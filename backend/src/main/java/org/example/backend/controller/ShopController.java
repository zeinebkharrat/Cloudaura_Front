package org.example.backend.controller;

import org.example.backend.dto.shop.AddToCartRequest;
import org.example.backend.dto.shop.UpdateCartItemRequest;
import java.util.List;
import org.example.backend.dto.shop.CheckoutOrderDto;
import org.example.backend.dto.shop.MyOrderSummaryDto;
import org.example.backend.dto.shop.ShopCartDto;
import org.example.backend.model.OrderStatus;
import org.example.backend.service.ShopService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/shop")
public class ShopController {

    private final ShopService shopService;

    public ShopController(ShopService shopService) {
        this.shopService = shopService;
    }

    @GetMapping("/cart")
    public ResponseEntity<ShopCartDto> getCart(Authentication authentication) {
        return ResponseEntity.ok(shopService.getCart(requireUsername(authentication)));
    }

    @PostMapping("/cart/items")
    public ResponseEntity<ShopCartDto> addToCart(
        Authentication authentication,
        @RequestBody AddToCartRequest body
    ) {
        return ResponseEntity.ok(shopService.addToCart(requireUsername(authentication), body));
    }

    @DeleteMapping("/cart/items/{cartItemId}")
    public ResponseEntity<ShopCartDto> removeCartItem(
        Authentication authentication,
        @PathVariable Integer cartItemId
    ) {
        return ResponseEntity.ok(shopService.removeCartItem(requireUsername(authentication), cartItemId));
    }

    @PutMapping("/cart/items/{cartItemId}")
    public ResponseEntity<ShopCartDto> updateCartItem(
        Authentication authentication,
        @PathVariable Integer cartItemId,
        @RequestBody UpdateCartItemRequest body
    ) {
        return ResponseEntity.ok(shopService.updateCartItemQuantity(
            requireUsername(authentication), cartItemId, body));
    }

    @PostMapping("/checkout")
    public ResponseEntity<CheckoutOrderDto> checkout(
        Authentication authentication,
        @RequestParam(required = false) String paymentMethod
    ) {
        return ResponseEntity.ok(shopService.checkout(requireUsername(authentication), paymentMethod));
    }

    @GetMapping("/orders")
    public ResponseEntity<List<MyOrderSummaryDto>> myOrders(Authentication authentication) {
        return ResponseEntity.ok(shopService.listMyOrders(requireUsername(authentication)));
    }

    @GetMapping("/orders/{orderId}")
    public ResponseEntity<CheckoutOrderDto> myOrderDetail(
        Authentication authentication,
        @PathVariable Integer orderId
    ) {
        return ResponseEntity.ok(shopService.getMyOrderDetail(requireUsername(authentication), orderId));
    }

    @GetMapping("/artisan-orders")
    public ResponseEntity<List<MyOrderSummaryDto>> getArtisanOrders(Authentication authentication) {
        return ResponseEntity.ok(shopService.listArtisanOrders(requireUsername(authentication)));
    }

    @PutMapping("/order-items/{orderItemId}/status")
    public ResponseEntity<Void> updateOrderItemStatus(
        Authentication authentication,
        @PathVariable Integer orderItemId,
        @RequestParam OrderStatus status
    ) {
        shopService.updateOrderItemStatus(orderItemId, status, requireUsername(authentication));
        return ResponseEntity.ok().build();
    }

    /**
     * Identity comes from the JWT (subject = username), same as {@link org.example.backend.service.CustomUserDetailsService}.
     * Do not trust client headers for the current user.
     */
    private static String requireUsername(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.unauthorized");
        }
        String name = authentication.getName();
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.session_invalid");
        }
        return name;
    }
}
