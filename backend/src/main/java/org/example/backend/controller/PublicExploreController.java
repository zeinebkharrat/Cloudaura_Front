package org.example.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityResponse;
import org.example.backend.dto.ActivityMediaResponse;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.dto.publicapi.ActivityReservationResponse;
import org.example.backend.dto.publicapi.CityResolveResponse;
import org.example.backend.dto.publicapi.CreateActivityReservationRequest;
import org.example.backend.dto.publicapi.PublicCityDetailsResponse;
import org.example.backend.service.ActivityReservationService;
import org.example.backend.service.ActivityService;
import org.example.backend.service.PublicExploreService;
import org.example.backend.service.RestaurantService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicExploreController {

    private final PublicExploreService publicExploreService;
    private final RestaurantService restaurantService;
    private final ActivityService activityService;
    private final ActivityReservationService activityReservationService;

    @GetMapping("/cities/resolve")
    public CityResolveResponse resolveCityByName(@RequestParam String name) {
        return publicExploreService.resolveCityByName(name);
    }

    @GetMapping("/cities/{cityId}/details")
    public PublicCityDetailsResponse getCityDetails(@PathVariable Integer cityId) {
        return publicExploreService.getCityDetails(cityId);
    }

    @GetMapping("/restaurants/{restaurantId}")
    public RestaurantResponse getRestaurantDetails(@PathVariable Integer restaurantId) {
        return restaurantService.getById(restaurantId);
    }

    @GetMapping("/activities/{activityId}")
    public ActivityResponse getActivityDetails(@PathVariable Integer activityId) {
        return activityService.getById(activityId);
    }

    @GetMapping("/activities/{activityId}/media")
    public List<ActivityMediaResponse> getActivityMedia(@PathVariable Integer activityId) {
        return publicExploreService.getActivityMedia(activityId);
    }

    @PostMapping("/activities/{activityId}/reservations")
    public ActivityReservationResponse createActivityReservation(
        @PathVariable Integer activityId,
        @Valid @RequestBody CreateActivityReservationRequest request
    ) {
        return activityReservationService.create(activityId, request);
    }
}