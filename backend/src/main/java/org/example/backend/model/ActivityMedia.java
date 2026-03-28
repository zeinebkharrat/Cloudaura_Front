package org.example.backend.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "activity_media")
public class ActivityMedia {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer mediaId;

    @ManyToOne
    @JoinColumn(name = "activity_id")
    private Activity activity;

    private String url;

    @Enumerated(EnumType.STRING)
    private MediaType mediaType;
}
