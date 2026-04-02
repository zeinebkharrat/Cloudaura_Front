package org.example.backend.repository;

import org.example.backend.model.PuzzleImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PuzzleImageRepository extends JpaRepository<PuzzleImage, Integer> {}
