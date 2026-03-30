package org.example.backend.controller.crud;

import org.example.backend.controller.crud.base.AbstractCrudController;
import org.example.backend.model.Cart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/crud/carts")
public class CartCrudController extends AbstractCrudController<Cart> {
    public CartCrudController() {
        super(Cart.class);
    }
}
