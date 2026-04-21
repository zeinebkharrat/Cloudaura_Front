package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class ActivityReceiptCloudinaryService {

    private final ObjectMapper objectMapper;

    @Value("${app.activity-receipt.cloudinary.cloud-name:${app.cloudinary.cloud-name:}}")
    private String cloudName;

    @Value("${app.activity-receipt.cloudinary.api-key:${app.cloudinary.api-key:}}")
    private String apiKey;

    @Value("${app.activity-receipt.cloudinary.api-secret:${app.cloudinary.api-secret:}}")
    private String apiSecret;

    @Value("${app.activity-receipt.cloudinary.folder:${app.cloudinary.receipts-folder:activity-receipts}}")
    private String receiptsFolder;

    private final WebClient webClient = WebClient.builder().build();

    public boolean isConfigured() {
        return cloudName != null && !cloudName.isBlank()
            && apiKey != null && !apiKey.isBlank()
            && apiSecret != null && !apiSecret.isBlank();
    }

    public String buildDeliveryUrl(Integer reservationId) {
        String publicId = buildPublicId(reservationId);
        return "https://res.cloudinary.com/" + cloudName.trim()
            + "/raw/upload/" + publicId + ".pdf";
    }

    public void uploadReceiptPdf(byte[] pdfBytes, Integer reservationId) {
        if (!isConfigured()) {
            throw new IllegalStateException("Cloudinary is not configured for activity receipts");
        }
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new IllegalArgumentException("PDF bytes are empty");
        }

        String publicId = buildPublicId(reservationId);
        long timestamp = Instant.now().getEpochSecond();

        Map<String, String> signParams = new TreeMap<>();
        signParams.put("invalidate", "true");
        signParams.put("overwrite", "true");
        signParams.put("public_id", publicId);
        signParams.put("timestamp", String.valueOf(timestamp));

        String signature = buildSignature(signParams, apiSecret.trim());

        ByteArrayResource pdfPart = new ByteArrayResource(pdfBytes) {
            @Override
            public String getFilename() {
                return "activity-receipt-ACT-" + reservationId + ".pdf";
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", pdfPart);
        body.add("api_key", apiKey.trim());
        body.add("timestamp", String.valueOf(timestamp));
        body.add("public_id", publicId);
        body.add("overwrite", "true");
        body.add("invalidate", "true");
        body.add("signature", signature);

        String response = webClient.post()
            .uri("https://api.cloudinary.com/v1_1/{cloud}/raw/upload", cloudName.trim())
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(BodyInserters.fromMultipartData(body))
            .retrieve()
            .bodyToMono(String.class)
            .block();

        validateUploadResponse(response, reservationId);
    }

    private String buildPublicId(Integer reservationId) {
        String folder = (receiptsFolder == null || receiptsFolder.isBlank())
            ? "activity-receipts"
            : receiptsFolder.trim();
        folder = folder.replace("\\", "/");
        while (folder.startsWith("/")) {
            folder = folder.substring(1);
        }
        while (folder.endsWith("/")) {
            folder = folder.substring(0, folder.length() - 1);
        }
        return folder + "/ACT-" + reservationId;
    }

    private String buildSignature(Map<String, String> sortedParams, String secret) {
        StringBuilder base = new StringBuilder();
        boolean first = true;
        for (Map.Entry<String, String> entry : sortedParams.entrySet()) {
            if (!first) {
                base.append('&');
            }
            first = false;
            base.append(entry.getKey()).append('=').append(entry.getValue());
        }
        base.append(secret);

        try {
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            byte[] hash = sha1.digest(base.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to sign Cloudinary upload", ex);
        }
    }

    private void validateUploadResponse(String responseBody, Integer reservationId) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new IllegalStateException("Cloudinary upload returned empty response");
        }

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String secureUrl = root.path("secure_url").asText("");
            if (secureUrl.isBlank()) {
                String error = root.path("error").path("message").asText("Unknown Cloudinary upload failure");
                throw new IllegalStateException(error);
            }
            log.info("Uploaded activity receipt PDF to Cloudinary for reservationId={}", reservationId);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not parse Cloudinary upload response", ex);
        }
    }
}
