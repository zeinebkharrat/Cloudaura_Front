package org.example.backend.controller;

import org.example.backend.dto.ludification.QuizUpsertRequest;
import org.example.backend.dto.ludification.QuizQuestionInput;
import org.example.backend.dto.ludification.QuizView;
import org.example.backend.dto.ludification.RoadmapNodeRequest;
import org.example.backend.model.Crossword;
import org.example.backend.model.PuzzleImage;
import org.example.backend.model.Quiz;
import org.example.backend.model.QuizQuestion;
import org.example.backend.model.RoadmapNode;
import org.example.backend.repository.CrosswordRepository;
import org.example.backend.repository.PuzzleImageRepository;
import org.example.backend.repository.QuizQuestionRepository;
import org.example.backend.repository.QuizRepository;
import org.example.backend.repository.RoadmapNodeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ludification")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class LudificationController {
    private static final Path PUZZLE_UPLOAD_DIR = Paths.get("uploads", "puzzles");

    private final QuizRepository quizRepo;
    private final QuizQuestionRepository quizQuestionRepo;
    private final CrosswordRepository crossRepo;
    private final RoadmapNodeRepository roadRepo;
    private final PuzzleImageRepository puzzleRepo;

    public LudificationController(
            QuizRepository quizRepo,
            QuizQuestionRepository quizQuestionRepo,
            CrosswordRepository crossRepo,
            RoadmapNodeRepository roadRepo,
            PuzzleImageRepository puzzleRepo) {
        this.quizRepo = quizRepo;
        this.quizQuestionRepo = quizQuestionRepo;
        this.crossRepo = crossRepo;
        this.roadRepo = roadRepo;
        this.puzzleRepo = puzzleRepo;
    }

    // --- QUIZ ---

    @GetMapping("/quizzes")
    public List<Quiz> getQuizzes() {
        return quizRepo.findAll();
    }

    @GetMapping("/quizzes/{id}")
    public ResponseEntity<QuizView> getQuizById(@PathVariable Integer id) {
        return quizRepo
                .findById(id)
                .map(q -> ResponseEntity.ok(toQuizView(q)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/quizzes")
    @Transactional
    public ResponseEntity<QuizView> createQuiz(@RequestBody QuizUpsertRequest body) {
        Quiz q = new Quiz();
        applyQuizFields(q, body);
        if (q.getCreatedAt() == null) {
            q.setCreatedAt(new Date());
        }
        q = quizRepo.save(q);
        saveQuestionsForQuiz(q, body.questions());
        return ResponseEntity.status(HttpStatus.CREATED).body(toQuizView(q));
    }

    @PutMapping("/quizzes/{id}")
    @Transactional
    public ResponseEntity<QuizView> updateQuiz(@PathVariable Integer id, @RequestBody QuizUpsertRequest body) {
        return quizRepo
                .findById(id)
                .map(q -> {
                    applyQuizFields(q, body);
                    if (body.questions() != null) {
                        quizQuestionRepo.deleteByQuizId(id);
                        quizQuestionRepo.flush();
                        saveQuestionsForQuiz(q, body.questions());
                    }
                    quizRepo.save(q);
                    return ResponseEntity.ok(toQuizView(q));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/quizzes/{id}")
    @Transactional
    public ResponseEntity<Void> deleteQuiz(@PathVariable Integer id) {
        if (!quizRepo.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        quizQuestionRepo.deleteByQuizId(id);
        quizRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void applyQuizFields(Quiz q, QuizUpsertRequest body) {
        if (body.title() != null) {
            q.setTitle(body.title());
        }
        if (body.description() != null) {
            q.setDescription(body.description());
        }
        if (body.published() != null) {
            q.setPublished(body.published());
        }
        if (body.createdAt() != null) {
            q.setCreatedAt(body.createdAt());
        }
    }

    private void saveQuestionsForQuiz(Quiz q, List<QuizQuestionInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return;
        }
        int i = 0;
        for (QuizQuestionInput in : inputs) {
            QuizQuestion qq = new QuizQuestion();
            qq.setQuiz(q);
            qq.setOrderIndex(in.orderIndex() != null ? in.orderIndex() : i);
            qq.setQuestionText(in.questionText());
            qq.setImageUrl(in.imageUrl());
            qq.setOptionsJson(in.optionsJson());
            qq.setCorrectOptionIndex(in.correctOptionIndex());
            quizQuestionRepo.save(qq);
            i++;
        }
    }

    private QuizView toQuizView(Quiz q) {
        return new QuizView(
                q.getQuizId(),
                q.getTitle(),
                q.getDescription(),
                q.getPublished(),
                q.getCreatedAt(),
                quizQuestionRepo.findByQuiz_QuizIdOrderByOrderIndexAsc(q.getQuizId()));
    }

    // --- CROSSWORD ---

    @GetMapping("/crosswords")
    public List<Crossword> getCrosswords() {
        return crossRepo.findAll();
    }

    @GetMapping("/crosswords/{id}")
    public ResponseEntity<Crossword> getCrosswordById(@PathVariable Integer id) {
        return crossRepo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/crosswords")
    public Crossword createCrossword(@RequestBody Crossword c) {
        if (c.getCreatedAt() == null) {
            c.setCreatedAt(new Date());
        }
        return crossRepo.save(c);
    }

    @PutMapping("/crosswords/{id}")
    public ResponseEntity<Crossword> updateCrossword(@PathVariable Integer id, @RequestBody Crossword details) {
        return crossRepo
                .findById(id)
                .map(c -> {
                    c.setTitle(details.getTitle());
                    c.setDescription(details.getDescription());
                    c.setPublished(details.getPublished());
                    c.setGridJson(details.getGridJson());
                    return ResponseEntity.ok(crossRepo.save(c));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/crosswords/{id}")
    public ResponseEntity<Void> deleteCrossword(@PathVariable Integer id) {
        if (crossRepo.existsById(id)) {
            crossRepo.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    // --- ROADMAP ---

    @GetMapping("/roadmap")
    public List<RoadmapNode> getRoadmap() {
        return roadRepo.findAllByOrderByStepOrderAsc();
    }

    @PostMapping("/roadmap")
    @Transactional
    public RoadmapNode createRoadmapNode(@RequestBody RoadmapNodeRequest req) {
        RoadmapNode r = new RoadmapNode();
        r.setStepOrder(req.stepOrder());
        r.setNodeLabel(req.nodeLabel());
        if (req.quizId() != null) {
            quizRepo.findById(req.quizId()).ifPresent(r::setQuiz);
        }
        if (req.crosswordId() != null) {
            crossRepo.findById(req.crosswordId()).ifPresent(r::setCrossword);
        }
        r.setPuzzleId(req.puzzleId());
        return roadRepo.save(r);
    }

    @DeleteMapping("/roadmap/{id}")
    public ResponseEntity<Void> deleteRoadmapNode(@PathVariable Integer id) {
        if (roadRepo.existsById(id)) {
            roadRepo.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    // --- PUZZLE IMAGE ---

    @GetMapping("/puzzles")
    public List<PuzzleImage> getPuzzles() {
        return puzzleRepo.findAll();
    }

    @GetMapping("/puzzles/{id}")
    public ResponseEntity<PuzzleImage> getPuzzleById(@PathVariable Integer id) {
        return puzzleRepo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/puzzles")
    public ResponseEntity<PuzzleImage> createPuzzle(@RequestBody PuzzleImage puzzle) {
        if (puzzle.getCreatedAt() == null) {
            puzzle.setCreatedAt(new Date());
        }
        if (puzzle.getPublished() == null) {
            puzzle.setPublished(Boolean.TRUE);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(puzzleRepo.save(puzzle));
    }

    @PostMapping(value = "/puzzles/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PuzzleImage> uploadPuzzle(
            @RequestParam("title") String title,
            @RequestParam(value = "published", defaultValue = "true") Boolean published,
            @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
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
            return ResponseEntity.status(HttpStatus.CREATED).body(puzzleRepo.save(puzzle));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/puzzles/files/{filename:.+}")
    public ResponseEntity<Resource> getPuzzleFile(@PathVariable String filename) {
        try {
            Path file = PUZZLE_UPLOAD_DIR.resolve(filename).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(resource);
        } catch (Exception ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/puzzles/{id}")
    public ResponseEntity<Void> deletePuzzle(@PathVariable Integer id) {
        if (!puzzleRepo.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        puzzleRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
