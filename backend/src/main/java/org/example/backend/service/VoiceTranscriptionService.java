package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.publicapi.VoiceTranscriptionResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VoiceTranscriptionService {

    private static final String ELEVENLABS_STT_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.voice.elevenlabs.api-key:${ELEVENLABS_API_KEY:}}")
    private String elevenLabsApiKey;

    @Value("${app.voice.elevenlabs.model-id:${ELEVENLABS_MODEL_ID:scribe_v1}}")
    private String elevenLabsModelId;

    @Value("${app.voice.max-audio-bytes:${APP_VOICE_MAX_AUDIO_BYTES:10485760}}")
    private long maxAudioBytes;

    public VoiceTranscriptionResponse transcribe(MultipartFile audioFile, String languageCode) {
        if (audioFile == null || audioFile.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Audio file is required");
        }
        if (audioFile.getSize() > maxAudioBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Audio file is too large");
        }
        if (elevenLabsApiKey == null || elevenLabsApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Voice provider is not configured");
        }

        final String boundary = "----cloudaura-" + UUID.randomUUID();

        try {
            byte[] body = buildMultipartBody(boundary, audioFile, languageCode);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(ELEVENLABS_STT_ENDPOINT))
                .header("xi-api-key", elevenLabsApiKey)
                .header("Accept", "application/json")
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, extractProviderError(response.body()));
            }

            JsonNode root = objectMapper.readTree(response.body());
            String transcript = firstNonBlank(
                root.path("text").asText(null),
                root.path("transcript").asText(null),
                root.path("data").path("text").asText(null)
            );

            if (transcript == null || transcript.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Voice provider returned an empty transcription");
            }

            String detectedLanguage = firstNonBlank(
                root.path("language_code").asText(null),
                root.path("language").asText(null),
                languageCode
            );

            return new VoiceTranscriptionResponse(transcript.trim(), detectedLanguage, "elevenlabs");
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read uploaded audio");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Voice transcription interrupted");
        }
    }

    private byte[] buildMultipartBody(String boundary, MultipartFile file, String languageCode) throws IOException {
        String fileName = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()
            ? "voice.webm"
            : file.getOriginalFilename();
        String contentType = file.getContentType() == null || file.getContentType().isBlank()
            ? "application/octet-stream"
            : file.getContentType();

        ByteArrayOutputStream out = new ByteArrayOutputStream();

        writeField(out, boundary, "model_id", elevenLabsModelId);
        if (languageCode != null && !languageCode.isBlank()) {
            writeField(out, boundary, "language_code", languageCode.trim());
        }

        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + sanitizeFileName(fileName) + "\"\r\n")
            .getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(file.getBytes());
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        return out.toByteArray();
    }

    private void writeField(ByteArrayOutputStream out, String boundary, String fieldName, String value) throws IOException {
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + fieldName + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(value.getBytes(StandardCharsets.UTF_8));
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String sanitizeFileName(String fileName) {
        return fileName.replace('"', '_').replace('\n', '_').replace('\r', '_');
    }

    private String extractProviderError(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            String message = firstNonBlank(
                root.path("detail").asText(null),
                root.path("error").path("message").asText(null),
                root.path("message").asText(null)
            );
            if (message != null) {
                return "Voice provider error: " + message;
            }
        } catch (Exception ignored) {
        }
        return "Voice provider rejected the request";
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
