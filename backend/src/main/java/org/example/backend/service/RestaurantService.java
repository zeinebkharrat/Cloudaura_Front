package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.RestaurantRequest;
import org.example.backend.dto.RestaurantMenuImageResponse;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Restaurant;
import org.example.backend.model.RestaurantMenuImage;
import org.example.backend.repository.RestaurantMenuImageRepository;
import org.example.backend.repository.RestaurantRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final RestaurantMenuImageRepository restaurantMenuImageRepository;
    private final CityService cityService;
    private final ImgBbService imgBbService;

    public Page<RestaurantResponse> list(String q, Pageable pageable) {
        return list(q, null, null, pageable);
    }

    public Page<RestaurantResponse> list(String q, Integer cityId, Pageable pageable) {
        return list(q, cityId, null, pageable);
    }

    public Page<RestaurantResponse> list(String q, Integer cityId, String cuisineType, Pageable pageable) {
        Specification<Restaurant> spec = (root, query, cb) -> {
            var predicate = cb.conjunction();

            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                predicate = cb.and(predicate, cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("cuisineType")), like),
                    cb.like(cb.lower(root.get("city").get("name")), like)
                ));
            }

            if (cityId != null) {
                predicate = cb.and(predicate, cb.equal(root.get("city").get("cityId"), cityId));
            }

            if (cuisineType != null && !cuisineType.isBlank()) {
                String cuisineLike = "%" + cuisineType.trim().toLowerCase() + "%";
                predicate = cb.and(predicate, cb.like(cb.lower(cb.coalesce(root.get("cuisineType"), "")), cuisineLike));
            }

            return predicate;
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

    @Transactional
    public RestaurantResponse uploadMenuImages(Integer id, MultipartFile[] files) {
        if (files == null || files.length == 0) {
            throw new IllegalArgumentException("Au moins une image de menu est obligatoire");
        }

        Restaurant restaurant = findRestaurant(id);
        int nextDisplayOrder = restaurantMenuImageRepository.findMaxDisplayOrderByRestaurantId(id) + 1;
        List<RestaurantMenuImage> uploaded = new ArrayList<>();

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }

            String contentType = file.getContentType();
            if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
                throw new IllegalArgumentException("Tous les fichiers du menu doivent être des images");
            }

            String imageUrl = imgBbService.uploadImage(file);
            RestaurantMenuImage menuImage = new RestaurantMenuImage();
            menuImage.setRestaurant(restaurant);
            menuImage.setImageUrl(imageUrl);
            menuImage.setDisplayOrder(nextDisplayOrder++);
            uploaded.add(menuImage);
        }

        if (uploaded.isEmpty()) {
            throw new IllegalArgumentException("Aucune image valide n'a été envoyée");
        }

        restaurant.getMenuImages().addAll(uploaded);
        return toResponse(restaurantRepository.save(restaurant));
    }

    @Transactional
    public RestaurantResponse deleteMenuImage(Integer restaurantId, Integer menuImageId) {
        Restaurant restaurant = findRestaurant(restaurantId);

        boolean removed = restaurant.getMenuImages().removeIf(
            menuImage -> menuImageId.equals(menuImage.getMenuImageId())
        );

        if (!removed) {
            throw new ResourceNotFoundException("Image de menu introuvable: " + menuImageId);
        }

        restaurant.getMenuImages().sort(
            Comparator.comparing(
                RestaurantMenuImage::getDisplayOrder,
                Comparator.nullsLast(Integer::compareTo)
            ).thenComparing(
                RestaurantMenuImage::getMenuImageId,
                Comparator.nullsLast(Integer::compareTo)
            )
        );

        for (int index = 0; index < restaurant.getMenuImages().size(); index++) {
            restaurant.getMenuImages().get(index).setDisplayOrder(index + 1);
        }

        return toResponse(restaurantRepository.save(restaurant));
    }

    public Restaurant findRestaurant(Integer id) {
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
        restaurant.setPhoneNumber(request.getPhoneNumber() == null ? null : request.getPhoneNumber().trim());
        restaurant.setLatitude(request.getLatitude());
        restaurant.setLongitude(request.getLongitude());
        restaurant.setImageUrl(request.getImageUrl());
    }

    private RestaurantResponse toResponse(Restaurant restaurant) {
        List<RestaurantMenuImageResponse> menuImages = restaurant.getMenuImages() == null
            ? List.of()
            : restaurant.getMenuImages().stream()
                .sorted(
                    Comparator.comparing(
                        RestaurantMenuImage::getDisplayOrder,
                        Comparator.nullsLast(Integer::compareTo)
                    ).thenComparing(
                        RestaurantMenuImage::getMenuImageId,
                        Comparator.nullsLast(Integer::compareTo)
                    )
                )
                .map(menuImage -> new RestaurantMenuImageResponse(
                    menuImage.getMenuImageId(),
                    menuImage.getImageUrl(),
                    menuImage.getDisplayOrder()
                ))
                .toList();

        return new RestaurantResponse(
            restaurant.getRestaurantId(),
            restaurant.getCity().getCityId(),
            restaurant.getCity().getName(),
            restaurant.getName(),
            restaurant.getCuisineType(),
            restaurant.getRating(),
            restaurant.getDescription(),
            restaurant.getAddress(),
            restaurant.getPhoneNumber(),
            restaurant.getLatitude(),
            restaurant.getLongitude(),
            restaurant.getImageUrl(),
            menuImages
        );
    }
}
