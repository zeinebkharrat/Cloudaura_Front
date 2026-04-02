package org.example.backend.controller;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sert {@code GET /uploads/products/{filename}} depuis le même répertoire que {@link ProductController}
 * (écriture : {@code ${app.upload.dir}/products/}).
 * Plus fiable que {@code ResourceHandlerRegistry} seul (résolution des chemins, ordre des handlers).
 */
@RestController
public class LocalProductImageController {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @GetMapping("/uploads/products/{filename:.+}")
    public ResponseEntity<Resource> serveProductImage(@PathVariable String filename) {
        Path primaryBase = Paths.get(uploadDir, "products").toAbsolutePath().normalize();
        Path file = resolveReadableFile(primaryBase, filename);

        // Legacy fallback when backend is started from /backend and historical files are in ../uploads.
        if (file == null) {
            Path legacyBase = Paths.get(System.getProperty("user.dir"), "..", "uploads", "products")
                    .toAbsolutePath()
                    .normalize();
            file = resolveReadableFile(legacyBase, filename);
        }

        if (file == null) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new FileSystemResource(file);
        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) {
            mediaType = MediaType.IMAGE_PNG;
        } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            mediaType = MediaType.IMAGE_JPEG;
        } else if (lower.endsWith(".gif")) {
            mediaType = MediaType.IMAGE_GIF;
        } else if (lower.endsWith(".webp")) {
            mediaType = MediaType.parseMediaType("image/webp");
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .contentType(mediaType)
                .body(resource);
    }

    private static Path resolveReadableFile(Path base, String filename) {
        Path candidate = base.resolve(filename).normalize();
        if (!candidate.startsWith(base)) {
            return null;
        }
        if (!Files.isRegularFile(candidate) || !Files.isReadable(candidate)) {
            return null;
        }
        return candidate;
    }
}
