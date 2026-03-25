package org.example.backend.service;

import org.example.backend.model.Post;
import org.example.backend.repository.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PostService implements IPostService {

    @Autowired
    PostRepository postRepo;

    @Override
    public List<Post> retrievePosts() {
        return postRepo.findAll();
    }

    @Override
    public Post addPost(Post post) {
        return postRepo.save(post);
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
    public void removePost(Integer postId) {
        postRepo.deleteById(postId);
    }
}
