package org.example.backend.dto;

public class PaymentRequest {
<<<<<<< HEAD
    private String eventName;
    private Long amount; // En centimes (ex: 5000 pour 50.00 EUR)

    // Getters et Setters
    public String getEventName() { return eventName; }
    public void setEventName(String eventName) { this.eventName = eventName; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
=======
    private long amount;
    private String productName;
    private int eventId;

    // SANS CES MÉTHODES, SPRING NE PEUT PAS LIRE LE JSON D'ANGULAR
    public long getAmount() { return amount; }
    public void setAmount(long amount) { this.amount = amount; }


    public void setProductName(String productName) {
        this.productName = productName;
    }
    public String getProductName() {
        return productName;
    }

    public int getEventId() { return eventId; }
    public void setEventId(int eventId) { this.eventId = eventId; }

>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
}