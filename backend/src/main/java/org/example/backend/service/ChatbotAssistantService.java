package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.publicapi.ChatbotQueryResponse;
import org.example.backend.model.Accommodation;
import org.example.backend.model.Activity;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.model.Product;
import org.example.backend.model.ReservationStatus;
import org.example.backend.model.Restaurant;
import org.example.backend.model.Transport;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.RestaurantRepository;
import org.example.backend.repository.TransportRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatbotAssistantService {

    private final ObjectMapper objectMapper;
    private final CityRepository cityRepository;
    private final RestaurantRepository restaurantRepository;
    private final ActivityRepository activityRepository;
    private final AccommodationRepository accommodationRepository;
    private final EventRepository eventRepository;
    private final EventReservationRepository eventReservationRepository;
    private final ProductRepository productRepository;
    private final TransportRepository transportRepository;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    public ChatbotQueryResponse answer(String question) {
        return answer(question, List.of());
    }

    public ChatbotQueryResponse answer(String question, List<String> conversation) {
        String rawQuestion = question == null ? "" : question.trim();
        String normalizedQuestion = normalize(question);
        String normalizedConversation = normalize(buildConversationContext(conversation));
        Language language = detectLanguage(rawQuestion, normalizedQuestion.isBlank() ? normalizedConversation : normalizedQuestion);

        if (normalizedQuestion.isBlank()) {
            return new ChatbotQueryResponse(
                t(language,
                    "Posez votre question et je vous aide avec l'application.",
                    "Ask your question and I will help you with the app.",
                    "اكتب سؤالك وسأساعدك بخصوص التطبيق."),
                false,
                List.of(),
                0.0
            );
        }

        List<City> allCities = cityRepository.findAll();
        Optional<City> city = findMentionedCity(normalizedQuestion, allCities);
        List<City> mentionedCities = findMentionedCitiesInQuestionOrder(normalizedQuestion, allCities);

        if (!isInScope(normalizedQuestion, allCities)) {
            return new ChatbotQueryResponse(
                outOfScope(language),
                true,
                List.of("scope-guard"),
                1.0
            );
        }

        Intent intent = detectIntent(normalizedQuestion);
        if (intent == Intent.GENERAL_TUNISIA && !normalizedConversation.isBlank()) {
            intent = detectIntent(normalizedConversation);
        }
        IntentAnswer intentAnswer = buildIntentAnswer(intent, city, mentionedCities, allCities, language, normalizedQuestion, normalizedConversation);

        if (intentAnswer == null) {
            return new ChatbotQueryResponse(
                t(language,
                    "Je n'ai pas encore assez d'informations dans l'application pour répondre précisément à cette question.",
                    "I do not yet have enough information in the app to answer this precisely.",
                    "لا أملك بعد معلومات كافية داخل التطبيق للإجابة بدقة على هذا السؤال."),
                false,
                List.of("application-data"),
                0.35
            );
        }

        String finalAnswer = intentAnswer.answer();

        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                String polished = polishWithGemini(rawQuestion, intentAnswer, language);
                if (polished != null && !polished.isBlank()) {
                    finalAnswer = polished.trim();
                }
            } catch (Exception ignored) {
                // keep deterministic DB answer if Gemini fails
            }
        }

        return new ChatbotQueryResponse(finalAnswer, false, intentAnswer.sources(), intentAnswer.confidence());
    }

    private Intent detectIntent(String normalizedQuestion) {
        boolean asksInfo = containsAny(normalizedQuestion, "info", "infos", "information", "informations", "detail", "details", "detailles", "detaillé", "details");
        boolean asksBest = containsAny(normalizedQuestion, "best", "meilleur", "top", "highest", "mieux", "افضل");
        boolean asksRestaurant = containsAny(normalizedQuestion, "restaurant", "restaurants", "cuisine", "food", "مطعم", "مطاعم");
        boolean asksActivity = containsAny(normalizedQuestion, "activity", "activities", "activite", "activites", "visit", "thing to do", "نشاط", "انشطة");
        boolean asksAccommodation = containsAny(normalizedQuestion, "hotel", "accommodation", "accommodations", "accomodation", "accomodations", "stay", "guesthouse", "maison d hote", "hebergement", "سكن", "اقامة");
        boolean asksTransport = containsAny(normalizedQuestion, "transport", "bus", "train", "taxi", "plane", "ferry", "route", "trajet", "نقل", "حافلة", "قطار");
        boolean asksEvent = containsAny(normalizedQuestion, "event", "events", "festival", "evenement", "evenements", "enennement", "enennements", "manifestation", "حدث", "فعاليات");
        boolean asksProduct = containsAny(normalizedQuestion, "product", "products", "artisanat", "artisan", "souvenir", "craft", "market", "produit", "منتج", "حرف", "صناعة تقليدية");
        boolean asksAppHelp = containsAny(normalizedQuestion,
            "application", "app", "compte", "account", "login", "connexion", "inscription", "reservation", "booking", "payment",
            "cart", "panier", "checkout", "commande", "order", "favoris", "profile", "profil");

        if (asksBest && asksRestaurant) {
            return Intent.BEST_RESTAURANT;
        }
        if (asksBest && asksActivity) {
            return Intent.BEST_ACTIVITY;
        }
        if (asksBest && asksAccommodation) {
            return Intent.BEST_ACCOMMODATION;
        }
        if (asksRestaurant) {
            return Intent.RESTAURANT;
        }
        if (asksActivity) {
            return Intent.ACTIVITY;
        }
        if (asksAccommodation) {
            return Intent.ACCOMMODATION;
        }
        if (asksTransport) {
            return Intent.TRANSPORT;
        }
        if (asksEvent) {
            return Intent.EVENT;
        }
        if (asksProduct) {
            return Intent.PRODUCT;
        }
        if (asksAppHelp) {
            return Intent.APPLICATION_HELP;
        }
        if (asksInfo) {
            return Intent.GENERAL_TUNISIA;
        }
        return Intent.GENERAL_TUNISIA;
    }

    private IntentAnswer buildIntentAnswer(Intent intent, Optional<City> city, List<City> mentionedCities, List<City> allCities, Language language, String normalizedQuestion, String normalizedConversation) {
        String effectiveQuestion = (normalizedQuestion + " " + normalizedConversation).trim();
        return switch (intent) {
            case BEST_RESTAURANT -> answerBestRestaurant(city, language);
            case BEST_ACTIVITY -> answerBestActivity(city, language);
            case BEST_ACCOMMODATION -> answerBestAccommodation(city, language);
            case RESTAURANT -> answerRestaurantOverview(city, language, effectiveQuestion);
            case ACTIVITY -> answerActivityOverview(city, language, effectiveQuestion);
            case ACCOMMODATION -> answerAccommodationOverview(city, language, effectiveQuestion);
            case TRANSPORT -> answerTransportOverview(mentionedCities, language, effectiveQuestion);
            case EVENT -> answerEventOverview(city, language, effectiveQuestion);
            case PRODUCT -> answerProductOverview(city, language, effectiveQuestion);
            case APPLICATION_HELP -> answerApplicationHelp(language, effectiveQuestion);
            case GENERAL_TUNISIA -> answerGeneral(allCities, city, language, effectiveQuestion);
        };
    }

    private IntentAnswer answerBestRestaurant(Optional<City> cityOpt, Language language) {
        if (cityOpt.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Pour trouver le meilleur restaurant, indiquez une ville tunisienne (ex: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "To find the best restaurant, please mention a Tunisian city (for example: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "للعثور على أفضل مطعم، اذكر مدينة تونسية مثل تونس أو سوسة أو صفاقس أو نابل أو الحمامات."),
                "No city provided. Need a city to rank restaurants by rating.",
                List.of("cities"),
                0.72
            );
        }

        City city = cityOpt.get();
        List<Restaurant> restaurants = restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(city.getCityId());
        if (restaurants.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Je n'ai pas encore de restaurants disponibles pour " + city.getName() + ".",
                    "I do not have restaurants available for " + city.getName() + " yet.",
                    "لا توجد مطاعم متاحة حاليا لمدينة " + city.getName() + "."),
                "No restaurant data for city.",
                List.of("restaurants"),
                0.8
            );
        }

        Restaurant best = restaurants.stream()
            .filter(r -> r.getRating() != null)
            .max(Comparator.comparing(Restaurant::getRating))
            .orElse(restaurants.get(0));

        String ratingText = best.getRating() == null ? "not rated yet" : String.format(Locale.ROOT, "%.1f/5", best.getRating());
        String answer = t(language,
            "Le meilleur choix restaurant à " + city.getName() + " est " + best.getName()
                + " (note " + ratingText + ")"
                + optionalText(best.getCuisineType(), ", cuisine: ")
                + optionalText(best.getAddress(), ", adresse: ")
                + ".",
            "A top restaurant choice in " + city.getName() + " is " + best.getName()
                + " (rating " + ratingText + ")"
                + optionalText(best.getCuisineType(), ", cuisine: ")
                + optionalText(best.getAddress(), ", address: ")
                + ".",
            "أفضل خيار مطعم في " + city.getName() + " هو " + best.getName()
                + " (التقييم " + ratingText + ")"
                + optionalText(best.getCuisineType(), "، النوع: ")
                + optionalText(best.getAddress(), "، العنوان: ")
                + ".");

        String facts = "City=" + city.getName() + "; BestRestaurant=" + best.getName() + "; Rating=" + ratingText
            + optionalText(best.getCuisineType(), "; Cuisine=")
            + optionalText(best.getAddress(), "; Address=");

        return new IntentAnswer(answer, facts, List.of("restaurants", "cities"), 0.94);
    }

    private IntentAnswer answerBestActivity(Optional<City> cityOpt, Language language) {
        if (cityOpt.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Indiquez une ville tunisienne pour que je propose la meilleure activité.",
                    "Please mention a Tunisian city so I can suggest the best activity.",
                    "اذكر مدينة تونسية لكي أقترح أفضل نشاط."),
                "No city provided for best activity.",
                List.of("cities"),
                0.72
            );
        }

        City city = cityOpt.get();
        List<Activity> activities = activityRepository.findByCityCityIdOrderByActivityIdDesc(city.getCityId());
        if (activities.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Je n'ai pas encore d'activités disponibles à " + city.getName() + ".",
                    "I do not have activities available in " + city.getName() + " yet.",
                    "لا توجد أنشطة متاحة حاليا في " + city.getName() + "."),
                "No activities in city.",
                List.of("activities"),
                0.8
            );
        }

        Activity best = activities.stream()
            .filter(a -> a.getPrice() != null)
            .min(Comparator.comparing(Activity::getPrice))
            .orElse(activities.get(0));

        String answer = t(language,
            "Une excellente activité à " + city.getName() + " est " + best.getName()
                + optionalText(best.getType(), " (type: ")
                + (best.getType() == null ? "" : ")")
                + optionalText(best.getPrice() != null ? String.format(Locale.ROOT, "%.0f DT", best.getPrice()) : null, ", prix: ")
                + ".",
            "A strong activity option in " + city.getName() + " is " + best.getName()
                + optionalText(best.getType(), " (type: ")
                + (best.getType() == null ? "" : ")")
                + optionalText(best.getPrice() != null ? String.format(Locale.ROOT, "%.0f DT", best.getPrice()) : null, ", price: ")
                + ".",
            "نشاط ممتاز في " + city.getName() + " هو " + best.getName()
                + optionalText(best.getType(), " (النوع: ")
                + (best.getType() == null ? "" : ")")
                + optionalText(best.getPrice() != null ? String.format(Locale.ROOT, "%.0f DT", best.getPrice()) : null, "، السعر: ")
                + ".");

        String facts = "City=" + city.getName() + "; SuggestedActivity=" + best.getName()
            + optionalText(best.getType(), "; Type=")
            + optionalText(best.getPrice() != null ? String.format(Locale.ROOT, "%.0f DT", best.getPrice()) : null, "; Price=");

        return new IntentAnswer(answer, facts, List.of("activities", "cities"), 0.86);
    }

    private IntentAnswer answerBestAccommodation(Optional<City> cityOpt, Language language) {
        if (cityOpt.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Indiquez une ville tunisienne pour que je propose le meilleur hébergement.",
                    "Please mention a Tunisian city so I can suggest the best accommodation.",
                    "اذكر مدينة تونسية لكي أقترح أفضل سكن."),
                "No city provided for accommodation ranking.",
                List.of("cities"),
                0.72
            );
        }

        City city = cityOpt.get();
        List<Accommodation> stays = accommodationRepository.findByCity_CityId(city.getCityId());
        if (stays.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Je n'ai pas encore d'hébergements disponibles à " + city.getName() + ".",
                    "I do not have accommodations available in " + city.getName() + " yet.",
                    "لا توجد أماكن إقامة متاحة حاليا في " + city.getName() + "."),
                "No accommodations in city.",
                List.of("accommodations"),
                0.8
            );
        }

        Accommodation best = stays.stream()
            .filter(a -> a.getRating() != null)
            .max(Comparator.comparing(Accommodation::getRating))
            .orElse(stays.get(0));

        String ratingText = best.getRating() == null ? "not rated yet" : String.format(Locale.ROOT, "%.1f/5", best.getRating());
        String answer = t(language,
            "Un très bon hébergement à " + city.getName() + " est " + best.getName()
                + " (note " + ratingText + ")"
                + optionalText(best.getType() != null ? best.getType().name() : null, ", type: ")
                + optionalText(best.getPricePerNight() != null ? String.format(Locale.ROOT, "%.0f DT/nuit", best.getPricePerNight()) : null, ", prix: ")
                + ".",
            "A top accommodation in " + city.getName() + " is " + best.getName()
                + " (rating " + ratingText + ")"
                + optionalText(best.getType() != null ? best.getType().name() : null, ", type: ")
                + optionalText(best.getPricePerNight() != null ? String.format(Locale.ROOT, "%.0f DT/night", best.getPricePerNight()) : null, ", price: ")
                + ".",
            "إقامة ممتازة في " + city.getName() + " هي " + best.getName()
                + " (التقييم " + ratingText + ")"
                + optionalText(best.getType() != null ? best.getType().name() : null, "، النوع: ")
                + optionalText(best.getPricePerNight() != null ? String.format(Locale.ROOT, "%.0f DT/ليلة", best.getPricePerNight()) : null, "، السعر: ")
                + ".");

        String facts = "City=" + city.getName() + "; BestAccommodation=" + best.getName() + "; Rating=" + ratingText
            + optionalText(best.getType() != null ? best.getType().name() : null, "; Type=")
            + optionalText(best.getPricePerNight() != null ? String.format(Locale.ROOT, "%.0f DT/night", best.getPricePerNight()) : null, "; Price=");

        return new IntentAnswer(answer, facts, List.of("accommodations", "cities"), 0.9);
    }

    private IntentAnswer answerRestaurantOverview(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        boolean asksPrice = asksCheapest(normalizedQuestion) || asksMostExpensive(normalizedQuestion) || containsAny(normalizedQuestion, "prix", "price", "cost", "coute");
        if (cityOpt.isPresent()) {
            City city = cityOpt.get();
            List<Restaurant> restaurants = restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(city.getCityId())
                .stream()
                .filter(restaurant -> matchesRestaurantType(restaurant, normalizedQuestion))
                .sorted(restaurantComparator(normalizedQuestion))
                .limit(5)
                .toList();

            if (restaurants.isEmpty()) {
                return new IntentAnswer(
                    t(language,
                        "Aucun restaurant disponible pour le moment à " + city.getName() + ".",
                        "No restaurants are currently available in " + city.getName() + ".",
                        "لا توجد مطاعم متاحة حاليا في " + city.getName() + "."),
                    "No restaurants in city.",
                    List.of("restaurants"),
                    0.8
                );
            }

            String names = restaurants.stream()
                .map(restaurant -> restaurant.getName()
                    + optionalText(restaurant.getRating() == null ? null : String.format(Locale.ROOT, "%.1f/5", restaurant.getRating()), " (rating: ")
                    + (restaurant.getRating() == null ? "" : ")")
                    + optionalText(restaurant.getAddress(), " - ")
                    + optionalText(shorten(restaurant.getDescription(), 70), " - "))
                .collect(Collectors.joining("; "));
            String priceNote = asksPrice
                ? t(language,
                    " Remarque: le prix restaurant n'est pas disponible dans la base actuelle, je classe donc selon la note et la pertinence.",
                    " Note: restaurant price is not available in the current dataset, so I rank by rating and relevance.",
                    " ملاحظة: سعر المطاعم غير متوفر حاليا في قاعدة البيانات، لذلك أعرض النتائج حسب التقييم والملاءمة.")
                : "";
            return new IntentAnswer(
                t(language,
                    "À " + city.getName() + ", voici des restaurants pertinents: " + names + ".",
                    "In " + city.getName() + ", relevant restaurants are: " + names + ".",
                    "في " + city.getName() + " هذه مطاعم مناسبة: " + names + ".") + priceNote,
                "City=" + city.getName() + "; Restaurants=" + names,
                List.of("restaurants", "cities"),
                0.84
            );
        }

        List<Restaurant> restaurants = restaurantRepository.findAll().stream()
            .filter(restaurant -> matchesRestaurantType(restaurant, normalizedQuestion))
            .sorted(restaurantComparator(normalizedQuestion))
            .limit(6)
            .toList();
        String names = restaurants.stream()
            .map(Restaurant::getName)
            .collect(Collectors.joining(", "));
        return new IntentAnswer(
            t(language,
                "Côté restaurants en Tunisie: " + (names.isBlank() ? "pas encore de données" : names) + ".",
                "Restaurant options in Tunisia include: " + (names.isBlank() ? "no data yet" : names) + ".",
                "خيارات المطاعم في تونس تشمل: " + (names.isBlank() ? "لا توجد بيانات بعد" : names) + "."),
            "Restaurants=" + names,
            List.of("restaurants"),
            0.75
        );
    }

    private IntentAnswer answerActivityOverview(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        boolean asksRating = asksTopRated(normalizedQuestion) || asksLowestRated(normalizedQuestion) || containsAny(normalizedQuestion, "note", "rating", "rated");
        if (cityOpt.isPresent()) {
            City city = cityOpt.get();
            List<Activity> activities = activityRepository.findByCityCityIdOrderByActivityIdDesc(city.getCityId())
                .stream()
                .filter(activity -> matchesActivityType(activity, normalizedQuestion))
                .filter(activity -> activity.getPrice() == null || maxPrice == null || activity.getPrice() <= maxPrice)
                .filter(activity -> activity.getPrice() == null || minPrice == null || activity.getPrice() >= minPrice)
                .sorted(activityComparator(normalizedQuestion))
                .limit(6)
                .toList();
            if (activities.isEmpty()) {
                return new IntentAnswer(
                    t(language,
                        "Aucune activité disponible pour le moment à " + city.getName() + ".",
                        "No activities are currently available in " + city.getName() + ".",
                        "لا توجد أنشطة متاحة حاليا في " + city.getName() + "."),
                    "No activities in city.",
                    List.of("activities"),
                    0.8
                );
            }

            String names = activities.stream()
                .map(activity -> activity.getName()
                    + optionalText(activity.getType(), " - ")
                    + optionalText(activity.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", activity.getPrice()), " - ")
                    + optionalText(activity.getAddress(), " - ")
                    + optionalText(shorten(activity.getDescription(), 70), " - "))
                .collect(Collectors.joining("; "));
            String ratingNote = asksRating
                ? t(language,
                    " Remarque: la note d'activité n'est pas disponible dans la base actuelle; je filtre selon type, localisation et prix.",
                    " Note: activity rating is not available in the current dataset; I filter by type, location, and price.",
                    " ملاحظة: تقييم الأنشطة غير متوفر حاليا؛ أعتمد على النوع والموقع والسعر.")
                : "";
            return new IntentAnswer(
                t(language,
                    "À " + city.getName() + ", activités proposées: " + names + ".",
                    "In " + city.getName() + ", available activities include: " + names + ".",
                    "في " + city.getName() + " الأنشطة المتاحة تشمل: " + names + ".") + ratingNote,
                "City=" + city.getName() + "; Activities=" + names,
                List.of("activities", "cities"),
                0.82
            );
        }

        List<Activity> activities = activityRepository.findAll().stream()
            .filter(activity -> matchesActivityType(activity, normalizedQuestion))
            .filter(activity -> activity.getPrice() == null || maxPrice == null || activity.getPrice() <= maxPrice)
            .filter(activity -> activity.getPrice() == null || minPrice == null || activity.getPrice() >= minPrice)
            .sorted(activityComparator(normalizedQuestion))
            .limit(6)
            .toList();
        String names = activities.stream().map(Activity::getName).collect(Collectors.joining(", "));
        return new IntentAnswer(
            t(language,
                "Activités disponibles en Tunisie: " + (names.isBlank() ? "pas encore de données" : names) + ".",
                "Available activities in Tunisia: " + (names.isBlank() ? "no data yet" : names) + ".",
                "الأنشطة المتاحة في تونس: " + (names.isBlank() ? "لا توجد بيانات بعد" : names) + "."),
            "Activities=" + names,
            List.of("activities"),
            0.74
        );
    }

    private IntentAnswer answerAccommodationOverview(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        if (cityOpt.isPresent()) {
            City city = cityOpt.get();
            List<Accommodation> stays = accommodationRepository.findByCity_CityId(city.getCityId()).stream()
                .filter(accommodation -> matchesAccommodationType(accommodation, normalizedQuestion))
                .filter(accommodation -> accommodation.getPricePerNight() == null || maxPrice == null || accommodation.getPricePerNight() <= maxPrice)
                .filter(accommodation -> accommodation.getPricePerNight() == null || minPrice == null || accommodation.getPricePerNight() >= minPrice)
                .sorted(accommodationComparator(normalizedQuestion))
                .limit(6)
                .toList();
            if (stays.isEmpty()) {
                return new IntentAnswer(
                    t(language,
                        "Aucun hébergement disponible pour le moment à " + city.getName() + ".",
                        "No accommodations are currently available in " + city.getName() + ".",
                        "لا توجد أماكن إقامة متاحة حاليا في " + city.getName() + "."),
                    "No accommodations in city.",
                    List.of("accommodations"),
                    0.8
                );
            }

            String names = stays.stream()
                .map(a -> a.getName()
                    + optionalText(a.getType() == null ? null : a.getType().name(), " - ")
                    + optionalText(a.getPricePerNight() == null ? null : String.format(Locale.ROOT, "%.0f DT/night", a.getPricePerNight()), " - ")
                    + optionalText(a.getRating() == null ? null : String.format(Locale.ROOT, "%.1f/5", a.getRating()), " - "))
                .collect(Collectors.joining("; "));
            return new IntentAnswer(
                t(language,
                    "À " + city.getName() + ", hébergements disponibles: " + names + ".",
                    "In " + city.getName() + ", accommodation options include: " + names + ".",
                    "في " + city.getName() + " تتوفر خيارات إقامة مثل: " + names + "."),
                "City=" + city.getName() + "; Accommodations=" + names,
                List.of("accommodations", "cities"),
                0.82
            );
        }

        List<Accommodation> stays = accommodationRepository.findAll().stream()
            .filter(a -> a.getStatus() == null || a.getStatus() == Accommodation.AccommodationStatus.AVAILABLE)
            .filter(accommodation -> matchesAccommodationType(accommodation, normalizedQuestion))
            .filter(accommodation -> accommodation.getPricePerNight() == null || maxPrice == null || accommodation.getPricePerNight() <= maxPrice)
            .filter(accommodation -> accommodation.getPricePerNight() == null || minPrice == null || accommodation.getPricePerNight() >= minPrice)
            .sorted(accommodationComparator(normalizedQuestion))
            .limit(6)
            .toList();

        if (stays.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Je n'ai pas encore d'hébergements disponibles dans l'application.",
                    "I do not have available accommodations in the app yet.",
                    "لا توجد حاليا أماكن إقامة متاحة في التطبيق."),
                "No accommodations available.",
                List.of("accommodations"),
                0.78
            );
        }

        String names = stays.stream()
            .map(a -> {
                String type = a.getType() == null ? "" : optionalText(a.getType().name(), " - ");
                String rating = a.getRating() == null ? "" : " - " + String.format(Locale.ROOT, "%.1f/5", a.getRating());
                String price = a.getPricePerNight() == null ? "" : " - " + String.format(Locale.ROOT, "%.0f DT/night", a.getPricePerNight());
                return a.getName() + type + rating + price;
            })
            .collect(Collectors.joining("; "));

        return new IntentAnswer(
            t(language,
                "Hébergements disponibles en Tunisie (hôtels, maisons d'hôtes...): " + names + ".",
                "Available accommodations in Tunisia (hotels, guesthouses, etc.): " + names + ".",
                "أماكن الإقامة المتاحة في تونس (فنادق، بيوت ضيافة...): " + names + "."),
            "Accommodations=" + names,
            List.of("accommodations", "cities"),
            0.84
        );
    }

    private IntentAnswer answerTransportOverview(List<City> mentionedCities, Language language, String normalizedQuestion) {
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        List<Transport> transports;
        if (mentionedCities.size() >= 2) {
            City from = mentionedCities.get(0);
            City to = mentionedCities.get(1);
            transports = transportRepository.findByDepartureCity_CityIdAndArrivalCity_CityIdAndIsActiveTrue(
                from.getCityId(),
                to.getCityId()
            ).stream()
                .filter(transport -> matchesTransportType(transport, normalizedQuestion))
                .filter(transport -> transport.getPrice() == null || maxPrice == null || transport.getPrice() <= maxPrice)
                .filter(transport -> transport.getPrice() == null || minPrice == null || transport.getPrice() >= minPrice)
                .toList();
            if (transports.isEmpty()) {
                return new IntentAnswer(
                    t(language,
                        "Je n'ai pas trouvé de trajet actif de " + from.getName() + " vers " + to.getName() + " pour le moment.",
                        "I could not find active transport from " + from.getName() + " to " + to.getName() + " right now.",
                        "لم أجد رحلات نقل نشطة من " + from.getName() + " إلى " + to.getName() + " حاليا."),
                    "No route transport found.",
                    List.of("transport", "cities"),
                    0.82
                );
            }

            Transport selected = selectTransportByPricePreference(transports, normalizedQuestion);

            String type = selected.getType() == null ? "transport" : selected.getType().name();
            String price = selected.getPrice() == null ? "N/A" : String.format(Locale.ROOT, "%.0f DT", selected.getPrice());
            String nextDepartures = transports.stream()
                .sorted(Comparator.comparing(Transport::getDepartureTime, Comparator.nullsLast(LocalDateTime::compareTo)))
                .limit(3)
                .map(this::describeTransport)
                .collect(Collectors.joining("; "));
            String answer = t(language,
                "Pour aller de " + from.getName() + " à " + to.getName() + ", une option recommandée est " + type + " à " + price + ". Prochains trajets: " + nextDepartures + ".",
                "For traveling from " + from.getName() + " to " + to.getName() + ", a recommended option is " + type + " at " + price + ". Next departures: " + nextDepartures + ".",
                "للتنقل من " + from.getName() + " إلى " + to.getName() + "، خيار مناسب هو " + type + " بسعر " + price + ". الرحلات القادمة: " + nextDepartures + ".");

            return new IntentAnswer(answer, "Route=" + from.getName() + "->" + to.getName() + "; Type=" + type + "; Price=" + price + "; Next=" + nextDepartures, List.of("transport", "cities"), 0.91);
        }

        transports = transportRepository.findTop5ByIsActiveTrueOrderByDepartureTimeAsc().stream()
            .filter(transport -> matchesTransportType(transport, normalizedQuestion))
            .filter(transport -> transport.getPrice() == null || maxPrice == null || transport.getPrice() <= maxPrice)
            .filter(transport -> transport.getPrice() == null || minPrice == null || transport.getPrice() >= minPrice)
            .toList();
        if (transports.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Aucune option de transport active pour le moment.",
                    "No active transport options are available right now.",
                    "لا توجد خيارات نقل نشطة حاليا."),
                "No active transports.",
                List.of("transport"),
                0.8
            );
        }

        String lines = transports.stream()
            .map(this::describeTransport)
            .collect(Collectors.joining("; "));
        return new IntentAnswer(
            t(language,
                "Options de transport disponibles: " + lines + ".",
                "Available transport options: " + lines + ".",
                "خيارات النقل المتاحة: " + lines + "."),
            "Transports=" + lines,
            List.of("transport"),
            0.78
        );
    }

    private IntentAnswer answerEventOverview(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        boolean asksThisMonth = containsAny(normalizedQuestion,
            "ce mois", "du mois", "this month", "current month", "mois actuel", "هذا الشهر", "الشهر الحالي");
        boolean asksNextMonth = containsAny(normalizedQuestion,
            "mois prochain", "prochain mois", "next month", "following month", "الشهر القادم", "الشهر المقبل");
        boolean asksFree = containsAny(normalizedQuestion,
            "gratuit", "gratuits", "free", "sans frais", "مجاني", "مجانا");
        boolean asksPaid = containsAny(normalizedQuestion,
            "payant", "payants", "paid", "ticket", "tickets", "مدفوع", "تذاكر");
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);

        List<Event> events = cityOpt.map(city -> eventRepository.findByCityCityId(city.getCityId()))
            .orElseGet(eventRepository::findAll)
            .stream()
            .filter(event -> !asksThisMonth || isInCurrentMonth(event.getStartDate(), event.getEndDate()))
            .filter(event -> !asksNextMonth || isInNextMonth(event.getStartDate(), event.getEndDate()))
            .filter(event -> !asksFree || event.getPrice() == null || event.getPrice() <= 0)
            .filter(event -> !asksPaid || (event.getPrice() != null && event.getPrice() > 0))
            .filter(event -> event.getPrice() == null || maxPrice == null || event.getPrice() <= maxPrice)
            .filter(event -> event.getPrice() == null || minPrice == null || event.getPrice() >= minPrice)
            .filter(event -> matchesEventType(event, normalizedQuestion))
            .sorted(Comparator.comparing(Event::getStartDate, Comparator.nullsLast(Date::compareTo)))
            .limit(6)
            .toList();

        if (events.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    asksThisMonth
                        ? "Je n'ai pas trouvé d'événements disponibles pour ce mois."
                        : asksNextMonth
                            ? "Je n'ai pas trouvé d'événements disponibles pour le mois prochain."
                            : "Je n'ai pas encore d'événements disponibles dans l'application.",
                    asksThisMonth
                        ? "I could not find available events for this month."
                        : asksNextMonth
                            ? "I could not find available events for next month."
                            : "I do not have events available in the app yet.",
                    asksThisMonth
                        ? "لم أجد فعاليات متاحة لهذا الشهر."
                        : asksNextMonth
                            ? "لم أجد فعاليات متاحة للشهر القادم."
                            : "لا توجد فعاليات متاحة حاليا في التطبيق."),
                "No events.",
                List.of("events"),
                0.78
            );
        }

        Map<Integer, Long> reservationCountByEvent = buildEventReservationCountMap();
        String lines = events.stream()
            .map(event -> {
                long reservations = reservationCountByEvent.getOrDefault(event.getEventId(), 0L);
                String dateLabel = formatEventDate(event.getStartDate());
                String cityLabel = event.getCity() == null ? "" : optionalText(event.getCity().getName(), " - ");
                String typeLabel = optionalText(event.getEventType(), " - ");
                String venueLabel = optionalText(event.getVenue(), " - ");
                String statusLabel = optionalText(event.getStatus(), " - ");
                String priceLabel = event.getPrice() == null
                    ? ""
                    : " - " + String.format(Locale.ROOT, "%.0f DT", event.getPrice());
                return event.getTitle()
                    + cityLabel
                    + typeLabel
                    + venueLabel
                    + optionalText(dateLabel, " (")
                    + (dateLabel.isBlank() ? "" : ")")
                    + statusLabel
                    + priceLabel
                    + " - " + reservations + " reservations";
            })
            .collect(Collectors.joining("; "));

        return new IntentAnswer(
            t(language,
                asksThisMonth
                    ? "Événements disponibles ce mois: " + lines + "."
                    : asksNextMonth
                        ? "Événements disponibles le mois prochain: " + lines + "."
                    : "Événements disponibles: " + lines + ".",
                asksThisMonth
                    ? "Available events this month: " + lines + "."
                    : asksNextMonth
                        ? "Available events next month: " + lines + "."
                    : "Available events: " + lines + ".",
                asksThisMonth
                    ? "الفعاليات المتاحة هذا الشهر: " + lines + "."
                    : asksNextMonth
                        ? "الفعاليات المتاحة الشهر القادم: " + lines + "."
                    : "الفعاليات المتاحة: " + lines + "."),
            "Events=" + lines,
            List.of("events", "event-reservations"),
            0.88
        );
    }

    private IntentAnswer answerProductOverview(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        List<Product> products = cityOpt
            .map(city -> productRepository.findPublishedByCity(city.getCityId()))
            .orElseGet(productRepository::findAllPublished)
            .stream()
            .filter(product -> product.getPrice() == null || maxPrice == null || product.getPrice() <= maxPrice)
            .filter(product -> product.getPrice() == null || minPrice == null || product.getPrice() >= minPrice)
            .filter(product -> matchesProductQuery(product, normalizedQuestion))
            .sorted(productComparator(normalizedQuestion))
            .limit(6)
            .toList();

        if (products.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Je n'ai pas encore de produits d'artisanat disponibles.",
                    "I do not have artisan product listings yet.",
                    "لا توجد حاليا منتجات حرفية متاحة."),
                "No products.",
                List.of("products"),
                0.78
            );
        }

        String names = products.stream()
            .map(product -> product.getName()
                + optionalText(product.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", product.getPrice()), " - ")
                + optionalText(product.getDescription(), " - "))
            .collect(Collectors.joining("; "));
        return new IntentAnswer(
            t(language,
                "Produits d'artisanat disponibles: " + names + ".",
                "Available artisan products: " + names + ".",
                "المنتجات الحرفية المتاحة: " + names + "."),
            "Products=" + names,
            List.of("products"),
            0.84
        );
    }

    private IntentAnswer answerApplicationHelp(Language language, String normalizedQuestion) {
        if (containsAny(normalizedQuestion, "login", "connexion", "inscription", "compte", "account", "mot de passe", "password", "profil", "profile")) {
            return new IntentAnswer(
                t(language,
                    "Pour le compte: ouvrez l'écran de connexion/inscription, renseignez vos informations, puis gérez votre profil depuis l'espace utilisateur.",
                    "For account actions: open login/signup, enter your details, then manage your profile from the user area.",
                    "لإدارة الحساب: افتح تسجيل الدخول/التسجيل، أدخل بياناتك، ثم عدّل ملفك من مساحة المستخدم."),
                "ApplicationHelp=account",
                List.of("application", "auth"),
                0.93
            );
        }

        if (containsAny(normalizedQuestion, "reservation", "booking", "book", "reserver", "réserver", "حجز")) {
            return new IntentAnswer(
                t(language,
                    "Pour réserver: choisissez une offre (hébergement, événement ou transport), vérifiez les détails, puis confirmez la réservation depuis l'écran de paiement.",
                    "To book: choose an offer (accommodation, event, or transport), review details, then confirm from the payment screen.",
                    "للحجز: اختر العرض (إقامة أو فعالية أو نقل)، راجع التفاصيل ثم أكّد الحجز من شاشة الدفع."),
                "ApplicationHelp=booking",
                List.of("application", "reservations"),
                0.93
            );
        }

        if (containsAny(normalizedQuestion, "cart", "panier", "checkout", "paiement", "payment", "commande", "order", "سلة", "دفع", "طلب")) {
            return new IntentAnswer(
                t(language,
                    "Pour panier/commande: ajoutez les éléments, ouvrez le panier, vérifiez le total, puis passez au paiement pour finaliser la commande.",
                    "For cart/orders: add items, open cart, verify totals, then proceed to payment to complete the order.",
                    "للسلة/الطلب: أضف العناصر، افتح السلة، راجع المجموع، ثم انتقل للدفع لإتمام الطلب."),
                "ApplicationHelp=cart-order-payment",
                List.of("application", "cart", "orders"),
                0.93
            );
        }

        if (containsAny(normalizedQuestion, "support", "aide", "help", "contact", "bug", "probleme", "problème", "مشكلة", "مساعدة")) {
            return new IntentAnswer(
                t(language,
                    "Si vous avez un souci dans l'application, décrivez l'écran concerné et l'action effectuée; je peux vous guider étape par étape.",
                    "If you face an app issue, share the screen and action you made; I can guide you step by step.",
                    "إذا واجهت مشكلة في التطبيق، اذكر الشاشة والخطوة التي قمت بها وسأرشدك خطوة بخطوة."),
                "ApplicationHelp=support",
                List.of("application", "support"),
                0.9
            );
        }

        String answer = t(language,
            "Je peux vous guider sur toutes les fonctionnalités de l'application: transport, hébergement (hôtels, maisons d'hôtes), restaurants, activités, événements, artisanat, réservations, panier, commandes, paiement et profil.",
            "I can guide you on all app features: transport, accommodations (hotels, guesthouses), restaurants, activities, events, artisan products, bookings, cart, orders, payment, and profile.",
            "يمكنني إرشادك في كل ميزات التطبيق: النقل، الإقامة (فنادق وبيوت ضيافة)، المطاعم، الأنشطة، الفعاليات، المنتجات الحرفية، الحجوزات، السلة، الطلبات، الدفع والملف الشخصي.");
        return new IntentAnswer(answer, "ApplicationHelp=features", List.of("application"), 0.92);
    }

    private IntentAnswer answerGeneral(List<City> allCities, Optional<City> mentionedCity, Language language, String normalizedQuestion) {
        if (mentionedCity.isPresent() && containsAny(normalizedQuestion,
            "info", "information", "description", "destination", "about", "a propos", "propos", "present", "presentation", "details")) {
            City city = mentionedCity.get();
            String destinationInfo = city.getName()
                + optionalText(city.getRegion(), " - ")
                + optionalText(city.getDescription(), " - ")
                + (city.getHasAirport() != null && city.getHasAirport() ? " - airport" : "")
                + (city.getHasTrainStation() != null && city.getHasTrainStation() ? " - train" : "")
                + (city.getHasBusStation() != null && city.getHasBusStation() ? " - bus" : "")
                + (city.getHasPort() != null && city.getHasPort() ? " - port" : "");

            return new IntentAnswer(
                t(language,
                    "Informations destination pour " + city.getName() + ": " + destinationInfo + ".",
                    "Destination information for " + city.getName() + ": " + destinationInfo + ".",
                    "معلومات الوجهة لمدينة " + city.getName() + ": " + destinationInfo + "."),
                "Destination=" + destinationInfo,
                List.of("cities"),
                0.9
            );
        }

        int cityCount = allCities.size();
        String topCities = allCities.stream().limit(6).map(City::getName).collect(Collectors.joining(", "));
        return new IntentAnswer(
            t(language,
                "Je suis votre guide IA. Je peux répondre sur " + cityCount + " villes, ainsi que transport, hébergement, restaurants, activités, événements et artisanat. Exemples de villes: " + topCities + ".",
                "I am your AI guide. I can answer about " + cityCount + " cities, plus transport, accommodations, restaurants, activities, events, and artisan products. City examples: " + topCities + ".",
                "أنا دليلك الذكي. أستطيع الإجابة عن " + cityCount + " مدينة، إضافة إلى النقل والإقامة والمطاعم والأنشطة والفعاليات والمنتجات الحرفية. من المدن: " + topCities + "."),
            "CitiesCount=" + cityCount + "; Cities=" + topCities,
            List.of("cities", "restaurants", "activities", "accommodations", "transport", "events", "products", "application"),
            0.76
        );
    }

    private String polishWithGemini(String question, IntentAnswer answer, Language language) throws IOException, InterruptedException {
        String base = geminiBaseUrl.endsWith("/") ? geminiBaseUrl.substring(0, geminiBaseUrl.length() - 1) : geminiBaseUrl;
        String modelPath = geminiModel.startsWith("models/") ? geminiModel : "models/" + geminiModel;
        String endpoint = base + "/" + modelPath + ":generateContent?key=" + encode(geminiApiKey);

        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode contents = root.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");

        parts.addObject().put("text", "You are YallaTN+ Assistant. Rewrite the draft answer as a natural guide message. "
            + "Do not invent facts. Use only these facts: " + answer.facts() + ". "
            + "Always answer in the same language as the user's question. "
            + "If question is out of app/Tunisia scope, answer exactly: '" + outOfScope(language) + "'. "
            + "User question: " + question + ". Draft answer: " + answer.answer());

        ObjectNode generationConfig = root.putObject("generationConfig");
        generationConfig.put("temperature", 0.25);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(endpoint))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("x-goog-api-key", geminiApiKey)
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            return "";
        }

        return extractGeminiText(objectMapper.readTree(response.body()));
    }

    private String extractGeminiText(JsonNode responseJson) {
        JsonNode candidates = responseJson.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return "";
        }

        StringBuilder text = new StringBuilder();
        for (JsonNode candidate : candidates) {
            JsonNode parts = candidate.path("content").path("parts");
            if (!parts.isArray()) {
                continue;
            }
            for (JsonNode part : parts) {
                String partText = part.path("text").asText("");
                if (!partText.isBlank()) {
                    if (!text.isEmpty()) {
                        text.append('\n');
                    }
                    text.append(partText);
                }
            }
        }

        return text.toString().trim();
    }

    private Optional<City> findMentionedCity(String normalizedQuestion, List<City> cities) {
        for (City city : cities) {
            if (city.getName() == null || city.getName().isBlank()) {
                continue;
            }
            String token = normalize(city.getName());
            if (containsToken(normalizedQuestion, token)) {
                return Optional.of(city);
            }
        }
        return Optional.empty();
    }

    private List<City> findMentionedCities(String normalizedQuestion, List<City> cities) {
        return cities.stream()
            .filter(city -> city.getName() != null && !city.getName().isBlank())
            .filter(city -> containsToken(normalizedQuestion, normalize(city.getName())))
            .limit(2)
            .toList();
    }

    private List<City> findMentionedCitiesInQuestionOrder(String normalizedQuestion, List<City> cities) {
        return cities.stream()
            .filter(city -> city.getName() != null && !city.getName().isBlank())
            .map(city -> Map.entry(city, normalizedQuestion.indexOf(normalize(city.getName()))))
            .filter(entry -> entry.getValue() >= 0)
            .sorted(Comparator.comparingInt(Map.Entry::getValue))
            .map(Map.Entry::getKey)
            .limit(2)
            .toList();
    }

    private boolean isInScope(String normalizedQuestion, List<City> cities) {
        List<String> keywords = Arrays.asList(
            "tunisia", "tunisie", "tunisian", "city", "cities", "destination", "governorate",
            "restaurant", "restaurants", "cuisine", "food", "activity", "activities", "visit",
            "hotel", "hotels", "accommodation", "accommodations", "accomodation", "accomodations", "stay", "stays",
            "guesthouse", "guesthouses", "maison d hote", "maison d hotes", "hebergement", "hebergements",
            "transport", "transports", "bus", "train", "taxi", "route", "trajet", "trajets",
            "event", "events", "evenement", "evenements", "enennement", "enennements", "festival", "festivals",
            "artisanat", "artisan", "artisans", "product", "products", "produit", "produits",
            "reservation", "reservations", "booking", "bookings", "cart", "order", "orders",
            "plage", "medina", "voyage", "tourisme", "trip", "app", "application", "login", "compte",
            "نقل", "سكن", "مطعم", "نشاط", "فعالية", "منتج", "حرف", "تطبيق"
        );
        for (String keyword : keywords) {
            if (containsToken(normalizedQuestion, normalize(keyword))) {
                return true;
            }
        }
        return findMentionedCity(normalizedQuestion, cities).isPresent();
    }

    private boolean containsAny(String haystack, String... tokens) {
        for (String token : tokens) {
            if (containsToken(haystack, normalize(token))) {
                return true;
            }
        }
        return false;
    }

    private boolean containsToken(String haystack, String token) {
        if (haystack == null || token == null || token.isBlank()) {
            return false;
        }
        if (token.contains(" ")) {
            return haystack.equals(token)
                || haystack.contains(" " + token + " ")
                || haystack.startsWith(token + " ")
                || haystack.endsWith(" " + token)
                || haystack.contains(token);
        }

        String[] words = haystack.split(" ");
        for (String word : words) {
            if (isWordMatch(word, token)) {
                return true;
            }
        }

        return haystack.equals(token)
            || haystack.contains(" " + token + " ")
            || haystack.startsWith(token + " ")
            || haystack.endsWith(" " + token);
    }

    private boolean isWordMatch(String word, String token) {
        if (word == null || token == null || word.isBlank() || token.isBlank()) {
            return false;
        }
        if (word.equals(token)) {
            return true;
        }

        String wordStem = stemWord(word);
        String tokenStem = stemWord(token);

        if (wordStem.equals(tokenStem)) {
            return true;
        }

        int diff = Math.abs(wordStem.length() - tokenStem.length());
        if (diff <= 1 && levenshteinDistanceAtMostOne(wordStem, tokenStem)) {
            return true;
        }

        return false;
    }

    private String stemWord(String value) {
        String stem = value;
        if (stem.length() > 4 && stem.endsWith("es")) {
            stem = stem.substring(0, stem.length() - 2);
        } else if (stem.length() > 3 && stem.endsWith("s")) {
            stem = stem.substring(0, stem.length() - 1);
        }
        return stem;
    }

    private boolean levenshteinDistanceAtMostOne(String a, String b) {
        if (a.equals(b)) {
            return true;
        }
        int la = a.length();
        int lb = b.length();
        if (Math.abs(la - lb) > 1) {
            return false;
        }

        int i = 0;
        int j = 0;
        int edits = 0;

        while (i < la && j < lb) {
            if (a.charAt(i) == b.charAt(j)) {
                i++;
                j++;
                continue;
            }

            edits++;
            if (edits > 1) {
                return false;
            }

            if (la > lb) {
                i++;
            } else if (lb > la) {
                j++;
            } else {
                i++;
                j++;
            }
        }

        if (i < la || j < lb) {
            edits++;
        }

        return edits <= 1;
    }

    private String buildConversationContext(List<String> conversation) {
        if (conversation == null || conversation.isEmpty()) {
            return "";
        }
        return conversation.stream()
            .filter(line -> line != null && !line.isBlank())
            .skip(Math.max(0, conversation.size() - 8))
            .collect(Collectors.joining(" "));
    }

    private boolean asksCheapest(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "moins cher", "moins couteux", "moins couteuse", "low cost", "cheapest", "lowest", "economique", "economy", "اقل سعر", "ارخص");
    }

    private boolean asksMostExpensive(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "plus cher", "plus couteux", "most expensive", "highest price", "premium", "اغلى", "اعلى سعر");
    }

    private boolean asksTopRated(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "meilleur", "best", "top rated", "highest rated", "meilleure note", "note la plus", "افضل تقييم");
    }

    private boolean asksLowestRated(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "moins note", "worst", "lowest rated", "اقل تقييم");
    }

    private Double extractMaxPrice(String normalizedQuestion) {
        if (!containsAny(normalizedQuestion, "moins de", "max", "maximum", "under", "below", "<")) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractMinPrice(String normalizedQuestion) {
        if (!containsAny(normalizedQuestion, "plus de", "min", "minimum", "above", "over", ">")) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractFirstNumber(String normalizedQuestion) {
        String[] tokens = normalizedQuestion.split(" ");
        for (String token : tokens) {
            try {
                return Double.parseDouble(token);
            } catch (NumberFormatException ignored) {
                // continue
            }
        }
        return null;
    }

    private Comparator<Restaurant> restaurantComparator(String normalizedQuestion) {
        if (asksLowestRated(normalizedQuestion)) {
            return Comparator.comparing(Restaurant::getRating, Comparator.nullsLast(Double::compareTo));
        }
        return Comparator.comparing(Restaurant::getRating, Comparator.nullsLast(Double::compareTo)).reversed();
    }

    private Comparator<Activity> activityComparator(String normalizedQuestion) {
        if (asksMostExpensive(normalizedQuestion)) {
            return Comparator.comparing(Activity::getPrice, Comparator.nullsLast(Double::compareTo)).reversed();
        }
        if (asksCheapest(normalizedQuestion)) {
            return Comparator.comparing(Activity::getPrice, Comparator.nullsLast(Double::compareTo));
        }
        return Comparator.comparing(Activity::getActivityId, Comparator.nullsLast(Integer::compareTo)).reversed();
    }

    private Comparator<Accommodation> accommodationComparator(String normalizedQuestion) {
        if (asksMostExpensive(normalizedQuestion)) {
            return Comparator.comparing(Accommodation::getPricePerNight, Comparator.nullsLast(Double::compareTo)).reversed();
        }
        if (asksCheapest(normalizedQuestion)) {
            return Comparator.comparing(Accommodation::getPricePerNight, Comparator.nullsLast(Double::compareTo));
        }
        if (asksLowestRated(normalizedQuestion)) {
            return Comparator.comparing(Accommodation::getRating, Comparator.nullsLast(Double::compareTo));
        }
        return Comparator.comparing(Accommodation::getRating, Comparator.nullsLast(Double::compareTo)).reversed();
    }

    private Comparator<Product> productComparator(String normalizedQuestion) {
        if (asksMostExpensive(normalizedQuestion)) {
            return Comparator.comparing(Product::getPrice, Comparator.nullsLast(Double::compareTo)).reversed();
        }
        if (asksCheapest(normalizedQuestion)) {
            return Comparator.comparing(Product::getPrice, Comparator.nullsLast(Double::compareTo));
        }
        return Comparator.comparing(Product::getProductId, Comparator.nullsLast(Integer::compareTo)).reversed();
    }

    private Transport selectTransportByPricePreference(List<Transport> transports, String normalizedQuestion) {
        if (transports == null || transports.isEmpty()) {
            return null;
        }

        if (asksMostExpensive(normalizedQuestion)) {
            return transports.stream()
                .filter(t -> t.getPrice() != null)
                .max(Comparator.comparing(Transport::getPrice))
                .orElse(transports.get(0));
        }

        return transports.stream()
            .filter(t -> t.getPrice() != null)
            .min(Comparator.comparing(Transport::getPrice))
            .orElse(transports.get(0));
    }

    private boolean matchesAccommodationType(Accommodation accommodation, String normalizedQuestion) {
        if (accommodation == null) {
            return false;
        }
        if (!containsAny(normalizedQuestion, "hotel", "guesthouse", "maison d hote", "hebergement", "accommodation", "stay")) {
            return true;
        }
        String type = accommodation.getType() == null ? "" : normalize(accommodation.getType().name().replace('_', ' '));
        if (containsAny(normalizedQuestion, "maison d hote", "guesthouse")) {
            return type.contains("maison hote") || type.contains("guesthouse") || type.contains("maison");
        }
        if (containsAny(normalizedQuestion, "hotel", "hotels")) {
            return type.contains("hotel");
        }
        return true;
    }

    private boolean matchesTransportType(Transport transport, String normalizedQuestion) {
        if (transport == null || transport.getType() == null) {
            return true;
        }
        if (!containsAny(normalizedQuestion, "bus", "train", "taxi", "plane", "avion", "ferry", "car", "van")) {
            return true;
        }
        String type = normalize(transport.getType().name());
        return containsToken(normalizedQuestion, type)
            || (containsAny(normalizedQuestion, "avion", "plane") && containsToken(type, "plane"));
    }

    private boolean matchesRestaurantType(Restaurant restaurant, String normalizedQuestion) {
        if (restaurant == null) {
            return false;
        }
        if (!containsAny(normalizedQuestion, "cuisine", "food", "restaurant", "resto", "مطعم")) {
            return true;
        }
        if (!containsAny(normalizedQuestion, "italien", "tunisien", "seafood", "fast", "oriental", "grill", "cafe")) {
            return true;
        }
        return containsToken(normalize(restaurant.getCuisineType()), normalizedQuestion)
            || containsToken(normalizedQuestion, normalize(restaurant.getCuisineType()));
    }

    private boolean matchesActivityType(Activity activity, String normalizedQuestion) {
        if (activity == null || activity.getType() == null || activity.getType().isBlank()) {
            return true;
        }
        if (!containsAny(normalizedQuestion, "type", "hiking", "culture", "sport", "tour", "randonnee", "adventure", "museum", "water", "wellness")) {
            return true;
        }
        return containsToken(normalizedQuestion, normalize(activity.getType()))
            || containsToken(normalize(activity.getType()), normalizedQuestion);
    }

    private boolean matchesEventType(Event event, String normalizedQuestion) {
        if (event == null || event.getEventType() == null || event.getEventType().isBlank()) {
            return true;
        }
        if (!containsAny(normalizedQuestion, "type", "festival", "concert", "conference", "workshop", "exhibition", "manifestation")) {
            return true;
        }
        return containsToken(normalizedQuestion, normalize(event.getEventType()));
    }

    private boolean matchesProductQuery(Product product, String normalizedQuestion) {
        if (product == null) {
            return false;
        }

        String name = normalize(product.getName());
        String description = normalize(product.getDescription());
        String category = product.getCategory() == null ? "" : normalize(product.getCategory().name());

        if (containsAny(normalizedQuestion, "color", "couleur", "rouge", "bleu", "vert", "noir", "blanc", "beige", "red", "blue", "green", "black", "white")) {
            boolean colorInText = containsToken(name, "rouge") || containsToken(name, "bleu") || containsToken(name, "vert")
                || containsToken(name, "noir") || containsToken(name, "blanc") || containsToken(description, "rouge")
                || containsToken(description, "bleu") || containsToken(description, "vert") || containsToken(description, "noir")
                || containsToken(description, "blanc") || containsToken(description, "beige");
            if (!colorInText) {
                try {
                    return product.getVariants() != null && product.getVariants().stream()
                        .filter(variant -> variant.getColor() != null)
                        .anyMatch(variant -> containsToken(normalizedQuestion, normalize(variant.getColor())));
                } catch (Exception ignored) {
                    return false;
                }
            }
            return true;
        }

        if (containsAny(normalizedQuestion, "description", "desc", "details", "detail")) {
            return !description.isBlank();
        }

        if (containsAny(normalizedQuestion, "artisan", "craft", "product", "produit", "category", "categorie")) {
            return true;
        }

        return containsToken(normalizedQuestion, name)
            || containsToken(normalizedQuestion, description)
            || containsToken(normalizedQuestion, category)
            || true;
    }

    private String optionalText(String value, String prefix) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return prefix + value;
    }

    private String shorten(String text, int maxLen) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String cleaned = text.replaceAll("\\s+", " ").trim();
        if (cleaned.length() <= maxLen) {
            return cleaned;
        }
        return cleaned.substring(0, Math.max(0, maxLen - 1)) + "…";
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String describeTransport(Transport transport) {
        String from = safeCityName(transport.getDepartureCity());
        String to = safeCityName(transport.getArrivalCity());
        String type = transport.getType() == null ? "transport" : transport.getType().name();
        String price = transport.getPrice() == null ? "N/A" : String.format(Locale.ROOT, "%.0f DT", transport.getPrice());
        String departure = transport.getDepartureTime() == null ? "" : " - " + transport.getDepartureTime().toLocalDate() + " " + transport.getDepartureTime().toLocalTime();
        String operator = optionalText(transport.getOperatorName(), " - ");
        return type + " " + from + "->" + to + " (" + price + ")" + departure + operator;
    }

    private String safeCityName(City city) {
        if (city == null) {
            return "?";
        }
        try {
            return city.getName() == null || city.getName().isBlank() ? "?" : city.getName();
        } catch (Exception ignored) {
            return "?";
        }
    }

    private Map<Integer, Long> buildEventReservationCountMap() {
        return eventReservationRepository.findAll().stream()
            .filter(reservation -> reservation.getEvent() != null && reservation.getEvent().getEventId() != null)
            .filter(reservation -> reservation.getStatus() != ReservationStatus.CANCELLED)
            .collect(Collectors.groupingBy(
                reservation -> reservation.getEvent().getEventId(),
                HashMap::new,
                Collectors.counting()
            ));
    }

    private boolean isInCurrentMonth(Date startDate, Date endDate) {
        YearMonth currentMonth = YearMonth.now();
        LocalDate start = toLocalDate(startDate);
        LocalDate end = endDate == null ? start : toLocalDate(endDate);
        if (start == null && end == null) {
            return false;
        }
        if (start == null) {
            return YearMonth.from(end).equals(currentMonth);
        }
        if (end == null) {
            return YearMonth.from(start).equals(currentMonth);
        }
        LocalDate firstDay = currentMonth.atDay(1);
        LocalDate lastDay = currentMonth.atEndOfMonth();
        return !end.isBefore(firstDay) && !start.isAfter(lastDay);
    }

    private boolean isInNextMonth(Date startDate, Date endDate) {
        YearMonth nextMonth = YearMonth.now().plusMonths(1);
        LocalDate start = toLocalDate(startDate);
        LocalDate end = endDate == null ? start : toLocalDate(endDate);
        if (start == null && end == null) {
            return false;
        }
        if (start == null) {
            return YearMonth.from(end).equals(nextMonth);
        }
        if (end == null) {
            return YearMonth.from(start).equals(nextMonth);
        }
        LocalDate firstDay = nextMonth.atDay(1);
        LocalDate lastDay = nextMonth.atEndOfMonth();
        return !end.isBefore(firstDay) && !start.isAfter(lastDay);
    }

    private LocalDate toLocalDate(Date value) {
        if (value == null) {
            return null;
        }
        return value.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private String formatEventDate(Date value) {
        LocalDate localDate = toLocalDate(value);
        if (localDate == null) {
            return "";
        }
        return localDate.toString();
    }

    private Language detectLanguage(String rawQuestion, String normalizedQuestion) {
        if (rawQuestion != null && rawQuestion.matches(".*[\\u0600-\\u06FF].*")) {
            return Language.AR;
        }
        if (containsAny(normalizedQuestion,
            "hola", "gracias", "como", "porque", "donde", "cuando",
            "ciao", "grazie", "come", "dove", "quando",
            "hallo", "danke", "wie", "warum", "wo", "wann")) {
            return Language.EN;
        }
        if (containsAny(normalizedQuestion,
            "bonjour", "salut", "merci", "pourquoi", "comment", "est ce", "quel", "quelle", "quels", "quelles", "je veux", "affiche", "montre")) {
            return Language.FR;
        }
        return Language.EN;
    }

    private String outOfScope(Language language) {
        return t(language,
            "Désolé, je peux répondre uniquement aux questions liées à la Tunisie et aux fonctionnalités de cette application.",
            "Sorry, I can only answer questions related to Tunisia and this application features.",
            "عذرا، يمكنني الإجابة فقط عن الأسئلة المتعلقة بتونس وميزات هذا التطبيق.");
    }

    private String t(Language language, String fr, String en, String ar) {
        return switch (language) {
            case FR -> fr;
            case AR -> ar;
            default -> en;
        };
    }

    private enum Intent {
        BEST_RESTAURANT,
        BEST_ACTIVITY,
        BEST_ACCOMMODATION,
        RESTAURANT,
        ACTIVITY,
        ACCOMMODATION,
        TRANSPORT,
        EVENT,
        PRODUCT,
        APPLICATION_HELP,
        GENERAL_TUNISIA
    }

    private enum Language {
        FR,
        EN,
        AR
    }

    private record IntentAnswer(String answer, String facts, List<String> sources, double confidence) {
    }
}
