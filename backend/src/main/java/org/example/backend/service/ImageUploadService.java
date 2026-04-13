package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Base64;
import java.util.UUID;

@Service
public class ImageUploadService {

    private static final String IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";
    private static final Logger log = LoggerFactory.getLogger(ImageUploadService.class);

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper;

    @Value("${app.imgbb.api-key:${imgbb.api.key:}}")
    private String apiKey;

    @Value("${app.upload.max-image-bytes:5242880}")
    private long maxImageBytes;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public ImageUploadService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String uploadProfileImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.image.required");
        }
        if (file.getSize() > maxImageBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "api.error.image.too_large");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.image.type_invalid");
        }

        if (apiKey == null || apiKey.isBlank()) {
            return saveImageLocally(file);
        }

        try {
            return uploadToImgBb(file);
        } catch (ResponseStatusException ex) {
            log.warn("ImgBB upload failed, falling back to local storage: {}", ex.getReason());
            return saveImageLocally(file);
        }
    }

    private String uploadToImgBb(MultipartFile file) {

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
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "api.error.image.provider_rejected");
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
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "api.error.image.provider_no_url");
            }
            return urlNode.asText();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.image.read_failed");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "api.error.image.upload_interrupted");
        }
    }

    /**
     * Sans ImgBB : enregistre le fichier sous {@code uploads/profile-images/} et renvoie une URL courte
     * (évite les data URLs énormes en base — quiz cover, profil, etc.).
     */
    private String saveImageLocally(MultipartFile file) {
        if (file.getSize() > maxImageBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "api.error.image.too_large");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.image.type_invalid");
        }
        try {
            String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
            String ext = "";
            int dot = original.lastIndexOf('.');
            if (dot >= 0) {
                ext = original.substring(dot);
            }
            if (ext.isEmpty()) {
                ext = contentType.contains("png") ? ".png" : contentType.contains("gif") ? ".gif" : ".jpg";
            }
            String fileName = UUID.randomUUID() + ext;
            Path targetDir = Paths.get(uploadDir, "profile-images").toAbsolutePath().normalize();
            Files.createDirectories(targetDir);
            Path target = targetDir.resolve(fileName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/profile-images/" + fileName;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "api.error.image.save_failed");
        }
    }
}
