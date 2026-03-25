package org.example.backend.service;

import org.example.backend.model.Comment;
import org.example.backend.repository.CommentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CommentService implements ICommentService {

    @Autowired
    CommentRepository commentRepo;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Override
    public List<Comment> retrieveAllComments() {
        return commentRepo.findAll();
    }

    @Override
    @Transactional
    public Comment addComment(Comment comment) {
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
        params.put("created_at", comment.getCreatedAt());
        params.put("updated_at", comment.getUpdatedAt());

        insert = insert.usingColumns(
                "post_id",
                "author_id",
                "parent_id",
                "content",
                "created_at",
                "updated_at"
        );

        try {
            insert.execute(params);
            Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
            return commentRepo.findById(id).orElse(null);
        } catch (Exception e) {
            if (comment.getContent() == null) throw e;
            Map<String, Object> byteParams = new HashMap<>(params);
            byteParams.put("content", comment.getContent().getBytes(StandardCharsets.UTF_8));

            insert.execute(byteParams);
            Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
            return commentRepo.findById(id).orElse(null);
        }
    }

    @Override
    public Comment updateComment(Comment comment) {
        return commentRepo.save(comment);
    }

    @Override
    public Comment retrieveComment(Integer commentId) {
        return commentRepo.findById(commentId).orElse(null);
    }

    @Override
    public void removeComment(Integer commentId) {
        commentRepo.deleteById(commentId);
    }
}
