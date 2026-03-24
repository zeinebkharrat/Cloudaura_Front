package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="special_offers")
public class SpecialOffer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer offerId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String title;
    private String description;
    private Double discountPercentage;
    private Date startDate;
    private Date endDate;
}