package org.example.backend.controller;

import java.net.URI;
import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.dto.admin.AdminOrderItemDto;
import org.example.backend.model.OrderItem;
import org.example.backend.service.OrderItemService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/order-items")
public class OrderItemController {
    private final OrderItemService orderItemService;

    public OrderItemController(OrderItemService orderItemService) {
        this.orderItemService = orderItemService;
    }

    @GetMapping
    public ResponseEntity<List<AdminOrderItemDto>> findAll() {
        return ResponseEntity.ok(orderItemService.findAllForAdmin());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderItem> findById(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(orderItemService.findById(id));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<OrderItem> create(@RequestBody OrderItem entity) {
        OrderItem created = orderItemService.save(entity);
        return ResponseEntity
            .created(URI.create("/api/order-items/" + created.getOrderItemId()))
            .body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrderItem> update(@PathVariable Integer id, @RequestBody OrderItem entity) {
        try {
            return ResponseEntity.ok(orderItemService.update(id, entity));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        try {
            orderItemService.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
