package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="transports")
public class Transport {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer transportId;
    @ManyToOne @JoinColumn(name="departure_city_id")
    private City departureCity;
    @ManyToOne @JoinColumn(name="arrival_city_id")
    private City arrivalCity;
    private String type;
    private Date departureTime;
    private Date arrivalTime;
    private Double price;
    private Integer capacity;
}