package org.example.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/public/giphy")
@RequiredArgsConstructor
public class GiphyController {

    private final RestTemplate restTemplate;

    @Value("${app.giphy.api-key:${GIPHY_API_KEY:}}")
    private String giphyApiKey;

    @Value("${app.giphy.base-url:https://api.giphy.com/v1}")
    private String giphyBaseUrl;

    @GetMapping("/search")
    public List<GiphyItemDto> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "gif") String type,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset
    ) {
        String query = q == null ? "" : q.trim();
        if (query.isEmpty()) {
            return List.of();
        }

        if (giphyApiKey == null || giphyApiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "api.error.giphy_not_configured");
        }

        String normalizedType = "sticker".equalsIgnoreCase(type) ? "sticker" : "gif";
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        int safeOffset = Math.max(offset, 0);

        String endpoint = "sticker".equals(normalizedType)
                ? "/stickers/search"
                : "/gifs/search";

        String url = UriComponentsBuilder
                .fromHttpUrl(giphyBaseUrl + endpoint)
                .queryParam("api_key", giphyApiKey)
                .queryParam("q", query)
                .queryParam("limit", safeLimit)
                .queryParam("offset", safeOffset)
                .queryParam("rating", "pg")
                .queryParam("lang", "en")
                .queryParam("bundle", "messaging_non_clips")
                .toUriString();

        JsonNode response = restTemplate.getForObject(url, JsonNode.class);
        if (response == null || !response.has("data") || !response.get("data").isArray()) {
            return List.of();
        }

        List<GiphyItemDto> result = new ArrayList<>();
        for (JsonNode item : response.get("data")) {
            String id = item.path("id").asText("");
            String title = item.path("title").asText("");

            JsonNode images = item.path("images");
            String previewUrl = textOrEmpty(images.path("fixed_width_small").path("url"));
            String fullUrl = textOrEmpty(images.path("fixed_height").path("url"));

            if (fullUrl.isBlank()) {
                fullUrl = textOrEmpty(images.path("original").path("url"));
            }
            if (previewUrl.isBlank()) {
                previewUrl = fullUrl;
            }

            if (!fullUrl.isBlank()) {
                result.add(new GiphyItemDto(id, title, normalizedType, previewUrl, fullUrl));
            }
        }

        return result;
    }

    private String textOrEmpty(JsonNode node) {
        return node == null ? "" : node.asText("").trim();
    }

    public record GiphyItemDto(
            String id,
            String title,
            String mediaType,
            String previewUrl,
            String fullUrl
    ) {}
}
