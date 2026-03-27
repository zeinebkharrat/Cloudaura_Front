package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.RestaurantRequest;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Restaurant;
import org.example.backend.repository.RestaurantRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final CityService cityService;
    private final ImgBbService imgBbService;

    public Page<RestaurantResponse> list(String q, Pageable pageable) {
        Specification<Restaurant> spec = (root, query, cb) -> {
            if (q == null || q.isBlank()) {
                return cb.conjunction();
            }
            String like = "%" + q.trim().toLowerCase() + "%";
            return cb.or(
                cb.like(cb.lower(root.get("name")), like),
                cb.like(cb.lower(root.get("cuisineType")), like),
                cb.like(cb.lower(root.get("city").get("name")), like)
            );
        };

        return restaurantRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public RestaurantResponse getById(Integer id) {
        return toResponse(findRestaurant(id));
    }

    @Transactional
    public RestaurantResponse create(RestaurantRequest request) {
        Restaurant restaurant = new Restaurant();
        apply(restaurant, request);
        return toResponse(restaurantRepository.save(restaurant));
    }

    @Transactional
    public RestaurantResponse update(Integer id, RestaurantRequest request) {
        Restaurant restaurant = findRestaurant(id);
        apply(restaurant, request);
        return toResponse(restaurantRepository.save(restaurant));
    }

    @Transactional
    public void delete(Integer id) {
        restaurantRepository.delete(findRestaurant(id));
    }

    @Transactional
    public RestaurantResponse uploadImage(Integer id, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier image est obligatoire");
        }

        Restaurant restaurant = findRestaurant(id);
        String url = imgBbService.uploadImage(file);
        restaurant.setImageUrl(url);

        return toResponse(restaurantRepository.save(restaurant));
    }

    private Restaurant findRestaurant(Integer id) {
        return restaurantRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Restaurant introuvable: " + id));
    }

    private void apply(Restaurant restaurant, RestaurantRequest request) {
        restaurant.setCity(cityService.findCity(request.getCityId()));
        restaurant.setName(request.getName());
        restaurant.setCuisineType(request.getCuisineType());
        restaurant.setRating(request.getRating());
        restaurant.setDescription(request.getDescription());
        restaurant.setAddress(request.getAddress());
        restaurant.setLatitude(request.getLatitude());
        restaurant.setLongitude(request.getLongitude());
        restaurant.setImageUrl(request.getImageUrl());
    }

    private RestaurantResponse toResponse(Restaurant restaurant) {
        return new RestaurantResponse(
            restaurant.getRestaurantId(),
            restaurant.getCity().getCityId(),
            restaurant.getCity().getName(),
            restaurant.getName(),
            restaurant.getCuisineType(),
            restaurant.getRating(),
            restaurant.getDescription(),
            restaurant.getAddress(),
            restaurant.getLatitude(),
            restaurant.getLongitude(),
            restaurant.getImageUrl()
        );
    }
}