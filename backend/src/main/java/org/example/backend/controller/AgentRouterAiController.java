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

import java.util.Map;

@RestController
@RequestMapping("/api/ai/agentrouter")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class AgentRouterAiController {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.agentrouter.api-key:}")
    private String apiKey;

    @Value("${app.agentrouter.api-url:https://agentrouter.org/v1/chat/completions}")
    private String apiUrl;

    @Value("${app.agentrouter.image-url:https://agentrouter.org/v1/images/generations}")
    private String imageUrl;

    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody Map<String, Object> request) {
        log.info("Received AgentRouter AI chat request: {}", request);

        if (apiKey == null || apiKey.isBlank()) {
            log.error("AgentRouter API key is missing");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "AgentRouter API key is not configured."));
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            
            log.info("Calling AgentRouter API at {}", apiUrl);
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(apiUrl, entity, JsonNode.class);
            
            return ResponseEntity.ok(response.getBody());
        } catch (HttpStatusCodeException e) {
            String errorBody = e.getResponseBodyAsString();
            log.error("AgentRouter API error ({}): {}", e.getStatusCode(), errorBody);
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", "AI service returned error", "details", errorBody));
        } catch (Exception e) {
            log.error("Unexpected error calling AgentRouter API", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to call AI service", "message", e.getMessage()));
        }
    }

    @PostMapping("/images")
    public ResponseEntity<?> generateImage(@RequestBody Map<String, Object> request) {
        log.info("Received AgentRouter AI image request: {}", request);

        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "AgentRouter API key is not configured."));
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            
            log.info("Calling AgentRouter Image API at {}", imageUrl);
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(imageUrl, entity, JsonNode.class);
            
            return ResponseEntity.ok(response.getBody());
        } catch (HttpStatusCodeException e) {
            log.error("AgentRouter Image API error ({}): {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", "AI image service returned error", "details", e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Unexpected error calling AgentRouter Image API", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to call AI image service", "message", e.getMessage()));
        }
    }
}
