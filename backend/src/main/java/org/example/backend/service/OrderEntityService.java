package org.example.backend.service;

import jakarta.persistence.Id;
import java.lang.reflect.Field;
import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.model.OrderEntity;
import org.example.backend.repository.OrderEntityRepository;
import org.springframework.stereotype.Service;

@Service
public class OrderEntityService {
    private final OrderEntityRepository orderEntityRepository;

    public OrderEntityService(OrderEntityRepository orderEntityRepository) {
        this.orderEntityRepository = orderEntityRepository;
    }

    public List<OrderEntity> findAll() {
        return orderEntityRepository.findAllWithUser();
    }

    public OrderEntity findById(Integer id) {
        return orderEntityRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("OrderEntity not found with id: " + id));
    }

    public OrderEntity save(OrderEntity entity) {
        return orderEntityRepository.save(entity);
    }

    public OrderEntity update(Integer id, OrderEntity entityDetails) {
        if (!orderEntityRepository.existsById(id)) {
            throw new NoSuchElementException("OrderEntity not found with id: " + id);
        }
        setIdField(entityDetails, id);
        return orderEntityRepository.save(entityDetails);
    }

    public void deleteById(Integer id) {
        if (!orderEntityRepository.existsById(id)) {
            throw new NoSuchElementException("OrderEntity not found with id: " + id);
        }
        orderEntityRepository.deleteById(id);
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
