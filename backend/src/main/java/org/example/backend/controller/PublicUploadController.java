package org.example.backend.controller;

import org.example.backend.dto.ImageUploadResponse;
import org.example.backend.service.ImageUploadService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/public/uploads")
public class PublicUploadController {

    private final ImageUploadService imageUploadService;

    public PublicUploadController(ImageUploadService imageUploadService) {
        this.imageUploadService = imageUploadService;
    }

    @PostMapping("/profile-image")
    public ImageUploadResponse uploadProfileImage(@RequestParam("file") MultipartFile file) {
        return new ImageUploadResponse(imageUploadService.uploadProfileImage(file));
    }
}
