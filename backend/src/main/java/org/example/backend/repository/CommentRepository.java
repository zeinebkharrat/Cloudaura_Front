package org.example.backend.repository;

import org.example.backend.model.Comment;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Integer> {
    List<Comment> findByPost(Post post);
    List<Comment> findByAuthor(User user);
    List<Comment> findByPostOrderByCreatedAtAsc(Post post);

    @Modifying
    @Query("delete from Comment c where c.post.postId = :postId and c.parent is not null")
    void deleteRepliesByPostId(@Param("postId") Integer postId);

    @Modifying
    @Query("delete from Comment c where c.post.postId = :postId and c.parent is null")
    void deleteRootCommentsByPostId(@Param("postId") Integer postId);
}

