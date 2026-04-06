package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class SightengineCommentModerationService {

    private static final String API_URL = "https://api.sightengine.com/1.0/text/check.json";
    private static final String MASK_TOKEN = "******";
    private static final double CATEGORY_THRESHOLD = 0.55d;
    private static final Logger log = LoggerFactory.getLogger(SightengineCommentModerationService.class);

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.moderation.sightengine.enabled:true}")
    private boolean enabled;

    @Value("${app.moderation.sightengine.api-user:}")
    private String apiUser;

    @Value("${app.moderation.sightengine.api-secret:}")
    private String apiSecret;

    @Value("${app.moderation.sightengine.lang:en,fr}")
    private String lang;

    public CommentModerationResult moderateComment(String input) {
        if (input == null || input.isBlank()) {
            return new CommentModerationResult(input, input, List.of());
        }

        if (!enabled || apiUser == null || apiUser.isBlank() || apiSecret == null || apiSecret.isBlank()) {
            return new CommentModerationResult(input, input, List.of());
        }

        try {
            JsonNode rulesResponse = callRulesMode(input);
            JsonNode mlResponse = null;
            try {
                mlResponse = callMlMode(input);
            } catch (Exception mlEx) {
                log.warn("Sightengine ML moderation call failed, continuing with rules mode only: {}", mlEx.getMessage());
            }

            String sanitized = maskProfanityMatches(input, rulesResponse);
            List<String> categories = extractAbuseCategories(rulesResponse, mlResponse);

            return new CommentModerationResult(input, sanitized, categories);
        } catch (Exception ex) {
            log.warn("Sightengine rules moderation call failed, returning original comment: {}", ex.getMessage());
            return new CommentModerationResult(input, input, List.of());
        }
    }

    private JsonNode callRulesMode(String text) throws Exception {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("text", text);
        body.add("lang", lang);
        body.add("mode", "rules");
        body.add("api_user", apiUser);
        body.add("api_secret", apiSecret);
        return execute(body);
    }

    private JsonNode callMlMode(String text) throws Exception {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("text", text);
        body.add("lang", lang);
        body.add("models", "general,self-harm");
        body.add("mode", "ml");
        body.add("api_user", apiUser);
        body.add("api_secret", apiSecret);
        return execute(body);
    }

    private JsonNode execute(MultiValueMap<String, String> body) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(API_URL, HttpMethod.POST, request, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Sightengine moderation call failed");
        }

        return objectMapper.readTree(response.getBody());
    }

    private String maskProfanityMatches(String original, JsonNode rulesResponse) {
        JsonNode matches = rulesResponse.path("profanity").path("matches");
        if (!matches.isArray() || matches.isEmpty()) {
            return original;
        }

        record Span(int start, int end) {}
        List<Span> spans = new ArrayList<>();

        for (JsonNode match : matches) {
            if (!match.has("start") || !match.has("end")) {
                continue;
            }
            int start = match.path("start").asInt(-1);
            int end = match.path("end").asInt(-1);
            if (start < 0 || end <= start || start >= original.length()) {
                continue;
            }
            // Sightengine's `end` in text moderation responses is inclusive.
            end = Math.min(end + 1, original.length());
            spans.add(new Span(start, end));
        }

        if (spans.isEmpty()) {
            return original;
        }

        spans.sort((a, b) -> Integer.compare(b.start(), a.start()));

        StringBuilder sb = new StringBuilder(original);
        int lastStart = Integer.MAX_VALUE;
        for (Span span : spans) {
            if (span.start() >= lastStart) {
                continue;
            }
            sb.replace(span.start(), span.end(), MASK_TOKEN);
            lastStart = span.start();
        }

        return sb.toString();
    }

    private List<String> extractAbuseCategories(JsonNode rulesResponse, JsonNode mlResponse) {
        LinkedHashSet<String> categories = new LinkedHashSet<>();

        JsonNode profMatches = rulesResponse.path("profanity").path("matches");
        if (profMatches.isArray()) {
            for (JsonNode m : profMatches) {
                String type = m.path("type").asText("").trim();
                if (!type.isEmpty()) {
                    categories.add(type);
                }
            }
        }

        if (mlResponse != null) {
            JsonNode cls = mlResponse.path("moderation_classes");
            addMlCategoryIfHigh(cls, categories, "sexual");
            addMlCategoryIfHigh(cls, categories, "discriminatory");
            addMlCategoryIfHigh(cls, categories, "insulting");
            addMlCategoryIfHigh(cls, categories, "violent");
            addMlCategoryIfHigh(cls, categories, "toxic");
            addMlCategoryIfHigh(cls, categories, "self-harm");
        }

        return new ArrayList<>(categories);
    }

    private void addMlCategoryIfHigh(JsonNode classesNode, Set<String> categories, String key) {
        if (classesNode.has(key) && classesNode.path(key).asDouble(0d) >= CATEGORY_THRESHOLD) {
            categories.add(key);
        }
    }
}
