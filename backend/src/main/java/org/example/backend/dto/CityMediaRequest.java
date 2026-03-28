package org.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.example.backend.model.MediaType;

@Data
public class CityMediaRequest {
    @NotNull(message = "cityId est obligatoire")
    private Integer cityId;
    @NotBlank(message = "L'URL est obligatoire")
    private String url;
    @NotNull(message = "Le type de média est obligatoire")
    private MediaType mediaType;
}
