package org.example.backend.dto.shop;

import java.util.ArrayList;
import java.util.List;
import org.example.backend.model.OrderStatus;

public class CheckoutOrderDto {
    private Integer orderId;
    private OrderStatus status;
    private Double totalAmount;
    /** ISO-8601 (ex. pour affichage récapitulatif). */
    private String orderedAt;
    private CheckoutBuyerDto buyer;
    private List<OrderLineDto> lines = new ArrayList<>();

    public Integer getOrderId() {
        return orderId;
    }

    public void setOrderId(Integer orderId) {
        this.orderId = orderId;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public Double getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(Double totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getOrderedAt() {
        return orderedAt;
    }

    public void setOrderedAt(String orderedAt) {
        this.orderedAt = orderedAt;
    }

    public CheckoutBuyerDto getBuyer() {
        return buyer;
    }

    public void setBuyer(CheckoutBuyerDto buyer) {
        this.buyer = buyer;
    }

    public List<OrderLineDto> getLines() {
        return lines;
    }

    public void setLines(List<OrderLineDto> lines) {
        this.lines = lines != null ? lines : new ArrayList<>();
    }
}
