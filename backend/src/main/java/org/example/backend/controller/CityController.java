package org.example.backend.controller;

import org.example.backend.dto.CityResponse;
import org.example.backend.repository.CityRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/cities")
public class CityController {

    private final CityRepository cityRepository;

    public CityController(CityRepository cityRepository) {
        this.cityRepository = cityRepository;
    }

    @GetMapping
    public List<CityResponse> listCities() {
        return cityRepository.findAll().stream()
                .map(city -> new CityResponse(city.getCityId(), city.getName(), city.getRegion()))
                .toList();
    }
}
