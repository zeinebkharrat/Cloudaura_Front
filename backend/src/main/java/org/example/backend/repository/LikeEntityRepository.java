package org.example.backend.repository;

import org.example.backend.model.LikeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LikeEntityRepository extends JpaRepository<LikeEntity, Integer> {
}

