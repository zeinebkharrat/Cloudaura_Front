package org.example.backend.service;

import org.example.backend.model.Post;

import java.util.List;

public interface IPostService {
    List<Post> retrievePosts();
    Post addPost(Post post);
    Post updatePost(Post post);
    Post retrievePost(Integer postId);
    Post repost(Integer originalPostId, Integer authorId, String caption);
    void removePost(Integer postId);
    List<Post> findPostsByAuthor(Integer authorId);
}

