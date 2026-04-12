package org.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class HuggingFacePosterService {

    private final RestTemplate restTemplate;

    @Value("${app.ai.huggingface.api-key:${HUGGINGFACE_API_KEY:${HF_TOKEN:}}}")
    private String huggingFaceApiKey;

    @Value("${app.ai.huggingface.model:black-forest-labs/FLUX.1-schnell}")
    private String huggingFaceModel;

    @Value("${app.ai.huggingface.fallback-models:}")
    private String huggingFaceFallbackModels;

    @Value("${app.ai.huggingface.base-url:https://router.huggingface.co/hf-inference/models}")
    private String huggingFaceBaseUrl;

    @Value("${app.ai.huggingface.accept:image/png}")
    private String huggingFaceAccept;

    @Value("${app.ai.huggingface.negative-prompt:text, bad letters, spelling, letters, numbers, watermarks, signature}")
    private String huggingFaceNegativePrompt;

    public HuggingFacePosterService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public byte[] generatePoster(String prompt) {
        String key = huggingFaceApiKey == null ? "" : huggingFaceApiKey.trim();
        if (key.isBlank()) {
            throw new IllegalStateException(
                    "Hugging Face API key is missing. Set app.ai.huggingface.api-key " +
                    "or env var HUGGINGFACE_API_KEY / HF_TOKEN."
            );
        }
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Prompt cannot be empty");
        }

        String primaryModel = huggingFaceModel == null || huggingFaceModel.isBlank()
            ? "black-forest-labs/FLUX.1-schnell"
            : huggingFaceModel.trim();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(key);
        headers.setContentType(MediaType.APPLICATION_JSON);
        String accept = huggingFaceAccept == null || huggingFaceAccept.isBlank()
            ? "image/png"
            : huggingFaceAccept.trim();
        headers.setAccept(Collections.singletonList(MediaType.parseMediaType(accept)));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("inputs", prompt);
        payload.put("options", Map.of("wait_for_model", true));

        String negativePrompt = huggingFaceNegativePrompt == null ? "" : huggingFaceNegativePrompt.trim();
        if (!negativePrompt.isBlank()) {
            payload.put("parameters", Map.of("negative_prompt", negativePrompt));
        }

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        Set<String> candidateModels = new LinkedHashSet<>();
        candidateModels.add(primaryModel);
        if (huggingFaceFallbackModels != null && !huggingFaceFallbackModels.isBlank()) {
            for (String candidate : huggingFaceFallbackModels.split(",")) {
                String trimmed = candidate == null ? "" : candidate.trim();
                if (!trimmed.isBlank()) {
                    candidateModels.add(trimmed);
                }
            }
        }

        List<String> attempted = new ArrayList<>();
        String lastError = "";
        for (String model : candidateModels) {
            attempted.add(model);
            try {
                return callModel(model, request);
            } catch (RestClientResponseException ex) {
                String body = ex.getResponseBodyAsString();
                int status = ex.getRawStatusCode();
                boolean retryableModelError = status == 404 || status == 410;
                if (retryableModelError) {
                    String reason = status == 404 ? "not found" : "deprecated or unsupported";
                    lastError = "Model '" + model + "' is " + reason + " on hf-inference";
                    continue;
                }
                String details = body == null || body.isBlank() ? ex.getMessage() : body;
                throw new IllegalStateException("Hugging Face generation failed with model '" + model + "': " + details);
            } catch (Exception ex) {
                String details = ex.getMessage() == null || ex.getMessage().isBlank()
                        ? ex.getClass().getSimpleName()
                        : ex.getMessage();
                throw new IllegalStateException("Hugging Face generation failed with model '" + model + "': " + details);
            }
        }

        throw new IllegalStateException(
                "No supported Hugging Face model available. Attempted: " + String.join(", ", attempted) +
                        (lastError.isBlank() ? "" : ". Last error: " + lastError)
        );
    }

    private byte[] callModel(String model, HttpEntity<Map<String, Object>> request) {
        String baseUrl = huggingFaceBaseUrl == null || huggingFaceBaseUrl.isBlank()
                ? "https://router.huggingface.co/hf-inference/models"
                : huggingFaceBaseUrl.trim();
        String url = baseUrl.endsWith("/") ? baseUrl + model : baseUrl + "/" + model;

        ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.POST, request, byte[].class);
        byte[] body = response.getBody();
        if (body == null || body.length == 0) {
            throw new IllegalStateException("Hugging Face returned an empty image response");
        }

        MediaType contentType = response.getHeaders().getContentType();
        if (contentType != null && MediaType.APPLICATION_JSON.includes(contentType)) {
            String error = new String(body);
            throw new IllegalStateException("Hugging Face generation failed: " + error);
        }

        return body;
    }
}
