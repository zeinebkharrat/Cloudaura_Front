package org.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class EventPosterAiService {

    private final RestTemplate restTemplate;

    @Value("${app.ai.google-vision.api-key:${GOOGLE_VISION_API_KEY:}}")
    private String googleVisionApiKey;

    public EventPosterAiService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String extractText(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required");
        }

        String apiKey = googleVisionApiKey == null ? "" : googleVisionApiKey.trim();
        if (apiKey.isBlank()) {
            throw new IllegalStateException("Google Vision API key is missing");
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
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read image bytes", ex);
        }
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
