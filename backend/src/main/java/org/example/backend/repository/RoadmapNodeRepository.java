package org.example.backend.repository;

import org.example.backend.model.RoadmapNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoadmapNodeRepository extends JpaRepository<RoadmapNode, Integer> {
    List<RoadmapNode> findAllByOrderByStepOrderAsc();
}
