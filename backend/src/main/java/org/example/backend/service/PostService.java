package org.example.backend.service;

import org.example.backend.model.Post;
import org.example.backend.repository.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PostService implements IPostService {

    @Autowired
    PostRepository postRepo;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Override
    public List<Post> retrievePosts() {
        return postRepo.findAll();
    }

    @Override
    @Transactional
    public Post addPost(Post post) {
        // Avoid JPA/Hibernate type issues for `content` by inserting via JDBC.
        // This also prevents Hibernate from trying to persist partial/attached entities.
        SimpleJdbcInsert insert = new SimpleJdbcInsert(jdbcTemplate)
                .withTableName("posts");

        Map<String, Object> params = new HashMap<>();
        params.put("author_id", post.getAuthor() != null ? post.getAuthor().getUserId() : null);
        params.put("content", post.getContent());
        params.put("location", post.getLocation());
        params.put("visibility", post.getVisibility());
        params.put("likes_count", post.getLikesCount());
        params.put("comments_count", post.getCommentsCount());
        params.put("created_at", post.getCreatedAt());
        params.put("updated_at", post.getUpdatedAt());

        // Provide explicit columns to avoid metadata mismatch.
        insert = insert.usingColumns(
                "author_id",
                "content",
                "location",
                "visibility",
                "likes_count",
                "comments_count",
                "created_at",
                "updated_at"
        );

        try {
            insert.execute(params);
            Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
            return postRepo.findById(id).orElse(null);
        } catch (Exception e) {
            // Fallback: if the column is stored as a binary type, write bytes.
            if (post.getContent() == null) throw e;

            Map<String, Object> byteParams = new HashMap<>(params);
            byteParams.put("content", post.getContent().getBytes(StandardCharsets.UTF_8));

            insert.execute(byteParams);
            Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
            return postRepo.findById(id).orElse(null);
        }
    }

    @Override
    public Post updatePost(Post post) {
        return postRepo.save(post);
    }

    @Override
    public Post retrievePost(Integer postId) {
        return postRepo.findById(postId).orElse(null);
    }

    @Override
    @Transactional
    public void removePost(Integer postId) {
        // Execute explicit SQL deletes to guarantee FK-safe ordering.
        jdbcTemplate.update("DELETE FROM likes WHERE post_id = ?", postId);
        jdbcTemplate.update("DELETE FROM comments WHERE post_id = ?", postId);
        jdbcTemplate.update("DELETE FROM post_media WHERE post_id = ?", postId);
        jdbcTemplate.update("DELETE FROM posts WHERE post_id = ?", postId);
    }
    
    @Override
    public List<Post> findPostsByAuthor(Integer authorId) {
        return postRepo.findByAuthorUserIdOrderByCreatedAtDesc(authorId);
    }
}
