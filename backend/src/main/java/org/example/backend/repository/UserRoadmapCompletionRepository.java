package org.example.backend.repository;

import org.example.backend.model.UserRoadmapCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRoadmapCompletionRepository extends JpaRepository<UserRoadmapCompletion, Integer> {

    List<UserRoadmapCompletion> findByUserUserIdOrderByCompletedAtAsc(Integer userId);

    List<UserRoadmapCompletion> findByUsernameOrderByCompletedAtAsc(String username);

    List<UserRoadmapCompletion> findByUsernameAndUserIsNullOrderByCompletedAtAsc(String username);

    Optional<UserRoadmapCompletion> findByUsernameAndRoadmapNode_NodeId(String username, Integer nodeId);

    boolean existsByUserUserIdAndRoadmapNode_NodeId(Integer userId, Integer nodeId);

    boolean existsByUsernameAndRoadmapNode_NodeId(String username, Integer nodeId);

    void deleteAllByRoadmapNode_NodeId(Integer nodeId);
}
