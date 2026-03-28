package org.example.backend.model;
 
import jakarta.persistence.*;
import java.util.Date;
 
@Entity
@Table(name = "carts")
public class Cart {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer cartId;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
 
    private Date createdAt;
 
    public Cart() {}
 
    public Integer getCartId() { return cartId; }
    public void setCartId(Integer id) { this.cartId = id; }
    public User getUser() { return user; }
    public void setUser(User u) { this.user = u; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date d) { this.createdAt = d; }
}
