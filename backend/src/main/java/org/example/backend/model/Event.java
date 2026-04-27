package org.example.backend.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import java.util.Date;

/**
 * Événement : PK colonne implicite {@code event_id} → {@link #eventId} / {@link #getEventId()}. Titre → clé
 * {@code event.{eventId}.name}, lieu → {@code event.{eventId}.venue}. Pas de champ {@code description} JPA.
 */
@Entity
@Table(name="events")
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id")
    private Integer eventId;

    @ManyToOne
    @JoinColumn(name="city_id")
    private City city;

    @Transient
    private Integer cityId;

    private String title;
    private String eventType;

    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern="yyyy-MM-dd'T'HH:mm:ss", timezone="Africa/Tunis")
    private Date startDate;

    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern="yyyy-MM-dd'T'HH:mm:ss", timezone="Africa/Tunis")
    private Date endDate;

    private String venue;
    private String status;
    private String imageUrl;
    private Double price;

    @Column(nullable = false)
    private Integer totalCapacity = 0;

    @Column(nullable = false)
    private Integer reservedCount = 0;

    public Integer getEventId() { return eventId; }
    public void setEventId(Integer eventId) { this.eventId = eventId; }
    public City getCity() { return city; }
    public void setCity(City city) {
        this.city = city;
        this.cityId = city != null ? city.getCityId() : null;
    }
    public Integer getCityId() {
        if (city != null && city.getCityId() != null) {
            return city.getCityId();
        }
        return cityId;
    }
    public void setCityId(Integer cityId) { this.cityId = cityId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public Date getStartDate() { return startDate; }
    public void setStartDate(Date startDate) { this.startDate = startDate; }
    public Date getEndDate() { return endDate; }
    public void setEndDate(Date endDate) { this.endDate = endDate; }
    public String getVenue() { return venue; }
    public void setVenue(String venue) { this.venue = venue; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }
    public Integer getTotalCapacity() { return totalCapacity; }
    public void setTotalCapacity(Integer totalCapacity) { this.totalCapacity = totalCapacity; }
    public Integer getReservedCount() { return reservedCount; }
    public void setReservedCount(Integer reservedCount) { this.reservedCount = reservedCount; }


    public void setId(Integer eventId) {
        this.eventId = eventId;
    }
}