package org.example.backend.service;

import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.model.Product;
import org.example.backend.model.User;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class ProductService {
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public ProductService(ProductRepository productRepository, UserRepository userRepository) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    public List<Product> findAll() {
        return productRepository.findAll();
    }

    public Product findById(Integer id) {
        return productRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("Product not found with id: " + id));
    }

    public Product save(Product entity, String username) {
        User currentUser = userRepository.findByUsernameIgnoreCase(username)
            .orElseThrow(() -> new NoSuchElementException("User not found with username: " + username));
        entity.setUser(currentUser);
        return productRepository.save(entity);
    }

    public Product update(Integer id, Product entityDetails) {
        Product existing = productRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("Product not found with id: " + id));

        existing.setName(entityDetails.getName());
        existing.setImageUrl(entityDetails.getImageUrl());
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
