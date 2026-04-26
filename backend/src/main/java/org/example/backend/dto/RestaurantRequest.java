package org.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RestaurantRequest {
    @NotNull(message = "cityId est obligatoire")
    private Integer cityId;
    @NotBlank(message = "Le nom du restaurant est obligatoire")
    private String name;
    private String cuisineType;
    private Double rating;
    private String description;
    private String address;
    @NotBlank(message = "Le numéro de téléphone du restaurant est obligatoire")
    private String phoneNumber;
    private Double latitude;
    private Double longitude;
    private String imageUrl;
}
