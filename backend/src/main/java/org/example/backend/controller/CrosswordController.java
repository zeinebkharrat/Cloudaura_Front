package org.example.backend.controller;

import org.example.backend.model.Crossword;
import org.example.backend.service.CrosswordService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ludification/crosswords")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class CrosswordController {

    private final CrosswordService crosswordService;

    public CrosswordController(CrosswordService crosswordService) {
        this.crosswordService = crosswordService;
    }

    @GetMapping
    public List<Crossword> getCrosswords() {
        return crosswordService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Crossword> getCrosswordById(@PathVariable Integer id) {
        return crosswordService
                .findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Crossword createCrossword(@RequestBody Crossword c) {
        return crosswordService.create(c);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Crossword> updateCrossword(@PathVariable Integer id, @RequestBody Crossword details) {
        return crosswordService
                .update(id, details)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCrossword(@PathVariable Integer id) {
        if (!crosswordService.delete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().build();
    }
}
