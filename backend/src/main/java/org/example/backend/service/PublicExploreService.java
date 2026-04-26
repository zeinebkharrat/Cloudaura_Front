package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityResponse;
import org.example.backend.dto.ActivityMediaResponse;
import org.example.backend.dto.CityMediaResponse;
import org.example.backend.dto.CityResponse;
import org.example.backend.dto.RestaurantMenuImageResponse;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.dto.publicapi.CityResolveResponse;
import org.example.backend.dto.publicapi.PublicCityDetailsResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.City;
import org.example.backend.model.CityMedia;
import org.example.backend.model.Restaurant;
import org.example.backend.model.RestaurantMenuImage;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.CityMediaRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.RestaurantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PublicExploreService {

    private final CityRepository cityRepository;
    private final CityMediaRepository cityMediaRepository;
    private final ActivityMediaRepository activityMediaRepository;
    private final RestaurantRepository restaurantRepository;
    private final ActivityRepository activityRepository;
    private final CatalogTranslationService catalogTranslationService;

    public CityResolveResponse resolveCityByName(String mapLabel) {
        if (mapLabel == null || mapLabel.isBlank()) {
            throw new IllegalArgumentException("Le nom de ville est obligatoire");
        }

        String normalizedInput = normalize(mapLabel);

        List<City> allCities = cityRepository.findAll().stream()
            .filter(city -> !city.isExcludedFromPublicCityCatalog())
            .filter(city -> city.getName() != null && !city.getName().isBlank())
            .toList();

        if (allCities.isEmpty()) {
            throw new ResourceNotFoundException("api.error.explore_no_cities");
        }

        City exact = allCities.stream()
            .filter(city -> normalize(city.getName()).equals(normalizedInput))
            .findFirst()
            .orElse(null);

        if (exact != null) {
            return new CityResolveResponse(toCityResponse(exact), true);
        }

        City best = allCities.stream()
            .min(Comparator.comparingInt(city -> levenshtein(normalizedInput, normalize(city.getName()))))
            .orElseThrow(() -> new ResourceNotFoundException("api.error.city_not_found"));

        return new CityResolveResponse(toCityResponse(best), false);
    }

    /** Liste toutes les villes (catalogue public, ex. {@code GET /api/public/cities/all}). */
    @Transactional(readOnly = true)
    public List<CityResponse> listAllCities() {
        return cityRepository.findAll().stream()
                .filter(c -> !c.isExcludedFromPublicCityCatalog())
                .map(this::toCityResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicCityDetailsResponse getCityDetails(Integer cityId) {
        City city = cityRepository.findById(cityId)
            .orElseThrow(() -> new ResourceNotFoundException("api.error.city_not_found"));
        if (city.isExcludedFromPublicCityCatalog()) {
            throw new ResourceNotFoundException("api.error.city_not_found");
        }

        List<CityMediaResponse> media = cityMediaRepository.findByCityCityIdOrderByMediaIdDesc(cityId)
            .stream()
            .map(this::toCityMediaResponse)
            .toList();

        List<RestaurantResponse> restaurants = restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(cityId)
            .stream()
            .map(this::toRestaurantResponse)
            .toList();

        List<ActivityResponse> activities = activityRepository.findByCityCityIdOrderByActivityIdDesc(cityId)
            .stream()
            .map(this::toActivityResponse)
            .toList();

        return new PublicCityDetailsResponse(toCityResponse(city), media, restaurants, activities);
    }

    @Transactional(readOnly = true)
    public List<ActivityMediaResponse> getActivityMedia(Integer activityId) {
        Activity activity = activityRepository.findById(activityId)
            .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_not_found"));

        return activityMediaRepository.findByActivityActivityIdOrderByMediaIdDesc(activity.getActivityId())
            .stream()
            .map(this::toActivityMediaResponse)
            .toList();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
        return decomposed.toLowerCase(Locale.ROOT).trim();
    }

    private int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= b.length(); j++) {
            dp[0][j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                    Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[a.length()][b.length()];
    }

    private CityResponse toCityResponse(City city) {
        int id = city.getCityId();
        return new CityResponse(
            city.getCityId(),
            catalogTranslationService.resolveForRequest("city." + id + ".name", city.getName()),
            catalogTranslationService.resolveForRequest("city." + id + ".region", city.getRegion()),
            catalogTranslationService.resolveForRequest("city." + id + ".description", city.getDescription()),
            city.getLatitude(),
            city.getLongitude()
        );
    }

    private CityMediaResponse toCityMediaResponse(CityMedia media) {
        City c = media.getCity();
        int cid = c.getCityId();
        return new CityMediaResponse(
            media.getMediaId(),
            cid,
            catalogTranslationService.resolveForRequest("city." + cid + ".name", c.getName()),
            media.getUrl(),
            media.getMediaType()
        );
    }

    private RestaurantResponse toRestaurantResponse(Restaurant restaurant) {
        int rid = restaurant.getRestaurantId();
        int cid = restaurant.getCity().getCityId();
        String rawName = restaurant.getName();
        String nameOut =
                catalogTranslationService.resolveEntityField(rid, "restaurant", "name", rawName);
        if (CatalogKeyUtil.isBadI18nPlaceholder(rawName, nameOut)) {
            nameOut = "";
        }
        String rawDesc = restaurant.getDescription();
        String descOut =
                catalogTranslationService.resolveEntityField(rid, "restaurant", "description", rawDesc);
        if (CatalogKeyUtil.isBadI18nPlaceholder(rawDesc, descOut)) {
            descOut = null;
        }
        String rawCuisine = restaurant.getCuisineType() == null ? null : restaurant.getCuisineType().label();
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
            cid,
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

    private ActivityResponse toActivityResponse(Activity activity) {
        String imageUrl = activityMediaRepository.findByActivityActivityIdOrderByMediaIdDesc(activity.getActivityId())
            .stream()
            .findFirst()
            .map(ActivityMedia::getUrl)
            .orElse(null);

        int aid = activity.getActivityId();
        int cid = activity.getCity().getCityId();
        String rawType = activity.getType();
        String resType = catalogTranslationService.resolveEntityField(aid, "activity", "type", rawType);
        String typeOut = CatalogKeyUtil.isBadI18nPlaceholder(rawType, resType) ? "" : resType;
        String rawAddr = activity.getAddress();
        String resAddr = catalogTranslationService.resolveEntityField(aid, "activity", "address", rawAddr);
        String addrOut = CatalogKeyUtil.isBadI18nPlaceholder(rawAddr, resAddr) ? null : resAddr;
        String rawName = activity.getName();
        String nameOut = catalogTranslationService.resolveEntityField(aid, "activity", "name", rawName);
        if (CatalogKeyUtil.isBadI18nPlaceholder(rawName, nameOut)) {
            nameOut = "";
        }
        String rawDesc = activity.getDescription();
        String descOut = catalogTranslationService.resolveEntityField(aid, "activity", "description", rawDesc);
        if (CatalogKeyUtil.isBadI18nPlaceholder(rawDesc, descOut)) {
            descOut = null;
        }
        return new ActivityResponse(
            activity.getActivityId(),
            cid,
            catalogTranslationService.resolveEntityField(cid, "city", "name", activity.getCity().getName()),
            nameOut,
            typeOut,
            activity.getPrice(),
            descOut,
            addrOut,
            activity.getLatitude(),
            activity.getLongitude(),
            imageUrl,
            activity.getMaxParticipantsPerDay(),
            activity.getMaxParticipantsStartDate()
        );
    }

    private ActivityMediaResponse toActivityMediaResponse(ActivityMedia media) {
        Activity a = media.getActivity();
        int aid = a.getActivityId();
        String rawMediaActName = a.getName();
        String mediaActName =
                catalogTranslationService.resolveEntityField(aid, "activity", "name", rawMediaActName);
        if (CatalogKeyUtil.isBadI18nPlaceholder(rawMediaActName, mediaActName)) {
            mediaActName = "";
        }
        return new ActivityMediaResponse(
            media.getMediaId(),
            aid,
            mediaActName,
            media.getUrl(),
            media.getMediaType()
        );
    }
}
