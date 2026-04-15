package org.example.backend.service;

import org.example.backend.dto.ludification.QuizQuestionInput;
import org.example.backend.dto.ludification.QuizUpsertRequest;
import org.example.backend.dto.ludification.QuizView;
import org.example.backend.i18n.ApiRequestLang;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.Quiz;
import org.example.backend.model.QuizQuestion;
import org.example.backend.repository.QuizQuestionRepository;
import org.example.backend.repository.QuizRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
public class QuizService {

    private static final Logger log = LoggerFactory.getLogger(QuizService.class);

    private final QuizRepository quizRepo;
    private final QuizQuestionRepository quizQuestionRepo;
    private final TranslationService translationService;

    public QuizService(
            QuizRepository quizRepo,
            QuizQuestionRepository quizQuestionRepo,
            TranslationService translationService) {
        this.quizRepo = quizRepo;
        this.quizQuestionRepo = quizQuestionRepo;
        this.translationService = translationService;
    }

    @Transactional(readOnly = true)
    public List<Quiz> findAll() {
        String lang = ApiRequestLang.get();
        List<Quiz> list = quizRepo.findAll();
        for (Quiz q : list) {
            String title = q.getTitle();
            if (CatalogKeyUtil.looksLikeCatalogKey(title)) {
                q.setTitle(null);
            } else if (title != null) {
                q.setTitle(translationService.safeTranslate(title, lang));
            }
            String desc = q.getDescription();
            if (CatalogKeyUtil.looksLikeCatalogKey(desc)) {
                q.setDescription(null);
            } else if (desc != null) {
                q.setDescription(translationService.safeTranslate(desc, lang));
            }
        }
        return list;
    }

    @Transactional(readOnly = true)
    public Optional<QuizView> findViewById(Integer id) {
        return quizRepo.findById(id).map(this::toQuizView);
    }

    @Transactional
    public QuizView create(QuizUpsertRequest body) {
        Quiz q = new Quiz();
        applyQuizFields(q, body);
        if (q.getTitle() != null && !q.getTitle().isBlank()
                && quizRepo.countSameNormalizedTitle(q.getTitle().trim()) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "A quiz with this title already exists. Choose a different title.");
        }
        if (q.getTimeLimitSeconds() == null) {
            q.setTimeLimitSeconds(60);
        }
        if (q.getCreatedAt() == null) {
            q.setCreatedAt(new Date());
        }
        try {
            q = quizRepo.save(q);
            quizRepo.flush();
        } catch (DataIntegrityViolationException ex) {
            log.warn("Quiz create (header row): {}", conflictDetail(ex));
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Quiz header: " + conflictDetail(ex));
        }
        try {
            saveQuestionsForQuiz(q, body.questions());
        } catch (DataIntegrityViolationException ex) {
            log.warn("Quiz create (questions): {}", conflictDetail(ex));
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Quiz questions: " + conflictDetail(ex));
        }
        return toQuizView(q);
    }

    @Transactional
    public Optional<QuizView> update(Integer id, QuizUpsertRequest body) {
        return quizRepo
                .findById(id)
                .map(
                        q -> {
                            applyQuizFields(q, body);
                            if (q.getTitle() != null && !q.getTitle().isBlank()
                                    && quizRepo.countSameNormalizedTitleExceptId(q.getTitle().trim(), id) > 0) {
                                throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "A quiz with this title already exists. Choose a different title.");
                            }
                            if (body.questions() != null) {
                                quizQuestionRepo.deleteByQuizId(id);
                                quizQuestionRepo.flush();
                                try {
                                    saveQuestionsForQuiz(q, body.questions());
                                } catch (DataIntegrityViolationException ex) {
                                    log.warn("Quiz update (questions): {}", conflictDetail(ex));
                                    throw new ResponseStatusException(
                                            HttpStatus.CONFLICT, "Quiz questions: " + conflictDetail(ex));
                                }
                            }
                            try {
                                quizRepo.save(q);
                                quizRepo.flush();
                            } catch (DataIntegrityViolationException ex) {
                                log.warn("Quiz update (header row): {}", conflictDetail(ex));
                                throw new ResponseStatusException(
                                        HttpStatus.CONFLICT, "Quiz header: " + conflictDetail(ex));
                            }
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
            String t = body.title().trim();
            q.setTitle(t.isEmpty() ? null : t);
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
        if (body.coverImageUrl() != null) {
            String u = body.coverImageUrl().trim();
            q.setCoverImageUrl(u.isEmpty() ? null : u);
        }
        if (body.timeLimitSeconds() != null) {
            q.setTimeLimitSeconds(normalizeTimeLimitSeconds(body.timeLimitSeconds()));
        }
    }

    /** Multiple de 3, entre 3 et 3600 s (1 h). */
    private static String conflictDetail(DataIntegrityViolationException ex) {
        Throwable t = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause() : ex;
        String m = t.getMessage();
        if (m == null) {
            m = ex.getMessage();
        }
        if (m == null) {
            return "constraint violation";
        }
        m = m.replace('\r', ' ').replace('\n', ' ');
        if (m.length() > 400) {
            return m.substring(0, 400) + "…";
        }
        return m;
    }

    private static int normalizeTimeLimitSeconds(int raw) {
        int v = Math.max(3, Math.min(3600, raw));
        int mod = v % 3;
        if (mod != 0) {
            v += 3 - mod;
        }
        if (v > 3600) {
            v = 3600 - (3600 % 3);
        }
        return v;
    }

    private void saveQuestionsForQuiz(Quiz q, List<QuizQuestionInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return;
        }
        // Tri par orderIndex puis indices 0..n-1 uniques : évite Duplicate entry sur (quiz_id, order_index) si la base impose une contrainte unique.
        List<QuizQuestionInput> rows = new ArrayList<>(inputs);
        rows.sort(Comparator.comparingInt(in -> in.orderIndex() != null ? in.orderIndex() : Integer.MAX_VALUE));
        int i = 0;
        for (QuizQuestionInput in : rows) {
            QuizQuestion qq = new QuizQuestion();
            qq.setQuiz(q);
            qq.setOrderIndex(i);
            qq.setQuestionText(in.questionText());
            qq.setImageUrl(in.imageUrl());
            qq.setOptionsJson(in.optionsJson());
            qq.setCorrectOptionIndex(in.correctOptionIndex());
            quizQuestionRepo.save(qq);
            i++;
        }
    }

    private QuizView toQuizView(Quiz q) {
        Integer t = q.getTimeLimitSeconds();
        if (t == null || t < 3) {
            t = 60;
        }
        t = normalizeTimeLimitSeconds(t);
        return new QuizView(
                q.getQuizId(),
                q.getTitle(),
                q.getDescription(),
                q.getPublished(),
                q.getCreatedAt(),
                q.getCoverImageUrl(),
                t,
                quizQuestionRepo.findByQuiz_QuizIdOrderByOrderIndexAsc(q.getQuizId()));
    }
}
