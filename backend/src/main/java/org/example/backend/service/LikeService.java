package org.example.backend.service;

import org.example.backend.model.LikeEntity;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.repository.LikeEntityRepository;
import org.example.backend.repository.PostRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class LikeService implements ILikeService {

    @Autowired
    LikeEntityRepository likeRepo;
    
    @Autowired
    PostRepository postRepo;
    
    @Autowired
    UserRepository userRepo;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    PostScoreService postScoreService;

    @Autowired
    MediaScoreService mediaScoreService;

    @Autowired
    UserNotificationService userNotificationService;

    @Override
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<LikeEntity> retrieveAllLikes() {
        return likeRepo.findAllWithUserAndPostGraph();
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
        if (postId != null) {
            refreshPostLikesCount(postId);
        }
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
        LikeEntity existing = likeRepo.findById(likeId).orElse(null);
        likeRepo.deleteById(likeId);
        if (existing != null && existing.getPost() != null && existing.getPost().getPostId() != null) {
            refreshPostLikesCount(existing.getPost().getPostId());
        }
    }
    
    // New JWT-authenticated methods
    @Override
    @Transactional
    public LikeEntity toggleLike(Integer postId, Integer userId) {
        // Validate post and user exist
        Post post = postRepo.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Check if user already liked this post
        Optional<LikeEntity> existingLike = likeRepo.findByUserAndPost(user, post);
        
        if (existingLike.isPresent()) {
            // Unlike the post
            likeRepo.delete(existingLike.get());
            refreshPostLikesCount(postId);
            return null; // Return null to indicate unliked
        } else {
            // Like the post
            LikeEntity newLike = new LikeEntity();
            newLike.setUser(user);
            newLike.setPost(post);
            newLike.setCreatedAt(new Date());
            
            LikeEntity saved = likeRepo.save(newLike);
            refreshPostLikesCount(postId);
            if (post.getAuthor() != null) {
                userNotificationService.notifyPostInteraction(
                        post.getAuthor().getUserId(),
                        post.getPostId(),
                        "POST_LIKE",
                        user
                );
            }
            return saved;
        }
    }
    
    @Override
    public boolean isPostLikedByUser(Integer postId, Integer userId) {
        Post post = postRepo.findById(postId).orElse(null);
        User user = userRepo.findById(userId).orElse(null);
        
        if (post == null || user == null) {
            return false;
        }
        
        return likeRepo.findByUserAndPost(user, post).isPresent();
    }
    
    @Override
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<LikeEntity> getLikesByPost(Integer postId) {
        return likeRepo.findByPostIdWithGraph(postId);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> getLikesByPostApiPayload(Integer postId, Integer currentUserIdOrNull) {
        List<LikeEntity> likes = likeRepo.findByPostIdWithGraph(postId);
        List<String> userNicknames = likes.stream()
                .map(like -> like.getUser() != null && like.getUser().getUsername() != null
                        ? like.getUser().getUsername()
                        : "User")
                .collect(Collectors.toList());
        boolean isLiked = currentUserIdOrNull != null && isPostLikedByUser(postId, currentUserIdOrNull);
        Map<String, Object> response = new HashMap<>();
        response.put("likes", likes);
        response.put("count", likes.size());
        response.put("isLikedByCurrentUser", isLiked);
        response.put("userNicknames", userNicknames);
        return response;
    }
    
    @Override
    @Transactional
    public void unlikePost(Integer postId, Integer userId) {
        Post post = postRepo.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Optional<LikeEntity> existingLike = likeRepo.findByUserAndPost(user, post);
        existingLike.ifPresent(like -> {
            likeRepo.delete(like);
            refreshPostLikesCount(postId);
        });
    }

    private void refreshPostLikesCount(Integer postId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM likes WHERE post_id = ?",
                Integer.class,
                postId
        );

        jdbcTemplate.update(
                "UPDATE posts SET likes_count = ? WHERE post_id = ?",
                count != null ? count : 0,
                postId
        );

            postScoreService.recomputePostScore(postId);
            mediaScoreService.recomputeAuthorMonthlyScoreFromPost(postId);
    }
}
