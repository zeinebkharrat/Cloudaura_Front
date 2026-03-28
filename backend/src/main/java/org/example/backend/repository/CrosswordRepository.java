package org.example.backend.repository;

import org.example.backend.model.Crossword;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CrosswordRepository extends JpaRepository<Crossword, Integer> {}
