package org.example.backend.service;

import org.example.backend.model.PuzzleImage;
import org.example.backend.repository.PuzzleImageRepository;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
public class PuzzleImageService {

    public static final Path PUZZLE_UPLOAD_DIR = Paths.get("uploads", "puzzles");

    private final PuzzleImageRepository puzzleRepo;

    public PuzzleImageService(PuzzleImageRepository puzzleRepo) {
        this.puzzleRepo = puzzleRepo;
    }

    public List<PuzzleImage> findAll() {
        return puzzleRepo.findAll();
    }

    public java.util.Optional<PuzzleImage> findById(Integer id) {
        return puzzleRepo.findById(id);
    }

    public PuzzleImage create(PuzzleImage puzzle) {
        if (puzzle.getCreatedAt() == null) {
            puzzle.setCreatedAt(new Date());
        }
        if (puzzle.getPublished() == null) {
            puzzle.setPublished(Boolean.TRUE);
        }
        return puzzleRepo.save(puzzle);
    }

    public PuzzleImage upload(String title, Boolean published, MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        try {
            Files.createDirectories(PUZZLE_UPLOAD_DIR);
            String ext = "";
            String original = file.getOriginalFilename();
            if (original != null && original.lastIndexOf('.') >= 0) {
                ext = original.substring(original.lastIndexOf('.'));
            }
            String filename = UUID.randomUUID() + ext;
            Path destination = PUZZLE_UPLOAD_DIR.resolve(filename);
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);

            PuzzleImage puzzle = new PuzzleImage();
            puzzle.setTitle(title);
            puzzle.setPublished(published);
            puzzle.setCreatedAt(new Date());
            puzzle.setImageDataUrl("/api/ludification/puzzles/files/" + filename);
            return puzzleRepo.save(puzzle);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public Resource loadFileAsResource(String filename) {
        try {
            Path file = PUZZLE_UPLOAD_DIR.resolve(filename).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND);
            }
            return resource;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    public boolean delete(Integer id) {
        if (!puzzleRepo.existsById(id)) {
            return false;
        }
        puzzleRepo.deleteById(id);
        return true;
    }
}
