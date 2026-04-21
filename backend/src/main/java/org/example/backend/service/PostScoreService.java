package org.example.backend.service;

import org.example.backend.model.Post;
import org.example.backend.repository.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostScoreService {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Transactional
    public void recomputePostScore(Integer postId) {
        if (postId == null) {
            return;
        }

        Post post = postRepository.findById(postId).orElse(null);
        if (post == null) {
            return;
        }

        int likes = post.getLikesCount() == null ? 0 : post.getLikesCount();
        int comments = post.getCommentsCount() == null ? 0 : post.getCommentsCount();
        int views = post.getTotalViews() == null ? 0 : post.getTotalViews();
        int reposts = post.getRepostCount() == null ? 0 : post.getRepostCount();

        double score = (likes * 2.0)
                + (comments * 3.0)
                + (views * 0.5)
                + 1.0
                + (reposts * 4.0);

        jdbcTemplate.update("UPDATE posts SET post_score = ? WHERE post_id = ?", score, postId);
    }
}
