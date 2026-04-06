package org.example.backend.service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;
import org.example.backend.dto.ProductCatalogItem;
import org.example.backend.model.Product;
import org.example.backend.model.ProductImage;
import org.example.backend.model.ProductVariant;
import org.example.backend.model.User;
import org.example.backend.repository.CartItemRepository;
import org.example.backend.repository.OrderItemRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
     * Internal / admin use.
     */
    public List<Product> findAll() {
        return productRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<ProductCatalogItem> findAllWithCatalogDto() {
        return productRepository.findAll().stream().map(this::toCatalogItem).toList();
    }

    @Transactional(readOnly = true)
    public List<ProductCatalogItem> findAllForCatalog() {
        return productRepository.findAllPublished().stream().map(this::toCatalogItem).toList();
    }

    @Transactional(readOnly = true)
    public List<ProductCatalogItem> findAllForArtisan(String username) {
        return productRepository.findAllByArtisan(username).stream().map(this::toCatalogItem).toList();
    }

    @Transactional(readOnly = true)
    public List<ProductCatalogItem> findAllByCity(Integer cityId) {
        return productRepository.findPublishedByCity(cityId).stream().map(this::toCatalogItem).toList();
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

    public ProductCatalogItem toCatalogItem(Product p) {
        ProductCatalogItem.CatalogSeller seller = null;
        User u = p.getUser();
        if (u != null && u.getUsername() != null && !u.getUsername().isBlank()) {
            String city = (u.getCity() != null) ? u.getCity().getName() : null;
            seller = new ProductCatalogItem.CatalogSeller(u.getUsername(), city);
        }

        List<ProductCatalogItem.CatalogImage> gallery = p.getImages().stream()
                .map(img -> new ProductCatalogItem.CatalogImage(img.getId(), normalizeImageUrlForApi(img.getImageUrl())))
                .collect(Collectors.toList());

        List<ProductCatalogItem.CatalogVariant> variants = p.getVariants().stream()
                .map(v -> new ProductCatalogItem.CatalogVariant(v.getVariantId(), v.getSize(), v.getColor(), v.getStock(), v.getPriceOverride()))
                .collect(Collectors.toList());

        boolean isFavorite = false;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
            java.util.Optional<User> userOpt = userRepository.findFirstByUsernameIgnoreCaseOrderByUserIdAsc(auth.getName());
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                if (user.getFavorites() != null) {
                    isFavorite = user.getFavorites().stream().anyMatch(fav -> fav.getProductId().equals(p.getProductId()));
                }
            }
        }

        return new ProductCatalogItem(
                p.getProductId(),
                p.getName(),
                p.getDescription(),
                p.getCategory() != null ? p.getCategory().name() : null,
                p.getStatus() != null ? p.getStatus().name() : null,
                normalizeImageUrlForApi(p.getImageUrl()),
                p.getPrice(),
                p.getStock(),
                seller,
                gallery,
                variants,
                isFavorite
        );
    }

    static String normalizeImageUrlForApi(String url) {
        if (url == null) return null;
        String t = url.trim();
        if (t.isEmpty()) return null;
        if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("//")) return t;
        return t.startsWith("/") ? t : "/" + t;
    }

    @Transactional
    public ProductCatalogItem save(Product entity, String username) {
        User currentUser = userRepository.findFirstByUsernameIgnoreCaseOrderByUserIdAsc(username)
                .orElseThrow(() -> new NoSuchElementException("User not found with username: " + username));
        // Frontend sends productId: 0 for new products — must be null or Hibernate / DB can error
        if (entity.getProductId() != null && entity.getProductId() == 0) {
            entity.setProductId(null);
        }
        entity.setUser(currentUser);
        entity.setImageUrl(normalizeImageUrlForApi(entity.getImageUrl()));

        if (entity.getImages() != null) {
            entity.getImages().forEach(img -> {
                img.setProduct(entity);
                if (img.getId() != null && img.getId() == 0) {
                    img.setId(null);
                }
                img.setImageUrl(normalizeImageUrlForApi(img.getImageUrl()));
            });
        }
        if (entity.getVariants() != null) {
            entity.getVariants().forEach(v -> {
                v.setProduct(entity);
                if (v.getVariantId() != null && v.getVariantId() == 0) {
                    v.setVariantId(null);
                }
            });
        }

        Product saved = productRepository.save(entity);
        return productRepository
                .findByIdWithSeller(saved.getProductId())
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
        Product existing = productRepository
                .findByIdWithSeller(id)
                .orElseThrow(() -> new NoSuchElementException("Product not found with id: " + id));

        existing.setName(entityDetails.getName());
        existing.setDescription(entityDetails.getDescription());
        existing.setCategory(entityDetails.getCategory());
        existing.setImageUrl(normalizeImageUrlForApi(entityDetails.getImageUrl()));
        existing.setPrice(entityDetails.getPrice());
        existing.setStock(entityDetails.getStock());
        existing.setStatus(entityDetails.getStatus());

        existing.getVariants().clear();
        if (entityDetails.getVariants() != null) {
            for (ProductVariant src : entityDetails.getVariants()) {
                ProductVariant v = new ProductVariant();
                v.setSize(src.getSize());
                v.setColor(src.getColor());
                v.setStock(src.getStock());
                v.setPriceOverride(src.getPriceOverride());
                v.setProduct(existing);
                existing.getVariants().add(v);
            }
        }

        existing.getImages().clear();
        if (entityDetails.getImages() != null) {
            for (ProductImage src : entityDetails.getImages()) {
                String u = normalizeImageUrlForApi(src.getImageUrl());
                if (u == null || u.isBlank()) {
                    continue;
                }
                ProductImage img = new ProductImage();
                img.setImageUrl(u);
                img.setProduct(existing);
                existing.getImages().add(img);
            }
        }

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
