package org.example.backend.controller;

import org.example.backend.model.PuzzleImage;
import org.example.backend.service.PuzzleImageService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/ludification/puzzles")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class PuzzleImageController {

    private final PuzzleImageService puzzleImageService;

    public PuzzleImageController(PuzzleImageService puzzleImageService) {
        this.puzzleImageService = puzzleImageService;
    }

    @GetMapping
    public List<PuzzleImage> getPuzzles() {
        return puzzleImageService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<PuzzleImage> getPuzzleById(@PathVariable Integer id) {
        return puzzleImageService
                .findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<PuzzleImage> createPuzzle(@RequestBody PuzzleImage puzzle) {
        PuzzleImage saved = puzzleImageService.create(puzzle);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PuzzleImage> uploadPuzzle(
            @RequestParam("title") String title,
            @RequestParam(value = "published", defaultValue = "true") Boolean published,
            @RequestParam("file") MultipartFile file) {
        PuzzleImage saved = puzzleImageService.upload(title, published, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/files/{filename:.+}")
    public ResponseEntity<Resource> getPuzzleFile(@PathVariable String filename) {
        Resource resource = puzzleImageService.loadFileAsResource(filename);
        return ResponseEntity.ok(resource);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePuzzle(@PathVariable Integer id) {
        if (!puzzleImageService.delete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
