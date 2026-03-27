package org.example.backend.repository;

import org.example.backend.model.LikeEntity;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LikeEntityRepository extends JpaRepository<LikeEntity, Integer> {
    Optional<LikeEntity> findByUserAndPost(User user, Post post);
    List<LikeEntity> findByPost(Post post);
    List<LikeEntity> findByUser(User user);
}

