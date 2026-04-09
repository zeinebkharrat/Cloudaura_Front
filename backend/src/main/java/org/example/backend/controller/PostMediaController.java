package org.example.backend.controller;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

import org.example.backend.model.PostMedia;
import org.example.backend.model.MediaType;
import org.example.backend.model.User;
import org.example.backend.service.IPostMediaService;
import org.example.backend.repository.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import org.example.backend.model.Post;

import java.io.IOException;

@RestController
@RequestMapping("/media")
public class PostMediaController {

    @Autowired
    IPostMediaService mediaService;

    @Autowired
    PostRepository postRepository;

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
        PostMedia media = mediaService.retrieveMediaWithPostAuthor(id);
        if (media == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Media not found");
        }

        Post linkedPost = media.getPost();
        if (linkedPost == null || linkedPost.getAuthor() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Media is not linked to a valid post");
        }

        User currentUser = getCurrentUser();
        if (!linkedPost.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the post owner can delete media");
        }

        mediaService.removeMedia(id);
    }

    @GetMapping("/getMedia/{id}")
    public PostMedia getMedia(@PathVariable Integer id) {
        return mediaService.retrieveMedia(id);
    }

    /**
     * Uploads an image/video to the backend filesystem and creates a PostMedia record.
     * Only the post owner can upload media.
     * Consumed by the Angular CommunityComponent.
     */
    @PostMapping(
            value = "/upload",
            consumes = { "multipart/form-data" }
    )
    public PostMedia uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestParam("postId") Integer postId,
            @RequestParam("mediaType") MediaType mediaType,
            @RequestParam(value = "orderIndex", required = false) Integer orderIndex
    ) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier media vide.");
        }

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post introuvable : " + postId));

        // Check if current user is the post owner
        User currentUser = getCurrentUser();
        if (!post.getAuthor().getUserId().equals(currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the post owner can upload media");
        }

        // Store uploads under: <project>/uploads/post-media/
        Path uploadRoot = Paths.get(System.getProperty("user.dir"), "uploads", "post-media");
        Files.createDirectories(uploadRoot);

        String original = file.getOriginalFilename();
        String safeOriginal = (original == null ? "media" : original)
                .replaceAll("[^a-zA-Z0-9._-]", "_");
        // Keep filenames reasonably short.
        if (safeOriginal.length() > 80) {
            safeOriginal = safeOriginal.substring(safeOriginal.length() - 80);
        }

        String storedName = UUID.randomUUID() + "_" + safeOriginal;
        Path targetPath = uploadRoot.resolve(storedName);
        file.transferTo(targetPath);

        String fileUrl = "/uploads/post-media/" + storedName;

        PostMedia media = new PostMedia();
        media.setPost(post);
        media.setFileUrl(fileUrl);
        media.setMediaType(mediaType);
        media.setOrderIndex(orderIndex != null ? orderIndex : 0);

        return mediaService.addMedia(media);
    }
    
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        
        // Extract User entity from CustomUserDetails
        Object principal = authentication.getPrincipal();
        if (principal instanceof org.example.backend.service.CustomUserDetailsService.CustomUserDetails) {
            return ((org.example.backend.service.CustomUserDetailsService.CustomUserDetails) principal).getUser();
        }
        
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication principal");
    }
}

