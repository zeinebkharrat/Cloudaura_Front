package org.example.backend.service;

import org.example.backend.model.Post;
import org.example.backend.model.SavedPost;
import org.example.backend.model.User;
import org.example.backend.repository.PostRepository;
import org.example.backend.repository.SavedPostRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class SavedPostService {

    private final SavedPostRepository savedPostRepository;
    private final UserRepository userRepository;
    private final PostRepository postRepository;

    public SavedPostService(SavedPostRepository savedPostRepository,
                            UserRepository userRepository,
                            PostRepository postRepository) {
        this.savedPostRepository = savedPostRepository;
        this.userRepository = userRepository;
        this.postRepository = postRepository;
    }

    @Transactional
    public Map<String, Object> toggleSave(Integer userId, Integer postId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.user_not_found"));
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.post_not_found"));

        return savedPostRepository.findByUserUserIdAndPostPostId(userId, postId)
                .map(existing -> {
                    savedPostRepository.delete(existing);
                    return Map.<String, Object>of("saved", false);
                })
                .orElseGet(() -> {
                    SavedPost row = new SavedPost();
                    row.setUser(user);
                    row.setPost(post);
                    row.setCreatedAt(new Date());
                    savedPostRepository.save(row);
                    return Map.<String, Object>of("saved", true);
                });
    }

    public List<Post> getSavedPosts(Integer userId) {
        return savedPostRepository.findByUserUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(SavedPost::getPost)
                .toList();
    }

    public boolean isSaved(Integer userId, Integer postId) {
        return savedPostRepository.existsByUserUserIdAndPostPostId(userId, postId);
    }
}
