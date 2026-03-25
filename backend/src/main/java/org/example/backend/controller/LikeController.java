package org.example.backend.controller;

import org.example.backend.model.LikeEntity;
import org.example.backend.service.ILikeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/like")
public class LikeController {

    @Autowired
    ILikeService likeService;

    @GetMapping("/allLikes")
    public List<LikeEntity> getAllLikes() {
        return likeService.retrieveAllLikes();
    }

    @PostMapping("/addLike")
    public LikeEntity addLike(@RequestBody LikeEntity like) {
        return likeService.addLike(like);
    }

    @PutMapping("/updateLike")
    public LikeEntity updateLike(@RequestBody LikeEntity like) {
        return likeService.updateLike(like);
    }

    @DeleteMapping("/deleteLike/{id}")
    public void deleteLike(@PathVariable Integer id) {
        likeService.removeLike(id);
    }

    @GetMapping("/getLike/{id}")
    public LikeEntity getLike(@PathVariable Integer id) {
        return likeService.retrieveLike(id);
    }
}

