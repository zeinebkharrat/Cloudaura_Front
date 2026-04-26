package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.RestaurantRequest;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.dto.RestaurantMenuImageResponse;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.CuisineType;
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

import java.util.Locale;
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
    private final CatalogTranslationService catalogTranslationService;

    public Page<RestaurantResponse> list(String q, Pageable pageable) {
        return list(q, null, null, pageable);
    }

    public Page<RestaurantResponse> list(String q, Integer cityId, Pageable pageable) {
        return list(q, cityId, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<RestaurantResponse> list(String q, Integer cityId, String cuisineType, Pageable pageable) {
        final CuisineType cuisineFilterEnum = parseCuisineOrNull(cuisineType, false);

        Specification<Restaurant> spec = (root, query, cb) -> {
            var predicate = cb.conjunction();

            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                CuisineType qCuisine = parseCuisineOrNull(q, false);
                predicate = cb.and(predicate, cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    qCuisine != null ? cb.equal(root.get("cuisineType"), qCuisine) : cb.disjunction(),
                    cb.like(cb.lower(root.get("city").get("name")), like)
                ));
            }

            if (cityId != null) {
                predicate = cb.and(predicate, cb.equal(root.get("city").get("cityId"), cityId));
            }

            if (cuisineFilterEnum != null) {
                predicate = cb.and(predicate, cb.equal(root.get("cuisineType"), cuisineFilterEnum));
            }

            return predicate;
        };

        return restaurantRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
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
            .orElseThrow(() -> new ResourceNotFoundException("api.error.restaurant_not_found"));
    }

    private void apply(Restaurant restaurant, RestaurantRequest request) {
        restaurant.setCity(cityService.findCity(request.getCityId()));
        restaurant.setName(request.getName());
        restaurant.setCuisineType(parseCuisineOrNull(request.getCuisineType(), true));
        restaurant.setRating(request.getRating());
        restaurant.setDescription(request.getDescription());
        restaurant.setAddress(request.getAddress());
        restaurant.setPhoneNumber(request.getPhoneNumber() == null ? null : request.getPhoneNumber().trim());
        restaurant.setLatitude(request.getLatitude());
        restaurant.setLongitude(request.getLongitude());
        restaurant.setImageUrl(request.getImageUrl());
    }

    private RestaurantResponse toResponse(Restaurant restaurant) {
        int rid = restaurant.getRestaurantId();
        int cid = restaurant.getCity().getCityId();

        String rawName = restaurant.getName();
        String resName = catalogTranslationService.resolveEntityField(rid, "restaurant", "name", rawName);
        String nameOut = CatalogKeyUtil.isBadI18nPlaceholder(rawName, resName) ? "" : resName;

        String rawDesc = restaurant.getDescription();
        String resDesc = catalogTranslationService.resolveEntityField(rid, "restaurant", "description", rawDesc);
        String descOut = CatalogKeyUtil.isBadI18nPlaceholder(rawDesc, resDesc) ? null : resDesc;

        String rawCuisine = cuisineLabel(restaurant.getCuisineType());
        String cuisineOut =
                rawCuisine == null || rawCuisine.isBlank() || CatalogKeyUtil.looksLikeCatalogKey(rawCuisine)
                        ? null
                        : rawCuisine;

        String rawAddr = restaurant.getAddress();
        String addrOut =
                rawAddr == null || rawAddr.isBlank() || CatalogKeyUtil.looksLikeCatalogKey(rawAddr)
                        ? null
                        : rawAddr;
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
            catalogTranslationService.resolveEntityField(cid, "city", "name", restaurant.getCity().getName()),
            nameOut,
            cuisineOut,
            restaurant.getRating(),
            descOut,
            addrOut,
            restaurant.getPhoneNumber(),
            restaurant.getLatitude(),
            restaurant.getLongitude(),
            restaurant.getImageUrl(),
            menuImages
        );
    }

    private CuisineType parseCuisineOrNull(String raw, boolean strict) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        try {
            return CuisineType.fromValue(raw);
        } catch (IllegalArgumentException ex) {
            if (strict) {
                throw ex;
            }
            return null;
        }
    }

    private String cuisineLabel(CuisineType cuisineType) {
        return cuisineType == null ? null : cuisineType.label();
    }

    private String normalizeCuisine(String raw) {
        return raw.trim().toLowerCase(Locale.ROOT).replace("-", " ").replace("_", " ").replaceAll("\\s+", " ");
    }
}
