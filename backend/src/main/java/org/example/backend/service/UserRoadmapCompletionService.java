package org.example.backend.service;

import org.example.backend.model.RoadmapNode;
import org.example.backend.model.User;
import org.example.backend.model.UserRoadmapCompletion;
import org.example.backend.repository.RoadmapNodeRepository;
import org.example.backend.repository.UserRoadmapCompletionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Date;
import java.util.LinkedHashSet;
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

    @Transactional
    public Map<String, Object> getProgress(User user) {
        backfillMissingUserLinks(user);

        Integer userId = user.getUserId();
        String username = user.getUsername();

        LinkedHashSet<Integer> completed = new LinkedHashSet<>();

        roadmapCompletionRepo.findByUserUserIdOrderByCompletedAtAsc(userId).stream()
                .map(c -> c.getRoadmapNode().getNodeId())
                .forEach(completed::add);

        // Backward compatibility: include legacy rows persisted only with username.
        roadmapCompletionRepo.findByUsernameOrderByCompletedAtAsc(username).stream()
                .map(c -> c.getRoadmapNode().getNodeId())
                .forEach(completed::add);

        return Map.of("completedNodeIds", completed.stream().toList(), "username", username);
    }

    @Transactional
    public Map<String, Object> canPlay(User user, Integer nodeId) {
        backfillMissingUserLinks(user);

        if (!roadRepo.existsById(nodeId)) {
            return Map.of("allowed", false, "error", "Étape inconnue");
        }
        Optional<String> block = validatePreviousStageCompleted(user, nodeId);
        if (block.isPresent()) {
            return Map.of("allowed", false, "error", block.get());
        }
        return Map.of("allowed", true);
    }

    @Transactional
    public Map<String, Object> complete(User user, Integer nodeId, Map<String, Object> body) {
        backfillMissingUserLinks(user);

        String username = user.getUsername();
        RoadmapNode node =
                roadRepo.findById(nodeId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        Optional<String> block = validatePreviousStageCompleted(user, nodeId);
        if (block.isPresent()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, block.get());
        }
        if (isNodeCompleted(user, nodeId)) {
            // If this completion only exists as a legacy username row, attach user_id now.
            roadmapCompletionRepo.findByUsernameAndRoadmapNode_NodeId(username, nodeId).ifPresent(existing -> {
                if (existing.getUser() == null) {
                    existing.setUser(user);
                    roadmapCompletionRepo.save(existing);
                }
            });
            return Map.of("alreadyCompleted", true, "nodeId", nodeId);
        }
        UserRoadmapCompletion row = new UserRoadmapCompletion();
        row.setUsername(username);
        row.setUser(user);
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

    private Optional<String> validatePreviousStageCompleted(User user, Integer nodeId) {
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
        if (!isNodeCompleted(user, prevId)) {
            return Optional.of("Terminez d'abord l'étape précédente du parcours.");
        }
        return Optional.empty();
    }

    private boolean isNodeCompleted(User user, Integer nodeId) {
        Integer userId = user.getUserId();
        String username = user.getUsername();

        return roadmapCompletionRepo.existsByUserUserIdAndRoadmapNode_NodeId(userId, nodeId)
                || roadmapCompletionRepo.existsByUsernameAndRoadmapNode_NodeId(username, nodeId);
    }

    private void backfillMissingUserLinks(User user) {
        String username = user.getUsername();
        List<UserRoadmapCompletion> legacyRows =
                roadmapCompletionRepo.findByUsernameAndUserIsNullOrderByCompletedAtAsc(username);

        if (legacyRows.isEmpty()) {
            return;
        }

        for (UserRoadmapCompletion row : legacyRows) {
            row.setUser(user);
        }
        roadmapCompletionRepo.saveAll(legacyRows);
    }
}
