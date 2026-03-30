package org.example.backend.model;
 
import jakarta.persistence.*;
 
@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer orderItemId;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private OrderEntity order;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;
 
    private Integer quantity;
 
    public OrderItem() {}
 
    public Integer getOrderItemId() { return orderItemId; }
    public void setOrderItemId(Integer id) { this.orderItemId = id; }
    public OrderEntity getOrder() { return order; }
    public void setOrder(OrderEntity o) { this.order = o; }
    public Product getProduct() { return product; }
    public void setProduct(Product p) { this.product = p; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer q) { this.quantity = q; }
}
