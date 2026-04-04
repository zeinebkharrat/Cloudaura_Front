package org.example.backend.service;

import jakarta.persistence.Id;
import java.lang.reflect.Field;
import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.dto.admin.AdminOrderItemDto;
import org.example.backend.model.OrderEntity;
import org.example.backend.model.OrderItem;
import org.example.backend.model.Product;
import org.example.backend.model.ProductVariant;
import org.example.backend.model.User;
import org.example.backend.repository.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderItemService {
    private final OrderItemRepository orderItemRepository;

    public OrderItemService(OrderItemRepository orderItemRepository) {
        this.orderItemRepository = orderItemRepository;
    }

    /**
     * Liste admin : DTO JSON sans entités Product (collections lazy / cycles).
     */
    @Transactional(readOnly = true)
    public List<AdminOrderItemDto> findAllForAdmin() {
        return orderItemRepository.findAllWithDetails().stream().map(this::toAdminDto).toList();
    }

    public List<OrderItem> findAll() {
        return orderItemRepository.findAllWithDetails();
    }

    private AdminOrderItemDto toAdminDto(OrderItem oi) {
        AdminOrderItemDto dto = new AdminOrderItemDto();
        dto.setOrderItemId(oi.getOrderItemId());
        dto.setQuantity(oi.getQuantity());
        dto.setStatus(oi.getStatus() != null ? oi.getStatus().name() : null);

        Product p = oi.getProduct();
        ProductVariant v = oi.getVariant();
        double unit = effectiveUnitPrice(p, v);
        AdminOrderItemDto.ProductRef pr = new AdminOrderItemDto.ProductRef();
        if (p != null) {
            pr.setProductId(p.getProductId());
            pr.setName(p.getName());
            pr.setPrice(unit);
        }
        dto.setProduct(pr);

        AdminOrderItemDto.OrderRef or = new AdminOrderItemDto.OrderRef();
        OrderEntity ord = oi.getOrder();
        if (ord != null) {
            or.setOrderId(ord.getOrderId());
            or.setTotalAmount(ord.getTotalAmount());
            or.setStatus(ord.getStatus() != null ? ord.getStatus().name() : null);
            User u = ord.getUser();
            if (u != null) {
                AdminOrderItemDto.UserRef ur = new AdminOrderItemDto.UserRef();
                ur.setUsername(u.getUsername());
                or.setUser(ur);
            }
        }
        dto.setOrder(or);
        return dto;
    }

    /** Même logique que le panier : override &gt; 0 uniquement, sinon prix produit. */
    private static double effectiveUnitPrice(Product p, ProductVariant v) {
        if (p == null) {
            return 0;
        }
        if (v != null) {
            Double po = v.getPriceOverride();
            if (po != null && po > 0) {
                return po;
            }
        }
        return p.getPrice() != null ? p.getPrice() : 0;
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
