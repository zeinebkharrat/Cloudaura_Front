package org.example.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "karaoke_songs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KaraokeSong {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String artist;
    private String audioUrl; // Original with vocals (for AI)
    private String instrumentalUrl; // Instrumental version (for the user)

    @Column(columnDefinition = "TEXT")
    private String lyricsJson; // Will store the synchronized lyrics as a JSON string

    private boolean published;
}
