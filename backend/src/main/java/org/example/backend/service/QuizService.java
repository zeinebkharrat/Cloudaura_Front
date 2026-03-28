package org.example.backend.service;

import org.example.backend.dto.ludification.QuizQuestionInput;
import org.example.backend.dto.ludification.QuizUpsertRequest;
import org.example.backend.dto.ludification.QuizView;
import org.example.backend.model.Quiz;
import org.example.backend.model.QuizQuestion;
import org.example.backend.repository.QuizQuestionRepository;
import org.example.backend.repository.QuizRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class QuizService {

    private final QuizRepository quizRepo;
    private final QuizQuestionRepository quizQuestionRepo;

    public QuizService(QuizRepository quizRepo, QuizQuestionRepository quizQuestionRepo) {
        this.quizRepo = quizRepo;
        this.quizQuestionRepo = quizQuestionRepo;
    }

    public List<Quiz> findAll() {
        return quizRepo.findAll();
    }

    public Optional<QuizView> findViewById(Integer id) {
        return quizRepo.findById(id).map(this::toQuizView);
    }

    @Transactional
    public QuizView create(QuizUpsertRequest body) {
        Quiz q = new Quiz();
        applyQuizFields(q, body);
        if (q.getCreatedAt() == null) {
            q.setCreatedAt(new Date());
        }
        q = quizRepo.save(q);
        saveQuestionsForQuiz(q, body.questions());
        return toQuizView(q);
    }

    @Transactional
    public Optional<QuizView> update(Integer id, QuizUpsertRequest body) {
        return quizRepo
                .findById(id)
                .map(
                        q -> {
                            applyQuizFields(q, body);
                            if (body.questions() != null) {
                                quizQuestionRepo.deleteByQuizId(id);
                                quizQuestionRepo.flush();
                                saveQuestionsForQuiz(q, body.questions());
                            }
                            quizRepo.save(q);
                            return toQuizView(q);
                        });
    }

    @Transactional
    public boolean delete(Integer id) {
        if (!quizRepo.existsById(id)) {
            return false;
        }
        quizQuestionRepo.deleteByQuizId(id);
        quizRepo.deleteById(id);
        return true;
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
}
