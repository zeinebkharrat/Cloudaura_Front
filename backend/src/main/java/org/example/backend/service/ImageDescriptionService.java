package org.example.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class ImageDescriptionService {

    private static final Logger log = LoggerFactory.getLogger(ImageDescriptionService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String geminiApiKey;
    private final String geminiModel;

    public ImageDescriptionService(
            @Value("${app.gemini.api-key:}") String geminiApiKey,
            @Value("${app.gemini.model:gemini-3-flash-preview}") String geminiModel
    ) {
        this.geminiApiKey = geminiApiKey;
        this.geminiModel = geminiModel;

        this.objectMapper = new ObjectMapper();
        this.webClient = WebClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();

        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            log.warn("No Gemini API key configured for image description. Set app.gemini.api-key.");
        } else {
            log.info("Gemini image description service initialized with model: {}", geminiModel);
        }
    }

    public String describeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return "A brief product description could not be generated.";
        }
        try {
            return describeImageFromBytes(file.getBytes(), file.getOriginalFilename(), file.getContentType());
        } catch (IOException ex) {
            log.error("Failed to read image file", ex);
            throw new RuntimeException("Could not read uploaded image: " + ex.getMessage(), ex);
        }
    }

    public String describeImageFromLocalPath(Path filePath) throws IOException {
        if (filePath == null || !Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            throw new IllegalArgumentException("Local image file does not exist: " + filePath);
        }
        byte[] bytes = Files.readAllBytes(filePath);
        String filename = filePath.getFileName().toString();
        String contentType = Files.probeContentType(filePath);
        if (contentType == null || contentType.isBlank()) {
            contentType = "image/jpeg";
        }
        return describeImageFromBytes(bytes, filename, contentType);
    }

    private String describeImageFromBytes(byte[] bytes, String originalFilename, String contentType) {
        if (bytes == null || bytes.length == 0) {
            return "A brief product description could not be generated.";
        }
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            return "AI description is disabled because no Gemini API key is configured.";
        }

        try {
            return describeImageWithGemini(bytes, originalFilename, contentType);
        } catch (Exception ex) {
            log.error("Gemini API error", ex);
            throw new RuntimeException("Could not generate description from image: " + ex.getMessage(), ex);
        }
    }

    private String describeImageWithGemini(byte[] imageBytes, String originalFilename, String contentType) throws IOException {
        String mimeType = (contentType != null && !contentType.isBlank())
                ? contentType
                : "image/jpeg";

        String encodedImage = Base64.getEncoder().encodeToString(imageBytes);
        String prompt = "Generate a short, descriptive product description highlighting key features for this artisan product image. Keep it under 60 words, in English.";

        String requestBody = objectMapper.writeValueAsString(
            java.util.Map.of(
                "contents", List.of(
                    java.util.Map.of(
                        "parts", List.of(
                            java.util.Map.of("text", prompt),
                            java.util.Map.of(
                                "inlineData",
                                java.util.Map.of(
                                    "mimeType", mimeType,
                                    "data", encodedImage
                                )
                            )
                        )
                    )
                )
            )
        );

        String rawResponse = webClient.post()
            .uri(uriBuilder -> uriBuilder
                .path("/v1beta/models/{model}:generateContent")
                .queryParam("key", geminiApiKey)
                .build(geminiModel))
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(String.class)
            .block();

        if (rawResponse == null || rawResponse.isBlank()) {
            throw new RuntimeException("Gemini returned an empty response.");
        }

        JsonNode root = objectMapper.readTree(rawResponse);
        String text = root.path("candidates")
            .path(0)
            .path("content")
            .path("parts")
            .path(0)
            .path("text")
            .asText(null);

        if (text == null || text.isBlank()) {
            throw new RuntimeException("Gemini returned an empty response.");
        }
        return text.trim();
    }
}
