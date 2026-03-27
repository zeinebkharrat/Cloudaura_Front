package org.example.backend.dto;

public class PaymentRequest {
    private String eventName;
    private Long amount; // En centimes (ex: 5000 pour 50.00 EUR)

    // Getters et Setters
    public String getEventName() { return eventName; }
    public void setEventName(String eventName) { this.eventName = eventName; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
}