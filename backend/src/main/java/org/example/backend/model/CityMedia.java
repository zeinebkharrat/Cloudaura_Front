package org.example.backend.model;
 
import jakarta.persistence.*;
 
@Entity
@Table(name = "city_media")
public class CityMedia {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer mediaId;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "city_id")
    private City city;
 
    private String url;
 
    @Enumerated(EnumType.STRING)
    private MediaType mediaType;
 
    public CityMedia() {}
 
    public Integer getMediaId() { return mediaId; }
    public void setMediaId(Integer id) { this.mediaId = id; }
    public City getCity() { return city; }
    public void setCity(City c) { this.city = c; }
    public String getUrl() { return url; }
    public void setUrl(String u) { this.url = u; }
    public MediaType getMediaType() { return mediaType; }
    public void setMediaType(MediaType t) { this.mediaType = t; }
}
