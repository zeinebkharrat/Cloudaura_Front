package org.example.backend.model;
 
import jakarta.persistence.*;
 
@Entity
@Table(name = "cart_items")
public class CartItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cartItemId;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cart_id")
    private Cart cart;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;
 
    private Integer quantity;
 
    public CartItem() {}
 
    public Integer getCartItemId() { return cartItemId; }
    public void setCartItemId(Integer id) { this.cartItemId = id; }
    public Cart getCart() { return cart; }
    public void setCart(Cart c) { this.cart = c; }
    public Product getProduct() { return product; }
    public void setProduct(Product p) { this.product = p; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer q) { this.quantity = q; }
}
