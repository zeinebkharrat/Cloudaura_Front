package org.example.backend.controller;

import org.example.backend.dto.shop.AddToCartRequest;
import org.example.backend.dto.shop.UpdateCartItemRequest;
import org.example.backend.dto.shop.CheckoutOrderDto;
import org.example.backend.dto.shop.ShopCartDto;
import org.example.backend.service.ShopService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shop")
public class ShopController {

    private final ShopService shopService;

    public ShopController(ShopService shopService) {
        this.shopService = shopService;
    }

    @GetMapping("/cart")
    public ResponseEntity<ShopCartDto> getCart(
        @RequestHeader(name = "X-Username", required = false) String username
    ) {
        return ResponseEntity.ok(shopService.getCart(username != null ? username : ""));
    }

    @PostMapping("/cart/items")
    public ResponseEntity<ShopCartDto> addToCart(
        @RequestHeader(name = "X-Username", required = false) String username,
        @RequestBody AddToCartRequest body
    ) {
        return ResponseEntity.ok(shopService.addToCart(username != null ? username : "", body));
    }

    @DeleteMapping("/cart/items/{cartItemId}")
    public ResponseEntity<ShopCartDto> removeCartItem(
        @RequestHeader(name = "X-Username", required = false) String username,
        @PathVariable Integer cartItemId
    ) {
        return ResponseEntity.ok(shopService.removeCartItem(username != null ? username : "", cartItemId));
    }

    @PutMapping("/cart/items/{cartItemId}")
    public ResponseEntity<ShopCartDto> updateCartItem(
        @RequestHeader(name = "X-Username", required = false) String username,
        @PathVariable Integer cartItemId,
        @RequestBody UpdateCartItemRequest body
    ) {
        return ResponseEntity.ok(shopService.updateCartItemQuantity(
            username != null ? username : "", cartItemId, body));
    }

    @PostMapping("/checkout")
    public ResponseEntity<CheckoutOrderDto> checkout(
        @RequestHeader(name = "X-Username", required = false) String username
    ) {
        return ResponseEntity.ok(shopService.checkout(username != null ? username : ""));
    }
}
