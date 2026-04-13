package org.example.backend.service;

import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.repository.PostRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PostService implements IPostService {

    @Autowired
    PostRepository postRepo;

    @Autowired
    UserRepository userRepository;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Override
    @Transactional(readOnly = true)
    public List<Post> retrievePosts() {
        return postRepo.findAllWithAuthorGraph();
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
        params.put("hashtags", post.getHashtags());
        params.put("location", post.getLocation());
        params.put("visibility", post.getVisibility());
        params.put("repost_of_post_id", post.getRepostOf() != null ? post.getRepostOf().getPostId() : null);
        params.put("likes_count", post.getLikesCount());
        params.put("comments_count", post.getCommentsCount());
        params.put("created_at", post.getCreatedAt());
        params.put("updated_at", post.getUpdatedAt());

        // Provide explicit columns to avoid metadata mismatch.
        insert = insert.usingColumns(
                "author_id",
                "content",
                "hashtags",
                "location",
                "visibility",
                "repost_of_post_id",
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
    public Post repost(Integer originalPostId, Integer authorId, String caption) {
        Post original = postRepo.findById(originalPostId).orElse(null);
        User author = userRepository.findById(authorId).orElse(null);
        if (original == null || author == null) {
            return null;
        }

        String normalizedCaption = caption == null ? "" : caption.trim();

        Post repost = new Post();
        repost.setAuthor(author);
        repost.setContent(normalizedCaption);
        repost.setHashtags(original.getHashtags());
        repost.setLocation(original.getLocation());
        repost.setVisibility(original.getVisibility() != null ? original.getVisibility() : "public");
        repost.setRepostOf(original);
        repost.setLikesCount(0);
        repost.setCommentsCount(0);
        Date now = new Date();
        repost.setCreatedAt(now);
        repost.setUpdatedAt(now);
        return addPost(repost);
    }

    @Override
    @Transactional
    public void removePost(Integer postId) {
        // Delete the selected post plus every repost that descends from it.
        // Build the repost tree in Java to stay compatible with older MySQL versions.
        List<Integer> targetPostIds = collectDescendantPostIds(postId);

        if (targetPostIds.isEmpty()) {
            return;
        }

        String placeholders = String.join(",", Collections.nCopies(targetPostIds.size(), "?"));
        Object[] args = targetPostIds.toArray();

        // Execute explicit SQL deletes to guarantee FK-safe ordering.
        jdbcTemplate.update(
                "UPDATE posts SET repost_of_post_id = NULL "
                        + "WHERE post_id IN (" + placeholders + ") "
                        + "AND repost_of_post_id IN (" + placeholders + ")",
                concat(args, args)
        );
        jdbcTemplate.update("DELETE FROM saved_posts WHERE post_id IN (" + placeholders + ")", args);
        jdbcTemplate.update("DELETE FROM likes WHERE post_id IN (" + placeholders + ")", args);
        jdbcTemplate.update("UPDATE comments SET parent_id = NULL WHERE post_id IN (" + placeholders + ")", args);
        jdbcTemplate.update("DELETE FROM comments WHERE post_id IN (" + placeholders + ")", args);
        jdbcTemplate.update("DELETE FROM post_media WHERE post_id IN (" + placeholders + ")", args);
        jdbcTemplate.update("DELETE FROM posts WHERE post_id IN (" + placeholders + ")", args);
    }

    private List<Integer> collectDescendantPostIds(Integer rootPostId) {
        Set<Integer> visited = new LinkedHashSet<>();
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        queue.add(rootPostId);

        while (!queue.isEmpty()) {
            Integer current = queue.poll();
            if (current == null || !visited.add(current)) {
                continue;
            }

            List<Integer> children = jdbcTemplate.queryForList(
                    "SELECT post_id FROM posts WHERE repost_of_post_id = ?",
                    Integer.class,
                    current
            );

            queue.addAll(children);
        }

        return List.copyOf(visited);
    }

    private Object[] concat(Object[] first, Object[] second) {
        Object[] merged = new Object[first.length + second.length];
        System.arraycopy(first, 0, merged, 0, first.length);
        System.arraycopy(second, 0, merged, first.length, second.length);
        return merged;
    }
    
    @Override
    public List<Post> findPostsByAuthor(Integer authorId) {
        return postRepo.findByAuthorUserIdOrderByCreatedAtDesc(authorId);
    }
}
