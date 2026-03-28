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
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

@Service
public class ImgBbService {

    private final RestTemplate restTemplate;

    @Value("${imgbb.api.key:}")
    private String apiKey;

    @Value("${imgbb.base-url:https://api.imgbb.com/1/upload}")
    private String uploadUrl;

    public ImgBbService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String uploadImage(MultipartFile file) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("La clé ImgBB n'est pas configurée côté backend");
        }

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier image vide");
        }

        if (file.getSize() > 10L * 1024L * 1024L) {
            throw new IllegalArgumentException("Image trop volumineuse (max 10MB)");
        }

        try {
            try {
                return uploadWithMultipart(file);
            } catch (RestClientResponseException ex) {
                if (ex.getStatusCode().value() >= 500) {
                    return uploadWithBase64(file);
                }
                throw ex;
            }
        } catch (RestClientResponseException ex) {
            String details = ex.getResponseBodyAsString();
            String reason = details == null || details.isBlank() ? ex.getMessage() : details;
            throw new IllegalStateException("Upload ImgBB échoué: " + reason);
        } catch (IOException ex) {
            throw new IllegalStateException("Impossible de lire le fichier uploadé", ex);
        }
    }

    private String uploadWithMultipart(MultipartFile file) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("key", apiKey);
        body.add("image", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename() != null ? file.getOriginalFilename() : "city-media.jpg";
            }
        });
        if (file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()) {
            body.add("name", file.getOriginalFilename());
        }

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(uploadUrl, request, Map.class);
        return extractUrl(response.getBody());
    }

    private String uploadWithBase64(MultipartFile file) throws IOException {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("key", apiKey);
            body.add("image", Base64.getEncoder().encodeToString(file.getBytes()));
            if (file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()) {
                body.add("name", file.getOriginalFilename());
            }

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(uploadUrl, request, Map.class);
            return extractUrl(response.getBody());
    }

    private String extractUrl(Map<?, ?> payload) {
        if (payload == null || payload.get("data") == null) {
            throw new IllegalStateException("Réponse ImgBB invalide");
        }

        Map<?, ?> data = (Map<?, ?>) payload.get("data");
        Object url = data.get("url");
        if (url == null) {
            url = data.get("display_url");
        }
        if (url == null) {
            throw new IllegalStateException("URL image absente dans la réponse ImgBB");
        }
        return url.toString();
    }
}
