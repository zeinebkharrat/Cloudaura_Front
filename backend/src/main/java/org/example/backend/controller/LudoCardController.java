package org.example.backend.controller;

import org.example.backend.model.LudoCard;
import org.example.backend.service.LudoCardService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ludification/ludo/cards")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class LudoCardController {

    private final LudoCardService ludoCardService;

    public LudoCardController(LudoCardService ludoCardService) {
        this.ludoCardService = ludoCardService;
    }

    @GetMapping
    public List<LudoCard> getLudoCards() {
        return ludoCardService.findAll();
    }

    @PostMapping
    public ResponseEntity<LudoCard> createLudoCard(@RequestBody LudoCard card) {
        LudoCard saved = ludoCardService.create(card);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLudoCard(@PathVariable Integer id) {
        if (!ludoCardService.delete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
