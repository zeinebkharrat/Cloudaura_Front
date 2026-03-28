package org.example.backend.service;

import org.example.backend.model.RoadmapNode;
import org.example.backend.model.UserRoadmapCompletion;
import org.example.backend.repository.RoadmapNodeRepository;
import org.example.backend.repository.UserRoadmapCompletionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserRoadmapCompletionService {

    private final RoadmapNodeRepository roadRepo;
    private final UserRoadmapCompletionRepository roadmapCompletionRepo;

    public UserRoadmapCompletionService(
            RoadmapNodeRepository roadRepo,
            UserRoadmapCompletionRepository roadmapCompletionRepo) {
        this.roadRepo = roadRepo;
        this.roadmapCompletionRepo = roadmapCompletionRepo;
    }

    public Map<String, Object> getProgress(String username) {
        String u = username.trim();
        List<Integer> ids =
                roadmapCompletionRepo.findByUsernameOrderByCompletedAtAsc(u).stream()
                        .map(c -> c.getRoadmapNode().getNodeId())
                        .toList();
        return Map.of("completedNodeIds", ids, "username", u);
    }

    public Map<String, Object> canPlay(String username, Integer nodeId) {
        String u = username.trim();
        if (!roadRepo.existsById(nodeId)) {
            return Map.of("allowed", false, "error", "Étape inconnue");
        }
        Optional<String> block = validatePreviousStageCompleted(u, nodeId);
        if (block.isPresent()) {
            return Map.of("allowed", false, "error", block.get());
        }
        return Map.of("allowed", true);
    }

    @Transactional
    public Map<String, Object> complete(Integer nodeId, Map<String, Object> body) {
        String username = "";
        if (body != null && body.get("username") != null) {
            username = String.valueOf(body.get("username")).trim();
        }
        if (username.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username requis");
        }
        RoadmapNode node =
                roadRepo.findById(nodeId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Optional<String> block = validatePreviousStageCompleted(username, nodeId);
        if (block.isPresent()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, block.get());
        }
        if (roadmapCompletionRepo.existsByUsernameAndRoadmapNode_NodeId(username, nodeId)) {
            return Map.of("alreadyCompleted", true, "nodeId", nodeId);
        }
        UserRoadmapCompletion row = new UserRoadmapCompletion();
        row.setUsername(username);
        row.setRoadmapNode(node);
        row.setCompletedAt(new Date());
        if (body != null) {
            Object sc = body.get("score");
            Object mx = body.get("maxScore");
            if (sc instanceof Number n) {
                row.setScore(n.intValue());
            }
            if (mx instanceof Number n) {
                row.setMaxScore(n.intValue());
            }
        }
        roadmapCompletionRepo.save(row);
        return Map.of("saved", true, "nodeId", nodeId);
    }

    private Optional<String> validatePreviousStageCompleted(String username, Integer nodeId) {
        List<RoadmapNode> order = roadRepo.findAllByOrderByStepOrderAsc();
        int idx = -1;
        for (int i = 0; i < order.size(); i++) {
            if (nodeId.equals(order.get(i).getNodeId())) {
                idx = i;
                break;
            }
        }
        if (idx < 0) {
            return Optional.of("Étape inconnue dans le parcours.");
        }
        if (idx == 0) {
            return Optional.empty();
        }
        RoadmapNode previous = order.get(idx - 1);
        Integer prevId = previous.getNodeId();
        if (!roadmapCompletionRepo.existsByUsernameAndRoadmapNode_NodeId(username, prevId)) {
            return Optional.of("Terminez d'abord l'étape précédente du parcours.");
        }
        return Optional.empty();
    }
}
