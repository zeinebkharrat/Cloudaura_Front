package org.example.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileService {

    private static final Logger log = LoggerFactory.getLogger(FileService.class);

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.upload.max-file-bytes:52428800}") // 50MB
    private long maxFileBytes;

    public String storeFile(MultipartFile file, String subDir) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required");
        }
        if (file.getSize() > maxFileBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File is too large");
        }

        try {
            String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
            String ext = "";
            int dot = original.lastIndexOf('.');
            if (dot >= 0) {
                ext = original.substring(dot);
            }
            
            String fileName = UUID.randomUUID().toString() + ext;
            Path targetDir = Paths.get(uploadDir, subDir).toAbsolutePath().normalize();
            Files.createDirectories(targetDir);
            Path target = targetDir.resolve(fileName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            
            return "/uploads/" + subDir + "/" + fileName;
        } catch (IOException e) {
            log.error("Failed to store file", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file");
        }
    }
}
