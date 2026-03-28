package org.example.backend.controller;

import org.example.backend.dto.ludification.RoadmapNodeRequest;
import org.example.backend.model.RoadmapNode;
import org.example.backend.service.RoadmapNodeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ludification/roadmap")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class RoadmapNodeController {

    private final RoadmapNodeService roadmapNodeService;

    public RoadmapNodeController(RoadmapNodeService roadmapNodeService) {
        this.roadmapNodeService = roadmapNodeService;
    }

    @GetMapping
    public List<RoadmapNode> getRoadmap() {
        return roadmapNodeService.findAllOrdered();
    }

    @PostMapping
    public RoadmapNode createRoadmapNode(@RequestBody RoadmapNodeRequest req) {
        return roadmapNodeService.create(req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoadmapNode(@PathVariable Integer id) {
        if (!roadmapNodeService.delete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().build();
    }
}
