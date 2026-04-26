package org.example.backend.controller;

import org.example.backend.dto.ImageUploadResponse;
import org.example.backend.service.ImageUploadService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/public/uploads")
public class PublicUploadController {

    private final ImageUploadService imageUploadService;
    private final org.example.backend.service.FileService fileService;

    public PublicUploadController(ImageUploadService imageUploadService, org.example.backend.service.FileService fileService) {
        this.imageUploadService = imageUploadService;
        this.fileService = fileService;
    }

    @PostMapping("/profile-image")
    public ImageUploadResponse uploadProfileImage(@RequestParam("file") MultipartFile file) {
        return new ImageUploadResponse(imageUploadService.uploadProfileImage(file));
    }

    @PostMapping("/audio")
    public ImageUploadResponse uploadAudio(@RequestParam("file") MultipartFile file) {
        // We reuse ImageUploadResponse as it just has a 'url' field
        return new ImageUploadResponse(fileService.storeFile(file, "audio"));
    }
}
