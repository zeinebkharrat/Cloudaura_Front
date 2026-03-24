package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
@Data @Entity @Table(name="city_media")
public class CityMedia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer mediaId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String url;
    @Enumerated(EnumType.STRING)
    private MediaType mediaType;
}