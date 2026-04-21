package org.example.backend.controller;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.example.backend.model.OrderEntity;
import org.example.backend.service.OrderEntityService;
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
@RequestMapping("/api/orders")
public class OrderEntityController {
    private final OrderEntityService orderEntityService;

    public OrderEntityController(OrderEntityService orderEntityService) {
        this.orderEntityService = orderEntityService;
    }

    @GetMapping
    public ResponseEntity<List<OrderEntity>> findAll() {
        return ResponseEntity.ok(orderEntityService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderEntity> findById(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(orderEntityService.findById(id));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<OrderEntity> create(@RequestBody OrderEntity entity) {
        OrderEntity created = orderEntityService.save(entity);
        return ResponseEntity
            .created(URI.create("/api/orders/" + created.getOrderId()))
            .body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody OrderEntity entity) {
        try {
            OrderEntity updated = orderEntityService.update(id, entity);
            return ResponseEntity.ok(Map.of(
                "orderId", updated.getOrderId(),
                "status", updated.getStatus() != null ? updated.getStatus().name() : null,
                "totalAmount", updated.getTotalAmount()
            ));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        try {
            orderEntityService.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
