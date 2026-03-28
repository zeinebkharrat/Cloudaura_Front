package com.yallatn.controller.shared;

import com.yallatn.dto.ApiResponse;
import com.yallatn.model.shared.City;
import com.yallatn.repository.shared.CityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/cities")
@RequiredArgsConstructor
public class CityController {
    private final CityRepository cityRepository;

    @GetMapping
    public ApiResponse<List<City>> getAll() {
        return ApiResponse.success(cityRepository.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<City> getById(@PathVariable int id) {
        return ApiResponse.success(cityRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ville non trouvée.")));
    }
}
