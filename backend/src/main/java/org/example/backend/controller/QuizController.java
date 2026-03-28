package org.example.backend.controller;

import org.example.backend.dto.ludification.QuizUpsertRequest;
import org.example.backend.dto.ludification.QuizView;
import org.example.backend.model.Quiz;
import org.example.backend.service.QuizService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ludification/quizzes")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @GetMapping
    public List<Quiz> getQuizzes() {
        return quizService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<QuizView> getQuizById(@PathVariable Integer id) {
        return quizService
                .findViewById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<QuizView> createQuiz(@RequestBody QuizUpsertRequest body) {
        QuizView created = quizService.create(body);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<QuizView> updateQuiz(@PathVariable Integer id, @RequestBody QuizUpsertRequest body) {
        return quizService
                .update(id, body)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteQuiz(@PathVariable Integer id) {
        if (!quizService.delete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
