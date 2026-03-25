package org.example.backend.service;

import org.example.backend.model.Post;

import java.util.List;

public interface IPostService {
    List<Post> retrievePosts();
    Post addPost(Post post);
    Post updatePost(Post post);
    Post retrievePost(Integer postId);
    void removePost(Integer postId);
}

