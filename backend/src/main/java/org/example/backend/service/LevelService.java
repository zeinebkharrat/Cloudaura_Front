package org.example.backend.service;

import org.example.backend.model.Level;
import org.example.backend.repository.LevelRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LevelService {

    private final LevelRepository levelRepository;

    public LevelService(LevelRepository levelRepository) {
        this.levelRepository = levelRepository;
    }

    public List<Level> findAll() {
        return levelRepository.findAll();
    }
}
