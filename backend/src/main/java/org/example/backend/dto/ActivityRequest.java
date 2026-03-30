package org.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ActivityRequest {
    @NotNull(message = "cityId est obligatoire")
    private Integer cityId;
    @NotBlank(message = "Le nom de l'activité est obligatoire")
    private String name;
    private String type;
    private Double price;
    private String description;
    private String address;
    private Double latitude;
    private Double longitude;
    private Integer maxParticipantsPerDay;
    private LocalDate maxParticipantsStartDate;
}