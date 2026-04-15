package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.personalization.PreferenceImageAnalysisResponse;
import org.example.backend.dto.personalization.PersonalizedRecommendationsResponse;
import org.example.backend.dto.personalization.PreferenceSurveyRequest;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.ActivityReservation;
import org.example.backend.model.City;
import org.example.backend.model.CityMedia;
import org.example.backend.model.Event;
import org.example.backend.model.EventReservation;
import org.example.backend.model.Reservation;
import org.example.backend.model.Room;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.example.backend.model.User;
import org.example.backend.model.UserPreferences;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.CityMediaRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.repository.UserPreferencesRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.text.Normalizer;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PersonalizationService {

    private static final int MAX_RECOMMENDATIONS = 6;
    private static final int USER_HISTORY_LIMIT = 40;

    private static final Map<String, Set<String>> INTEREST_KEYWORDS = Map.of(
        "beaches", Set.of("beach", "coast", "sea", "marine", "island", "shore", "plage", "mer"),
        "nightlife", Set.of("night", "party", "club", "bar", "music", "festival", "soir"),
        "culture", Set.of("culture", "museum", "medina", "heritage", "historic", "art", "souk", "tradition"),
        "adventure", Set.of("adventure", "hike", "trek", "quad", "desert", "surf", "climb", "trail"),
        "nature", Set.of("nature", "park", "mountain", "oasis", "forest", "island", "green", "randonnee"),
        "food", Set.of("food", "cuisine", "restaurant", "culinary", "taste", "streetfood", "gastronomy"),
        "family", Set.of("family", "kids", "children", "zoo", "park", "safe", "familial"),
        "relaxation", Set.of("relax", "spa", "wellness", "calm", "resort", "sunset", "detente")
    );

    private static final Set<String> STOPWORDS = Set.of(
        "a", "an", "the", "and", "or", "to", "for", "in", "on", "of", "with", "at", "by",
        "de", "du", "des", "la", "le", "les", "et", "ou", "pour", "dans", "sur", "avec",
        "this", "that", "these", "those", "your", "you", "our", "nous", "vous", "from"
    );

    private static final Map<String, String> TOKEN_ALIASES = Map.ofEntries(
        Map.entry("plages", "beach"),
        Map.entry("plage", "beach"),
        Map.entry("beaches", "beach"),
        Map.entry("nightlife", "night"),
        Map.entry("soiree", "night"),
        Map.entry("clubs", "club"),
        Map.entry("kids", "child"),
        Map.entry("children", "child"),
        Map.entry("familial", "family"),
        Map.entry("restaurants", "restaurant"),
        Map.entry("cuisine", "food"),
        Map.entry("medinas", "medina"),
        Map.entry("museums", "museum"),
        Map.entry("hikes", "hike"),
        Map.entry("treks", "trek"),
        Map.entry("mountains", "mountain"),
        Map.entry("islands", "island"),
        Map.entry("trains", "train"),
        Map.entry("buses", "bus")
    );

    private final UserRepository userRepository;
    private final UserPreferencesRepository userPreferencesRepository;
    private final CityRepository cityRepository;
    private final CityMediaRepository cityMediaRepository;
    private final ActivityRepository activityRepository;
    private final ActivityMediaRepository activityMediaRepository;
    private final EventRepository eventRepository;
    private final ReservationRepository reservationRepository;
    private final TransportReservationRepository transportReservationRepository;
    private final ActivityReservationRepository activityReservationRepository;
    private final EventReservationRepository eventReservationRepository;
    private final ImageDescriptionService imageDescriptionService;

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

        UserNlpProfile profile = buildUserNlpProfile(userId, prefs, interests);

        List<City> cities = cityRepository.findAll();
        List<Activity> activities = activityRepository.findAll();
        List<Event> events = eventRepository.findAll();

        Map<String, Double> cityIdf = buildIdf(cities.stream().map(this::cityText).toList());
        Map<String, Double> activityIdf = buildIdf(activities.stream().map(this::activityText).toList());
        Map<String, Double> eventIdf = buildIdf(events.stream().map(this::eventText).toList());

        List<PersonalizedRecommendationsResponse.RecommendedCity> cityRecommendations = cities.stream()
            .map(city -> mapCity(city, scoreCity(city, prefs, interests, profile, cityIdf)))
            .filter(item -> item.score() > 0.05d)
                .sorted(Comparator.comparingDouble(PersonalizedRecommendationsResponse.RecommendedCity::score).reversed())
                .limit(MAX_RECOMMENDATIONS)
                .toList();

        if (cityRecommendations.isEmpty()) {
            cityRecommendations = cities.stream()
                    .limit(MAX_RECOMMENDATIONS)
                    .map(city -> mapCity(city, 0.2d))
                    .toList();
        }

        List<PersonalizedRecommendationsResponse.RecommendedActivity> activityRecommendations = activities.stream()
            .map(activity -> mapActivity(activity, scoreActivity(activity, prefs, interests, profile, activityIdf)))
            .filter(item -> item.score() > 0.05d)
                .sorted(Comparator.comparingDouble(PersonalizedRecommendationsResponse.RecommendedActivity::score).reversed())
                .limit(MAX_RECOMMENDATIONS)
                .toList();

        if (activityRecommendations.isEmpty()) {
            activityRecommendations = activities.stream()
                    .limit(MAX_RECOMMENDATIONS)
                    .map(activity -> mapActivity(activity, 0.2d))
                    .toList();
        }

        List<PersonalizedRecommendationsResponse.RecommendedEvent> eventRecommendations = events.stream()
            .map(event -> mapEvent(event, scoreEvent(event, prefs, interests, profile, eventIdf)))
            .filter(item -> item.score() > 0.05d)
                .sorted(Comparator.comparingDouble(PersonalizedRecommendationsResponse.RecommendedEvent::score).reversed())
                .limit(MAX_RECOMMENDATIONS)
                .toList();

        if (eventRecommendations.isEmpty()) {
            eventRecommendations = events.stream()
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

    @Transactional
    public PreferenceImageAnalysisResponse analyzePreferenceImage(Integer userId,
                                                                  MultipartFile file,
                                                                  boolean applyToPreferences) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }

        String description;
        try {
            description = imageDescriptionService.describeImage(file);
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    ex.getMessage() != null ? ex.getMessage() : "Could not analyze image");
        }

        Map<String, Integer> tf = termFrequency(description);
        List<String> topKeywords = tf.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(12)
                .map(Map.Entry::getKey)
                .toList();

        Map<String, Double> interestScores = new LinkedHashMap<>();
        for (Map.Entry<String, Set<String>> entry : INTEREST_KEYWORDS.entrySet()) {
            String interest = entry.getKey();
            Set<String> keys = entry.getValue();
            long matches = keys.stream().filter(tf::containsKey).count();
            if (matches > 0) {
                double score = (double) matches / keys.size();
                interestScores.put(interest, score);
            }
        }

        List<String> detectedInterests = interestScores.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(4)
                .map(Map.Entry::getKey)
                .toList();

        boolean preferencesUpdated = false;
        if (applyToPreferences && !detectedInterests.isEmpty()) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            UserPreferences prefs = userPreferencesRepository.findByUserUserId(userId)
                    .orElseGet(() -> UserPreferences.builder().user(user).build());

            Set<String> merged = new HashSet<>(parseInterests(prefs));
            merged.addAll(detectedInterests);
            prefs.setTravelStyle(merged.stream()
                    .map(this::normalizeToken)
                    .filter(v -> !v.isBlank())
                    .sorted()
                    .collect(Collectors.joining(",")));
            userPreferencesRepository.save(prefs);
            preferencesUpdated = true;
        }

        return new PreferenceImageAnalysisResponse(
                description,
                detectedInterests,
                topKeywords,
                preferencesUpdated
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

    private double scoreCity(City city,
                             UserPreferences prefs,
                             List<String> interests,
                             UserNlpProfile profile,
                             Map<String, Double> idf) {
        String text = cityText(city);
        double semantic = tfIdfSimilarity(profile.tokenWeights(), text, idf);
        double keyword = scoreByInterests(text, interests, 1.0d);
        double region = scoreRegion(city, prefs, 1.0d);
        double history = profile.cityAffinity().getOrDefault(city.getCityId(), 0d);

        double infra = 0d;
        if (Boolean.TRUE.equals(city.getHasAirport())) {
            infra += 0.25d;
        }
        if (Boolean.TRUE.equals(city.getHasPort()) && interests.contains("beaches")) {
            infra += 0.35d;
        }
        if (Boolean.TRUE.equals(city.getHasTrainStation()) || Boolean.TRUE.equals(city.getHasBusStation())) {
            infra += 0.1d;
        }

        double score =
                0.52d * semantic +
                0.20d * keyword +
                0.16d * region +
                0.08d * Math.min(1d, history) +
                0.04d * Math.min(1d, infra);

        return clamp01(score);
    }

    private double scoreActivity(Activity activity,
                                 UserPreferences prefs,
                                 List<String> interests,
                                 UserNlpProfile profile,
                                 Map<String, Double> idf) {
        String text = activityText(activity);
        double semantic = tfIdfSimilarity(profile.tokenWeights(), text, idf);
        double keyword = scoreByInterests(text, interests, 1.0d);
        double region = scoreRegion(activity.getCity(), prefs, 1.0d);
        double budget = scoreBudget(activity.getPrice(), prefs, 1.0d);

        String normalizedType = normalizeToken(activity.getType());
        double activityTypeAffinity = profile.preferredActivityTypes().contains(normalizedType) ? 1d : 0d;

        String travelWith = normalizeToken(prefs != null ? prefs.getTravelWith() : null);
        double familyFit = ("family".equals(travelWith) && text.contains("family")) ? 1d : 0d;

        double score =
                0.44d * semantic +
                0.18d * keyword +
                0.14d * region +
                0.14d * budget +
                0.07d * activityTypeAffinity +
                0.03d * familyFit;

        return clamp01(score);
    }

    private double scoreEvent(Event event,
                              UserPreferences prefs,
                              List<String> interests,
                              UserNlpProfile profile,
                              Map<String, Double> idf) {
        String text = eventText(event);
        double semantic = tfIdfSimilarity(profile.tokenWeights(), text, idf);
        double keyword = scoreByInterests(text, interests, 1.0d);
        double region = scoreRegion(event.getCity(), prefs, 1.0d);
        double budget = scoreBudget(event.getPrice(), prefs, 1.0d);

        Date startDate = event.getStartDate();
        double recency = 0d;
        if (startDate != null && startDate.toInstant().isAfter(Instant.now().minusSeconds(72 * 3600L))) {
            recency = 1d;
        }

        String normalizedType = normalizeToken(event.getEventType());
        double eventTypeAffinity = profile.preferredEventTypes().contains(normalizedType) ? 1d : 0d;

        String transportPreference = normalizeToken(prefs != null ? prefs.getTransportPreference() : null);
        double nightlifeBoost = ("nightlife".equals(transportPreference) && text.contains("night")) ? 1d : 0d;

        double score =
                0.42d * semantic +
                0.16d * keyword +
                0.12d * region +
                0.11d * budget +
                0.10d * recency +
                0.06d * eventTypeAffinity +
                0.03d * nightlifeBoost;

        return clamp01(score);
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

    private UserNlpProfile buildUserNlpProfile(Integer userId, UserPreferences prefs, List<String> interests) {
        Map<String, Double> tokenWeights = new HashMap<>();
        Map<Integer, Double> cityAffinity = new HashMap<>();
        Set<String> preferredActivityTypes = new HashSet<>();
        Set<String> preferredEventTypes = new HashSet<>();

        addWeightedTokens(tokenWeights, String.join(" ", interests), 2.8d);
        addWeightedTokens(tokenWeights, prefs != null ? prefs.getPreferredRegion() : null, 2.0d);
        addWeightedTokens(tokenWeights, prefs != null ? prefs.getTravelWith() : null, 1.6d);
        addWeightedTokens(tokenWeights, prefs != null ? prefs.getAccommodationType() : null, 1.5d);
        addWeightedTokens(tokenWeights, prefs != null ? prefs.getTransportPreference() : null, 1.4d);
        addWeightedTokens(tokenWeights, prefs != null ? prefs.getPreferredCuisine() : null, 1.6d);

        for (Reservation reservation : reservationRepository.findByUser_UserId(userId)) {
            if (reservation.getRoom() == null) {
                continue;
            }
            Room room = reservation.getRoom();
            if (room.getAccommodation() != null && room.getAccommodation().getCity() != null) {
                City city = room.getAccommodation().getCity();
                cityAffinity.merge(city.getCityId(), 1.2d, Double::sum);
                addWeightedTokens(tokenWeights, city.getName() + " " + city.getRegion(), 1.3d);
            }
            addWeightedTokens(tokenWeights, room.getRoomType() != null ? room.getRoomType().name() : null, 1.1d);
            addWeightedTokens(tokenWeights, room.getAccommodation() != null ? room.getAccommodation().getType().name() : null, 1.1d);
        }

        for (TransportReservation reservation : transportReservationRepository.findByUser_UserId(userId)) {
            Transport transport = reservation.getTransport();
            if (transport == null) {
                continue;
            }
            if (transport.getDepartureCity() != null) {
                cityAffinity.merge(transport.getDepartureCity().getCityId(), 0.9d, Double::sum);
                addWeightedTokens(tokenWeights, transport.getDepartureCity().getName(), 1.0d);
            }
            if (transport.getArrivalCity() != null) {
                cityAffinity.merge(transport.getArrivalCity().getCityId(), 1.1d, Double::sum);
                addWeightedTokens(tokenWeights, transport.getArrivalCity().getName(), 1.2d);
            }
            addWeightedTokens(tokenWeights, transport.getType() != null ? transport.getType().name() : null, 0.9d);
            addWeightedTokens(tokenWeights, transport.getDescription(), 0.8d);
        }

        for (ActivityReservation reservation : activityReservationRepository
                .findByUserUserIdOrderByReservationDateDesc(userId, PageRequest.of(0, USER_HISTORY_LIMIT))
                .getContent()) {
            Activity activity = reservation.getActivity();
            if (activity == null) {
                continue;
            }
            addWeightedTokens(tokenWeights, activityText(activity), 1.5d);
            if (activity.getCity() != null) {
                cityAffinity.merge(activity.getCity().getCityId(), 1.4d, Double::sum);
            }
            preferredActivityTypes.add(normalizeToken(activity.getType()));
        }

        List<EventReservation> eventReservations = eventReservationRepository.findByUserUserIdOrderByEventReservationIdDesc(userId);
        int maxEvents = Math.min(USER_HISTORY_LIMIT, eventReservations.size());
        for (int i = 0; i < maxEvents; i++) {
            Event event = eventReservations.get(i).getEvent();
            if (event == null) {
                continue;
            }
            addWeightedTokens(tokenWeights, eventText(event), 1.4d);
            if (event.getCity() != null) {
                cityAffinity.merge(event.getCity().getCityId(), 1.1d, Double::sum);
            }
            preferredEventTypes.add(normalizeToken(event.getEventType()));
        }

        return new UserNlpProfile(tokenWeights, cityAffinity, preferredActivityTypes, preferredEventTypes);
    }

    private String cityText(City city) {
        return String.join(" ",
                normalizeText(city.getName()),
                normalizeText(city.getRegion()),
                normalizeText(city.getDescription())
        );
    }

    private String activityText(Activity activity) {
        return String.join(" ",
                normalizeText(activity.getName()),
                normalizeText(activity.getType()),
                normalizeText(activity.getDescription()),
                normalizeText(activity.getAddress()),
                normalizeText(activity.getCity() != null ? activity.getCity().getName() : null)
        );
    }

    private String eventText(Event event) {
        return String.join(" ",
                normalizeText(event.getTitle()),
                normalizeText(event.getEventType()),
                normalizeText(event.getVenue()),
                normalizeText(event.getCity() != null ? event.getCity().getName() : null)
        );
    }

    private Map<String, Double> buildIdf(List<String> documents) {
        if (documents == null || documents.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Integer> df = new HashMap<>();
        int docCount = 0;
        for (String document : documents) {
            List<String> tokens = tokenize(document);
            if (tokens.isEmpty()) {
                continue;
            }
            docCount++;
            Set<String> unique = new HashSet<>(tokens);
            for (String token : unique) {
                df.merge(token, 1, Integer::sum);
            }
        }
        if (docCount == 0) {
            return Collections.emptyMap();
        }
        Map<String, Double> idf = new HashMap<>();
        for (Map.Entry<String, Integer> entry : df.entrySet()) {
            double value = Math.log((docCount + 1d) / (entry.getValue() + 1d)) + 1d;
            idf.put(entry.getKey(), value);
        }
        return idf;
    }

    private double tfIdfSimilarity(Map<String, Double> profileWeights, String document, Map<String, Double> idf) {
        if (profileWeights == null || profileWeights.isEmpty()) {
            return 0;
        }
        Map<String, Integer> tf = termFrequency(document);
        if (tf.isEmpty()) {
            return 0;
        }

        double dot = 0d;
        double queryNorm = 0d;
        double docNorm = 0d;

        for (Map.Entry<String, Double> entry : profileWeights.entrySet()) {
            String token = entry.getKey();
            double idfWeight = idf.getOrDefault(token, 1d);
            double queryWeight = entry.getValue() * idfWeight;
            queryNorm += queryWeight * queryWeight;

            int tfValue = tf.getOrDefault(token, 0);
            if (tfValue > 0) {
                double docWeight = (1d + Math.log(tfValue)) * idfWeight;
                dot += queryWeight * docWeight;
            }
        }

        for (Map.Entry<String, Integer> entry : tf.entrySet()) {
            double idfWeight = idf.getOrDefault(entry.getKey(), 1d);
            double docWeight = (1d + Math.log(entry.getValue())) * idfWeight;
            docNorm += docWeight * docWeight;
        }

        if (queryNorm == 0d || docNorm == 0d) {
            return 0d;
        }
        return dot / (Math.sqrt(queryNorm) * Math.sqrt(docNorm));
    }

    private Map<String, Integer> termFrequency(String text) {
        Map<String, Integer> tf = new HashMap<>();
        for (String token : tokenize(text)) {
            tf.merge(token, 1, Integer::sum);
        }
        return tf;
    }

    private void addWeightedTokens(Map<String, Double> bag, String text, double weight) {
        if (weight <= 0d) {
            return;
        }
        for (String token : tokenize(text)) {
            bag.merge(token, weight, Double::sum);
        }
    }

    private List<String> tokenize(String text) {
        String normalized = normalizeText(text);
        if (normalized.isBlank()) {
            return List.of();
        }
        String[] parts = normalized.split("[^a-z0-9]+");
        List<String> tokens = new ArrayList<>(parts.length);
        for (String raw : parts) {
            String token = canonicalToken(raw);
            if (!token.isBlank()) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private String canonicalToken(String rawToken) {
        if (rawToken == null) {
            return "";
        }
        String token = rawToken.trim();
        if (token.length() < 2 || STOPWORDS.contains(token)) {
            return "";
        }
        token = TOKEN_ALIASES.getOrDefault(token, token);

        if (token.endsWith("ing") && token.length() > 5) {
            token = token.substring(0, token.length() - 3);
        } else if (token.endsWith("ed") && token.length() > 4) {
            token = token.substring(0, token.length() - 2);
        } else if (token.endsWith("es") && token.length() > 4) {
            token = token.substring(0, token.length() - 2);
        } else if (token.endsWith("s") && token.length() > 3) {
            token = token.substring(0, token.length() - 1);
        }

        if (token.length() < 2 || STOPWORDS.contains(token)) {
            return "";
        }
        return token;
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
        String lowered = value.trim().toLowerCase(Locale.ROOT);
        String folded = Normalizer.normalize(lowered, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return folded;
    }

    private String normalizeText(String value) {
        return normalizeToken(value);
    }

    private double round(double value) {
        return Math.round(value * 1000d) / 1000d;
    }

    private double clamp01(double value) {
        if (value < 0d) {
            return 0d;
        }
        return Math.min(1d, value);
    }

    private record UserNlpProfile(
            Map<String, Double> tokenWeights,
            Map<Integer, Double> cityAffinity,
            Set<String> preferredActivityTypes,
            Set<String> preferredEventTypes
    ) {
    }
}
