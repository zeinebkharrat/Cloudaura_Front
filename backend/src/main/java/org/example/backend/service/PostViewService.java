package org.example.backend.service;

import org.example.backend.model.Post;
import org.example.backend.model.PostView;
import org.example.backend.model.User;
import org.example.backend.repository.PostRepository;
import org.example.backend.repository.PostViewRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Date;

@Service
public class PostViewService {

    @Autowired
    private PostViewRepository postViewRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PostScoreService postScoreService;

    @Autowired
    private MediaScoreService mediaScoreService;

    @Transactional
    public boolean recordMonthlyView(Integer postId, Integer userId) {
        if (postId == null || userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid post/user");
        }

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        String monthKey = MediaScoreService.currentMonthKeyUtc();
        boolean exists = postViewRepository.existsByUserUserIdAndPostPostIdAndMonthKey(userId, postId, monthKey);
        if (exists) {
            return false;
        }

        PostView view = new PostView();
        view.setUser(user);
        view.setPost(post);
        view.setMonthKey(monthKey);
        view.setCreatedAt(new Date());
        postViewRepository.save(view);

        Integer current = post.getTotalViews() == null ? 0 : post.getTotalViews();
        jdbcTemplate.update("UPDATE posts SET total_views = ? WHERE post_id = ?", current + 1, postId);

        postScoreService.recomputePostScore(postId);
        mediaScoreService.recomputeAuthorMonthlyScoreFromPost(postId);

        return true;
    }
}
