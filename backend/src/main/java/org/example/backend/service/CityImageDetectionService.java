package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityResponse;
import org.example.backend.dto.publicapi.CityImageDetectionResponse;
import org.example.backend.model.City;
import org.example.backend.repository.CityRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CityImageDetectionService {

    private final CityRepository cityRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.zenserp.base-url:https://app.zenserp.com/api/v2}")
    private String zenserpBaseUrl;

    @Value("${app.zenserp.api-key:}")
    private String zenserpApiKey;

    @Value("${imgbb.base-url:https://api.imgbb.com/1/upload}")
    private String imgbbBaseUrl;

    @Value("${imgbb.api.key:}")
    private String imgbbApiKey;

    @Value("${app.image-detection.max-image-bytes:5242880}")
    private long maxImageBytes;

    public CityImageDetectionResponse detectFromImage(MultipartFile image) {
        validateInput(image);

        try {
            String geminiFailureMessage = null;

            if (geminiApiKey != null && !geminiApiKey.isBlank()) {
                try {
                    GeminiCitySignal signal = queryGeminiCitySignal(image);
                    if (!signal.cityName().isBlank()) {
                        MatchResult match = findBestCityFromCandidate(signal.cityName(), signal.evidence());
                        if (match == null && !signal.evidence().isBlank()) {
                            match = findBestCityFromText(normalize(signal.evidence()));
                        }

                        if (match != null) {
                            CityResponse cityResponse = toCityResponse(match.city());
                            double confidence = clamp(Math.max(signal.confidence(), Math.min(match.score(), 1.0)));
                            return new CityImageDetectionResponse(true, cityResponse, confidence, "City detected successfully.");
                        }
                    }
                } catch (ResponseStatusException ex) {
                    geminiFailureMessage = ex.getReason();
                } catch (Exception ex) {
                    geminiFailureMessage = "Gemini image provider is unavailable.";
                }
            }

            if (zenserpApiKey != null && !zenserpApiKey.isBlank()) {
                String imageUrl = uploadToImgbb(image);
                String payload = queryZenserp(imageUrl);
                String normalizedText = parseZenserpText(payload);

                MatchResult fallbackMatch = findBestCityFromText(normalizedText);
                if (fallbackMatch != null) {
                    CityResponse cityResponse = toCityResponse(fallbackMatch.city());
                    return new CityImageDetectionResponse(
                        true,
                        cityResponse,
                        clamp(Math.min(0.88, fallbackMatch.score())),
                        "City detected successfully."
                    );
                }
            }

            if (geminiFailureMessage != null && !geminiFailureMessage.isBlank()) {
                return new CityImageDetectionResponse(false, null, 0.0, geminiFailureMessage);
            }

            return new CityImageDetectionResponse(false, null, 0.0, "No corresponding city found for this image.");
        } catch (ResponseStatusException ex) {
            return new CityImageDetectionResponse(
                false,
                null,
                0.0,
                ex.getReason() != null ? ex.getReason() : "No corresponding city found for this image."
            );
        } catch (Exception ex) {
            return new CityImageDetectionResponse(false, null, 0.0, "No corresponding city found for this image.");
        }
    }

    private void validateInput(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required.");
        }

        if (image.getSize() > maxImageBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image is too large.");
        }

        String contentType = image.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only image files are supported.");
        }
    }

    private GeminiCitySignal queryGeminiCitySignal(MultipartFile image) throws IOException, InterruptedException {
        String base = geminiBaseUrl.endsWith("/") ? geminiBaseUrl.substring(0, geminiBaseUrl.length() - 1) : geminiBaseUrl;
        List<String> modelCandidates = buildGeminiModelCandidates(base);

        String requestBody = buildGeminiRequestBody(image);
        String lastError = "Gemini image provider is unavailable.";

        for (String modelPath : modelCandidates) {
            String endpoint = base + "/" + modelPath + ":generateContent?key=" + encode(geminiApiKey);
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("x-goog-api-key", geminiApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                lastError = parseGeminiError(response.body());
                continue;
            }

            JsonNode responseJson = objectMapper.readTree(response.body());
            String textPayload = extractGeminiText(responseJson);
            if (textPayload.isBlank()) {
                continue;
            }

            String rawJson = extractJsonObject(textPayload);
            if (rawJson.isBlank()) {
                return new GeminiCitySignal("", 0.0, textPayload);
            }

            JsonNode parsed = objectMapper.readTree(rawJson);
            String cityName = parsed.path("city").asText("").trim();
            String evidence = parsed.path("evidence").asText("").trim();
            double confidence = clamp(parsed.path("confidence").asDouble(0.0));
            return new GeminiCitySignal(cityName, confidence, evidence);
        }

        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, lastError);
    }

    private List<String> buildGeminiModelCandidates(String base) throws IOException, InterruptedException {
        List<String> candidates = new ArrayList<>();
        addModelCandidate(candidates, geminiModel);

        HttpRequest listRequest = HttpRequest.newBuilder()
            .uri(URI.create(base + "/models?key=" + encode(geminiApiKey)))
            .header("Accept", "application/json")
            .header("x-goog-api-key", geminiApiKey)
            .GET()
            .build();

        HttpResponse<String> listResponse = httpClient.send(listRequest, HttpResponse.BodyHandlers.ofString());
        if (listResponse.statusCode() >= 200 && listResponse.statusCode() < 300 && listResponse.body() != null && !listResponse.body().isBlank()) {
            JsonNode root = objectMapper.readTree(listResponse.body());
            JsonNode models = root.path("models");
            if (models.isArray()) {
                for (JsonNode modelNode : models) {
                    String name = modelNode.path("name").asText("").trim();
                    if (name.isBlank()) {
                        continue;
                    }

                    boolean supportsGenerate = false;
                    JsonNode methods = modelNode.path("supportedGenerationMethods");
                    if (methods.isArray()) {
                        for (JsonNode method : methods) {
                            if ("generateContent".equalsIgnoreCase(method.asText(""))) {
                                supportsGenerate = true;
                                break;
                            }
                        }
                    }

                    if (supportsGenerate && name.startsWith("models/gemini")) {
                        addModelCandidate(candidates, name);
                    }
                }
            }
        }

        addModelCandidate(candidates, "models/gemini-1.5-flash");
        addModelCandidate(candidates, "models/gemini-1.5-flash-latest");
        addModelCandidate(candidates, "models/gemini-2.0-flash");
        return candidates;
    }

    private void addModelCandidate(List<String> sink, String model) {
        if (model == null || model.isBlank()) {
            return;
        }

        String normalized = model.trim();
        if (!normalized.startsWith("models/")) {
            normalized = "models/" + normalized;
        }

        if (!sink.contains(normalized)) {
            sink.add(normalized);
        }
    }

    private String buildGeminiRequestBody(MultipartFile image) throws IOException {
        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode contents = root.putArray("contents");
        ObjectNode userContent = contents.addObject();
        ArrayNode parts = userContent.putArray("parts");

        parts.addObject().put(
            "text",
            "You are a Tunisia tourism image analyst. Identify which Tunisian city best matches this image. "
                + "Return STRICT JSON only with this schema: "
                + "{\"city\":\"<city-name-or-empty>\",\"confidence\":<0-to-1>,\"evidence\":\"<short reason>\"}. "
                + "If unsure, set city to empty string and confidence <= 0.35."
        );

        ObjectNode imagePart = parts.addObject();
        ObjectNode inlineData = imagePart.putObject("inline_data");
        inlineData.put("mime_type", image.getContentType() == null ? "image/jpeg" : image.getContentType());
        inlineData.put("data", Base64.getEncoder().encodeToString(image.getBytes()));

        ObjectNode generationConfig = root.putObject("generationConfig");
        generationConfig.put("temperature", 0.1);

        return objectMapper.writeValueAsString(root);
    }

    private String parseGeminiError(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "Gemini image provider is unavailable.";
        }

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String message = root.path("error").path("message").asText("").trim();
            if (!message.isBlank()) {
                return "Gemini error: " + message;
            }
        } catch (Exception ignored) {
            // keep generic message if response is not valid JSON
        }

        return "Gemini image provider is unavailable.";
    }

    private String uploadToImgbb(MultipartFile image) throws IOException, InterruptedException {
        if (imgbbApiKey == null || imgbbApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Image hosting service is not configured.");
        }

        String base64Image = Base64.getEncoder().encodeToString(image.getBytes());
        String body = "key=" + encode(imgbbApiKey) + "&image=" + encode(base64Image);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(imgbbBaseUrl))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image upload failed.");
        }

        JsonNode root = objectMapper.readTree(response.body());
        String imageUrl = root.path("data").path("url").asText("");
        if (imageUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image upload failed.");
        }

        return imageUrl;
    }

    private String queryZenserp(String imageUrl) throws IOException, InterruptedException {
        String base = zenserpBaseUrl.endsWith("/") ? zenserpBaseUrl.substring(0, zenserpBaseUrl.length() - 1) : zenserpBaseUrl;
        List<String> uris = List.of(
            base + "/search?apikey=" + encode(zenserpApiKey) + "&engine=google_lens&url=" + encode(imageUrl) + "&hl=en",
            base + "/search?apikey=" + encode(zenserpApiKey) + "&engine=google_lens&image_url=" + encode(imageUrl) + "&hl=en",
            base + "/search?engine=google_lens&url=" + encode(imageUrl) + "&hl=en",
            base + "/search?engine=google_lens&image_url=" + encode(imageUrl) + "&hl=en"
        );

        String payload = null;
        for (String uri : uris) {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(uri))
                .header("Accept", "application/json")
                .header("apikey", zenserpApiKey)
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && response.body() != null && !response.body().isBlank()) {
                payload = response.body();
                break;
            }
        }

        if (payload == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image search provider is unavailable.");
        }

        return payload;
    }

    private String parseZenserpText(String payload) throws IOException {
        JsonNode root = objectMapper.readTree(payload);
        List<String> collected = new ArrayList<>();
        collectTextNodes(root.path("knowledge_graph"), collected);
        collectTextNodes(root.path("visual_matches"), collected);
        collectTextNodes(root.path("related_searches"), collected);
        collectTextNodes(root.path("inline_images"), collected);
        collectTextNodes(root.path("organic"), collected);

        if (collected.isEmpty()) {
            collectTextNodes(root, collected);
        }

        return normalize(String.join(" ", collected));
    }

    private void collectTextNodes(JsonNode node, List<String> sink) {
        if (node == null || node.isNull()) {
            return;
        }

        if (node.isTextual()) {
            sink.add(node.asText(""));
            return;
        }

        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                JsonNode value = entry.getValue();
                if (value.isTextual()) {
                    sink.add(value.asText(""));
                }
                collectTextNodes(value, sink);
            });
            return;
        }

        if (node.isArray()) {
            for (JsonNode child : node) {
                collectTextNodes(child, sink);
            }
        }
    }

    private String extractGeminiText(JsonNode responseJson) {
        JsonNode candidates = responseJson.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return "";
        }

        StringBuilder text = new StringBuilder();
        for (JsonNode candidate : candidates) {
            JsonNode parts = candidate.path("content").path("parts");
            if (!parts.isArray()) {
                continue;
            }
            for (JsonNode part : parts) {
                String partText = part.path("text").asText("");
                if (!partText.isBlank()) {
                    if (!text.isEmpty()) {
                        text.append('\n');
                    }
                    text.append(partText);
                }
            }
        }

        return text.toString().trim();
    }

    private String extractJsonObject(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        String cleaned = value.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceAll("^```[a-zA-Z]*\\s*", "");
            cleaned = cleaned.replaceAll("\\s*```$", "");
        }

        Pattern pattern = Pattern.compile("\\{[\\s\\S]*}");
        Matcher matcher = pattern.matcher(cleaned);
        if (matcher.find()) {
            return matcher.group();
        }
        return "";
    }

    private MatchResult findBestCityFromCandidate(String candidateCityName, String evidenceText) {
        String normalizedCandidate = normalize(candidateCityName);
        if (normalizedCandidate.isBlank()) {
            return null;
        }

        List<City> cities = cityRepository.findAll();
        MatchResult best = null;
        String normalizedEvidence = normalize(evidenceText);

        for (City city : cities) {
            if (city.getName() == null || city.getName().isBlank()) {
                continue;
            }
            if (city.isExcludedFromPublicCityCatalog()) {
                continue;
            }

            String cityName = normalize(city.getName());
            String regionName = normalize(city.getRegion());
            double score = 0.0;

            if (normalizedCandidate.equals(cityName)) {
                score += 1.0;
            } else if (containsToken(normalizedCandidate, cityName) || containsToken(cityName, normalizedCandidate)) {
                score += 0.82;
            }

            if (!regionName.isBlank() && containsToken(normalizedCandidate, regionName)) {
                score += 0.15;
            }

            if (!normalizedEvidence.isBlank() && containsToken(normalizedEvidence, cityName)) {
                score += 0.2;
            }

            if (score < 0.65) {
                continue;
            }

            if (best == null || score > best.score()) {
                best = new MatchResult(city, score);
            }
        }

        return best;
    }

    private MatchResult findBestCityFromText(String normalizedContent) {
        if (normalizedContent == null || normalizedContent.isBlank()) {
            return null;
        }

        List<City> cities = cityRepository.findAll();
        MatchResult best = null;

        for (City city : cities) {
            if (city.getName() == null || city.getName().isBlank()) {
                continue;
            }
            if (city.isExcludedFromPublicCityCatalog()) {
                continue;
            }

            String cityName = normalize(city.getName());
            String regionName = normalize(city.getRegion());
            double score = 0.0;

            int cityMentions = countTokenOccurrences(normalizedContent, cityName);
            if (cityMentions > 0) {
                score += 0.8 + Math.min(0.35, cityMentions * 0.07);
            }

            if (!regionName.isBlank() && containsToken(normalizedContent, regionName)) {
                score += 0.2;
            }

            if (score < 0.65) {
                continue;
            }

            if (best == null || score > best.score()) {
                best = new MatchResult(city, score);
            }
        }

        return best;
    }

    private int countTokenOccurrences(String haystack, String token) {
        if (haystack == null || token == null || token.isBlank()) {
            return 0;
        }

        int count = 0;
        String padded = " " + haystack + " ";
        String needle = " " + token + " ";
        int index = 0;

        while (true) {
            index = padded.indexOf(needle, index);
            if (index < 0) {
                break;
            }
            count++;
            index += needle.length();
        }

        return count;
    }

    private boolean containsToken(String haystack, String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        return haystack.equals(token)
            || haystack.contains(" " + token + " ")
            || haystack.startsWith(token + " ")
            || haystack.endsWith(" " + token);
    }

    private CityResponse toCityResponse(City city) {
        return new CityResponse(
            city.getCityId(),
            city.getName(),
            city.getRegion(),
            city.getDescription(),
            city.getLatitude(),
            city.getLongitude()
        );
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9\\s]", " ")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private double clamp(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private record MatchResult(City city, double score) {
    }

    private record GeminiCitySignal(String cityName, double confidence, String evidence) {
    }
}
