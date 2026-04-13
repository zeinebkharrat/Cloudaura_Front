package org.example.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "ticket_types")
public class TicketType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ticket_type_id")
    private Integer ticketTypeId;

    @Column(name = "ticket_nomevent")
    private String ticketNomevent;

    private Double price;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private Event event;

    public Integer getTicketTypeId() {
        return ticketTypeId;
    }

    public void setTicketTypeId(Integer ticketTypeId) {
        this.ticketTypeId = ticketTypeId;
    }

    public String getTicketNomevent() {
        return ticketNomevent;
    }

    public void setTicketNomevent(String ticketNomevent) {
        this.ticketNomevent = ticketNomevent;
    }

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public Event getEvent() {
        return event;
    }

    public void setEvent(Event event) {
        this.event = event;
    }
}
