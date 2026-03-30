package org.example.backend.service;

import jakarta.persistence.Id;
import java.lang.reflect.Field;
import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.model.OrderItem;
import org.example.backend.repository.OrderItemRepository;
import org.springframework.stereotype.Service;

@Service
public class OrderItemService {
    private final OrderItemRepository orderItemRepository;

    public OrderItemService(OrderItemRepository orderItemRepository) {
        this.orderItemRepository = orderItemRepository;
    }

    public List<OrderItem> findAll() {
        return orderItemRepository.findAllWithDetails();
    }

    public OrderItem findById(Integer id) {
        return orderItemRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("OrderItem not found with id: " + id));
    }

    public OrderItem save(OrderItem entity) {
        return orderItemRepository.save(entity);
    }

    public OrderItem update(Integer id, OrderItem entityDetails) {
        if (!orderItemRepository.existsById(id)) {
            throw new NoSuchElementException("OrderItem not found with id: " + id);
        }
        setIdField(entityDetails, id);
        return orderItemRepository.save(entityDetails);
    }

    public void deleteById(Integer id) {
        if (!orderItemRepository.existsById(id)) {
            throw new NoSuchElementException("OrderItem not found with id: " + id);
        }
        orderItemRepository.deleteById(id);
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
