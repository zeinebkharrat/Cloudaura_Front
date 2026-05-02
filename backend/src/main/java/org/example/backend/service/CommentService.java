package org.example.backend.service;

import org.example.backend.model.Ban;
import org.example.backend.model.Comment;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.repository.BanRepository;
import org.example.backend.repository.CommentRepository;
import org.example.backend.repository.PostRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;

import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
public class CommentService implements ICommentService {

    private static final int SECOND_OFFENSE_MUTE_MINUTES = 15;

    @Autowired
    CommentRepository commentRepo;
    
    @Autowired
    PostRepository postRepo;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    PostScoreService postScoreService;

    @Autowired
    MediaScoreService mediaScoreService;

    @Autowired
    SightengineCommentModerationService moderationService;

    @Autowired
    BanRepository banRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    EmailService emailService;

    @Autowired
    UserNotificationService userNotificationService;

    @Override
    @Transactional(readOnly = true)
    public List<Comment> retrieveAllComments() {
        return commentRepo.findAllWithGraph();
    }

    @Override
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public Comment addComment(Comment comment) {
        User author = requireAuthor(comment);
        ensureUserCanComment(author);
        ensurePostAllowsComments(comment);
        CommentModerationResult moderation = applyModeration(comment);
        applyEscalationPolicy(author, moderation.abuseCategories());

        // Insert via JDBC to avoid JPA/Lob datatype issues for `content`.
        SimpleJdbcInsert insert = new SimpleJdbcInsert(jdbcTemplate)
                .withTableName("comments");

        Integer postId = comment.getPost() != null ? comment.getPost().getPostId() : null;
        Integer authorId = comment.getAuthor() != null ? comment.getAuthor().getUserId() : null;
        Integer parentId = comment.getParent() != null ? comment.getParent().getCommentId() : null;

        Map<String, Object> params = new HashMap<>();
        params.put("post_id", postId);
        params.put("author_id", authorId);
        params.put("parent_id", parentId);
        params.put("content", comment.getContent());
        params.put("original_content", comment.getOriginalContent());
        params.put("sanitized_content", comment.getSanitizedContent());
        params.put("abuse_categories", comment.getAbuseCategories());
        params.put("gifs", comment.getGifs());
        params.put("created_at", comment.getCreatedAt());
        params.put("updated_at", comment.getUpdatedAt());

        insert = insert.usingColumns(
                "post_id",
                "author_id",
                "parent_id",
                "content",
                "original_content",
                "sanitized_content",
                "abuse_categories",
                "gifs",
                "created_at",
                "updated_at"
        );

        try {
            insert.execute(params);
            Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
            if (postId != null) {
                refreshPostCommentsCount(postId);
                notifyPostCommentAuthor(postId, author);
            }
            return commentRepo.findById(id).orElse(null);
        } catch (Exception e) {
            if (comment.getContent() == null) throw e;
            Map<String, Object> byteParams = new HashMap<>(params);
            byteParams.put("content", comment.getContent().getBytes(StandardCharsets.UTF_8));

            insert.execute(byteParams);
            Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
            if (postId != null) {
                refreshPostCommentsCount(postId);
                notifyPostCommentAuthor(postId, author);
            }
            return commentRepo.findById(id).orElse(null);
        }
    }

    @Override
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public Comment updateComment(Comment comment) {
        User author = requireAuthor(comment);
        ensureUserCanComment(author);
        ensurePostAllowsComments(comment);
        CommentModerationResult moderation = applyModeration(comment);
        applyEscalationPolicy(author, moderation.abuseCategories());
        return commentRepo.save(comment);
    }

    @Override
    public Comment retrieveComment(Integer commentId) {
        return commentRepo.findById(commentId).orElse(null);
    }

    @Override
    @Transactional
    public void removeComment(Integer commentId) {
        Comment existing = commentRepo.findById(commentId).orElse(null);

        List<Integer> targetCommentIds = collectDescendantCommentIds(commentId);
        if (!targetCommentIds.isEmpty()) {
            String placeholders = String.join(",", Collections.nCopies(targetCommentIds.size(), "?"));
            Object[] args = targetCommentIds.toArray();

            // Break intra-branch references, then delete every node in the branch.
            jdbcTemplate.update("UPDATE comments SET parent_id = NULL WHERE comment_id IN (" + placeholders + ")", args);
            jdbcTemplate.update("DELETE FROM comments WHERE comment_id IN (" + placeholders + ")", args);
        }

        if (existing != null && existing.getPost() != null && existing.getPost().getPostId() != null) {
            refreshPostCommentsCount(existing.getPost().getPostId());
        }
    }
    
    // New JWT-authenticated method
    @Override
    @Transactional(readOnly = true)
    public List<Comment> retrieveCommentsByPost(Integer postId) {
        return commentRepo.findByPostIdWithGraph(postId);
    }

    private void refreshPostCommentsCount(Integer postId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM comments WHERE post_id = ?",
                Integer.class,
                postId
        );

        jdbcTemplate.update(
                "UPDATE posts SET comments_count = ? WHERE post_id = ?",
                count != null ? count : 0,
                postId
        );

            postScoreService.recomputePostScore(postId);
            mediaScoreService.recomputeAuthorMonthlyScoreFromPost(postId);
    }

    private List<Integer> collectDescendantCommentIds(Integer rootCommentId) {
        Set<Integer> visited = new LinkedHashSet<>();
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        queue.add(rootCommentId);

        while (!queue.isEmpty()) {
            Integer current = queue.poll();
            if (current == null || !visited.add(current)) {
                continue;
            }

            List<Integer> children = jdbcTemplate.queryForList(
                    "SELECT comment_id FROM comments WHERE parent_id = ?",
                    Integer.class,
                    current
            );
            queue.addAll(children);
        }

        return List.copyOf(visited);
    }

    private void notifyPostCommentAuthor(Integer postId, User commentAuthor) {
        Post targetPost = postRepo.findById(postId).orElse(null);
        if (targetPost == null || targetPost.getAuthor() == null) {
            return;
        }
        userNotificationService.notifyPostInteraction(
                targetPost.getAuthor().getUserId(),
                postId,
                "POST_COMMENT",
                commentAuthor
        );
    }

    private CommentModerationResult applyModeration(Comment comment) {
        String incoming = comment.getContent();
        CommentModerationResult moderation = moderationService.moderateComment(incoming);

        comment.setOriginalContent(moderation.originalContent());
        comment.setSanitizedContent(moderation.sanitizedContent());
        comment.setContent(moderation.sanitizedContent());

        List<String> categories = moderation.abuseCategories();
        comment.setAbuseCategories(categories.isEmpty() ? null : String.join(",", categories));
        return moderation;
    }

    private User requireAuthor(Comment comment) {
        if (comment == null || comment.getAuthor() == null || comment.getAuthor().getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }

        Integer userId = comment.getAuthor().getUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void ensurePostAllowsComments(Comment comment) {
        Integer postId = comment != null && comment.getPost() != null ? comment.getPost().getPostId() : null;
        if (postId == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Post is required");
        }

        Post post = postRepo.findById(postId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        if (Boolean.FALSE.equals(post.getCommentsEnabled())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Comments are disabled for this post");
        }
    }

    private void ensureUserCanComment(User user) {
        // Validation removed: user can comment even if previously banned or restricted
    }

    private void applyEscalationPolicy(User user, List<String> categories) {
        // Escalation policy removed: Bad words will just be sanitized with asterisks.
    }

    private int resolveBanDays(int previousBanEvents) {
        return 3 << previousBanEvents;
    }

    private void sendSecondOffenseWarning(User user, Date mutedUntil, List<String> categories) {
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }
        emailService.sendCommentModerationWarningEmail(
                user.getEmail(),
                user.getFirstName(),
                mutedUntil,
                String.join(", ", categories)
        );
    }

    private void sendEscalatedBanEmail(User user, Date expiresAt, int banDays, List<String> categories) {
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }
        emailService.sendCommentBanEmail(
                user.getEmail(),
                user.getFirstName(),
                expiresAt,
                banDays,
                String.join(", ", categories)
        );
    }

    private String formatDateTime(Date date) {
        return new SimpleDateFormat("yyyy-MM-dd HH:mm").format(date);
    }
}
