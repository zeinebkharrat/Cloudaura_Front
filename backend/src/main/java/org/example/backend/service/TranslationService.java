package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.TranslationCache;
import org.example.backend.repository.TranslationCacheRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Proxies to the public MyMemory translation API (GET), with RAM LRU cache, DB persistence, and a
 * daily word budget guard.
 */
@Service
@Slf4j
public class TranslationService {

    private static final int MAX_UTF8_BYTES = 2000;

    private final ObjectMapper objectMapper;
    private final TranslationCacheRepository translationCacheRepository;

    @Value("${app.translation.enabled:true}")
    private boolean translationEnabled;

    @Value("${app.translate.mymemory-url:https://api.mymemory.translated.net/get}")
    private String mymemoryUrl;

    @Value("${app.translate.contact-email:}")
    private String contactEmail;

    @Value("${app.translate.daily-word-limit:4500}")
    private int dailyWordLimit;

    /**
     * ISO-like source language sent to MyMemory in {@code langpair}. MyMemory rejects {@code auto}
     * as a source (HTTP 403), so this must be a concrete code (default {@code fr} matches seeded
     * catalog / activity copy in this project).
     */
    @Value("${app.translate.default-source-lang:fr}")
    private String defaultSourceLang;

    /** Mutable for unit tests ({@link org.springframework.test.util.ReflectionTestUtils}). */
    private RestTemplate myMemoryClient;

    private final Map<String, String> cache =
            Collections.synchronizedMap(
                    new LinkedHashMap<>(256, 0.75f, true) {
                        @Override
                        protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
                            return size() > 2000;
                        }
                    });

    private final AtomicLong dailyWordCount = new AtomicLong();

    public TranslationService(ObjectMapper objectMapper, TranslationCacheRepository translationCacheRepository) {
        this.objectMapper = objectMapper;
        this.translationCacheRepository = translationCacheRepository;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(15000);
        this.myMemoryClient = new RestTemplate(factory);
    }

    @Scheduled(cron = "0 0 0 * * *")
    public void resetDailyCounter() {
        dailyWordCount.set(0);
        log.info("Translation daily word counter reset");
    }

    /**
     * Best-effort translation for catalog or user-facing strings. Never throws to callers; returns
     * the original text when translation is skipped or fails.
     */
    public String safeTranslate(String text, String targetLang) {
        if (!translationEnabled) {
            return text;
        }
        if (text == null || text.isBlank()) {
            return text;
        }
        if (CatalogKeyUtil.looksLikeCatalogKey(text)) {
            return text;
        }
        try {
            String src = normalizeLang(defaultSourceLang, "fr");
            String tgt = normalizeLang(targetLang, "en");
            if (tgt.isBlank()) {
                tgt = "en";
            }
            if (src.equals(tgt)) {
                return text;
            }
            return translate(text, src, tgt);
        } catch (Exception e) {
            log.warn(
                    "Translation failed targetLang={} textPrefix='{}': {}",
                    targetLang,
                    text.length() > 80 ? text.substring(0, 80) + "…" : text,
                    e.getMessage());
            return text;
        }
    }

    /**
     * Resolves {@code text} via RAM → DB → MyMemory (then persists). Catalog-style keys are never
     * sent to MyMemory and are returned unchanged.
     */
    public String translate(String text, String sourceLang, String targetLang) throws Exception {
        if (!translationEnabled) {
            return text == null ? "" : text;
        }
        if (text == null || text.isBlank()) {
            return "";
        }
        if (CatalogKeyUtil.looksLikeCatalogKey(text)) {
            return text;
        }
        byte[] utf8 = text.getBytes(StandardCharsets.UTF_8);
        if (utf8.length > MAX_UTF8_BYTES) {
            throw new IllegalArgumentException("Text exceeds translation size limit (" + MAX_UTF8_BYTES + " bytes).");
        }
        String src = normalizeLang(sourceLang, "fr");
        String tgt = normalizeLang(targetLang, "en");
        if (tgt.isBlank()) {
            tgt = "en";
        }
        if (src.equals(tgt)) {
            return text;
        }
        String cacheKey = src + "|" + tgt + "|" + text;

        String ramHit = cache.get(cacheKey);
        if (ramHit != null) {
            return ramHit;
        }

        var dbHit = translationCacheRepository.findByCacheKey(cacheKey);
        if (dbHit.isPresent()) {
            String v = dbHit.get().getValue();
            cache.put(cacheKey, v);
            return v;
        }

        int words = countWords(text);
        long used = dailyWordCount.get();
        if (used >= dailyWordLimit || used + words > dailyWordLimit) {
            log.warn(
                    "MyMemory daily word budget exhausted or would be exceeded (limit={}, used={}, requestWords={});"
                            + " returning original text",
                    dailyWordLimit,
                    used,
                    words);
            return text;
        }

        UriComponentsBuilder b =
                UriComponentsBuilder.fromUriString(mymemoryUrl)
                        .queryParam("q", text)
                        .queryParam("langpair", src + "|" + tgt);
        if (contactEmail != null && !contactEmail.isBlank()) {
            b.queryParam("de", contactEmail.trim());
        }
        URI uri = b.encode(StandardCharsets.UTF_8).build().toUri();

        String body = myMemoryClient.getForObject(uri, String.class);
        if (body == null || body.isBlank()) {
            return text;
        }
        JsonNode root = objectMapper.readTree(body);
        int status = parseMyMemoryStatus(root.path("responseStatus"));
        if (status != 200) {
            String detail = root.path("responseDetails").asText("");
            throw new IllegalStateException(
                    "Translation provider returned status " + status + (detail.isBlank() ? "" : (": " + detail)));
        }
        String translated = root.path("responseData").path("translatedText").asText("");
        if (translated.isBlank()) {
            return text;
        }
        if (looksLikeMyMemoryHardError(translated)) {
            throw new IllegalStateException("Translation provider returned error payload in translatedText");
        }

        dailyWordCount.addAndGet(words);

        TranslationCache row = new TranslationCache();
        row.setCacheKey(cacheKey);
        row.setTargetLang(tgt);
        row.setValue(translated);
        translationCacheRepository.save(row);

        cache.put(cacheKey, translated);
        return translated;
    }

    private static int countWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return (int)
                Arrays.stream(text.trim().split("\\s+")).filter(s -> !s.isBlank()).count();
    }

    private static String normalizeLang(String raw, String fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String t = raw.trim().toLowerCase();
        if (t.length() > 12) {
            return fallback;
        }
        if ("auto".equals(t)) {
            return fallback;
        }
        return t.replace('_', '-').split("-", 2)[0];
    }

    /** MyMemory returns {@code responseStatus} as number or string depending on error shape. */
    private static int parseMyMemoryStatus(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return 500;
        }
        if (node.isNumber()) {
            return node.intValue();
        }
        String s = node.asText("").trim();
        if (s.isEmpty()) {
            return 500;
        }
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException ex) {
            return 500;
        }
    }

    private static boolean looksLikeMyMemoryHardError(String translated) {
        String t = translated.trim();
        return t.startsWith("'AUTO'")
                || t.contains("INVALID SOURCE LANGUAGE")
                || t.contains("QUERY LENGTH LIMIT EXCEEDED");
    }
}
