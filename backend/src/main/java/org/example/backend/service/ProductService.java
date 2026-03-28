package org.example.backend.service;

import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.dto.ProductCatalogItem;
import org.example.backend.model.Product;
import org.example.backend.model.User;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public ProductService(ProductRepository productRepository, UserRepository userRepository) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    /**
     * Internal / admin use — entity graph; prefer {@link #findAllForCatalog()} for JSON APIs.
     */
    public List<Product> findAll() {
        return productRepository.findAllWithSeller();
    }

    @Transactional(readOnly = true)
    public List<ProductCatalogItem> findAllForCatalog() {
        return productRepository.findAllWithSeller().stream().map(this::toCatalogItem).toList();
    }

    @Transactional(readOnly = true)
    public List<ProductCatalogItem> findAllForArtisan(String username) {
        return productRepository.findAllByArtisan(username).stream().map(this::toCatalogItem).toList();
    }

    public Product findById(Integer id) {
        return productRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("Product not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public ProductCatalogItem findByIdForCatalog(Integer id) {
        return productRepository.findByIdWithSeller(id)
            .map(this::toCatalogItem)
            .orElseThrow(() -> new NoSuchElementException("Product not found with id: " + id));
    }

    private ProductCatalogItem toCatalogItem(Product p) {
        ProductCatalogItem.CatalogSeller seller = null;
        User u = p.getUser();
        if (u != null && u.getUsername() != null && !u.getUsername().isBlank()) {
            seller = new ProductCatalogItem.CatalogSeller(u.getUsername());
        }
        return new ProductCatalogItem(
                p.getProductId(),
                p.getName(),
                normalizeImageUrlForApi(p.getImageUrl()),
                p.getPrice(),
                p.getStock(),
                seller
        );
    }

    /**
     * Uniformise l’URL image pour le catalogue : trim, chemin local toujours avec “/” initial (ex. /uploads/products/…).
     */
    static String normalizeImageUrlForApi(String url) {
        if (url == null) {
            return null;
        }
        String t = url.trim();
        if (t.isEmpty()) {
            return null;
        }
        if (t.startsWith("http://") || t.startsWith("https://")) {
            return t;
        }
        if (t.startsWith("//")) {
            return "https:" + t;
        }
        return t.startsWith("/") ? t : "/" + t;
    }

    public Product save(Product entity, String username) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new NoSuchElementException("User not found with username: " + username));
        entity.setUser(currentUser);
        entity.setImageUrl(normalizeImageUrlForApi(entity.getImageUrl()));
        return productRepository.save(entity);
    }

    public Product update(Integer id, Product entityDetails) {
        Product existing = productRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Product not found with id: " + id));

        existing.setName(entityDetails.getName());
        existing.setImageUrl(normalizeImageUrlForApi(entityDetails.getImageUrl()));
        existing.setPrice(entityDetails.getPrice());
        existing.setStock(entityDetails.getStock());
        if (entityDetails.getUser() != null) {
            existing.setUser(entityDetails.getUser());
        }

        return productRepository.save(existing);
    }

    public void deleteById(Integer id) {
        if (!productRepository.existsById(id)) {
            throw new NoSuchElementException("Product not found with id: " + id);
        }
        productRepository.deleteById(id);
    }
}
