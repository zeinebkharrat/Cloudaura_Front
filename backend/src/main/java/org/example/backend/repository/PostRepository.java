package org.example.backend.repository;

import org.example.backend.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post,Integer> {
    List<Post> findByAuthorUserId(Integer authorId);
    List<Post> findByAuthorUserIdOrderByCreatedAtDesc(Integer authorId);
    List<Post> findTop5ByAuthorUserIdOrderByCreatedAtDesc(Integer authorId);
    long countByAuthorUserId(Integer authorId);

    @Query("SELECT DISTINCT p FROM Post p "
            + "LEFT JOIN FETCH p.author "
            + "LEFT JOIN FETCH p.repostOf "
            + "ORDER BY p.createdAt DESC, p.postId DESC")
    List<Post> findAllWithAuthorGraph();

        long countByRepostOfPostId(Integer repostOfPostId);

        @Query("SELECT COALESCE(SUM(p.likesCount), 0), COALESCE(SUM(p.commentsCount), 0), COALESCE(SUM(p.totalViews), 0), COUNT(p), COALESCE(SUM(p.repostCount), 0) "
            + "FROM Post p "
            + "WHERE p.author.userId = :userId "
            + "AND p.createdAt >= :start "
            + "AND p.createdAt < :end")
        Object[] aggregateUserPostMetricsForMonth(
            @Param("userId") Integer userId,
            @Param("start") Date start,
            @Param("end") Date end
        );
}
