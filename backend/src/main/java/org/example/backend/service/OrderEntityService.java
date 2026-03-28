package org.example.backend.service;

import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.model.OrderEntity;
import org.example.backend.repository.OrderEntityRepository;
import org.example.backend.repository.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderEntityService {
    private final OrderEntityRepository orderEntityRepository;
    private final OrderItemRepository orderItemRepository;

    public OrderEntityService(
        OrderEntityRepository orderEntityRepository,
        OrderItemRepository orderItemRepository
    ) {
        this.orderEntityRepository = orderEntityRepository;
        this.orderItemRepository = orderItemRepository;
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

    /**
     * Fusionne les champs non nuls de {@code incoming} dans l’entité persistée
     * (permet au backoffice d’envoyer seulement {@code status} sans écraser client / total).
     */
    @Transactional
    public OrderEntity update(Integer id, OrderEntity incoming) {
        OrderEntity existing = orderEntityRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("OrderEntity not found with id: " + id));
        if (incoming.getStatus() != null) {
            existing.setStatus(incoming.getStatus());
        }
        if (incoming.getTotalAmount() != null) {
            existing.setTotalAmount(incoming.getTotalAmount());
        }
        if (incoming.getUser() != null) {
            existing.setUser(incoming.getUser());
        }
        if (incoming.getCreatedAt() != null) {
            existing.setCreatedAt(incoming.getCreatedAt());
        }
        return orderEntityRepository.save(existing);
    }

    @Transactional
    public void deleteById(Integer id) {
        if (!orderEntityRepository.existsById(id)) {
            throw new NoSuchElementException("OrderEntity not found with id: " + id);
        }
        orderItemRepository.deleteByOrder_OrderId(id);
        orderEntityRepository.deleteById(id);
    }
}
