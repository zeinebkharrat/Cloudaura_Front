package org.example.backend.repository;

import org.example.backend.model.LikeEntity;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LikeEntityRepository extends JpaRepository<LikeEntity, Integer> {
    Optional<LikeEntity> findByUserAndPost(User user, Post post);
    List<LikeEntity> findByPost(Post post);
    List<LikeEntity> findByUser(User user);
        List<LikeEntity> findTop5ByUserUserIdOrderByCreatedAtDesc(Integer userId);
        long countByUserUserId(Integer userId);
    void deleteByPostPostId(Integer postId);

    @Query("SELECT DISTINCT l FROM LikeEntity l "
            + "JOIN FETCH l.user "
            + "JOIN FETCH l.post p "
            + "LEFT JOIN FETCH p.author "
            + "LEFT JOIN FETCH p.repostOf")
    List<LikeEntity> findAllWithUserAndPostGraph();

    @Query("SELECT DISTINCT l FROM LikeEntity l "
            + "JOIN FETCH l.user "
            + "JOIN FETCH l.post p "
            + "LEFT JOIN FETCH p.author "
            + "LEFT JOIN FETCH p.repostOf "
            + "WHERE p.postId = :postId")
    List<LikeEntity> findByPostIdWithGraph(@Param("postId") Integer postId);
}

