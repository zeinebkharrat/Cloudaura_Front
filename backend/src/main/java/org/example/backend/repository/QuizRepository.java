package org.example.backend.repository;

import org.example.backend.model.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizRepository extends JpaRepository<Quiz, Integer> {

    /** Aligné sur une contrainte UNIQUE MySQL sur title (trim + casse comme en base). */
    @Query(value = "select count(*) from quizzes where lower(trim(title)) = lower(trim(:title))", nativeQuery = true)
    long countSameNormalizedTitle(@Param("title") String title);

    @Query(
            value = "select count(*) from quizzes where lower(trim(title)) = lower(trim(:title)) and quiz_id <> :id",
            nativeQuery = true)
    long countSameNormalizedTitleExceptId(@Param("title") String title, @Param("id") Integer id);
}
