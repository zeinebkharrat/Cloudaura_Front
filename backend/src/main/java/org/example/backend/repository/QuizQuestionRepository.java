package org.example.backend.repository;

import org.example.backend.model.QuizQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizQuestionRepository extends JpaRepository<QuizQuestion, Integer> {

    List<QuizQuestion> findByQuiz_QuizIdOrderByOrderIndexAsc(Integer quizId);

    @Modifying
    @Query("delete from QuizQuestion q where q.quiz.quizId = :quizId")
    void deleteByQuizId(@Param("quizId") Integer quizId);
}
