package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Base64;

@Service
public class ImageUploadService {

    private static final String IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper;

    @Value("${app.imgbb.api-key:}")
    private String apiKey;

    @Value("${app.upload.max-image-bytes:5242880}")
    private long maxImageBytes;

    public ImageUploadService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String uploadProfileImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "ImgBB API key is not configured");
        }
        if (file.getSize() > maxImageBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Image exceeds allowed size");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Only image files are accepted");
        }

        try {
            String base64Image = Base64.getEncoder().encodeToString(file.getBytes());
            String requestBody = "image=" + URLEncoder.encode(base64Image, StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(IMGBB_ENDPOINT + "?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8)))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image upload provider rejected the request");
            }

            JsonNode root = objectMapper.readTree(response.body());
            if (!root.path("success").asBoolean(true)) {
                String msg = root.path("error").path("message").asText();
                if (msg == null || msg.isBlank()) {
                    msg = root.path("status_txt").asText("ImgBB upload failed");
                }
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, msg);
            }

            JsonNode urlNode = root.path("data").path("url");
            if (urlNode.isMissingNode() || urlNode.asText().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image upload provider did not return a URL");
            }
            return urlNode.asText();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded file");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Image upload interrupted");
        }
    }
}
