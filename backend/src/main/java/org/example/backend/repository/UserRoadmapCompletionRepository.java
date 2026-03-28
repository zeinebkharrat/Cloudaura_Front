package org.example.backend.repository;

import org.example.backend.model.UserRoadmapCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserRoadmapCompletionRepository extends JpaRepository<UserRoadmapCompletion, Integer> {

    List<UserRoadmapCompletion> findByUsernameOrderByCompletedAtAsc(String username);

    boolean existsByUsernameAndRoadmapNode_NodeId(String username, Integer nodeId);
}
