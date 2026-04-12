package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.personalization.PersonalizedRecommendationsResponse;
import org.example.backend.dto.personalization.PreferenceSurveyRequest;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.City;
import org.example.backend.model.CityMedia;
import org.example.backend.model.Event;
import org.example.backend.model.User;
import org.example.backend.model.UserPreferences;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.CityMediaRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.UserPreferencesRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PersonalizationService {

    private static final int MAX_RECOMMENDATIONS = 6;

    private static final Map<String, Set<String>> INTEREST_KEYWORDS = Map.of(
            "beaches", Set.of("beach", "coast", "sea", "marine", "island", "shore"),
            "nightlife", Set.of("night", "party", "club", "bar", "music", "festival"),
            "culture", Set.of("culture", "museum", "medina", "heritage", "historic", "art", "souk"),
            "adventure", Set.of("adventure", "hike", "trek", "quad", "desert", "surf", "climb"),
            "nature", Set.of("nature", "park", "mountain", "oasis", "forest", "island"),
            "food", Set.of("food", "cuisine", "restaurant", "culinary", "taste", "street food"),
            "family", Set.of("family", "kids", "children", "zoo", "park", "safe"),
            "relaxation", Set.of("relax", "spa", "wellness", "calm", "resort", "sunset")
    );

    private final UserRepository userRepository;
    private final UserPreferencesRepository userPreferencesRepository;
    private final CityRepository cityRepository;
    private final CityMediaRepository cityMediaRepository;
    private final ActivityRepository activityRepository;
    private final ActivityMediaRepository activityMediaRepository;
    private final EventRepository eventRepository;

    @Transactional
    public void savePreferences(Integer userId, PreferenceSurveyRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        UserPreferences prefs = userPreferencesRepository.findByUserUserId(userId)
                .orElseGet(() -> UserPreferences.builder().user(user).build());

        prefs.setTravelStyle(toCsv(request.interests()));
        prefs.setPreferredRegion(clean(request.preferredRegion()));
        prefs.setTravelWith(clean(request.travelWith()));
        prefs.setAccommodationType(clean(request.accommodationType()));
        prefs.setTransportPreference(clean(request.transportPreference()));
        prefs.setPreferredCuisine(clean(request.preferredCuisine()));

        String budgetLevel = normalizeToken(request.budgetLevel());
        switch (budgetLevel) {
            case "low" -> {
                prefs.setBudgetMin(0d);
                prefs.setBudgetMax(70d);
            }
            case "medium" -> {
                prefs.setBudgetMin(50d);
                prefs.setBudgetMax(170d);
            }
            case "premium" -> {
                prefs.setBudgetMin(140d);
                prefs.setBudgetMax(500d);
            }
            default -> {
                prefs.setBudgetMin(null);
                prefs.setBudgetMax(null);
            }
        }

        userPreferencesRepository.save(prefs);
    }

    @Transactional(readOnly = true)
    public PersonalizedRecommendationsResponse getRecommendations(Integer userId) {
        UserPreferences prefs = userPreferencesRepository.findByUserUserId(userId).orElse(null);
        List<String> interests = parseInterests(prefs);

        List<PersonalizedRecommendationsResponse.RecommendedCity> cityRecommendations = cityRepository.findAll().stream()
                .map(city -> mapCity(city, scoreCity(city, prefs, interests)))
                .filter(item -> item.score() > 0)
                .sorted(Comparator.comparingDouble(PersonalizedRecommendationsResponse.RecommendedCity::score).reversed())
                .limit(MAX_RECOMMENDATIONS)
                .toList();

        if (cityRecommendations.isEmpty()) {
            cityRecommendations = cityRepository.findAll().stream()
                    .limit(MAX_RECOMMENDATIONS)
                    .map(city -> mapCity(city, 0.2d))
                    .toList();
        }

        List<PersonalizedRecommendationsResponse.RecommendedActivity> activityRecommendations = activityRepository.findAll().stream()
                .map(activity -> mapActivity(activity, scoreActivity(activity, prefs, interests)))
                .filter(item -> item.score() > 0)
                .sorted(Comparator.comparingDouble(PersonalizedRecommendationsResponse.RecommendedActivity::score).reversed())
                .limit(MAX_RECOMMENDATIONS)
                .toList();

        if (activityRecommendations.isEmpty()) {
            activityRecommendations = activityRepository.findAll().stream()
                    .limit(MAX_RECOMMENDATIONS)
                    .map(activity -> mapActivity(activity, 0.2d))
                    .toList();
        }

        List<PersonalizedRecommendationsResponse.RecommendedEvent> eventRecommendations = eventRepository.findAll().stream()
                .map(event -> mapEvent(event, scoreEvent(event, prefs, interests)))
                .filter(item -> item.score() > 0)
                .sorted(Comparator.comparingDouble(PersonalizedRecommendationsResponse.RecommendedEvent::score).reversed())
                .limit(MAX_RECOMMENDATIONS)
                .toList();

        if (eventRecommendations.isEmpty()) {
            eventRecommendations = eventRepository.findAll().stream()
                    .limit(MAX_RECOMMENDATIONS)
                    .map(event -> mapEvent(event, 0.2d))
                    .toList();
        }

        return new PersonalizedRecommendationsResponse(
                prefs != null,
                cityRecommendations,
                activityRecommendations,
                eventRecommendations
        );
    }

    private PersonalizedRecommendationsResponse.RecommendedCity mapCity(City city, double score) {
        String image = cityMediaRepository.findByCityCityIdOrderByMediaIdDesc(city.getCityId()).stream()
                .findFirst()
                .map(CityMedia::getUrl)
                .orElse(null);

        return new PersonalizedRecommendationsResponse.RecommendedCity(
                city.getCityId(),
                city.getName(),
                city.getRegion(),
                city.getDescription(),
                image,
                round(score)
        );
    }

    private PersonalizedRecommendationsResponse.RecommendedActivity mapActivity(Activity activity, double score) {
        String image = activityMediaRepository.findByActivityActivityIdOrderByMediaIdDesc(activity.getActivityId()).stream()
                .findFirst()
                .map(ActivityMedia::getUrl)
                .orElse(null);

        return new PersonalizedRecommendationsResponse.RecommendedActivity(
                activity.getActivityId(),
                activity.getCity() != null ? activity.getCity().getCityId() : null,
                activity.getCity() != null ? activity.getCity().getName() : null,
                activity.getName(),
                activity.getType(),
                activity.getDescription(),
                activity.getPrice(),
                image,
                round(score)
        );
    }

    private PersonalizedRecommendationsResponse.RecommendedEvent mapEvent(Event event, double score) {
        String startDate = null;
        if (event.getStartDate() != null) {
            startDate = event.getStartDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate().toString();
        }

        return new PersonalizedRecommendationsResponse.RecommendedEvent(
                event.getEventId(),
                event.getCity() != null ? event.getCity().getCityId() : null,
                event.getCity() != null ? event.getCity().getName() : null,
                event.getTitle(),
                event.getEventType(),
                event.getVenue(),
                startDate,
                event.getPrice(),
                event.getImageUrl(),
                round(score)
        );
    }

    private double scoreCity(City city, UserPreferences prefs, List<String> interests) {
        double score = 0.15d;
        String text = normalizeText(city.getName()) + " " + normalizeText(city.getRegion()) + " " + normalizeText(city.getDescription());

        score += scoreByInterests(text, interests, 0.42d);

        String preferredRegion = normalizeToken(prefs != null ? prefs.getPreferredRegion() : null);
        if (!preferredRegion.isBlank()) {
            String region = normalizeToken(city.getRegion());
            if (region.contains(preferredRegion) || preferredRegion.contains(region)) {
                score += 0.35d;
            }
        }

        if (Boolean.TRUE.equals(city.getHasAirport())) {
            score += 0.04d;
        }
        if (Boolean.TRUE.equals(city.getHasPort()) && interests.contains("beaches")) {
            score += 0.12d;
        }

        return score;
    }

    private double scoreActivity(Activity activity, UserPreferences prefs, List<String> interests) {
        double score = 0.1d;
        String text = normalizeText(activity.getName()) + " " + normalizeText(activity.getType()) + " " + normalizeText(activity.getDescription());

        score += scoreByInterests(text, interests, 0.5d);
        score += scoreRegion(activity.getCity(), prefs, 0.26d);
        score += scoreBudget(activity.getPrice(), prefs, 0.24d);

        String travelWith = normalizeToken(prefs != null ? prefs.getTravelWith() : null);
        if ("family".equals(travelWith) && text.contains("family")) {
            score += 0.15d;
        }

        return score;
    }

    private double scoreEvent(Event event, UserPreferences prefs, List<String> interests) {
        double score = 0.1d;
        String text = normalizeText(event.getTitle()) + " " + normalizeText(event.getEventType()) + " " + normalizeText(event.getVenue());

        score += scoreByInterests(text, interests, 0.46d);
        score += scoreRegion(event.getCity(), prefs, 0.23d);
        score += scoreBudget(event.getPrice(), prefs, 0.2d);

        Date startDate = event.getStartDate();
        if (startDate != null && startDate.toInstant().isAfter(Instant.now().minusSeconds(48 * 3600L))) {
            score += 0.18d;
        }

        String transportPreference = normalizeToken(prefs != null ? prefs.getTransportPreference() : null);
        if ("nightlife".equals(transportPreference) && text.contains("night")) {
            score += 0.15d;
        }

        return score;
    }

    private double scoreByInterests(String text, List<String> interests, double maxWeight) {
        if (interests.isEmpty()) {
            return maxWeight * 0.2d;
        }

        int matched = 0;
        for (String interest : interests) {
            Set<String> keywords = INTEREST_KEYWORDS.getOrDefault(interest, Set.of(interest));
            boolean found = keywords.stream().anyMatch(text::contains);
            if (found) {
                matched++;
            }
        }

        return maxWeight * ((double) matched / Math.max(1, interests.size()));
    }

    private double scoreRegion(City city, UserPreferences prefs, double weight) {
        String preferredRegion = normalizeToken(prefs != null ? prefs.getPreferredRegion() : null);
        if (preferredRegion.isBlank() || city == null) {
            return weight * 0.2d;
        }

        String region = normalizeToken(city.getRegion());
        if (region.contains(preferredRegion) || preferredRegion.contains(region)) {
            return weight;
        }
        return 0;
    }

    private double scoreBudget(Double price, UserPreferences prefs, double weight) {
        if (price == null || prefs == null || prefs.getBudgetMin() == null || prefs.getBudgetMax() == null) {
            return weight * 0.3d;
        }

        double min = prefs.getBudgetMin();
        double max = prefs.getBudgetMax();
        if (price >= min && price <= max) {
            return weight;
        }

        double distance = 0d;
        if (price < min) {
            distance = min - price;
        } else if (price > max) {
            distance = price - max;
        }

        if (distance <= 20) {
            return weight * 0.65d;
        }
        if (distance <= 60) {
            return weight * 0.35d;
        }
        return 0;
    }

    private List<String> parseInterests(UserPreferences prefs) {
        if (prefs == null || prefs.getTravelStyle() == null || prefs.getTravelStyle().isBlank()) {
            return List.of();
        }

        return List.of(prefs.getTravelStyle().split(","))
                .stream()
                .map(this::normalizeToken)
                .filter(token -> !token.isBlank())
                .toList();
    }

    private String toCsv(List<String> interests) {
        if (interests == null || interests.isEmpty()) {
            return null;
        }

        return interests.stream()
                .map(this::normalizeToken)
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.joining(","));
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeToken(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeText(String value) {
        return normalizeToken(value);
    }

    private double round(double value) {
        return Math.round(value * 1000d) / 1000d;
    }
}
