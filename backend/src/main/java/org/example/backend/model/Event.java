package org.example.backend.model;
import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
@Data @Entity @Table(name="events")
public class Event {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer eventId;
    @ManyToOne @JoinColumn(name="city_id")
    private City city;
    private String title;
    private String eventType;
    private Date startDate;
    private Date endDate;
    private String venue;
    private String status;
}