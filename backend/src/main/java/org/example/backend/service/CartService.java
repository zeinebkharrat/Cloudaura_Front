package org.example.backend.service;

import jakarta.persistence.Id;
import java.lang.reflect.Field;
import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.model.Cart;
import org.example.backend.repository.CartRepository;
import org.springframework.stereotype.Service;

@Service
public class CartService {
    private final CartRepository cartRepository;

    public CartService(CartRepository cartRepository) {
        this.cartRepository = cartRepository;
    }

    public List<Cart> findAll() {
        return cartRepository.findAll();
    }

    public Cart findById(Integer id) {
        return cartRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("Cart not found with id: " + id));
    }

    public Cart save(Cart entity) {
        return cartRepository.save(entity);
    }

    public Cart update(Integer id, Cart entityDetails) {
        if (!cartRepository.existsById(id)) {
            throw new NoSuchElementException("Cart not found with id: " + id);
        }
        setIdField(entityDetails, id);
        return cartRepository.save(entityDetails);
    }

    public void deleteById(Integer id) {
        if (!cartRepository.existsById(id)) {
            throw new NoSuchElementException("Cart not found with id: " + id);
        }
        cartRepository.deleteById(id);
    }

    private static void setIdField(Object entity, Integer id) {
        Class<?> c = entity.getClass();
        while (c != null) {
            for (Field f : c.getDeclaredFields()) {
                if (f.getAnnotation(Id.class) != null) {
                    f.setAccessible(true);
                    try {
                        f.set(entity, id);
                    } catch (IllegalAccessException e) {
                        throw new IllegalStateException("Cannot set @Id field", e);
                    }
                    return;
                }
            }
            c = c.getSuperclass();
        }
        throw new IllegalStateException("No @Id field on " + entity.getClass().getName());
    }
}
