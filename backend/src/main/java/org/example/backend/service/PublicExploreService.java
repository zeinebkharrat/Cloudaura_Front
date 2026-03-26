package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityResponse;
import org.example.backend.dto.CityMediaResponse;
import org.example.backend.dto.CityResponse;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.dto.publicapi.CityResolveResponse;
import org.example.backend.dto.publicapi.PublicCityDetailsResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Activity;
import org.example.backend.model.City;
import org.example.backend.model.CityMedia;
import org.example.backend.model.Restaurant;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.CityMediaRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.RestaurantRepository;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PublicExploreService {

    private final CityRepository cityRepository;
    private final CityMediaRepository cityMediaRepository;
    private final RestaurantRepository restaurantRepository;
    private final ActivityRepository activityRepository;

    public CityResolveResponse resolveCityByName(String mapLabel) {
        if (mapLabel == null || mapLabel.isBlank()) {
            throw new IllegalArgumentException("Le nom de ville est obligatoire");
        }

        String normalizedInput = normalize(mapLabel);

        List<City> allCities = cityRepository.findAll().stream()
            .filter(city -> city.getName() != null && !city.getName().isBlank())
            .toList();

        if (allCities.isEmpty()) {
            throw new ResourceNotFoundException("Aucune ville disponible en base de données");
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
            .orElseThrow(() -> new ResourceNotFoundException("Aucune ville trouvée pour: " + mapLabel));

        return new CityResolveResponse(toCityResponse(best), false);
    }

    public PublicCityDetailsResponse getCityDetails(Integer cityId) {
        City city = cityRepository.findById(cityId)
            .orElseThrow(() -> new ResourceNotFoundException("Ville introuvable: " + cityId));

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
        return new CityResponse(
            city.getCityId(),
            city.getName(),
            city.getRegion(),
            city.getDescription(),
            city.getLatitude(),
            city.getLongitude()
        );
    }

    private CityMediaResponse toCityMediaResponse(CityMedia media) {
        return new CityMediaResponse(
            media.getMediaId(),
            media.getCity().getCityId(),
            media.getCity().getName(),
            media.getUrl(),
            media.getMediaType()
        );
    }

    private RestaurantResponse toRestaurantResponse(Restaurant restaurant) {
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

    private ActivityResponse toActivityResponse(Activity activity) {
        return new ActivityResponse(
            activity.getActivityId(),
            activity.getCity().getCityId(),
            activity.getCity().getName(),
            activity.getName(),
            activity.getType(),
            activity.getPrice(),
            activity.getDescription()
        );
    }
}