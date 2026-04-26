package org.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

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

    @Value("${app.gemini.api-key:${GEMINI_API_KEY:}}")
    private String geminiApiKey;

    @Value("${app.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.ai.ocrspace.api-key:helloworld}")
    private String ocrSpaceApiKey;

    @Value("${app.ai.ocrspace.url:https://api.ocr.space/parse/image}")
    private String ocrSpaceUrl;

    public EventPosterAiService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String extractText(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required");
        }

        String visionKey = googleVisionApiKey == null ? "" : googleVisionApiKey.trim();
        String activeGeminiKey = geminiApiKey == null ? "" : geminiApiKey.trim();
        String activeOcrSpaceKey = ocrSpaceApiKey == null ? "" : ocrSpaceApiKey.trim();

        if (visionKey.isBlank() && activeGeminiKey.isBlank() && activeOcrSpaceKey.isBlank()) {
            throw new IllegalStateException("No OCR provider configured. Set app.ai.google-vision.api-key, app.gemini.api-key or app.ai.ocrspace.api-key");
        }

        try {
            byte[] imageBytes = file.getBytes();
            String visionFailure = null;
            String geminiFailure = null;
            String ocrSpaceFailure = null;

            if (!visionKey.isBlank()) {
                try {
                    String visionText = extractWithGoogleVision(imageBytes, visionKey);
                    if (visionText != null && !visionText.isBlank()) {
                        return visionText;
                    }
                } catch (Exception ex) {
                    visionFailure = providerFailureMessage("Google Vision", ex);
                }
            }

            if (!activeGeminiKey.isBlank()) {
                try {
                    String geminiText = extractWithGemini(imageBytes, file.getContentType(), activeGeminiKey);
                    if (geminiText != null && !geminiText.isBlank()) {
                        return geminiText;
                    }
                } catch (Exception ex) {
                    geminiFailure = providerFailureMessage("Gemini", ex);
                }
            }

            if (!activeOcrSpaceKey.isBlank()) {
                try {
                    String ocrSpaceText = extractWithOcrSpace(imageBytes, file.getOriginalFilename());
                    if (ocrSpaceText != null && !ocrSpaceText.isBlank()) {
                        return ocrSpaceText;
                    }
                } catch (Exception ex) {
                    ocrSpaceFailure = providerFailureMessage("OCR.Space", ex);
                }
            }

            if (visionFailure != null || geminiFailure != null || ocrSpaceFailure != null) {
                StringBuilder message = new StringBuilder("OCR providers failed");
                if (visionFailure != null) {
                    message.append(". ").append(visionFailure);
                }
                if (geminiFailure != null) {
                    message.append(". ").append(geminiFailure);
                }
                if (ocrSpaceFailure != null) {
                    message.append(". ").append(ocrSpaceFailure);
                }
                throw new IllegalStateException(message.toString());
            }

            return "";
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read image bytes", ex);
        }
    }

    private String extractWithGoogleVision(byte[] imageBytes, String apiKey) {
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);

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
        return extractTextFromGoogleVisionResponse(response.getBody());
    }

    private String extractWithGemini(byte[] imageBytes, String contentType, String apiKey) {
        String mimeType = (contentType == null || contentType.isBlank()) ? "image/jpeg" : contentType;
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> inlineData = Map.of(
                "mime_type", mimeType,
                "data", base64Image
        );
        Map<String, Object> textInstruction = Map.of(
                "text",
                "Extract all visible text from this event poster image. Return plain text only, preserving line breaks when possible."
        );
        Map<String, Object> imagePart = Map.of("inline_data", inlineData);
        Map<String, Object> userParts = Map.of("parts", List.of(textInstruction, imagePart));
        Map<String, Object> payload = Map.of("contents", Collections.singletonList(userParts));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        String base = geminiBaseUrl == null ? "https://generativelanguage.googleapis.com/v1beta" : geminiBaseUrl.trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String modelPath = (geminiModel != null && geminiModel.startsWith("models/"))
                ? geminiModel
                : "models/" + (geminiModel == null || geminiModel.isBlank() ? "gemini-2.5-flash" : geminiModel.trim());

        String url = base + "/" + modelPath + ":generateContent?key=" + apiKey;
        ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
        return extractTextFromGeminiResponse(response.getBody());
    }

    private String extractWithOcrSpace(byte[] imageBytes, String originalFilename) {
        String[] languages = new String[] {"eng", "fre", "ara"};
        String[] engines = new String[] {"2", "1"};
        String lastError = "";

        for (String language : languages) {
            for (String engine : engines) {
                Map<String, Object> responseBody = callOcrSpace(imageBytes, originalFilename, language, engine);
                String text = extractTextFromOcrSpaceResponse(responseBody);
                if (text != null && !text.isBlank()) {
                    return text;
                }
                String error = extractOcrSpaceError(responseBody);
                if (error != null && !error.isBlank()) {
                    lastError = language + "/" + engine + ": " + error;
                }
            }
        }

        if (!lastError.isBlank()) {
            throw new IllegalStateException(lastError);
        }
        return "";
    }

    private Map<String, Object> callOcrSpace(byte[] imageBytes, String originalFilename, String language, String engine) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        String safeName = (originalFilename == null || originalFilename.isBlank()) ? "poster.jpg" : originalFilename;
        ByteArrayResource resource = new ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return safeName;
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("apikey", ocrSpaceApiKey);
        body.add("language", language);
        body.add("isOverlayRequired", "false");
        body.add("OCREngine", engine);
        body.add("detectOrientation", "true");
        body.add("scale", "true");
        body.add("file", resource);

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(ocrSpaceUrl, request, Map.class);
        return response.getBody();
    }

    private String providerFailureMessage(String providerName, Exception ex) {
        String details = "";
        if (ex instanceof RestClientResponseException restEx) {
            String responseBody = restEx.getResponseBodyAsString();
            if (responseBody != null && !responseBody.isBlank()) {
                details = "HTTP " + restEx.getStatusCode().value() + " " + responseBody;
            } else {
                details = "HTTP " + restEx.getStatusCode().value();
            }
        }

        if (details.isBlank()) {
            details = ex.getMessage() == null ? "Unknown error" : ex.getMessage();
        }

        if (details.length() > 500) {
            details = details.substring(0, 500) + "...";
        }
        return providerName + " failed: " + details;
    }

    private String extractTextFromGoogleVisionResponse(Map body) {
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

    private String extractTextFromGeminiResponse(Map body) {
        if (body == null) {
            return "";
        }

        Object candidatesObj = body.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) {
            return "";
        }

        Object firstObj = candidates.get(0);
        if (!(firstObj instanceof Map<?, ?> first)) {
            return "";
        }

        Object contentObj = first.get("content");
        if (!(contentObj instanceof Map<?, ?> contentMap)) {
            return "";
        }

        Object partsObj = contentMap.get("parts");
        if (!(partsObj instanceof List<?> parts) || parts.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        for (Object partObj : parts) {
            if (partObj instanceof Map<?, ?> partMap) {
                Object textObj = partMap.get("text");
                if (textObj != null) {
                    if (!sb.isEmpty()) {
                        sb.append('\n');
                    }
                    sb.append(textObj.toString());
                }
            }
        }

        return sb.toString().trim();
    }

    private String extractTextFromOcrSpaceResponse(Map body) {
        if (body == null) {
            return "";
        }

        Object parsedResultsObj = body.get("ParsedResults");
        if (!(parsedResultsObj instanceof List<?> parsedResults) || parsedResults.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        for (Object parsedObj : parsedResults) {
            if (parsedObj instanceof Map<?, ?> parsedMap) {
                Object parsedTextObj = parsedMap.get("ParsedText");
                if (parsedTextObj != null) {
                    String parsedText = parsedTextObj.toString().trim();
                    if (!parsedText.isBlank()) {
                        if (!sb.isEmpty()) {
                            sb.append('\n');
                        }
                        sb.append(parsedText);
                    }
                }
            }
        }
        return sb.toString().trim();
    }

    private String extractOcrSpaceError(Map body) {
        if (body == null) {
            return "";
        }

        Object topError = body.get("ErrorMessage");
        if (topError instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        if (topError instanceof List<?> list && !list.isEmpty()) {
            String merged = list.stream()
                    .filter(item -> item != null)
                    .map(Object::toString)
                    .filter(text -> !text.isBlank())
                    .reduce("", (a, b) -> a.isBlank() ? b : a + " " + b)
                    .trim();
            if (!merged.isBlank()) {
                return merged;
            }
        }

        Object details = body.get("ErrorDetails");
        if (details instanceof String detailText && !detailText.isBlank()) {
            return detailText.trim();
        }

        Object isErrored = body.get("IsErroredOnProcessing");
        if (Boolean.TRUE.equals(isErrored)) {
            return "OCR.Space could not process this image";
        }

        return "";
    }
}
