package org.example.backend.dto.shop;

import java.util.ArrayList;
import java.util.List;

public class ShopCartDto {
    private Integer cartId;
    private List<ShopCartLineDto> items = new ArrayList<>();
    private double total;

    public Integer getCartId() {
        return cartId;
    }

    public void setCartId(Integer cartId) {
        this.cartId = cartId;
    }

    public List<ShopCartLineDto> getItems() {
        return items;
    }

    public void setItems(List<ShopCartLineDto> items) {
        this.items = items != null ? items : new ArrayList<>();
    }

    public double getTotal() {
        return total;
    }

    public void setTotal(double total) {
        this.total = total;
    }
}
