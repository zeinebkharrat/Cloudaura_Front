package org.example.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.google.genai.Client;
import com.google.genai.types.Blob;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;

@Service
public class ImageDescriptionService {

    private static final Logger log = LoggerFactory.getLogger(ImageDescriptionService.class);

    private final Client geminiClient;
    private final String geminiModel;

    public ImageDescriptionService(
            @Value("${app.gemini.api-key:}") String geminiApiKey,
            @Value("${app.gemini.model:gemini-3-flash-preview}") String geminiModel
    ) {
        this.geminiModel = geminiModel;

        Client client = null;
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                client = Client.builder()
                        .apiKey(geminiApiKey)
                        .build();
                log.info("Google Gemini client initialized successfully with model: {}", geminiModel);
            } catch (Exception e) {
                log.error("Failed to initialize Google Gemini client", e);
            }
        } else {
            log.warn("No Gemini API key configured for image description. Set app.gemini.api-key.");
        }
        this.geminiClient = client;
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
        if (geminiClient == null) {
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
        byte[] bytes = imageBytes;
        String mimeType = (contentType != null && !contentType.isBlank())
                ? contentType
                : "image/jpeg";

        Part textPart = Part.builder()
                .text("Generate a short, descriptive product description highlighting key features for this artisan product image. Keep it under 60 words, in English.")
                .build();

        Part imagePart = Part.builder()
                .inlineData(Blob.builder()
                        .mimeType(mimeType)
                        .data(bytes)
                        .build())
                .build();

        Content content = Content.builder()
                .parts(List.of(textPart, imagePart))
                .build();

        GenerateContentResponse response = geminiClient.models.generateContent(
                geminiModel,
                content,
                null
        );

        String text = response.text();
        if (text == null || text.isBlank()) {
            throw new RuntimeException("Gemini returned an empty response.");
        }
        return text.trim();
    }
}
