package org.example.backend.service;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Service
public class ImageDescriptionService {

    private static final Logger log = LoggerFactory.getLogger(ImageDescriptionService.class);

    private static final int MAX_IMAGE_EDGE_PX = 1536;
    private static final long MAX_INLINE_BYTES = 4L * 1024 * 1024;

    /** MIMEs that often mismatch bytes after ImageIO round-trip; normalize to JPEG. */
    private static final Set<String> REENCODE_AS_JPEG_MIMES = Set.of(
            "image/webp", "image/heic", "image/heif", "image/avif", "image/jxl"
    );

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String geminiApiKey;
    private final String geminiModel;
    private final List<String> extraModels;

    public ImageDescriptionService(
            @Value("${app.gemini.api-key:}") String geminiApiKey,
            @Value("${app.gemini.model:gemini-2.5-flash}") String geminiModel,
            @Value("${app.gemini.fallback-models:gemini-2.0-flash,gemini-1.5-flash}") String fallbackModelsCsv
    ) {
        this.geminiApiKey = geminiApiKey == null ? "" : geminiApiKey.trim();
        this.geminiModel = geminiModel == null ? "" : geminiModel.trim();
        this.extraModels = parseModelList(fallbackModelsCsv, this.geminiModel);

        this.objectMapper = new ObjectMapper();
        this.webClient = WebClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();

        if (this.geminiApiKey.isBlank()) {
            log.warn("No Gemini API key configured for image description. Set app.gemini.api-key.");
        } else {
            log.info("Gemini image description: primary model={}, fallbacks={}", this.geminiModel, this.extraModels);
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
        if (geminiApiKey.isBlank()) {
            return "AI description is disabled because no Gemini API key is configured.";
        }

        try {
            return describeImageWithGemini(bytes, contentType);
        } catch (Exception ex) {
            if (ex instanceof WebClientResponseException wcre) {
                log.error("Gemini HTTP {}: {}", wcre.getStatusCode().value(),
                        truncateForLog(wcre.getResponseBodyAsString()));
            } else {
                log.error("Gemini API error: {}", ex.getMessage(), ex);
            }
            log.warn("All Gemini models failed; using generic fallback. Fix API key, model names, or quota for image-specific text.");
            return softFallbackDescription();
        }
    }

    private String describeImageWithGemini(byte[] imageBytes, String contentType) throws IOException {
        String declaredMime = normalizeImageMimeType(contentType);
        PreparedVisionImage prepared = prepareVisionImage(imageBytes, declaredMime);
        String encodedImage = Base64.getEncoder().encodeToString(prepared.bytes());

        String prompt = """
                You write short marketplace listings for handmade products sold in Tunisia.
                Look ONLY at the attached product photo and describe what is visibly there.

                Write 2–4 sentences in English (max ~80 words). Include:
                — what the item appears to be (jewelry, pottery, textile, decor, etc.);
                — visible materials, textures, colors, and any distinctive shapes or patterns;
                — overall style (e.g. traditional, minimalist, ornate) if clear from the image.

                Do not invent a brand, exact materials you cannot see, or a price.
                Avoid empty phrases like "quality materials" unless you tie them to something visible.
                """.trim();

        String requestBody = buildGenerateContentJson(prepared.mimeType(), encodedImage, prompt);

        List<String> modelsToTry = new ArrayList<>();
        if (!geminiModel.isBlank()) {
            modelsToTry.add(geminiModel);
        }
        modelsToTry.addAll(extraModels);

        Exception last = null;
        for (String model : modelsToTry) {
            if (model == null || model.isBlank()) {
                continue;
            }
            try {
                return callGeminiGenerateContent(model, requestBody);
            } catch (Exception e) {
                last = e;
                if (e instanceof WebClientResponseException wcre) {
                    log.warn("Gemini model {} failed (HTTP {}): {}", model, wcre.getStatusCode().value(),
                            truncateForLog(wcre.getResponseBodyAsString()));
                } else {
                    log.warn("Gemini model {} failed: {}", model, e.getMessage());
                }
            }
        }
        if (last != null) {
            throw new RuntimeException(last.getMessage(), last);
        }
        throw new RuntimeException("No Gemini model configured.");
    }

    private record PreparedVisionImage(byte[] bytes, String mimeType) {}

    /**
     * Ensures bytes and {@code mimeType} match. Gemini rejects requests when e.g. {@code image/webp}
     * is declared but JPEG bytes are sent after re-encoding.
     */
    private PreparedVisionImage prepareVisionImage(byte[] raw, String declaredMime) throws IOException {
        if (raw == null || raw.length == 0) {
            return new PreparedVisionImage(raw, declaredMime);
        }

        BufferedImage src;
        try {
            src = ImageIO.read(new ByteArrayInputStream(raw));
        } catch (Exception e) {
            log.warn("Could not decode image (will send raw bytes): {}", e.getMessage());
            return new PreparedVisionImage(raw, declaredMime);
        }

        if (src == null) {
            log.warn("ImageIO returned null decoder; sending raw bytes with mime {}", declaredMime);
            return new PreparedVisionImage(raw, declaredMime);
        }

        int w = src.getWidth();
        int h = src.getHeight();
        int maxEdge = Math.max(w, h);

        boolean tooLarge = raw.length > MAX_INLINE_BYTES || maxEdge > MAX_IMAGE_EDGE_PX;
        boolean riskyMime = REENCODE_AS_JPEG_MIMES.contains(declaredMime);

        if (!tooLarge && !riskyMime) {
            return new PreparedVisionImage(raw, declaredMime);
        }

        int targetMax = MAX_IMAGE_EDGE_PX;
        for (int attempt = 0; attempt < 6; attempt++) {
            BufferedImage scaled = scaleToMaxEdgeRgb(src, targetMax);
            byte[] jpeg = writeJpeg(scaled, 0.82f);
            if (jpeg.length <= MAX_INLINE_BYTES) {
                log.info("Prepared image for Gemini: {} bytes, mime {} -> {} bytes image/jpeg (maxEdge {})",
                        raw.length, declaredMime, jpeg.length, targetMax);
                return new PreparedVisionImage(jpeg, "image/jpeg");
            }
            targetMax = Math.max(384, targetMax * 2 / 3);
        }

        byte[] last = writeJpeg(scaleToMaxEdgeRgb(src, 384), 0.72f);
        log.warn("Image still large after compression ({} bytes); sending anyway as image/jpeg", last.length);
        return new PreparedVisionImage(last, "image/jpeg");
    }

    private static BufferedImage scaleToMaxEdgeRgb(BufferedImage src, int maxEdge) {
        int w = src.getWidth();
        int h = src.getHeight();
        int me = Math.max(w, h);
        if (me <= 0) {
            return src;
        }

        double scale = me > maxEdge ? (maxEdge / (double) me) : 1.0;
        int nw = Math.max(1, (int) Math.round(w * scale));
        int nh = Math.max(1, (int) Math.round(h * scale));

        BufferedImage scaled = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = scaled.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, nw, nh);
            g.drawImage(src, 0, 0, nw, nh, null);
        } finally {
            g.dispose();
        }
        return scaled;
    }

    private static byte[] writeJpeg(BufferedImage img, float quality) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            ImageIO.write(img, "jpeg", baos);
            return baos.toByteArray();
        }
        ImageWriter writer = writers.next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        if (param.canWriteCompressed()) {
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
        }
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return baos.toByteArray();
    }

    private static List<String> parseModelList(String csv, String primary) {
        List<String> out = new ArrayList<>();
        String p = primary == null ? "" : primary.trim();
        if (csv != null) {
            for (String part : csv.split(",")) {
                String m = part == null ? "" : part.trim();
                if (m.isEmpty() || out.contains(m)) {
                    continue;
                }
                if (m.equalsIgnoreCase(p)) {
                    continue;
                }
                out.add(m);
            }
        }
        return List.copyOf(out);
    }

    private String buildGenerateContentJson(String mimeType, String encodedImage, String prompt) throws IOException {
        Map<String, Object> inline = new LinkedHashMap<>();
        inline.put("mimeType", mimeType);
        inline.put("data", encodedImage);

        List<Map<String, Object>> parts = List.of(
                Map.of("inlineData", inline),
                Map.of("text", prompt)
        );

        Map<String, Object> userTurn = new LinkedHashMap<>();
        userTurn.put("role", "user");
        userTurn.put("parts", parts);

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", 0.65);
        generationConfig.put("maxOutputTokens", 512);

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("contents", List.of(userTurn));
        root.put("generationConfig", generationConfig);

        return objectMapper.writeValueAsString(root);
    }

    private String callGeminiGenerateContent(String model, String requestBody) throws IOException {
        String rawResponse = webClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/v1beta/models/{model}:generateContent")
                        .queryParam("key", geminiApiKey)
                        .build(model))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block(Duration.ofMinutes(2));

        if (rawResponse == null || rawResponse.isBlank()) {
            throw new RuntimeException("Gemini returned an empty response.");
        }

        JsonNode root = objectMapper.readTree(rawResponse);
        if (root.has("error")) {
            String msg = root.path("error").path("message").asText("Gemini API error");
            throw new RuntimeException(msg);
        }

        JsonNode promptFeedback = root.path("promptFeedback");
        if (promptFeedback.has("blockReason") && !promptFeedback.path("blockReason").isMissingNode()) {
            throw new RuntimeException("Prompt blocked: " + promptFeedback.path("blockReason").asText());
        }

        String text = extractTextFromCandidates(root);
        if (text == null || text.isBlank()) {
            JsonNode c0 = root.path("candidates").path(0);
            throw new RuntimeException("Gemini returned no text (finishReason=" + c0.path("finishReason").asText("") + ").");
        }
        return text.trim();
    }

    private static String extractTextFromCandidates(JsonNode root) {
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return null;
        }
        JsonNode candidate = candidates.get(0);
        String finish = candidate.path("finishReason").asText("");
        if ("SAFETY".equalsIgnoreCase(finish) || "BLOCKLIST".equalsIgnoreCase(finish)) {
            return null;
        }
        JsonNode parts = candidate.path("content").path("parts");
        if (!parts.isArray()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode part : parts) {
            if (part.has("text")) {
                String t = part.path("text").asText("");
                if (!t.isBlank()) {
                    if (sb.length() > 0) {
                        sb.append(' ');
                    }
                    sb.append(t.trim());
                }
            }
        }
        String s = sb.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static String normalizeImageMimeType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "image/jpeg";
        }
        String t = contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if ("image/jpg".equals(t)) {
            return "image/jpeg";
        }
        if (t.startsWith("image/")) {
            return t;
        }
        return "image/jpeg";
    }

    private static String softFallbackDescription() {
        return "We could not analyze this photo automatically. Add a short description manually, or check your Gemini API key and quota—then try again.";
    }

    private static String truncateForLog(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replaceAll("\\s+", " ").trim();
        if (t.length() <= 600) {
            return t;
        }
        return t.substring(0, 600) + "...";
    }
}
