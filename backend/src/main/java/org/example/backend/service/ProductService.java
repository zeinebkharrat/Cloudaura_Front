package org.example.backend.service;

import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.dto.ProductCatalogItem;
import org.example.backend.model.Product;
import org.example.backend.model.User;
import org.example.backend.repository.CartItemRepository;
import org.example.backend.repository.OrderItemRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderItemRepository orderItemRepository;

    public ProductService(
            ProductRepository productRepository,
            UserRepository userRepository,
            CartItemRepository cartItemRepository,
            OrderItemRepository orderItemRepository) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.cartItemRepository = cartItemRepository;
        this.orderItemRepository = orderItemRepository;
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

    @Transactional
    public ProductCatalogItem save(Product entity, String username) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new NoSuchElementException("User not found with username: " + username));
        entity.setUser(currentUser);
        entity.setImageUrl(normalizeImageUrlForApi(entity.getImageUrl()));
        Product saved = productRepository.save(entity);
        return productRepository.findByIdWithSeller(saved.getProductId())
                .map(this::toCatalogItem)
                .orElseThrow(() -> new NoSuchElementException("Product not found after save"));
    }

    /**
     * Updates catalog fields only. Seller ({@code user}) is never taken from the JSON body (avoids detached
     * {@code User} proxies and keeps ownership stable). Returns a DTO so Jackson does not touch
     * {@code Product.user} after the session closes (open-in-view=false).
     */
    @Transactional
    public ProductCatalogItem update(Integer id, Product entityDetails) {
        Product existing = productRepository.findByIdWithSeller(id)
                .orElseThrow(() -> new NoSuchElementException("Product not found with id: " + id));

        existing.setName(entityDetails.getName());
        existing.setImageUrl(normalizeImageUrlForApi(entityDetails.getImageUrl()));
        existing.setPrice(entityDetails.getPrice());
        existing.setStock(entityDetails.getStock());

        Product saved = productRepository.save(existing);
        return toCatalogItem(saved);
    }

    @Transactional
    public void deleteById(Integer id) {
        if (!productRepository.existsById(id)) {
            throw new NoSuchElementException("Product not found with id: " + id);
        }
        cartItemRepository.deleteAllByProduct_ProductId(id);
        orderItemRepository.deleteAllByProduct_ProductId(id);
        productRepository.deleteById(id);
    }
}
