package org.example.backend.controller;

import org.example.backend.service.UserRoadmapCompletionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ludification/roadmap")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class UserRoadmapCompletionController {

    private final UserRoadmapCompletionService completionService;

    public UserRoadmapCompletionController(UserRoadmapCompletionService completionService) {
        this.completionService = completionService;
    }

    @GetMapping("/progress")
    public ResponseEntity<Map<String, Object>> getRoadmapProgress(@RequestParam String username) {
        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "username requis"));
        }
        return ResponseEntity.ok(completionService.getProgress(username));
    }

    @GetMapping("/nodes/{nodeId}/can-play")
    public ResponseEntity<Map<String, Object>> canPlayRoadmapNode(
            @PathVariable Integer nodeId, @RequestParam String username) {
        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("allowed", false, "error", "username requis"));
        }
        return ResponseEntity.ok(completionService.canPlay(username, nodeId));
    }

    @PostMapping("/nodes/{nodeId}/complete")
    public ResponseEntity<Map<String, Object>> completeRoadmapNode(
            @PathVariable Integer nodeId, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> result = completionService.complete(nodeId, body);
        return ResponseEntity.ok(result);
    }
}
