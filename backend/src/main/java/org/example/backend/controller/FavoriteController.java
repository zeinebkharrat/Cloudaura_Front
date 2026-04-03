package org.example.backend.controller;

import java.util.List;
import java.util.Map;
import org.example.backend.dto.ProductCatalogItem;
import org.example.backend.model.Product;
import org.example.backend.model.User;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/favorites")
@Transactional
public class FavoriteController {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final ProductService productService;

    public FavoriteController(
            UserRepository userRepository,
            ProductRepository productRepository,
            ProductService productService
    ) {
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.productService = productService;
    }

    @PostMapping("/toggle/{productId}")
    public ResponseEntity<?> toggleFavorite(Authentication authentication, @PathVariable Integer productId) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("message", "User not authenticated"));
        }

        String username = authentication.getName();
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        boolean removed;
        if (user.getFavorites().contains(product)) {
            user.getFavorites().remove(product);
            removed = true;
        } else {
            user.getFavorites().add(product);
            removed = false;
        }

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "productId", productId,
            "isFavorite", !removed,
            "message", removed ? "Removed from favorites" : "Added to favorites"
        ));
    }

    @GetMapping
    public ResponseEntity<List<ProductCatalogItem>> getFavorites(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String username = authentication.getName();
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        var favs = user.getFavorites();
        favs.size(); // initialize lazy collection inside transaction
        List<ProductCatalogItem> out = favs.stream()
                .map(productService::toCatalogItem)
                .toList();
        return ResponseEntity.ok(out);
    }

    @GetMapping("/check/{productId}")
    public ResponseEntity<?> checkFavorite(Authentication authentication, @PathVariable Integer productId) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.ok(Map.of("isFavorite", false));
        }

        String username = authentication.getName();
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        return ResponseEntity.ok(Map.of("isFavorite", user.getFavorites().contains(product)));
    }
}
