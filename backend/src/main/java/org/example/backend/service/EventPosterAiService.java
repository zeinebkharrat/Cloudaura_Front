package org.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class EventPosterAiService {

    private final RestTemplate restTemplate;

    @Value("${app.ai.google-vision.api-key:${GOOGLE_VISION_API_KEY:}}")
    private String googleVisionApiKey;

    @Value("${app.ai.ocr-space.api-key:${OCR_SPACE_API_KEY:helloworld}}")
    private String ocrSpaceApiKey;

    @Value("${app.ai.ocr-space.url:https://api.ocr.space/parse/image}")
    private String ocrSpaceUrl;

    @Value("${app.gemini.api-key:${GEMINI_API_KEY:}}")
    private String geminiApiKey;

    @Value("${app.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    public EventPosterAiService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String extractText(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required");
        }

        String extracted = tryGoogleVision(file);
        if (extracted != null && !extracted.isBlank()) {
            return extracted;
        }

        extracted = tryOcrSpace(file);
        if (extracted != null && !extracted.isBlank()) {
            return extracted;
        }

        extracted = tryGeminiVision(file);
        if (extracted != null && !extracted.isBlank()) {
            return extracted;
        }

        throw new IllegalStateException("AI extraction failed: no readable text found");
    }

    private String tryGoogleVision(MultipartFile file) {
        String apiKey = googleVisionApiKey == null ? "" : googleVisionApiKey.trim();
        if (apiKey.isBlank()) {
            return "";
        }

        try {
            String base64Image = Base64.getEncoder().encodeToString(file.getBytes());

            Map<String, Object> image = Map.of("content", base64Image);
            Map<String, Object> feature = Map.of("type", "TEXT_DETECTION", "maxResults", 1);
            Map<String, Object> request = Map.of(
                    "image", image,
                    "features", Collections.singletonList(feature)
            );
            Map<String, Object> payload = Map.of("requests", Collections.singletonList(request));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            String url = "https://vision.googleapis.com/v1/images:annotate?key=" + apiKey;
            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            return extractTextFromResponse(response.getBody());
        } catch (Exception ex) {
            return "";
        }
    }

    private String tryOcrSpace(MultipartFile file) {
        String apiKey = ocrSpaceApiKey == null ? "" : ocrSpaceApiKey.trim();
        if (apiKey.isBlank()) {
            return "";
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    String name = file.getOriginalFilename();
                    return name == null || name.isBlank() ? "poster.png" : name;
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("apikey", apiKey);
            body.add("language", "eng");
            body.add("isOverlayRequired", "false");
            body.add("file", resource);

            HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(ocrSpaceUrl, entity, Map.class);
            return extractTextFromOcrSpaceResponse(response.getBody());
        } catch (Exception ex) {
            return "";
        }
    }

    private String tryGeminiVision(MultipartFile file) {
        String apiKey = geminiApiKey == null ? "" : geminiApiKey.trim();
        if (apiKey.isBlank()) {
            return "";
        }

        try {
            String mimeType = file.getContentType();
            if (mimeType == null || mimeType.isBlank()) {
                mimeType = "image/jpeg";
            }
            String encoded = Base64.getEncoder().encodeToString(file.getBytes());

            Map<String, Object> textPart = new HashMap<>();
            textPart.put(
                    "text",
                    "You are an OCR engine. Extract all visible text from this poster image. "
                            + "Return only the extracted text with line breaks. "
                            + "Do not add explanations."
            );

            Map<String, Object> inlineData = new HashMap<>();
            inlineData.put("mimeType", mimeType);
            inlineData.put("data", encoded);

            Map<String, Object> imagePart = new HashMap<>();
            imagePart.put("inlineData", inlineData);

            List<Map<String, Object>> parts = new ArrayList<>();
            parts.add(textPart);
            parts.add(imagePart);

            Map<String, Object> content = new HashMap<>();
            content.put("parts", parts);

            Map<String, Object> payload = new HashMap<>();
            payload.put("contents", Collections.singletonList(content));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            String model = (geminiModel == null || geminiModel.trim().isBlank())
                    ? "gemini-2.5-flash"
                    : geminiModel.trim();
            String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                    + model
                    + ":generateContent?key="
                    + apiKey;

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            return extractTextFromGeminiResponse(response.getBody());
        } catch (Exception ex) {
            return "";
        }
    }

    private String extractTextFromGeminiResponse(Map body) {
        if (body == null) {
            return "";
        }

        Object candidatesObj = body.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) {
            return "";
        }

        Object firstCandidateObj = candidates.get(0);
        if (!(firstCandidateObj instanceof Map<?, ?> firstCandidate)) {
            return "";
        }

        Object contentObj = firstCandidate.get("content");
        if (!(contentObj instanceof Map<?, ?> content)) {
            return "";
        }

        Object partsObj = content.get("parts");
        if (!(partsObj instanceof List<?> parts) || parts.isEmpty()) {
            return "";
        }

        StringBuilder text = new StringBuilder();
        for (Object partObj : parts) {
            if (!(partObj instanceof Map<?, ?> part)) {
                continue;
            }
            Object partText = part.get("text");
            if (partText != null) {
                if (text.length() > 0) {
                    text.append('\n');
                }
                text.append(partText.toString().trim());
            }
        }

        return text.toString().trim();
    }

    private String extractTextFromOcrSpaceResponse(Map body) {
        if (body == null) {
            return "";
        }

        Object parsedResultsObj = body.get("ParsedResults");
        if (!(parsedResultsObj instanceof List<?> parsedResults) || parsedResults.isEmpty()) {
            return "";
        }

        StringBuilder text = new StringBuilder();
        for (Object entryObj : parsedResults) {
            if (!(entryObj instanceof Map<?, ?> entry)) {
                continue;
            }
            Object parsedText = entry.get("ParsedText");
            if (parsedText != null) {
                if (text.length() > 0) {
                    text.append('\n');
                }
                text.append(parsedText.toString().trim());
            }
        }

        return text.toString().trim();
    }

    private String extractTextFromResponse(Map body) {
        if (body == null) {
            return "";
        }

        Object responsesObj = body.get("responses");
        if (!(responsesObj instanceof List<?> responses) || responses.isEmpty()) {
            return "";
        }

        Object firstObj = responses.get(0);
        if (!(firstObj instanceof Map<?, ?> first)) {
            return "";
        }

        Object fullTextObj = first.get("fullTextAnnotation");
        if (fullTextObj instanceof Map<?, ?> fullTextMap) {
            Object text = fullTextMap.get("text");
            if (text != null) {
                return text.toString().trim();
            }
        }

        Object textAnnotationsObj = first.get("textAnnotations");
        if (textAnnotationsObj instanceof List<?> textAnnotations && !textAnnotations.isEmpty()) {
            Object firstAnnotationObj = textAnnotations.get(0);
            if (firstAnnotationObj instanceof Map<?, ?> firstAnnotation) {
                Object description = firstAnnotation.get("description");
                if (description != null) {
                    return description.toString().trim();
                }
            }
        }

        return "";
    }
}
