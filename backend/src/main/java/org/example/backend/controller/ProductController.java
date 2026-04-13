package org.example.backend.controller;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.example.backend.dto.ProductCatalogItem;
import org.example.backend.model.Product;
import org.example.backend.service.ProductService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;
import org.example.backend.service.ImageDescriptionService;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductService productService;
    private final ImageDescriptionService imageDescriptionService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public ProductController(ProductService productService, ImageDescriptionService imageDescriptionService) {
        this.productService = productService;
        this.imageDescriptionService = imageDescriptionService;
    }

    @PostMapping({"/upload-image", "/upload-image/"})
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            String originalName = file.getOriginalFilename() == null ? "image" : file.getOriginalFilename();
            String extension = "";
            int dotIndex = originalName.lastIndexOf('.');
            if (dotIndex >= 0) {
                extension = originalName.substring(dotIndex);
            }
            String fileName = UUID.randomUUID() + extension;
            Path targetDir = Paths.get(uploadDir, "products").toAbsolutePath().normalize();
            Files.createDirectories(targetDir);
            Path target = targetDir.resolve(fileName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return ResponseEntity.ok(Map.of("imageUrl", "/uploads/products/" + fileName));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping(path = "/describe-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> describeImage(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            String description = imageDescriptionService.describeImage(file);
            return ResponseEntity.ok(Map.of("description", description));
        } catch (Exception ex) {
            String message = ex.getMessage() != null ? ex.getMessage() : "Could not describe image.";
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", message));
        }
    }

    @PostMapping(path = "/describe-image/local")
    public ResponseEntity<Map<String, String>> describeLocalImage(@RequestParam("filename") String filename) {
        if (filename == null || filename.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Filename is required."));
        }
        try {
            Path filePath = Paths.get(uploadDir, "products", filename).toAbsolutePath().normalize();
            Path baseDir = Paths.get(uploadDir, "products").toAbsolutePath().normalize();
            if (!filePath.startsWith(baseDir) || !Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Local image not found."));
            }
            String description = imageDescriptionService.describeImageFromLocalPath(filePath);
            return ResponseEntity.ok(Map.of("description", description));
        } catch (Exception ex) {
            String message = ex.getMessage() != null ? ex.getMessage() : "Could not describe local image.";
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", message));
        }
    }

    @GetMapping
    public ResponseEntity<List<ProductCatalogItem>> findAll(
            Authentication authentication,
            @RequestParam(required = false) Integer cityId
    ) {
        if (authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) {
            return ResponseEntity.ok(productService.findAllWithCatalogDto());
        }
        if (cityId != null) {
            return ResponseEntity.ok(productService.findAllByCity(cityId));
        }
        return ResponseEntity.ok(productService.findAllForCatalog());
    }

    @GetMapping("/my-products")
    public ResponseEntity<List<ProductCatalogItem>> findMyProducts(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(productService.findAllForArtisan(authentication.getName()));
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<ProductCatalogItem> findById(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(productService.findByIdForCatalog(id));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<?> create(Authentication authentication, @RequestBody Product entity) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String username = authentication.getName();
        if (username == null || username.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            ProductCatalogItem created = productService.save(entity, username);
            return ResponseEntity
                .created(URI.create("/api/products/" + created.productId()))
                .body(created);
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(Map.of("error", ex.getReason() != null ? ex.getReason() : "Request rejected"));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", ex.getMessage() != null ? ex.getMessage() : "Unexpected error"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Product entity) {
        try {
            return ResponseEntity.ok(productService.update(id, entity));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", ex.getMessage() != null ? ex.getMessage() : "Unexpected error"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        try {
            productService.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
