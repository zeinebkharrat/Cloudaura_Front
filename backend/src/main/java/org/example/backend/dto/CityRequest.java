package org.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CityRequest {
    @NotBlank(message = "Le nom de la ville est obligatoire")
    private String name;
    private String region;
    private String description;
    private Double latitude;
    private Double longitude;
}
