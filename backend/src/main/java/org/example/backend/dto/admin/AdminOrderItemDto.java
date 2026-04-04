package org.example.backend.dto.admin;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Ligne de commande pour l’admin — structure plate compatible avec le front Angular
 * (évite la sérialisation d’entités JPA Product / OrderItem → LazyInitializationException).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AdminOrderItemDto {

    private Integer orderItemId;
    private Integer quantity;
    private String status;
    private OrderRef order;
    private ProductRef product;

    public Integer getOrderItemId() {
        return orderItemId;
    }

    public void setOrderItemId(Integer orderItemId) {
        this.orderItemId = orderItemId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OrderRef getOrder() {
        return order;
    }

    public void setOrder(OrderRef order) {
        this.order = order;
    }

    public ProductRef getProduct() {
        return product;
    }

    public void setProduct(ProductRef product) {
        this.product = product;
    }

    public static class OrderRef {
        private Integer orderId;
        private Double totalAmount;
        private String status;
        private UserRef user;

        public Integer getOrderId() {
            return orderId;
        }

        public void setOrderId(Integer orderId) {
            this.orderId = orderId;
        }

        public Double getTotalAmount() {
            return totalAmount;
        }

        public void setTotalAmount(Double totalAmount) {
            this.totalAmount = totalAmount;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public UserRef getUser() {
            return user;
        }

        public void setUser(UserRef user) {
            this.user = user;
        }
    }

    public static class UserRef {
        private String username;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }
    }

    public static class ProductRef {
        private Integer productId;
        private String name;
        private Double price;

        public Integer getProductId() {
            return productId;
        }

        public void setProductId(Integer productId) {
            this.productId = productId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Double getPrice() {
            return price;
        }

        public void setPrice(Double price) {
            this.price = price;
        }
    }
}
