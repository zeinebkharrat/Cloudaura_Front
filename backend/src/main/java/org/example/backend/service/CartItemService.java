package org.example.backend.service;

import jakarta.persistence.Id;
import java.lang.reflect.Field;
import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.model.CartItem;
import org.example.backend.repository.CartItemRepository;
import org.springframework.stereotype.Service;

@Service
public class CartItemService {
    private final CartItemRepository cartItemRepository;

    public CartItemService(CartItemRepository cartItemRepository) {
        this.cartItemRepository = cartItemRepository;
    }

    public List<CartItem> findAll() {
        return cartItemRepository.findAll();
    }

    public CartItem findById(Integer id) {
        return cartItemRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("CartItem not found with id: " + id));
    }

    public CartItem save(CartItem entity) {
        return cartItemRepository.save(entity);
    }

    public CartItem update(Integer id, CartItem entityDetails) {
        if (!cartItemRepository.existsById(id)) {
            throw new NoSuchElementException("CartItem not found with id: " + id);
        }
        setIdField(entityDetails, id);
        return cartItemRepository.save(entityDetails);
    }

    public void deleteById(Integer id) {
        if (!cartItemRepository.existsById(id)) {
            throw new NoSuchElementException("CartItem not found with id: " + id);
        }
        cartItemRepository.deleteById(id);
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
