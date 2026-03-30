package org.example.backend.controller;

import java.net.URI;
import java.util.List;
import java.util.NoSuchElementException;
import org.example.backend.model.CartItem;
import org.example.backend.service.CartItemService;
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
@RequestMapping("/api/cart-items")
public class CartItemController {
    private final CartItemService cartItemService;

    public CartItemController(CartItemService cartItemService) {
        this.cartItemService = cartItemService;
    }

    @GetMapping
    public ResponseEntity<List<CartItem>> findAll() {
        return ResponseEntity.ok(cartItemService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CartItem> findById(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(cartItemService.findById(id));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<CartItem> create(@RequestBody CartItem entity) {
        CartItem created = cartItemService.save(entity);
        return ResponseEntity
            .created(URI.create("/api/cart-items/" + created.getCartItemId()))
            .body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CartItem> update(@PathVariable Integer id, @RequestBody CartItem entity) {
        try {
            return ResponseEntity.ok(cartItemService.update(id, entity));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        try {
            cartItemService.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
