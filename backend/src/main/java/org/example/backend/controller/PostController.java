package org.example.backend.controller;

import org.example.backend.model.Post;
import org.example.backend.service.IPostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/post")
public class PostController {

    @Autowired
    IPostService postService;

    @GetMapping("/allPosts")
    public List<Post> getAllPosts() {
        return postService.retrievePosts();
    }

    @PostMapping("/addPost")
    public Post addPost(@RequestBody Post post) {
        return postService.addPost(post);
    }

    @PutMapping("/updatePost")
    public Post updatePost(@RequestBody Post post) {
        return postService.updatePost(post);
    }

    @DeleteMapping("/deletePost/{id}")
    public void deletePost(@PathVariable Integer id) {
        postService.removePost(id);
    }

    @GetMapping("getPost/{id}")
    public Post getPost(@PathVariable Integer id) {
        return postService.retrievePost(id);
    }
}

