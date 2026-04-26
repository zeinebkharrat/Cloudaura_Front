package org.example.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/groq")
@RequiredArgsConstructor
@Slf4j
public class GroqAiController {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.groq.api-key:}")
    private String apiKey;

    @Value("${app.groq.api-url:https://api.groq.com/openai/v1/chat/completions}")
    private String apiUrl;

    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody Map<String, Object> request) {
        log.info("Received AI chat request: {}", request);

        if (apiKey == null || apiKey.isBlank()) {
            log.error("Groq API key is missing");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Groq API key is not configured."));
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            
            log.info("Calling Groq API at {}", apiUrl);
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(apiUrl, entity, JsonNode.class);
            
            return ResponseEntity.ok(response.getBody());
        } catch (HttpStatusCodeException e) {
            log.error("Groq API error ({}): {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", "AI service returned error", "details", e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Unexpected error calling Groq API", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to call AI service", "message", e.getMessage()));
        }
    }
}
