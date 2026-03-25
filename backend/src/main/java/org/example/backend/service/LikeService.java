package org.example.backend.service;

import org.example.backend.model.LikeEntity;
import org.example.backend.repository.LikeEntityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;

import java.util.List;
import java.util.HashMap;
import java.util.Map;

@Service
public class LikeService implements ILikeService {

    @Autowired
    LikeEntityRepository likeRepo;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Override
    public List<LikeEntity> retrieveAllLikes() {
        return likeRepo.findAll();
    }

    @Override
    @Transactional
    public LikeEntity addLike(LikeEntity like) {
        // Insert via JDBC to avoid persistence issues when sending nested partial entities.
        SimpleJdbcInsert insert = new SimpleJdbcInsert(jdbcTemplate)
                .withTableName("likes");

        Integer userId = like.getUser() != null ? like.getUser().getUserId() : null;
        Integer postId = like.getPost() != null ? like.getPost().getPostId() : null;

        Map<String, Object> params = new HashMap<>();
        params.put("user_id", userId);
        params.put("post_id", postId);
        params.put("created_at", like.getCreatedAt());

        insert = insert.usingColumns("user_id", "post_id", "created_at");

        insert.execute(params);
        Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
        return likeRepo.findById(id).orElse(null);
    }

    @Override
    public LikeEntity updateLike(LikeEntity like) {
        return likeRepo.save(like);
    }

    @Override
    public LikeEntity retrieveLike(Integer likeId) {
        return likeRepo.findById(likeId).orElse(null);
    }

    @Override
    public void removeLike(Integer likeId) {
        likeRepo.deleteById(likeId);
    }
}
