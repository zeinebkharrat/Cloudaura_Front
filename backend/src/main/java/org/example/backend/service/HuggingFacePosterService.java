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

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

@Service
public class HuggingFacePosterService {

    private static final String HF_ROUTER_BASE_URL = "https://router.huggingface.co/hf-inference/models";
    private static final String HF_DEFAULT_BASE_URL = HF_ROUTER_BASE_URL;
    private static final String DEFAULT_PRIMARY_MODEL = "black-forest-labs/FLUX.1-schnell";
    private static final List<String> DEFAULT_FALLBACK_MODELS = List.of();
    private static final int MAX_ATTEMPTS_PER_MODEL = 3;

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

    @Value("${app.ai.huggingface.width:512}")
    private int huggingFaceWidth;

    @Value("${app.ai.huggingface.height:512}")
    private int huggingFaceHeight;

    @Value("${app.ai.huggingface.steps:4}")
    private int huggingFaceSteps;

    @Value("${app.ai.huggingface.guidance-scale:0.0}")
    private double huggingFaceGuidanceScale;

    @Value("${app.ai.huggingface.low-memory-width:384}")
    private int huggingFaceLowMemoryWidth;

    @Value("${app.ai.huggingface.low-memory-height:384}")
    private int huggingFaceLowMemoryHeight;

    @Value("${app.ai.huggingface.low-memory-steps:2}")
    private int huggingFaceLowMemorySteps;

    @Value("${app.ai.huggingface.local-fallback-enabled:true}")
    private boolean huggingFaceLocalFallbackEnabled;

    @Value("${app.ai.pollinations.enabled:true}")
    private boolean pollinationsEnabled;

    @Value("${app.ai.pollinations.base-url:https://image.pollinations.ai/prompt}")
    private String pollinationsBaseUrl;

    @Value("${app.ai.pollinations.width:768}")
    private int pollinationsWidth;

    @Value("${app.ai.pollinations.height:1152}")
    private int pollinationsHeight;

    public HuggingFacePosterService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public byte[] generatePoster(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Prompt cannot be empty");
        }

        String key = huggingFaceApiKey == null ? "" : huggingFaceApiKey.trim();
        if (key.isBlank()) {
            byte[] pollinationsPoster = tryPollinationsPoster(prompt);
            if (pollinationsPoster != null) {
                return pollinationsPoster;
            }
            if (huggingFaceLocalFallbackEnabled) {
                return buildLocalFallbackPoster(prompt);
            }
            throw new IllegalStateException(
                    "Hugging Face API key is missing. Set app.ai.huggingface.api-key " +
                    "or env var HUGGINGFACE_API_KEY / HF_TOKEN."
            );
        }

        String primaryModel = huggingFaceModel == null || huggingFaceModel.isBlank()
            ? DEFAULT_PRIMARY_MODEL
            : huggingFaceModel.trim();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(key);
        headers.setContentType(MediaType.APPLICATION_JSON);
        String accept = huggingFaceAccept == null || huggingFaceAccept.isBlank()
            ? "image/png"
            : huggingFaceAccept.trim();
        headers.setAccept(Collections.singletonList(MediaType.parseMediaType(accept)));

        Set<String> candidateModels = buildCandidateModels(primaryModel);

        List<String> attempted = new ArrayList<>();
        String lastError = "";
        for (String model : candidateModels) {
            attempted.add(model);
            for (int attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
                boolean lowMemoryMode = attempt > 1;
                HttpEntity<Map<String, Object>> request = new HttpEntity<>(buildPayload(prompt, lowMemoryMode), headers);
                try {
                    return callModel(model, request);
                } catch (RestClientResponseException ex) {
                    String body = ex.getResponseBodyAsString();
                    int status = ex.getRawStatusCode();
                    String details = body == null || body.isBlank() ? ex.getMessage() : body;
                    if (isAuthFailure(status, details)) {
                        lastError = "Model '" + model + "' rejected the request due to token/auth issue (status " + status + "): " + shorten(details);
                        break;
                    }
                    if (isUnsupportedModelFailure(status, details)) {
                        lastError = "Model '" + model + "' is unsupported by the current provider: " + shorten(details);
                        break;
                    }
                    if (isRetryableModelFailure(status, details)) {
                        String modeLabel = lowMemoryMode ? "low-memory" : "standard";
                        lastError = "Model '" + model + "' failed (attempt " + attempt + "/" + MAX_ATTEMPTS_PER_MODEL + ", mode " + modeLabel + ", status " + status + "): " + shorten(details);
                        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
                            continue;
                        }
                        break;
                    }
                    throw new IllegalStateException("Hugging Face generation failed with model '" + model + "': " + details);
                } catch (Exception ex) {
                    String details = ex.getMessage() == null || ex.getMessage().isBlank()
                            ? ex.getClass().getSimpleName()
                            : ex.getMessage();
                    if (isUnsupportedModelFailure(0, details)) {
                        lastError = "Model '" + model + "' is unsupported by the current provider: " + shorten(details);
                        break;
                    }
                    if (isRetryableModelFailure(0, details)) {
                        String modeLabel = lowMemoryMode ? "low-memory" : "standard";
                        lastError = "Model '" + model + "' failed (attempt " + attempt + "/" + MAX_ATTEMPTS_PER_MODEL + ", mode " + modeLabel + "): " + shorten(details);
                        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
                            continue;
                        }
                        break;
                    }
                    throw new IllegalStateException("Hugging Face generation failed with model '" + model + "': " + details);
                }
            }
        }

        byte[] pollinationsPoster = tryPollinationsPoster(prompt);
        if (pollinationsPoster != null) {
            return pollinationsPoster;
        }

        if (huggingFaceLocalFallbackEnabled) {
            return buildLocalFallbackPoster(prompt);
        }

        throw new IllegalStateException(
                "No supported Hugging Face model available. Attempted: " + String.join(", ", attempted) +
                        (lastError.isBlank() ? "" : ". Last error: " + lastError)
        );
    }

    private byte[] tryPollinationsPoster(String prompt) {
        if (!pollinationsEnabled) {
            return null;
        }

        String base = (pollinationsBaseUrl == null || pollinationsBaseUrl.isBlank())
                ? "https://image.pollinations.ai/prompt"
                : pollinationsBaseUrl.trim();

        int width = sanitizePositive(pollinationsWidth, 768);
        int height = sanitizePositive(pollinationsHeight, 1152);
        String cleanedPrompt = prompt == null ? "" : prompt.trim();
        if (cleanedPrompt.isBlank()) {
            return null;
        }

        String antiLogoSuffix = " cinematic background only, no logo, no brand mark, no watermark, no text, no letters, no words";
        String pollinationsPrompt = cleanedPrompt + antiLogoSuffix;

        String encodedPrompt = URLEncoder.encode(pollinationsPrompt, StandardCharsets.UTF_8);
        String url = (base.endsWith("/") ? base.substring(0, base.length() - 1) : base)
                + "/" + encodedPrompt
                + "?width=" + width
                + "&height=" + height
                + "&enhance=true"
                + "&nologo=true"
                + "&safe=true";

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(Collections.singletonList(MediaType.ALL));
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );

            byte[] body = response.getBody();
            if (body == null || body.length == 0) {
                return null;
            }

            MediaType contentType = response.getHeaders().getContentType();
            if (contentType != null && MediaType.APPLICATION_JSON.includes(contentType)) {
                return null;
            }
            return body;
        } catch (Exception ex) {
            return null;
        }
    }

    private byte[] buildLocalFallbackPoster(String prompt) {
        final int width = 1024;
        final int height = 1536;
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();

        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            long seed = prompt == null ? 17L : prompt.hashCode();
            Random random = new Random(seed);

            Color bgA = new Color(18 + random.nextInt(35), 36 + random.nextInt(45), 70 + random.nextInt(55));
            Color bgB = new Color(70 + random.nextInt(50), 18 + random.nextInt(55), 60 + random.nextInt(55));
            g.setPaint(new GradientPaint(0, 0, bgA, width, height, bgB));
            g.fillRect(0, 0, width, height);

            // Soft glow layers for depth.
            g.setColor(new Color(255, 255, 255, 26));
            g.fillOval(-260, -220, 760, 760);
            g.setColor(new Color(255, 255, 255, 18));
            g.fillOval(width - 460, -120, 700, 700);
            g.setColor(new Color(255, 255, 255, 20));
            g.fillOval(width - 420, height - 560, 760, 760);

            // Glass-like translucent panel to keep overlay text readable.
            RoundRectangle2D.Float glass = new RoundRectangle2D.Float(72, 92, width - 144, height - 184, 44, 44);
            g.setColor(new Color(8, 16, 34, 76));
            g.fill(glass);
            g.setColor(new Color(255, 255, 255, 50));
            g.draw(glass);

            // Gentle vignette so edges stay darker than center.
            g.setPaint(new GradientPaint(
                    width / 2f,
                    120,
                    new Color(0, 0, 0, 0),
                    width / 2f,
                    height,
                    new Color(0, 0, 0, 120)
            ));
            g.fillRect(0, 0, width, height);

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Poster generation failed and fallback renderer could not build PNG", ex);
        } finally {
            g.dispose();
        }
    }

    private Map<String, Object> buildPayload(String prompt, boolean lowMemoryMode) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("inputs", prompt);
        payload.put("options", Map.of("wait_for_model", true));

        int width = lowMemoryMode ? sanitizePositive(huggingFaceLowMemoryWidth, 384) : sanitizePositive(huggingFaceWidth, 512);
        int height = lowMemoryMode ? sanitizePositive(huggingFaceLowMemoryHeight, 384) : sanitizePositive(huggingFaceHeight, 512);
        int steps = lowMemoryMode ? sanitizePositive(huggingFaceLowMemorySteps, 2) : sanitizePositive(huggingFaceSteps, 4);

        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("width", width);
        parameters.put("height", height);
        parameters.put("num_inference_steps", steps);
        parameters.put("guidance_scale", huggingFaceGuidanceScale);

        String negativePrompt = huggingFaceNegativePrompt == null ? "" : huggingFaceNegativePrompt.trim();
        if (!negativePrompt.isBlank()) {
            parameters.put("negative_prompt", negativePrompt);
        }

        payload.put("parameters", parameters);
        return payload;
    }

    private int sanitizePositive(int value, int fallback) {
        return value > 0 ? value : fallback;
    }

    private Set<String> buildCandidateModels(String primaryModel) {
        Set<String> models = new LinkedHashSet<>();
        models.add(primaryModel);

        if (huggingFaceFallbackModels != null && !huggingFaceFallbackModels.isBlank()) {
            for (String candidate : huggingFaceFallbackModels.split(",")) {
                String trimmed = candidate == null ? "" : candidate.trim();
                if (!trimmed.isBlank()) {
                    models.add(trimmed);
                }
            }
        }

        for (String candidate : DEFAULT_FALLBACK_MODELS) {
            if (candidate != null && !candidate.isBlank()) {
                models.add(candidate);
            }
        }

        return models;
    }

    private boolean isUnsupportedModelFailure(int status, String details) {
        if (status == 404 || status == 410) {
            return true;
        }
        if (details == null || details.isBlank()) {
            return false;
        }

        String msg = details.toLowerCase();
        return msg.contains("model not supported")
                || msg.contains("not supported by provider")
            || msg.contains("unsupported model")
            || msg.contains("deprecated and no longer supported")
            || msg.contains("no longer supported");
    }

    private boolean isAuthFailure(int status, String details) {
        if (status == 401 || status == 403) {
            return true;
        }
        if (details == null || details.isBlank()) {
            return false;
        }
        String msg = details.toLowerCase();
        return msg.contains("invalid token")
                || msg.contains("token is invalid")
                || msg.contains("authentication")
                || msg.contains("unauthorized")
                || msg.contains("forbidden");
    }

    private boolean isRetryableModelFailure(int status, String details) {
        if (status == 429 || status == 500 || status == 503) {
            return true;
        }
        if (details == null || details.isBlank()) {
            return false;
        }

        String msg = details.toLowerCase();
        return msg.contains("cuda out of memory")
                || msg.contains("out of memory")
                || msg.contains("insufficient memory")
                || msg.contains("model is currently loading")
                || msg.contains("currently loading")
                || msg.contains("temporarily unavailable")
                || msg.contains("service unavailable")
                || msg.contains("timeout")
                || msg.contains("timed out");
    }

    private String shorten(String input) {
        if (input == null) {
            return "";
        }
        String compact = input.replaceAll("\\s+", " ").trim();
        return compact.length() <= 220 ? compact : compact.substring(0, 220) + "...";
    }

    private byte[] callModel(String model, HttpEntity<Map<String, Object>> request) {
        List<String> baseUrls = resolveBaseUrls(huggingFaceBaseUrl);
        String lastUnsupportedError = "";

        for (String baseUrl : baseUrls) {
            String url = baseUrl.endsWith("/") ? baseUrl + model : baseUrl + "/" + model;
            try {
                ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.POST, request, byte[].class);
                byte[] body = response.getBody();
                if (body == null || body.length == 0) {
                    throw new IllegalStateException("Hugging Face returned an empty image response");
                }

                MediaType contentType = response.getHeaders().getContentType();
                if (contentType != null && MediaType.APPLICATION_JSON.includes(contentType)) {
                    String error = new String(body);
                    if (isUnsupportedModelFailure(0, error)) {
                        lastUnsupportedError = "Endpoint '" + baseUrl + "': " + shorten(error);
                        continue;
                    }
                    throw new IllegalStateException("Hugging Face generation failed: " + error);
                }

                return body;
            } catch (RestClientResponseException ex) {
                String details = ex.getResponseBodyAsString();
                if (details == null || details.isBlank()) {
                    details = ex.getMessage();
                }
                if (isUnsupportedModelFailure(ex.getRawStatusCode(), details)) {
                    lastUnsupportedError = "Endpoint '" + baseUrl + "': " + shorten(details);
                    continue;
                }
                throw ex;
            }
        }

        throw new IllegalStateException(
                "The requested model is unsupported across configured Hugging Face endpoints. " +
                        "Tried: " + String.join(", ", baseUrls) +
                        (lastUnsupportedError.isBlank() ? "" : ". Last unsupported detail: " + lastUnsupportedError)
        );
    }

    private List<String> resolveBaseUrls(String rawConfiguredBaseUrl) {
        String configured = normalizeBaseUrl(rawConfiguredBaseUrl);
        LinkedHashSet<String> urls = new LinkedHashSet<>();
        urls.add(configured);
        urls.add(HF_ROUTER_BASE_URL);
        return new ArrayList<>(urls);
    }

    private String normalizeBaseUrl(String raw) {
        String candidate = raw == null ? "" : raw.trim();
        if (candidate.isBlank()) {
            return HF_DEFAULT_BASE_URL;
        }

        // Guard against unresolved/encoded placeholders like %24%7B...%7D or ${...}
        String lower = candidate.toLowerCase();
        if (candidate.contains("${")
                || lower.contains("%24%7b")
                || lower.contains("%7d")
                || lower.contains("huggingface_base_url")) {
            return HF_DEFAULT_BASE_URL;
        }

        if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
            if (candidate.startsWith("/https://")) {
                candidate = candidate.substring(1);
            } else {
                return HF_DEFAULT_BASE_URL;
            }
        }

        try {
            URI parsed = URI.create(candidate);
            if (parsed.getScheme() == null || parsed.getHost() == null) {
                return HF_DEFAULT_BASE_URL;
            }
        } catch (IllegalArgumentException ex) {
            return HF_DEFAULT_BASE_URL;
        }

        return candidate;
    }
}
