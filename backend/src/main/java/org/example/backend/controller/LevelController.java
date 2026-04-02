package org.example.backend.controller;

import org.example.backend.model.Level;
import org.example.backend.service.LevelService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Niveaux / points (gamification) — lecture seule côté API publique.
 */
@RestController
@RequestMapping("/api/levels")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class LevelController {

    private final LevelService levelService;

    public LevelController(LevelService levelService) {
        this.levelService = levelService;
    }

    @GetMapping
    public List<Level> getLevels() {
        return levelService.findAll();
    }
}
