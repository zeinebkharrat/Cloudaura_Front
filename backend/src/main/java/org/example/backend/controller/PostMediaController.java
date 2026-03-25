package org.example.backend.controller;

import org.example.backend.model.PostMedia;
import org.example.backend.service.IPostMediaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/media")
public class PostMediaController {

    @Autowired
    IPostMediaService mediaService;

    @GetMapping("/allMedias")
    public List<PostMedia> getAllMedia() {
        return mediaService.retrieveAllMedia();
    }

    @PostMapping("/addMedia")
    public PostMedia addMedia(@RequestBody PostMedia media) {
        return mediaService.addMedia(media);
    }

    @PutMapping("/updateMedia")
    public PostMedia updateMedia(@RequestBody PostMedia media) {
        return mediaService.updateMedia(media);
    }

    @DeleteMapping("/deleteMedia/{id}")
    public void deleteMedia(@PathVariable Integer id) {
        mediaService.removeMedia(id);
    }

    @GetMapping("/getMedia/{id}")
    public PostMedia getMedia(@PathVariable Integer id) {
        return mediaService.retrieveMedia(id);
    }
}

