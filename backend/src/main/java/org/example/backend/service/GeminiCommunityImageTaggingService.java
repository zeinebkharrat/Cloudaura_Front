package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GeminiCommunityImageTaggingService {

    private static final Logger log = LoggerFactory.getLogger(GeminiCommunityImageTaggingService.class);
    private static final String GEMINI_URL_TEMPLATE = "https://generativelanguage.googleapis.com/%s/models/%s:generateContent?key=%s";
    private static final List<String> API_VERSIONS = List.of("v1beta", "v1");
    private static final List<String> FALLBACK_MODELS = List.of(
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash-001",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash-8b-latest",
            "gemini-1.5-flash-8b",
            "gemini-1.5-flash"
    );
        private static final Pattern RETRY_DELAY_SECONDS_PATTERN = Pattern.compile("\\\"retryDelay\\\"\\s*:\\s*\\\"(\\d+)s\\\"");
        private static final long DEFAULT_RETRY_DELAY_SECONDS = 60L;

    private static final List<String> ALLOWED_CATEGORIES = List.of(
            "dessert", "food", "beach", "mountain", "forest", "desert", "sea", "lake", "river", "waterfall",
            "island", "snow", "nature", "sunset", "night", "city", "village", "street", "architecture", "travel",
            "restaurant", "cafe", "hotel", "camping", "museum", "park", "shopping", "sports", "people", "animal",
            "vehicle", "festival", "art"
    );

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${gemini.api.key.community:${GEMINI_API_KEY_COMMUNITY:}}")
    private String geminiApiKey;

    @Value("${gemini.api.model.community:${GEMINI_API_MODEL_COMMUNITY:gemini-1.5-flash-latest}}")
    private String configuredModel;

    private volatile Instant geminiCooldownUntil = Instant.EPOCH;

    public GeminiCommunityImageTaggingService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<String> classifyImageCategories(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return List.of();
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            return List.of();
        }

        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            log.warn("Gemini key is missing (gemini.api.key.community), skipping image classification");
            return List.of();
        }

        if (Instant.now().isBefore(geminiCooldownUntil)) {
            return List.of();
        }

        try {
            String base64Image = Base64.getEncoder().encodeToString(file.getBytes());
            String prompt = buildPrompt();

            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(
                            Map.of(
                                    "parts", List.of(
                                            Map.of("text", prompt),
                                            Map.of("inline_data", Map.of(
                                                    "mime_type", contentType,
                                                    "data", base64Image
                                            ))
                                    )
                            )
                    )
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            for (String model : resolveModelOrder()) {
                for (String apiVersion : API_VERSIONS) {
                    String url = String.format(GEMINI_URL_TEMPLATE, apiVersion, model, geminiApiKey);
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> response = restTemplate.postForObject(url, entity, Map.class);
                        String modelText = extractModelText(response);
                        List<String> categories = parseCategories(modelText);
                        if (!categories.isEmpty()) {
                            return categories;
                        }
                    } catch (HttpClientErrorException.NotFound notFound) {
                        log.debug("Gemini model {} is unavailable on API {}", model, apiVersion);
                    } catch (HttpClientErrorException.TooManyRequests tooManyRequests) {
                        long retrySeconds = extractRetryDelaySeconds(tooManyRequests);
                        geminiCooldownUntil = Instant.now().plusSeconds(retrySeconds);
                        log.warn("Gemini quota exceeded. Auto-tagging paused for {}s", retrySeconds);
                        return List.of();
                    } catch (HttpClientErrorException.BadRequest badRequest) {
                        log.warn("Gemini rejected request for model {} on {}: {}", model, apiVersion, badRequest.getStatusText());
                    } catch (RestClientException ex) {
                        log.warn("Gemini request failed for model {} on {}: {}", model, apiVersion, ex.getMessage());
                    }
                }
            }

            log.warn("No supported Gemini model found for community image classification");
            return List.of();
        } catch (IOException | RestClientException ex) {
            log.warn("Failed to classify uploaded image with Gemini: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<String> resolveModelOrder() {
        LinkedHashMap<String, Boolean> ordered = new LinkedHashMap<>();
        String first = configuredModel == null ? "" : configuredModel.trim();
        if (!first.isEmpty()) {
            ordered.put(first, Boolean.TRUE);
        }
        for (String model : FALLBACK_MODELS) {
            ordered.put(model, Boolean.TRUE);
        }
        return new ArrayList<>(ordered.keySet());
    }

    private long extractRetryDelaySeconds(HttpClientErrorException ex) {
        String body = ex.getResponseBodyAsString();
        if (body != null && !body.isBlank()) {
            Matcher matcher = RETRY_DELAY_SECONDS_PATTERN.matcher(body);
            if (matcher.find()) {
                try {
                    long parsed = Long.parseLong(matcher.group(1));
                    return Math.max(parsed, 5L);
                } catch (NumberFormatException ignored) {
                    // Ignore malformed values and use default below.
                }
            }
        }
        return DEFAULT_RETRY_DELAY_SECONDS;
    }

    private String buildPrompt() {
        return "You are classifying one social-media travel photo. "
                + "Return ONLY strict JSON in this shape: {\"categories\":[\"...\"]}. "
                + "Choose up to 3 categories from this list only: "
                + String.join(", ", ALLOWED_CATEGORIES)
                + ". If unsure, return [\"travel\"].";
    }

    private String extractModelText(Map<String, Object> response) {
        if (response == null) {
            return "";
        }

        Object candidatesObj = response.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) {
            return "";
        }

        Object firstCandidate = candidates.get(0);
        if (!(firstCandidate instanceof Map<?, ?> candidateMap)) {
            return "";
        }

        Object contentObj = candidateMap.get("content");
        if (!(contentObj instanceof Map<?, ?> contentMap)) {
            return "";
        }

        Object partsObj = contentMap.get("parts");
        if (!(partsObj instanceof List<?> parts) || parts.isEmpty()) {
            return "";
        }

        Object firstPart = parts.get(0);
        if (!(firstPart instanceof Map<?, ?> partMap)) {
            return "";
        }

        Object textObj = partMap.get("text");
        return textObj == null ? "" : textObj.toString();
    }

    private List<String> parseCategories(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return List.of();
        }

        String cleaned = rawText
                .replace("```json", "")
                .replace("```", "")
                .trim();

        Set<String> allowedSet = new LinkedHashSet<>(ALLOWED_CATEGORIES);
        Set<String> picked = new LinkedHashSet<>();

        try {
            JsonNode root = objectMapper.readTree(cleaned);
            JsonNode categories = root.path("categories");
            if (categories.isArray()) {
                for (JsonNode node : categories) {
                    String normalized = normalizeCategory(node.asText());
                    if (!normalized.isBlank() && allowedSet.contains(normalized)) {
                        picked.add(normalized);
                    }
                }
            }
        } catch (Exception ignored) {
            String[] tokens = cleaned.split("[,\\n\\r\\t ]+");
            for (String token : tokens) {
                String normalized = normalizeCategory(token);
                if (!normalized.isBlank() && allowedSet.contains(normalized)) {
                    picked.add(normalized);
                }
            }
        }

        if (picked.isEmpty()) {
            picked.add("travel");
        }

        List<String> list = new ArrayList<>(picked);
        return list.size() <= 3 ? list : list.subList(0, 3);
    }

    private String normalizeCategory(String input) {
        if (input == null) {
            return "";
        }

        return input
                .toLowerCase(Locale.ROOT)
                .trim()
                .replace("#", "")
                .replaceAll("[\\\"'{}\\[\\]:]", "")
                .replaceAll("[^a-z]", "");
    }
}
