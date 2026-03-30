package org.example.backend.controller.crud;

import org.example.backend.controller.crud.base.AbstractCrudController;
import org.example.backend.model.CartItem;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/crud/cart-items")
public class CartItemCrudController extends AbstractCrudController<CartItem> {
    public CartItemCrudController() {
        super(CartItem.class);
    }
}
