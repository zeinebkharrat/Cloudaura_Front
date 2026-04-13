package org.example.backend.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

@Service
public class StreamChatService {

    private final RestTemplate restTemplate;

    @Value("${app.stream.chat.api-key:${STREAM_CHAT_API_KEY:}}")
    private String apiKey;

    @Value("${app.stream.chat.secret:${STREAM_CHAT_SECRET:}}")
    private String secret;

    @Value("${app.stream.chat.base-url:https://chat.stream-io-api.com}")
    private String baseUrl;

    @Value("${app.upload.dir:uploads}")
    private String uploadRootDir;

    public StreamChatService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String uploadVoiceFile(MultipartFile file, Integer userId) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Audio file is required");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType();
        if (!contentType.toLowerCase().startsWith("audio/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only audio files are allowed");
        }
        if (apiKey == null || apiKey.isBlank() || secret == null || secret.isBlank()) {
            return saveVoiceLocally(file);
        }

        String authToken = createStreamUserToken(String.valueOf(userId));

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", authToken);
        headers.set("Stream-Auth-Type", "jwt");
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        try {
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    String original = file.getOriginalFilename();
                    return (original == null || original.isBlank()) ? "voice-message.webm" : original;
                }
            });
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded audio");
        }

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        String url = UriComponentsBuilder
                .fromHttpUrl(baseUrl + "/uploads/file")
                .queryParam("api_key", apiKey)
                .toUriString();

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, requestEntity, Map.class);
            Map<?, ?> payload = response.getBody();
            if (payload == null) {
                return saveVoiceLocally(file);
            }

            Object fileUrl = payload.get("file");
            if (!(fileUrl instanceof String) || ((String) fileUrl).isBlank()) {
                return saveVoiceLocally(file);
            }
            return (String) fileUrl;
        } catch (HttpStatusCodeException ex) {
            // Stream can reject some file types; fallback to local storage instead of failing chat UX.
            return saveVoiceLocally(file);
        } catch (Exception ex) {
            return saveVoiceLocally(file);
        }
    }

    private String saveVoiceLocally(MultipartFile file) {
        try {
            Path root = Paths.get(System.getProperty("user.dir"), uploadRootDir, "voice-messages");
            Files.createDirectories(root);

            String original = file.getOriginalFilename();
            String safeOriginal = (original == null ? "voice.webm" : original)
                    .replaceAll("[^a-zA-Z0-9._-]", "_");
            if (safeOriginal.length() > 100) {
                safeOriginal = safeOriginal.substring(safeOriginal.length() - 100);
            }

            String stored = UUID.randomUUID() + "_" + safeOriginal;
            Path target = root.resolve(stored);
            file.transferTo(target);

            return "/uploads/voice-messages/" + stored;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Voice upload failed");
        }
    }

    private String createStreamUserToken(String userId) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + 3600_000L);

        return Jwts.builder()
                .claim("user_id", userId)
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(SignatureAlgorithm.HS256, secret.getBytes(StandardCharsets.UTF_8))
                .compact();
    }
}
