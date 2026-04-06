package org.example.backend.controller;

import jakarta.validation.Valid;
import org.example.backend.dto.ActivityReservationListItemResponse;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityResponse;
import org.example.backend.dto.ActivityResponse;
import org.example.backend.dto.ActivityMediaResponse;
import org.example.backend.dto.PageResponse;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.dto.publicapi.ActivityAvailabilityDayResponse;
import org.example.backend.dto.publicapi.ActivityReservationResponse;
import org.example.backend.dto.publicapi.CityResolveResponse;
import org.example.backend.dto.publicapi.CreateActivityReservationRequest;
import org.example.backend.dto.publicapi.CreatePublicReviewRequest;
import org.example.backend.dto.publicapi.PublicReviewPageResponse;
import org.example.backend.dto.publicapi.PublicReviewResponse;
import org.example.backend.dto.publicapi.PublicCityDetailsResponse;
import org.example.backend.dto.publicapi.ReviewSummaryResponse;
import org.example.backend.dto.publicapi.VoiceTranscriptionResponse;
import org.example.backend.service.ActivityReservationService;
import org.example.backend.service.ActivityService;
import org.example.backend.service.PublicExploreService;
import org.example.backend.service.PublicReviewService;
import org.example.backend.service.RestaurantService;
import org.example.backend.service.VoiceTranscriptionService;
import org.springframework.http.MediaType;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicExploreController {

    private final PublicExploreService publicExploreService;
    private final RestaurantService restaurantService;
    private final ActivityService activityService;
    private final ActivityReservationService activityReservationService;
    private final PublicReviewService publicReviewService;
    private final VoiceTranscriptionService voiceTranscriptionService;

    @GetMapping("/cities/resolve")
    public CityResolveResponse resolveCityByName(@RequestParam String name) {
        return publicExploreService.resolveCityByName(name);
    }

    @GetMapping("/cities/all")
    public List<CityResponse> listAllCities() {
        return publicExploreService.listAllCities();
    }

    @GetMapping("/cities/{cityId}/details")
    public PublicCityDetailsResponse getCityDetails(@PathVariable Integer cityId) {
        return publicExploreService.getCityDetails(cityId);
    }

    @GetMapping("/restaurants/{restaurantId}")
    public RestaurantResponse getRestaurantDetails(@PathVariable Integer restaurantId) {
        return restaurantService.getById(restaurantId);
    }

    @GetMapping("/restaurants")
    public PageResponse<RestaurantResponse> listRestaurants(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) Integer cityId,
        @RequestParam(required = false) String cuisineType,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "18") int size,
        @RequestParam(defaultValue = "restaurantId,desc") String sort
    ) {
        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(restaurantService.list(q, cityId, cuisineType, pageable));
    }

    @GetMapping("/activities/{activityId}")
    public ActivityResponse getActivityDetails(@PathVariable Integer activityId) {
        return activityService.getById(activityId);
    }

    @GetMapping("/restaurants/{restaurantId}/reviews")
    public PublicReviewPageResponse listRestaurantReviews(
        @PathVariable Integer restaurantId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        Pageable pageable = buildPageable(page, size, sort);
        return publicReviewService.listRestaurantReviews(restaurantId, pageable);
    }

    @PostMapping("/restaurants/{restaurantId}/reviews")
    public PublicReviewResponse upsertRestaurantReview(
        @PathVariable Integer restaurantId,
        @Valid @RequestBody CreatePublicReviewRequest request
    ) {
        return publicReviewService.upsertRestaurantReview(restaurantId, request);
    }

    @DeleteMapping("/restaurants/{restaurantId}/reviews/mine")
    public void deleteRestaurantReview(@PathVariable Integer restaurantId) {
        publicReviewService.deleteRestaurantReview(restaurantId);
    }

    @GetMapping("/restaurants/{restaurantId}/reviews/summary")
    public ReviewSummaryResponse restaurantReviewSummary(@PathVariable Integer restaurantId) {
        return publicReviewService.summaryForRestaurant(restaurantId);
    }

    @GetMapping("/activities")
    public PageResponse<ActivityResponse> listActivities(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) Integer cityId,
        @RequestParam(required = false) Double minPrice,
        @RequestParam(required = false) Double maxPrice,
        @RequestParam(required = false) String date,
        @RequestParam(defaultValue = "1") Integer participants,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "18") int size,
        @RequestParam(defaultValue = "activityId,desc") String sort
    ) {
        LocalDate availableDate = null;
        if (date != null && !date.isBlank()) {
            try {
                availableDate = LocalDate.parse(date);
            } catch (DateTimeException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paramètre date invalide (yyyy-MM-dd)");
            }
        }

        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(activityService.list(
            q,
            cityId,
            minPrice,
            maxPrice,
            availableDate,
            participants,
            pageable
        ));
    }

    @GetMapping("/activities/{activityId}/media")
    public List<ActivityMediaResponse> getActivityMedia(@PathVariable Integer activityId) {
        return publicExploreService.getActivityMedia(activityId);
    }

    @GetMapping("/activities/{activityId}/reviews")
    public PublicReviewPageResponse listActivityReviews(
        @PathVariable Integer activityId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        Pageable pageable = buildPageable(page, size, sort);
        return publicReviewService.listActivityReviews(activityId, pageable);
    }

    @PostMapping("/activities/{activityId}/reviews")
    public PublicReviewResponse upsertActivityReview(
        @PathVariable Integer activityId,
        @Valid @RequestBody CreatePublicReviewRequest request
    ) {
        return publicReviewService.upsertActivityReview(activityId, request);
    }

    @DeleteMapping("/activities/{activityId}/reviews/mine")
    public void deleteActivityReview(@PathVariable Integer activityId) {
        publicReviewService.deleteActivityReview(activityId);
    }

    @GetMapping("/activities/{activityId}/reviews/summary")
    public ReviewSummaryResponse activityReviewSummary(@PathVariable Integer activityId) {
        return publicReviewService.summaryForActivity(activityId);
    }

    @GetMapping("/activities/{activityId}/availability")
    public List<ActivityAvailabilityDayResponse> getActivityAvailability(
        @PathVariable Integer activityId,
        @RequestParam(required = false) String from,
        @RequestParam(defaultValue = "45") int days,
        @RequestParam(defaultValue = "1") int participants
    ) {
        LocalDate fromDate;
        try {
            fromDate = (from == null || from.isBlank()) ? LocalDate.now() : LocalDate.parse(from);
        } catch (DateTimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paramètre from invalide (yyyy-MM-dd)");
        }
        return activityReservationService.availability(activityId, fromDate, days, participants);
    }

    @PostMapping("/activities/{activityId}/reservations")
    public ActivityReservationResponse createActivityReservation(
        @PathVariable Integer activityId,
        @Valid @RequestBody CreateActivityReservationRequest request
    ) {
        return activityReservationService.create(activityId, request);
    }

    @PostMapping(value = "/voice/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public VoiceTranscriptionResponse transcribeVoice(
        @RequestParam("audio") MultipartFile audio,
        @RequestParam(required = false) String language
    ) {
        return voiceTranscriptionService.transcribe(audio, language);
    }

    @GetMapping("/my/activity-reservations")
    public PageResponse<ActivityReservationListItemResponse> myActivityReservations(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "reservationDate,desc") String sort
    ) {
        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(activityReservationService.listCurrentUserReservations(pageable));
    }

    private Pageable buildPageable(int page, int size, String sort) {
        String[] sortParts = sort.split(",");
        String sortBy = sortParts[0].trim();
        Sort.Direction direction = (sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1]))
            ? Sort.Direction.DESC
            : Sort.Direction.ASC;
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(direction, sortBy));
    }
}
