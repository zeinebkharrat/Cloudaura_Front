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
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.ActivityReviewRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.RestaurantRepository;
import org.example.backend.repository.RestaurantReviewRepository;
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
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
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
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatbotAssistantService {

    private final ObjectMapper objectMapper;
    private final CityRepository cityRepository;
    private final RestaurantRepository restaurantRepository;
    private final ActivityRepository activityRepository;
    private final ActivityReservationRepository activityReservationRepository;
    private final ActivityReviewRepository activityReviewRepository;
    private final AccommodationRepository accommodationRepository;
    private final EventRepository eventRepository;
    private final EventReservationRepository eventReservationRepository;
    private final ProductRepository productRepository;
    private final TransportRepository transportRepository;
    private final RestaurantReviewRepository restaurantReviewRepository;

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

        // Use conversation as fallback for city context only on short follow-up prompts.
        if (city.isEmpty() && isLowSignalQuestion(normalizedQuestion) && !normalizedConversation.isBlank()) {
            city = findMentionedCity(normalizedConversation, allCities);
        }
        if (mentionedCities.isEmpty() && isLowSignalQuestion(normalizedQuestion) && !normalizedConversation.isBlank()) {
            mentionedCities = findMentionedCitiesInQuestionOrder(normalizedConversation, allCities);
        }

        boolean inScope = isInScope(normalizedQuestion, allCities)
            || (isLowSignalQuestion(normalizedQuestion) && isInScope(normalizedConversation, allCities));

        if (!inScope) {
            return new ChatbotQueryResponse(
                outOfScope(language),
                true,
                List.of("scope-guard"),
                1.0
            );
        }

        Intent intent = detectIntent(normalizedQuestion);
        if (intent == Intent.GENERAL_TUNISIA
            && isLowSignalQuestion(normalizedQuestion)
            && !containsAny(normalizedQuestion,
                "ville tunisienne", "propose moi une ville", "plage", "beach", "sahel", "desert", "dessert", "montagne", "mountain", "cap bon")
            && !normalizedConversation.isBlank()) {
            Intent conversationIntent = detectIntent(normalizedConversation);
            if (conversationIntent != Intent.GENERAL_TUNISIA) {
                intent = conversationIntent;
            }
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
        if (isSmallTalkOrPoliteness(normalizedQuestion)) {
            return Intent.SMALL_TALK;
        }

        boolean asksCitySuggestion = containsAny(normalizedQuestion,
            "propose moi une ville", "propose une ville", "ville tunisienne", "ville en tunisie", "suggest a city", "recommend city", "city in tunisia", "ville avec plage", "beach city", "sahel");
        boolean asksInfo = containsAny(normalizedQuestion, "info", "infos", "information", "informations", "detail", "details", "detailles", "detaillé", "details");
        boolean asksCityList = containsAny(normalizedQuestion,
            "nom des villes", "noms des villes", "villes tunisiennes", "toutes les villes", "tous les villes", "all cities", "city names");
        boolean asksBest = asksBestKeyword(normalizedQuestion);
        boolean asksRestaurant = containsAny(normalizedQuestion, "restaurant", "restaurants", "cuisine", "food", "مطعم", "مطاعم");
        boolean asksRestaurantStars = asksRestaurant
            && containsAny(normalizedQuestion, "notation", "note", "rating", "etoile", "etoiles", "star", "stars")
            && (containsAny(normalizedQuestion, "superieur", "inferieur", "plus de", "moins de", "above", "below", ">", "<")
                || extractFirstNumber(normalizedQuestion) != null);
        boolean asksActivity = containsAny(normalizedQuestion, "activity", "activities", "activite", "activites", "activies", "activis", "visit", "thing to do", "نشاط", "انشطة");
        boolean asksAccommodation = containsAny(normalizedQuestion, "hotel", "accommodation", "accommodations", "accomodation", "accomodations", "stay", "guesthouse", "maison d hote", "hebergement", "سكن", "اقامة");
        boolean asksTransport = containsAny(normalizedQuestion,
            "transport", "tansport", "transports", "bus", "train", "taxi", "plane", "ferry", "route", "trajet", "voyage", "travel", "trip", "departure", "destination", "from", "to", "vers", "نقل", "حافلة", "قطار")
            || isTravelRouteQuery(normalizedQuestion);
        boolean asksEvent = containsAny(normalizedQuestion,
            "event", "events", "even", "evnt", "festival", "concert",
            "evenement", "evenements", "evenemnt", "evenemnts", "enennement", "enennements", "manifestation",
            "حدث", "فعاليات", "فعالية");
        boolean asksProduct = containsAny(normalizedQuestion, "product", "products", "artisanat", "artisan", "souvenir", "craft", "market", "produit", "منتج", "حرف", "صناعة تقليدية");
        boolean asksAppHelp = containsAny(normalizedQuestion,
            "application", "app", "compte", "account", "login", "connexion", "inscription", "reservation", "booking", "payment",
            "cart", "panier", "checkout", "commande", "order", "favoris", "profile", "profil");
        boolean asksReservationAvailability = containsAny(normalizedQuestion,
            "reserver", "reservation", "booking", "book", "reserve")
            && (extractRequestedDate(normalizedQuestion) != null || extractRequestedActivityMonth(normalizedQuestion) != null
                || containsAny(normalizedQuestion, "personne", "personnes", "participant", "participants", "pax"));

        if (asksCitySuggestion) {
            return Intent.GENERAL_TUNISIA;
        }
        if (asksRestaurantStars) {
            return Intent.RESTAURANT;
        }
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
        if (asksReservationAvailability) {
            return Intent.ACTIVITY;
        }
        if (asksActivity) {
            return Intent.ACTIVITY;
        }
        if (asksAccommodation) {
            return Intent.ACCOMMODATION;
        }
        if (asksEvent) {
            return Intent.EVENT;
        }
        if (asksTransport) {
            return Intent.TRANSPORT;
        }
        if (asksProduct || asksPriceQuestionWithoutDomain(normalizedQuestion)) {
            return Intent.PRODUCT;
        }
        if (asksAppHelp) {
            return Intent.APPLICATION_HELP;
        }
        if (asksCityList) {
            return Intent.GENERAL_TUNISIA;
        }
        if (asksInfo) {
            return Intent.GENERAL_TUNISIA;
        }
        return Intent.GENERAL_TUNISIA;
    }

    private IntentAnswer buildIntentAnswer(Intent intent, Optional<City> city, List<City> mentionedCities, List<City> allCities, Language language, String normalizedQuestion, String normalizedConversation) {
        String effectiveQuestion = normalizedQuestion;

        if (intent == Intent.GENERAL_TUNISIA && asksDetailsQuery(effectiveQuestion)) {
            IntentAnswer detailsFallback = answerSpecificEntityDetails(city, language, effectiveQuestion);
            if (detailsFallback != null) {
                return detailsFallback;
            }
        }

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
            case SMALL_TALK -> answerSmallTalk(language, effectiveQuestion);
            case GENERAL_TUNISIA -> answerGeneral(allCities, city, language, effectiveQuestion);
        };
    }

    private IntentAnswer answerSpecificEntityDetails(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        List<Activity> activities = cityOpt
            .map(city -> activityRepository.findByCityCityIdOrderByActivityIdDesc(city.getCityId()))
            .orElseGet(activityRepository::findAll);
        Optional<Activity> activity = findMentionedActivity(normalizedQuestion, activities);
        if (activity.isPresent()) {
            Activity a = activity.get();
            String details = a.getName()
                + optionalText(a.getType(), " - ")
                + optionalText(a.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", a.getPrice()), " - ")
                + optionalText(a.getAddress(), " - ")
                + optionalText(a.getDescription(), " - ");
            return new IntentAnswer(
                t(language,
                    "Détails activité: " + details + ".",
                    "Activity details: " + details + ".",
                    "تفاصيل النشاط: " + details + "."),
                "ActivityDetails=" + details,
                List.of("activities"),
                0.94
            );
        }

        List<Restaurant> restaurants = cityOpt
            .map(city -> restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(city.getCityId()))
            .orElseGet(restaurantRepository::findAll);
        Optional<Restaurant> restaurant = findMentionedRestaurant(normalizedQuestion, restaurants);
        if (restaurant.isPresent()) {
            Restaurant r = restaurant.get();
            Map<Integer, Double> avgRatingByRestaurant = buildRestaurantAverageRatingMap();
            Map<Integer, Long> reviewCountByRestaurant = buildRestaurantReviewCountMap();
            String details = r.getName()
                + optionalText(r.getCuisineType(), " - ")
                + optionalText(formatRestaurantRatingText(r.getRestaurantId(), avgRatingByRestaurant, reviewCountByRestaurant), " - ")
                + optionalText(r.getAddress(), " - ")
                + optionalText(r.getDescription(), " - ");
            return new IntentAnswer(
                t(language,
                    "Détails restaurant: " + details + ".",
                    "Restaurant details: " + details + ".",
                    "تفاصيل المطعم: " + details + "."),
                "RestaurantDetails=" + details,
                List.of("restaurants"),
                0.94
            );
        }

        List<Event> events = cityOpt
            .map(city -> eventRepository.findByCityCityId(city.getCityId()))
            .orElseGet(eventRepository::findAll);
        Optional<Event> event = findMentionedEvent(normalizedQuestion, events);
        if (event.isPresent()) {
            Event e = event.get();
            String details = e.getTitle()
                + optionalText(e.getEventType(), " - ")
                + optionalText(e.getCity() == null ? null : e.getCity().getName(), " - ")
                + optionalText(e.getVenue(), " - ")
                + optionalText(formatEventDate(e.getStartDate()), " - ")
                + optionalText(e.getStatus(), " - ")
                + optionalText(e.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", e.getPrice()), " - ");
            return new IntentAnswer(
                t(language,
                    "Détails événement: " + details + ".",
                    "Event details: " + details + ".",
                    "تفاصيل الفعالية: " + details + "."),
                "EventDetails=" + details,
                List.of("events"),
                0.94
            );
        }

        return null;
    }

    private IntentAnswer answerSmallTalk(Language language, String normalizedQuestion) {
        String mirroredGreeting = mirroredGreeting(normalizedQuestion, language);
        if (mirroredGreeting != null) {
            return new IntentAnswer(
                mirroredGreeting,
                "SmallTalk=greeting",
                List.of("application"),
                0.98
            );
        }

        return new IntentAnswer(
            t(language,
                "Oui bien sûr. Je suis là pour vous aider. Posez votre question et je vous réponds avec les informations de l'application.",
                "Yes, of course. I am here to help. Ask your question and I will answer using app data.",
                "نعم بالتأكيد. أنا هنا للمساعدة. اطرح سؤالك وسأجيبك اعتمادا على بيانات التطبيق."),
            "SmallTalk=polite",
            List.of("application"),
            0.96
        );
    }

    private String mirroredGreeting(String normalizedQuestion, Language language) {
        if (containsAny(normalizedQuestion, "bonsoir")) {
            return t(language, "Bonsoir! Comment puis-je vous aider?", "Good evening! How can I help you?", "مساء الخير! كيف يمكنني مساعدتك؟");
        }
        if (containsAny(normalizedQuestion, "bonjour")) {
            return t(language, "Bonjour! Comment puis-je vous aider?", "Hello! How can I help you?", "صباح الخير! كيف يمكنني مساعدتك؟");
        }
        if (containsAny(normalizedQuestion, "hello", "hi", "hey")) {
            return t(language, "Bonjour! Comment puis-je vous aider?", "Hello! How can I help you?", "مرحبا! كيف يمكنني مساعدتك؟");
        }
        if (containsAny(normalizedQuestion, "salam", "marhba", "assalam", "السلام", "مرحبا")) {
            return t(language, "Salam! Comment puis-je vous aider?", "Salam! How can I help you?", "سلام! كيف يمكنني مساعدتك؟");
        }
        return null;
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

        Map<Integer, Double> avgRatingByRestaurant = buildRestaurantAverageRatingMap();
        Map<Integer, Long> reviewCountByRestaurant = buildRestaurantReviewCountMap();

        Restaurant best = restaurants.stream()
            .max(Comparator.comparing(r -> avgRatingByRestaurant.getOrDefault(r.getRestaurantId(), 0.0)))
            .orElse(restaurants.get(0));

        double avgStars = avgRatingByRestaurant.getOrDefault(best.getRestaurantId(), 0.0);
        long totalReviews = reviewCountByRestaurant.getOrDefault(best.getRestaurantId(), 0L);
        String ratingText = totalReviews <= 0
            ? t(language, "pas encore noté", "not rated yet", "غير مقيم بعد")
            : String.format(Locale.ROOT, "%.1f/5 (%d reviews)", avgStars, totalReviews);
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
        boolean asksDetails = asksDetailsQuery(normalizedQuestion);
        Double minStars = extractMinStars(normalizedQuestion);
        Double maxStars = extractMaxStars(normalizedQuestion);
        Map<Integer, Double> avgRatingByRestaurant = buildRestaurantAverageRatingMap();
        Map<Integer, Long> reviewCountByRestaurant = buildRestaurantReviewCountMap();

        List<Restaurant> allRestaurants = cityOpt
            .map(city -> restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(city.getCityId()))
            .orElseGet(restaurantRepository::findAll);

        if (cityOpt.isEmpty() && (minStars != null || maxStars != null)) {
            String starsConstraint = minStars != null
                ? t(language,
                    "avec note supérieure ou égale à " + String.format(Locale.ROOT, "%.0f", minStars) + " étoiles",
                    "with rating greater than or equal to " + String.format(Locale.ROOT, "%.0f", minStars) + " stars",
                    "بتقييم أكبر أو يساوي " + String.format(Locale.ROOT, "%.0f", minStars) + " نجوم")
                : t(language,
                    "avec note inférieure ou égale à " + String.format(Locale.ROOT, "%.0f", maxStars) + " étoiles",
                    "with rating less than or equal to " + String.format(Locale.ROOT, "%.0f", maxStars) + " stars",
                    "بتقييم أقل أو يساوي " + String.format(Locale.ROOT, "%.0f", maxStars) + " نجوم");

            return new IntentAnswer(
                t(language,
                    "Pour filtrer les restaurants " + starsConstraint + ", indiquez une ville tunisienne (ex: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "To filter restaurants " + starsConstraint + ", please mention a Tunisian city (for example: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "لتصفية المطاعم " + starsConstraint + "، اذكر مدينة تونسية مثل تونس أو سوسة أو صفاقس أو نابل أو الحمامات."),
                "NeedCityForRestaurantStars",
                List.of("cities", "restaurants"),
                0.9
            );
        }

        if (asksDetails) {
            Optional<Restaurant> matched = findMentionedRestaurant(normalizedQuestion, allRestaurants);
            if (matched.isPresent()) {
                Restaurant r = matched.get();
                String ratingText = formatRestaurantRatingText(r.getRestaurantId(), avgRatingByRestaurant, reviewCountByRestaurant);
                String details = r.getName()
                    + optionalText(r.getCuisineType(), " - ")
                    + optionalText(ratingText, " - ")
                    + optionalText(r.getAddress(), " - ")
                    + optionalText(r.getDescription(), " - ");
                return new IntentAnswer(
                    t(language,
                        "Détails restaurant: " + details + ".",
                        "Restaurant details: " + details + ".",
                        "تفاصيل المطعم: " + details + "."),
                    "RestaurantDetails=" + details,
                    List.of("restaurants"),
                    0.94
                );
            }
        }

        if (cityOpt.isPresent()) {
            City city = cityOpt.get();
            List<Restaurant> restaurants = allRestaurants
                .stream()
                .filter(restaurant -> matchesRestaurantType(restaurant, normalizedQuestion))
                .filter(restaurant -> minStars == null || avgRatingByRestaurant.getOrDefault(restaurant.getRestaurantId(), 0.0) >= minStars)
                .filter(restaurant -> maxStars == null || avgRatingByRestaurant.getOrDefault(restaurant.getRestaurantId(), 0.0) <= maxStars)
                .sorted(restaurantComparator(normalizedQuestion, avgRatingByRestaurant))
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
                .map(restaurant -> {
                    String rating = formatRestaurantRatingText(restaurant.getRestaurantId(), avgRatingByRestaurant, reviewCountByRestaurant);
                    String title = "• " + restaurant.getName()
                        + optionalText(rating, " (rating: ")
                        + (rating.isBlank() ? "" : ")");
                    String address = optionalText(restaurant.getAddress(), "\n📍 ");
                    String desc = optionalText(shorten(restaurant.getDescription(), 120), "\n➤ ");
                    return title + address + desc;
                })
                .collect(Collectors.joining("\n"));
            String priceNote = asksPrice
                ? t(language,
                    " Remarque: le prix restaurant n'est pas disponible dans la base actuelle, je classe donc selon la note et la pertinence.",
                    " Note: restaurant price is not available in the current dataset, so I rank by rating and relevance.",
                    " ملاحظة: سعر المطاعم غير متوفر حاليا في قاعدة البيانات، لذلك أعرض النتائج حسب التقييم والملاءمة.")
                : "";
            return new IntentAnswer(
                t(language,
                    "À " + city.getName() + ", voici des restaurants pertinents:\n" + names,
                    "In " + city.getName() + ", relevant restaurants are:\n" + names,
                    "في " + city.getName() + " هذه مطاعم مناسبة:\n" + names) + priceNote,
                "City=" + city.getName() + "; Restaurants=" + names,
                List.of("restaurants", "cities"),
                0.84
            );
        }

        List<Restaurant> restaurants = allRestaurants.stream()
            .filter(restaurant -> matchesRestaurantType(restaurant, normalizedQuestion))
            .filter(restaurant -> minStars == null || avgRatingByRestaurant.getOrDefault(restaurant.getRestaurantId(), 0.0) >= minStars)
            .filter(restaurant -> maxStars == null || avgRatingByRestaurant.getOrDefault(restaurant.getRestaurantId(), 0.0) <= maxStars)
            .sorted(restaurantComparator(normalizedQuestion, avgRatingByRestaurant))
            .limit(6)
            .toList();
        String names = restaurants.stream()
            .map(restaurant -> "• " + restaurant.getName())
            .collect(Collectors.joining("\n"));
        return new IntentAnswer(
            t(language,
                "Côté restaurants en Tunisie:\n" + (names.isBlank() ? "Je suis désolé, je n'ai trouvé aucun restaurant pour cette demande." : names),
                "Restaurant options in Tunisia include:\n" + (names.isBlank() ? "I am sorry, I could not find any restaurant for this request." : names),
                "خيارات المطاعم في تونس تشمل:\n" + (names.isBlank() ? "عذرا، لم أجد مطاعم مطابقة لهذا الطلب." : names)),
            "Restaurants=" + names,
            List.of("restaurants"),
            0.75
        );
    }

    private IntentAnswer answerActivityOverview(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        Double exactPrice = extractExactPrice(normalizedQuestion);
        Double minStars = extractMinStars(normalizedQuestion);
        Double maxStars = extractMaxStars(normalizedQuestion);
        int requestedParticipants = extractRequestedParticipants(normalizedQuestion);
        LocalDate requestedDate = extractRequestedDate(normalizedQuestion);
        YearMonth requestedMonth = extractRequestedActivityMonth(normalizedQuestion);
        boolean asksAll = asksAllResults(normalizedQuestion);
        boolean asksRating = asksTopRated(normalizedQuestion) || asksLowestRated(normalizedQuestion) || containsAny(normalizedQuestion, "note", "rating", "rated");
        boolean asksDetails = asksDetailsQuery(normalizedQuestion);
        boolean asksYesNo = containsAny(normalizedQuestion, "est ce", "y a", "is there", "are there", "existe", "exists");

        Map<Integer, Double> avgRatingByActivity = buildActivityAverageRatingMap();
        Map<Integer, Long> reviewCountByActivity = buildActivityReviewCountMap();

        if (requestedDate != null && requestedDate.isBefore(LocalDate.now())) {
            return new IntentAnswer(
                t(language,
                    "Je suis désolé, la date demandée est déjà passée. Merci de choisir une date future.",
                    "I am sorry, the requested date is already in the past. Please choose a future date.",
                    "عذرا، التاريخ المطلوب في الماضي. يرجى اختيار تاريخ قادم."),
                "Activities=date-in-past",
                List.of("activities"),
                0.9
            );
        }

        boolean asksAllCities = containsAny(normalizedQuestion, "toutes les villes", "de toutes les villes", "all cities", "all city");

        List<Activity> allActivities = (cityOpt.isPresent() && !asksAllCities)
            ? activityRepository.findByCityCityIdOrderByActivityIdDesc(cityOpt.get().getCityId())
            : activityRepository.findAll();

        Optional<Activity> askedActivity = findMentionedActivity(normalizedQuestion, allActivities)
            .or(() -> findActivityByKeyword(normalizedQuestion, allActivities));

        if (asksYesNo && askedActivity.isPresent()) {
            Activity activity = askedActivity.get();
            boolean available = isActivityAvailableForFilter(activity, requestedDate, requestedMonth, requestedParticipants)
                && (exactPrice == null || (activity.getPrice() != null && Math.abs(activity.getPrice() - exactPrice) <= 0.5))
                && (maxPrice == null || (activity.getPrice() != null && activity.getPrice() <= maxPrice))
                && (minPrice == null || (activity.getPrice() != null && activity.getPrice() >= minPrice))
                && (minStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) >= minStars)
                && (maxStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) <= maxStars);

            String ratingText = formatActivityRatingText(activity.getActivityId(), avgRatingByActivity, reviewCountByActivity);
            String details = "• " + activity.getName()
                + optionalText(activity.getType(), "\n➤ type: ")
                + optionalText(ratingText, "\n➤ rating: ")
                + optionalText(activity.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", activity.getPrice()), "\n➤ prix: ")
                + optionalText(activity.getAddress(), "\n📍 ")
                + optionalText(shorten(activity.getDescription(), 120), "\n➤ ");

            return new IntentAnswer(
                available
                    ? t(language,
                        "Oui, cette activité est disponible:\n" + details,
                        "Yes, this activity is available:\n" + details,
                        "نعم، هذا النشاط متاح:\n" + details)
                    : t(language,
                        "Je suis désolé, cette activité n'est pas disponible selon vos critères pour le moment.",
                        "I am sorry, this activity is not available for your criteria at the moment.",
                        "عذرا، هذا النشاط غير متاح حاليا حسب المعايير المطلوبة."),
                "ActivityYesNo=" + activity.getName() + "; available=" + available,
                List.of("activities"),
                0.94
            );
        }

        if (asksDetails) {
            Optional<Activity> matched = findMentionedActivity(normalizedQuestion, allActivities);
            if (matched.isPresent()) {
                Activity activity = matched.get();
                String ratingText = formatActivityRatingText(activity.getActivityId(), avgRatingByActivity, reviewCountByActivity);
                String details = activity.getName()
                    + optionalText(activity.getType(), " - ")
                    + optionalText(ratingText, " - ")
                    + optionalText(activity.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", activity.getPrice()), " - ")
                    + optionalText(activity.getAddress(), " - ")
                    + optionalText(activity.getDescription(), " - ");
                return new IntentAnswer(
                    t(language,
                        "Détails activité: " + details + ".",
                        "Activity details: " + details + ".",
                        "تفاصيل النشاط: " + details + "."),
                    "ActivityDetails=" + details,
                    List.of("activities"),
                    0.95
                );
            }
        }

        int resultLimit = asksAll ? 200 : (asksCheapest(normalizedQuestion) || asksMostExpensive(normalizedQuestion)) ? 1 : 6;

        if (asksAll && requestedDate == null && exactPrice == null && minPrice == null && maxPrice == null && minStars == null && maxStars == null) {
            List<Activity> activitiesAll = allActivities.stream()
                .sorted(activityComparator("", avgRatingByActivity))
                .limit(resultLimit)
                .toList();

            String namesAll = activitiesAll.stream()
                .map(activity -> "• " + activity.getName()
                    + optionalText(formatActivityRatingText(activity.getActivityId(), avgRatingByActivity, reviewCountByActivity), " - ")
                    + optionalText(activity.getPrice() == null ? null : String.format(Locale.ROOT, " - %.0f DT", activity.getPrice()), "")
                    + optionalText(activity.getAddress(), "\n📍 "))
                .collect(Collectors.joining("\n"));

            return new IntentAnswer(
                t(language,
                    "Activités disponibles en Tunisie:\n" + (namesAll.isBlank() ? "Je suis désolé, je n'ai trouvé aucune activité disponible pour le moment." : namesAll),
                    "Available activities in Tunisia:\n" + (namesAll.isBlank() ? "I am sorry, I could not find any available activity for now." : namesAll),
                    "الأنشطة المتاحة في تونس:\n" + (namesAll.isBlank() ? "عذرا، لم أجد أي نشاط متاح حاليا." : namesAll)),
                "Activities=" + namesAll,
                List.of("activities"),
                0.86
            );
        }

        if (cityOpt.isPresent()) {
            City city = cityOpt.get();
            List<Activity> activities = allActivities
                .stream()
                .filter(activity -> matchesActivityType(activity, normalizedQuestion))
                .filter(activity -> isActivityAvailableForFilter(activity, requestedDate, requestedMonth, requestedParticipants))
                .filter(activity -> exactPrice == null || (activity.getPrice() != null && Math.abs(activity.getPrice() - exactPrice) <= 0.5))
                .filter(activity -> activity.getPrice() == null || maxPrice == null || activity.getPrice() <= maxPrice)
                .filter(activity -> activity.getPrice() == null || minPrice == null || activity.getPrice() >= minPrice)
                .filter(activity -> minStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) >= minStars)
                .filter(activity -> maxStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) <= maxStars)
                .sorted(activityComparator(normalizedQuestion, avgRatingByActivity))
                .limit(resultLimit)
                .toList();

            if (activities.isEmpty() && asksAll && requestedDate == null && exactPrice == null && minPrice == null && maxPrice == null && minStars == null && maxStars == null) {
                activities = allActivities.stream()
                    .sorted(activityComparator("", avgRatingByActivity))
                    .limit(50)
                    .toList();
            }

            if (activities.isEmpty()) {
                return new IntentAnswer(
                    t(language,
                        requestedDate != null
                            ? "Je suis désolé, je n'ai trouvé aucune activité disponible à " + city.getName() + " pour la date demandée."
                            : "Je suis désolé, je n'ai trouvé aucune activité disponible pour le moment à " + city.getName() + ".",
                        requestedDate != null
                            ? "I am sorry, I could not find any available activity in " + city.getName() + " for the requested date."
                            : "I am sorry, I could not find any available activity in " + city.getName() + " at the moment.",
                        requestedDate != null
                            ? "عذرا، لم أجد أنشطة متاحة في " + city.getName() + " للتاريخ المطلوب."
                            : "عذرا، لم أجد أنشطة متاحة حاليا في " + city.getName() + "."),
                    "No activities in city.",
                    List.of("activities"),
                    0.8
                );
            }

            String names = activities.stream()
                .map(activity -> {
                    String rating = formatActivityRatingText(activity.getActivityId(), avgRatingByActivity, reviewCountByActivity);
                    return activity.getName()
                    + optionalText(activity.getType(), "\n➤ type: ")
                    + optionalText(rating, "\n➤ rating: ")
                    + optionalText(activity.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", activity.getPrice()), "\n➤ prix: ")
                    + optionalText(activity.getAddress(), "\n📍 ")
                    + optionalText(shorten(activity.getDescription(), 120), "\n➤ ");
                })
                .map(line -> "• " + line)
                .collect(Collectors.joining("\n"));
            return new IntentAnswer(
                t(language,
                    "À " + city.getName() + ", activités proposées:\n" + names,
                    "In " + city.getName() + ", available activities include:\n" + names,
                    "في " + city.getName() + " الأنشطة المتاحة تشمل:\n" + names),
                "City=" + city.getName() + "; Activities=" + names,
                List.of("activities", "cities"),
                0.82
            );
        }

        List<Activity> activities = allActivities.stream()
            .filter(activity -> matchesActivityType(activity, normalizedQuestion))
            .filter(activity -> isActivityAvailableForFilter(activity, requestedDate, requestedMonth, requestedParticipants))
            .filter(activity -> exactPrice == null || (activity.getPrice() != null && Math.abs(activity.getPrice() - exactPrice) <= 0.5))
            .filter(activity -> activity.getPrice() == null || maxPrice == null || activity.getPrice() <= maxPrice)
            .filter(activity -> activity.getPrice() == null || minPrice == null || activity.getPrice() >= minPrice)
            .filter(activity -> minStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) >= minStars)
            .filter(activity -> maxStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) <= maxStars)
            .sorted(activityComparator(normalizedQuestion, avgRatingByActivity))
            .limit(resultLimit)
            .toList();

        if (activities.isEmpty() && asksAll && requestedDate == null && exactPrice == null && minPrice == null && maxPrice == null && minStars == null && maxStars == null) {
            activities = allActivities.stream()
                .sorted(activityComparator("", avgRatingByActivity))
                .limit(50)
                .toList();
        }

        String names = activities.stream()
            .map(activity -> "• " + activity.getName()
                + optionalText(formatActivityRatingText(activity.getActivityId(), avgRatingByActivity, reviewCountByActivity), " - ")
                + optionalText(activity.getPrice() == null ? null : String.format(Locale.ROOT, " - %.0f DT", activity.getPrice()), "")
                + optionalText(activity.getAddress(), "\n📍 "))
            .collect(Collectors.joining("\n"));
        return new IntentAnswer(
            t(language,
                "Activités disponibles en Tunisie:\n" + (names.isBlank() ? "Je suis désolé, je n'ai trouvé aucune activité disponible pour cette demande." : names),
                "Available activities in Tunisia:\n" + (names.isBlank() ? "I am sorry, I could not find any available activity for this request." : names),
                "الأنشطة المتاحة في تونس:\n" + (names.isBlank() ? "عذرا، لم أجد أنشطة متاحة لهذا الطلب." : names)),
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

        if (mentionedCities.size() < 2 && asksTransportMeansOnly(normalizedQuestion)) {
            return answerTransportTypesOnly(language);
        }

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
                        "Je n'ai pas trouvé de trajet actif de " + from.getName() + " vers " + to.getName() + " pour le moment. "
                            + routeDistanceDurationText(from, to, language),
                        "I could not find active transport from " + from.getName() + " to " + to.getName() + " right now. "
                            + routeDistanceDurationText(from, to, language),
                        "لم أجد رحلات نقل نشطة من " + from.getName() + " إلى " + to.getName() + " حاليا. "
                            + routeDistanceDurationText(from, to, language)),
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
            String routeStats = routeDistanceDurationText(from, to, language);
            String answer = t(language,
                "Pour aller de " + from.getName() + " à " + to.getName() + ", une option recommandée est " + type + " à " + price + ". " + routeStats + " Prochains trajets: " + nextDepartures + ".",
                "For traveling from " + from.getName() + " to " + to.getName() + ", a recommended option is " + type + " at " + price + ". " + routeStats + " Next departures: " + nextDepartures + ".",
                "للتنقل من " + from.getName() + " إلى " + to.getName() + "، خيار مناسب هو " + type + " بسعر " + price + ". " + routeStats + " الرحلات القادمة: " + nextDepartures + ".");

            return new IntentAnswer(answer, "Route=" + from.getName() + "->" + to.getName() + "; Type=" + type + "; Price=" + price + "; Next=" + nextDepartures, List.of("transport", "cities"), 0.91);
        }

        transports = transportRepository.findByIsActiveTrue().stream()
            .filter(transport -> matchesTransportType(transport, normalizedQuestion))
            .filter(transport -> transport.getPrice() == null || maxPrice == null || transport.getPrice() <= maxPrice)
            .filter(transport -> transport.getPrice() == null || minPrice == null || transport.getPrice() >= minPrice)
            .sorted(Comparator.comparing(Transport::getDepartureTime, Comparator.nullsLast(LocalDateTime::compareTo)))
            .toList();
        if (transports.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Je suis désolé, je n'ai trouvé aucune option de transport active pour le moment.",
                    "I am sorry, I could not find any active transport option at the moment.",
                    "عذرا، لم أجد أي خيار نقل نشط حاليا."),
                "No active transports.",
                List.of("transport"),
                0.8
            );
        }

        Set<String> departureCities = transports.stream()
            .map(Transport::getDepartureCity)
            .map(this::safeCityName)
            .filter(name -> name != null && !name.isBlank() && !"?".equals(name))
            .collect(Collectors.toCollection(TreeSet::new));
        Set<String> arrivalCities = transports.stream()
            .map(Transport::getArrivalCity)
            .map(this::safeCityName)
            .filter(name -> name != null && !name.isBlank() && !"?".equals(name))
            .collect(Collectors.toCollection(TreeSet::new));
        String routeExamples = transports.stream()
            .map(t -> safeCityName(t.getDepartureCity()) + " -> " + safeCityName(t.getArrivalCity()))
            .filter(route -> !route.contains("?"))
            .distinct()
            .limit(8)
            .collect(Collectors.joining(", "));

        if (mentionedCities.size() < 2 && !asksTransportMeansOnly(normalizedQuestion)) {
            String answer = t(language,
                "Je peux vous aider à trouver le meilleur trajet. De quelle ville partez-vous et vers quelle ville allez-vous ?"
                    + (departureCities.isEmpty() ? "" : " Villes de départ connues: " + String.join(", ", departureCities) + ".")
                    + (arrivalCities.isEmpty() ? "" : " Villes d'arrivée connues: " + String.join(", ", arrivalCities) + ".")
                    + (routeExamples.isBlank() ? "" : " Exemples de routes: " + routeExamples + ".")
                    + " Vous pouvez aussi préciser votre budget (ex: moins de 50 DT) et le type (bus, taxi, train...).",
                "I can help you find the best route. What is your departure city and destination?"
                    + (departureCities.isEmpty() ? "" : " Known departure cities: " + String.join(", ", departureCities) + ".")
                    + (arrivalCities.isEmpty() ? "" : " Known arrival cities: " + String.join(", ", arrivalCities) + ".")
                    + (routeExamples.isBlank() ? "" : " Example routes: " + routeExamples + ".")
                    + " You can also provide a budget (for example under 50 DT) and transport type (bus, taxi, train...).",
                "يمكنني مساعدتك في اختيار أفضل رحلة. من أي مدينة ستنطلق وإلى أي مدينة تريد الذهاب؟"
                    + (departureCities.isEmpty() ? "" : " مدن الانطلاق المتاحة: " + String.join(", ", departureCities) + ".")
                    + (arrivalCities.isEmpty() ? "" : " مدن الوصول المتاحة: " + String.join(", ", arrivalCities) + ".")
                    + (routeExamples.isBlank() ? "" : " أمثلة مسارات: " + routeExamples + ".")
                    + " ويمكنك أيضا تحديد الميزانية ونوع النقل.");
            return new IntentAnswer(answer, "TransportConversation=need-route-details", List.of("transport", "cities"), 0.92);
        }

        String lines = transports.stream()
            .limit(8)
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
        LocalDate requestedDate = extractRequestedDate(normalizedQuestion);
        boolean asksThisMonth = containsAny(normalizedQuestion,
            "ce mois", "du mois", "this month", "current month", "mois actuel", "هذا الشهر", "الشهر الحالي");
        boolean asksNextMonth = containsAny(normalizedQuestion,
            "mois prochain", "prochain mois", "next month", "following month", "الشهر القادم", "الشهر المقبل");
        boolean asksToday = containsAny(normalizedQuestion, "aujourd hui", "today", "اليوم");
        boolean asksTomorrow = containsAny(normalizedQuestion, "demain", "tomorrow", "غدا");
        boolean asksThisWeek = containsAny(normalizedQuestion, "cette semaine", "this week", "semaine actuelle", "هذا الاسبوع", "هذا الأسبوع");
        boolean asksWeekend = containsAny(normalizedQuestion, "weekend", "week end", "fin de semaine", "نهاية الاسبوع", "نهاية الأسبوع");

        boolean asksUpcoming = containsAny(normalizedQuestion, "a venir", "avenir", "upcoming", "coming", "prochains", "prochaines", "قادمة");
        boolean asksOngoing = containsAny(normalizedQuestion, "en cours", "ongoing", "live now", "maintenant", "الان", "الآن");
        boolean asksCompleted = containsAny(normalizedQuestion, "passe", "passes", "termines", "completed", "past", "historique", "archive", "منتهية", "سابقة");

        YearMonth requestedMonth = extractRequestedMonth(normalizedQuestion);
        boolean asksFree = containsAny(normalizedQuestion,
            "gratuit", "gratuits", "free", "sans frais", "مجاني", "مجانا");
        boolean asksPaid = containsAny(normalizedQuestion,
            "payant", "payants", "paid", "ticket", "tickets", "مدفوع", "تذاكر");
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        Double exactPrice = extractExactPrice(normalizedQuestion);
        boolean asksDetails = asksDetailsQuery(normalizedQuestion);

        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate tomorrow = today.plusDays(1);
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        LocalDate weekEnd = today.with(TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SUNDAY));
        LocalDate weekendStart = today.with(TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SATURDAY));
        LocalDate weekendEnd = today.with(TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SUNDAY));

        boolean hasExplicitStatusFilter = asksUpcoming || asksOngoing || asksCompleted;
        boolean hasExplicitTimeFilter = asksThisMonth || asksNextMonth || requestedMonth != null || requestedDate != null || asksToday || asksTomorrow || asksThisWeek || asksWeekend;

        List<Event> baseEvents = cityOpt.map(city -> eventRepository.findByCityCityId(city.getCityId()))
            .orElseGet(eventRepository::findAll);

        if (asksDetails) {
            Optional<Event> matched = findMentionedEvent(normalizedQuestion, baseEvents);
            if (matched.isPresent()) {
                Event event = matched.get();
                String details = event.getTitle()
                    + optionalText(event.getEventType(), " - ")
                    + optionalText(event.getCity() == null ? null : event.getCity().getName(), " - ")
                    + optionalText(event.getVenue(), " - ")
                    + optionalText(formatEventDate(event.getStartDate()), " - ")
                    + optionalText(event.getStatus(), " - ")
                    + optionalText(event.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", event.getPrice()), " - ");
                return new IntentAnswer(
                    t(language,
                        "Détails événement: " + details + ".",
                        "Event details: " + details + ".",
                        "تفاصيل الفعالية: " + details + "."),
                    "EventDetails=" + details,
                    List.of("events"),
                    0.95
                );
            }
        }

        int resultLimit = (asksCheapest(normalizedQuestion) || asksMostExpensive(normalizedQuestion)) ? 1 : 6;

        List<Event> events = baseEvents
            .stream()
            // By default, hide completed/past events unless user explicitly asks for historical/completed ones.
            .filter(event -> hasExplicitStatusFilter || hasExplicitTimeFilter || !isCompletedEvent(event.getStartDate(), event.getEndDate()))
            .filter(event -> !asksThisMonth || isInCurrentMonth(event.getStartDate(), event.getEndDate()))
            .filter(event -> !asksNextMonth || isInNextMonth(event.getStartDate(), event.getEndDate()))
            .filter(event -> requestedMonth == null || isInMonth(event.getStartDate(), event.getEndDate(), requestedMonth))
            .filter(event -> requestedDate == null || isOnDate(event.getStartDate(), event.getEndDate(), requestedDate))
            .filter(event -> !asksToday || isOnDate(event.getStartDate(), event.getEndDate(), today))
            .filter(event -> !asksTomorrow || isOnDate(event.getStartDate(), event.getEndDate(), tomorrow))
            .filter(event -> !asksThisWeek || intersectsRange(event.getStartDate(), event.getEndDate(), weekStart, weekEnd))
            .filter(event -> !asksWeekend || intersectsRange(event.getStartDate(), event.getEndDate(), weekendStart, weekendEnd))
            .filter(event -> !asksUpcoming || isUpcomingEvent(event.getStartDate(), event.getEndDate()))
            .filter(event -> !asksOngoing || isOngoingEvent(event.getStartDate(), event.getEndDate()))
            .filter(event -> !asksCompleted || isCompletedEvent(event.getStartDate(), event.getEndDate()))
            .filter(event -> !asksFree || event.getPrice() == null || event.getPrice() <= 0)
            .filter(event -> !asksPaid || (event.getPrice() != null && event.getPrice() > 0))
            .filter(event -> exactPrice == null || (event.getPrice() != null && Math.abs(event.getPrice() - exactPrice) <= 0.5))
            .filter(event -> event.getPrice() == null || maxPrice == null || event.getPrice() <= maxPrice)
            .filter(event -> event.getPrice() == null || minPrice == null || event.getPrice() >= minPrice)
            .filter(event -> matchesEventType(event, normalizedQuestion))
            .sorted(Comparator.comparing(Event::getStartDate, Comparator.nullsLast(Date::compareTo)))
            .limit(resultLimit)
            .toList();

        if (events.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    exactPrice != null
                        ? "Je n'ai trouvé aucun événement à " + String.format(Locale.ROOT, "%.0f DT", exactPrice) + "."
                        :
                    requestedMonth != null
                        ? "Je n'ai pas trouvé d'événements disponibles pour " + formatYearMonthLabel(requestedMonth, language) + "."
                        :
                    requestedDate != null
                        ? "Je suis désolé, je n'ai trouvé aucun événement disponible pour cette date."
                        :
                    asksThisMonth
                        ? "Je n'ai pas trouvé d'événements disponibles pour ce mois."
                        : asksNextMonth
                            ? "Je n'ai pas trouvé d'événements disponibles pour le mois prochain."
                            : asksToday
                                ? "Je n'ai pas trouvé d'événements disponibles aujourd'hui."
                                : asksTomorrow
                                    ? "Je n'ai pas trouvé d'événements disponibles pour demain."
                                    : asksThisWeek
                                        ? "Je n'ai pas trouvé d'événements disponibles cette semaine."
                                        : asksWeekend
                                            ? "Je n'ai pas trouvé d'événements disponibles ce weekend."
                                            : asksCompleted
                                                ? "Je n'ai pas trouvé d'événements terminés correspondant à votre demande."
                                                : asksOngoing
                                                    ? "Je n'ai pas trouvé d'événements en cours correspondant à votre demande."
                                            : "Je suis désolé, je n'ai pas encore d'événements disponibles dans l'application.",
                    exactPrice != null
                        ? "I could not find any event at " + String.format(Locale.ROOT, "%.0f DT", exactPrice) + "."
                        :
                    requestedMonth != null
                        ? "I could not find available events for " + formatYearMonthLabel(requestedMonth, language) + "."
                        :
                    requestedDate != null
                        ? "I am sorry, I could not find any available event for that date."
                        :
                    asksThisMonth
                        ? "I could not find available events for this month."
                        : asksNextMonth
                            ? "I could not find available events for next month."
                            : asksToday
                                ? "I could not find available events for today."
                                : asksTomorrow
                                    ? "I could not find available events for tomorrow."
                                    : asksThisWeek
                                        ? "I could not find available events for this week."
                                        : asksWeekend
                                            ? "I could not find available events for this weekend."
                                            : asksCompleted
                                                ? "I could not find completed events matching your request."
                                                : asksOngoing
                                                    ? "I could not find ongoing events matching your request."
                                            : "I am sorry, I do not have events available in the app yet.",
                    exactPrice != null
                        ? "لم أجد أي فعالية بسعر " + String.format(Locale.ROOT, "%.0f DT", exactPrice) + "."
                        :
                    requestedMonth != null
                        ? "لم أجد فعاليات متاحة في هذا الشهر المحدد."
                        :
                    requestedDate != null
                        ? "عذرا، لم أجد أي فعالية متاحة لهذا التاريخ."
                        :
                    asksThisMonth
                        ? "لم أجد فعاليات متاحة لهذا الشهر."
                        : asksNextMonth
                            ? "لم أجد فعاليات متاحة للشهر القادم."
                            : "عذرا، لا توجد فعاليات متاحة حاليا في التطبيق."),
                "No events.",
                List.of("events"),
                0.78
            );
        }

        String lines = events.stream()
            .map(event -> {
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
                        + priceLabel;
            })
            .collect(Collectors.joining("; "));

        return new IntentAnswer(
            t(language,
                requestedMonth != null
                    ? "Événements disponibles pour " + formatYearMonthLabel(requestedMonth, language) + ": " + lines + "."
                    :
                requestedDate != null
                    ? "Événements disponibles pour la date demandée: " + lines + "."
                    :
                asksThisMonth
                    ? "Événements disponibles ce mois: " + lines + "."
                    : asksNextMonth
                        ? "Événements disponibles le mois prochain: " + lines + "."
                    : asksToday
                        ? "Événements disponibles aujourd'hui: " + lines + "."
                        : asksTomorrow
                            ? "Événements disponibles pour demain: " + lines + "."
                            : asksThisWeek
                                ? "Événements disponibles cette semaine: " + lines + "."
                                : asksWeekend
                                    ? "Événements disponibles ce weekend: " + lines + "."
                                    : asksOngoing
                                        ? "Événements en cours: " + lines + "."
                                        : asksCompleted
                                            ? "Événements terminés: " + lines + "."
                    : "Événements disponibles: " + lines + ".",
                requestedMonth != null
                    ? "Available events for " + formatYearMonthLabel(requestedMonth, language) + ": " + lines + "."
                    :
                requestedDate != null
                    ? "Available events for the requested date: " + lines + "."
                    :
                asksThisMonth
                    ? "Available events this month: " + lines + "."
                    : asksNextMonth
                        ? "Available events next month: " + lines + "."
                    : asksToday
                        ? "Available events today: " + lines + "."
                        : asksTomorrow
                            ? "Available events tomorrow: " + lines + "."
                            : asksThisWeek
                                ? "Available events this week: " + lines + "."
                                : asksWeekend
                                    ? "Available events this weekend: " + lines + "."
                                    : asksOngoing
                                        ? "Ongoing events: " + lines + "."
                                        : asksCompleted
                                            ? "Completed events: " + lines + "."
                    : "Available events: " + lines + ".",
                requestedMonth != null
                    ? "الفعاليات المتاحة للشهر المحدد: " + lines + "."
                    :
                requestedDate != null
                    ? "الفعاليات المتاحة للتاريخ المطلوب: " + lines + "."
                    :
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

        if (containsAny(normalizedQuestion, "combien", "how much", "prix", "price", "ou", "where")) {
            Optional<Product> matched = productRepository.findAllPublished().stream()
                .filter(product -> product.getName() != null && !product.getName().isBlank())
                .filter(product -> containsToken(normalizedQuestion, normalize(product.getName())))
                .findFirst();

            if (matched.isPresent()) {
                Product product = matched.get();
                String price = product.getPrice() == null ? t(language, "prix non disponible", "price not available", "السعر غير متوفر") : String.format(Locale.ROOT, "%.0f DT", product.getPrice());
                String sellerCity = "";
                try {
                    if (product.getUser() != null && product.getUser().getCity() != null && product.getUser().getCity().getName() != null) {
                        sellerCity = product.getUser().getCity().getName();
                    }
                } catch (Exception ignored) {
                    sellerCity = "";
                }

                String answer = containsAny(normalizedQuestion, "ou", "where")
                    ? t(language,
                        product.getName() + " est proposé" + (sellerCity.isBlank() ? "" : " à " + sellerCity) + ".",
                        product.getName() + " is offered" + (sellerCity.isBlank() ? "" : " in " + sellerCity) + ".",
                        product.getName() + " متوفر" + (sellerCity.isBlank() ? "" : " في " + sellerCity) + ".")
                    : t(language,
                        "Le prix de " + product.getName() + " est " + price + ".",
                        "The price of " + product.getName() + " is " + price + ".",
                        "سعر " + product.getName() + " هو " + price + ".");

                return new IntentAnswer(answer, "Product=" + product.getName() + "; Price=" + price + "; City=" + sellerCity, List.of("products"), 0.93);
            }
        }

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
        boolean asksDesert = containsAny(normalizedQuestion, "desert", "dessert", "sahara");
        boolean asksMountain = containsAny(normalizedQuestion, "montagne", "mountain", "montagneuse");
        if (asksDesert || asksMountain) {
            List<City> desertCities = allCities.stream().filter(this::looksDesertCity).limit(10).toList();
            List<City> mountainCities = allCities.stream().filter(this::looksMountainCity).limit(10).toList();

            String desertList = desertCities.stream().map(City::getName).collect(Collectors.joining(", "));
            String mountainList = mountainCities.stream().map(City::getName).collect(Collectors.joining(", "));

            if (asksDesert && !asksMountain) {
                return new IntentAnswer(
                    t(language,
                        "Villes tunisiennes désertiques: " + (desertList.isBlank() ? "Tozeur, Kebili, Tataouine" : desertList) + ".",
                        "Tunisian desert cities: " + (desertList.isBlank() ? "Tozeur, Kebili, Tataouine" : desertList) + ".",
                        "مدن تونسية صحراوية: " + (desertList.isBlank() ? "توزر، قبلي، تطاوين" : desertList) + "."),
                    "DesertCities=" + desertList,
                    List.of("cities"),
                    0.91
                );
            }

            if (asksMountain && !asksDesert) {
                return new IntentAnswer(
                    t(language,
                        "Villes/regions tunisiennes montagneuses: " + (mountainList.isBlank() ? "Kasserine, Zaghouan, Jendouba, Le Kef" : mountainList) + ".",
                        "Tunisian mountain cities/areas: " + (mountainList.isBlank() ? "Kasserine, Zaghouan, Jendouba, Le Kef" : mountainList) + ".",
                        "مدن/مناطق تونسية جبلية: " + (mountainList.isBlank() ? "القصرين، زغوان، جندوبة، الكاف" : mountainList) + "."),
                    "MountainCities=" + mountainList,
                    List.of("cities"),
                    0.91
                );
            }

            return new IntentAnswer(
                t(language,
                    "Villes désertiques: " + (desertList.isBlank() ? "Tozeur, Kebili, Tataouine" : desertList)
                        + ". Villes montagneuses: " + (mountainList.isBlank() ? "Kasserine, Zaghouan, Jendouba, Le Kef" : mountainList) + ".",
                    "Desert cities: " + (desertList.isBlank() ? "Tozeur, Kebili, Tataouine" : desertList)
                        + ". Mountain cities: " + (mountainList.isBlank() ? "Kasserine, Zaghouan, Jendouba, Le Kef" : mountainList) + ".",
                    "مدن صحراوية: " + (desertList.isBlank() ? "توزر، قبلي، تطاوين" : desertList)
                        + ". مدن جبلية: " + (mountainList.isBlank() ? "القصرين، زغوان، جندوبة، الكاف" : mountainList) + "."),
                "DesertCities=" + desertList + "; MountainCities=" + mountainList,
                List.of("cities"),
                0.9
            );
        }

        if (containsAny(normalizedQuestion, "cap bon", "capbon")) {
            return new IntentAnswer(
                t(language,
                    "Le Cap Bon correspond principalement à la région de Nabeul (avec Hammamet, Korba, Kelibia...).",
                    "Cap Bon mainly refers to the Nabeul region (including Hammamet, Korba, Kelibia...).",
                    "منطقة الوطن القبلي (Cap Bon) ترتبط أساسا بولاية نابل (الحمامات، قربص، قليبية...)."),
                "CapBon=Nabeul",
                List.of("cities"),
                0.95
            );
        }

        if (containsAny(normalizedQuestion, "ville culturelle", "villes culturelles", "cultural city", "cultural cities", "historique", "historical city")) {
            List<City> culturalCities = allCities.stream()
                .filter(this::looksCulturalCity)
                .limit(10)
                .toList();

            String cityNames = culturalCities.stream().map(City::getName).collect(Collectors.joining(", "));
            return new IntentAnswer(
                t(language,
                    "Villes tunisiennes culturelles/historiques: " + (cityNames.isBlank() ? "Tunis, Kairouan, Sousse, Sfax, Nabeul" : cityNames) + ".",
                    "Tunisian cultural/historical cities: " + (cityNames.isBlank() ? "Tunis, Kairouan, Sousse, Sfax, Nabeul" : cityNames) + ".",
                    "مدن تونسية ثقافية/تاريخية: " + (cityNames.isBlank() ? "تونس، القيروان، سوسة، صفاقس، نابل" : cityNames) + "."),
                "CulturalCities=" + cityNames,
                List.of("cities"),
                0.9
            );
        }

        if (containsAny(normalizedQuestion, "plage", "beach", "sahel", "cote", "coast", "mer", "littoral")) {
            List<City> coastalCities = allCities.stream()
                .filter(this::looksCoastalCity)
                .limit(10)
                .toList();

            if (coastalCities.isEmpty()) {
                return new IntentAnswer(
                    t(language,
                        "Je n'ai pas trouvé de ville côtière dans les données actuelles.",
                        "I could not find coastal cities in the current data.",
                        "لم أجد مدنا ساحلية في البيانات الحالية."),
                    "CoastalCities=none",
                    List.of("cities"),
                    0.78
                );
            }

            String cityNames = coastalCities.stream().map(City::getName).collect(Collectors.joining(", "));
            return new IntentAnswer(
                t(language,
                    "Villes tunisiennes avec plage/côte: " + cityNames + ".",
                    "Tunisian beach/coastal cities: " + cityNames + ".",
                    "مدن تونسية ساحلية: " + cityNames + "."),
                "CoastalCities=" + cityNames,
                List.of("cities"),
                0.9
            );
        }

        if (containsAny(normalizedQuestion,
            "nom des villes", "noms des villes", "villes tunisiennes", "toutes les villes", "all cities", "city names")) {
            String cityNames = allCities.stream()
                .map(City::getName)
                .filter(name -> name != null && !name.isBlank())
                .sorted(String::compareToIgnoreCase)
                .collect(Collectors.joining(", "));
            return new IntentAnswer(
                t(language,
                    "Liste des villes tunisiennes: " + cityNames + ".",
                    "List of Tunisian cities: " + cityNames + ".",
                    "قائمة المدن التونسية: " + cityNames + "."),
                "CitiesList=" + cityNames,
                List.of("cities"),
                0.95
            );
        }

        if (containsAny(normalizedQuestion,
            "propose moi une ville", "propose une ville", "ville tunisienne", "ville en tunisie", "suggest a city", "recommend city", "city in tunisia")) {
            String cityNames = allCities.stream()
                .map(City::getName)
                .filter(name -> name != null && !name.isBlank())
                .sorted(String::compareToIgnoreCase)
                .limit(8)
                .collect(Collectors.joining(", "));
            return new IntentAnswer(
                t(language,
                    "Voici des villes tunisiennes que je vous propose: " + cityNames + ".",
                    "Here are Tunisian cities I suggest: " + cityNames + ".",
                    "هذه مدن تونسية أقترحها عليك: " + cityNames + "."),
                "CitySuggestions=" + cityNames,
                List.of("cities"),
                0.93
            );
        }

        if (mentionedCity.isPresent() && (containsAny(normalizedQuestion,
            "info", "information", "description", "destination", "about", "a propos", "propos", "present", "presentation", "details")
            || isCityOnlyQuestion(normalizedQuestion, mentionedCity.get()))) {
            City city = mentionedCity.get();
            List<Restaurant> cityRestaurants = restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(city.getCityId());
            List<Activity> cityActivities = activityRepository.findByCityCityIdOrderByActivityIdDesc(city.getCityId());

            String restaurantsSummary = cityRestaurants.stream()
                .map(Restaurant::getName)
                .filter(name -> name != null && !name.isBlank())
                .limit(5)
                .collect(Collectors.joining(", "));
            String activitiesSummary = cityActivities.stream()
                .map(Activity::getName)
                .filter(name -> name != null && !name.isBlank())
                .limit(5)
                .collect(Collectors.joining(", "));

            String destinationInfo = city.getName()
                + optionalText(city.getRegion(), " - ")
                + optionalText(city.getDescription(), " - ")
                + (city.getHasAirport() != null && city.getHasAirport() ? " - airport" : "")
                + (city.getHasTrainStation() != null && city.getHasTrainStation() ? " - train" : "")
                + (city.getHasBusStation() != null && city.getHasBusStation() ? " - bus" : "")
                + (city.getHasPort() != null && city.getHasPort() ? " - port" : "");

            String cityBundle = t(language,
                "Informations sur " + city.getName() + ": " + destinationInfo
                    + ". Restaurants: " + (restaurantsSummary.isBlank() ? "pas encore disponibles" : restaurantsSummary)
                    + ". Activités: " + (activitiesSummary.isBlank() ? "pas encore disponibles" : activitiesSummary) + ".",
                "Information about " + city.getName() + ": " + destinationInfo
                    + ". Restaurants: " + (restaurantsSummary.isBlank() ? "not available yet" : restaurantsSummary)
                    + ". Activities: " + (activitiesSummary.isBlank() ? "not available yet" : activitiesSummary) + ".",
                "معلومات عن " + city.getName() + ": " + destinationInfo
                    + ". المطاعم: " + (restaurantsSummary.isBlank() ? "غير متوفرة حاليا" : restaurantsSummary)
                    + ". الأنشطة: " + (activitiesSummary.isBlank() ? "غير متوفرة حاليا" : activitiesSummary) + ".");

            return new IntentAnswer(
                cityBundle,
                "Destination=" + destinationInfo + "; Restaurants=" + restaurantsSummary + "; Activities=" + activitiesSummary,
                List.of("cities", "restaurants", "activities"),
                0.92
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
        if (isSmallTalkOrPoliteness(normalizedQuestion)) {
            return true;
        }
        List<String> keywords = Arrays.asList(
            "tunisia", "tunisie", "tunisian", "tunisienne", "tunisien", "city", "cities", "ville", "villes", "destination", "governorate",
            "restaurant", "restaurants", "cuisine", "food", "activity", "activities", "visit",
            "hotel", "hotels", "accommodation", "accommodations", "accomodation", "accomodations", "stay", "stays",
            "guesthouse", "guesthouses", "maison d hote", "maison d hotes", "hebergement", "hebergements",
            "transport", "transports", "bus", "train", "taxi", "route", "trajet", "trajets", "voyage", "travel", "trip", "departure", "destination",
            "event", "events", "evenement", "evenements", "enennement", "enennements", "festival", "festivals",
            "artisanat", "artisan", "artisans", "product", "products", "produit", "produits",
            "reservation", "reservations", "booking", "bookings", "cart", "order", "orders", "combien", "price", "prix", "cost", "ou", "where",
            "plage", "beach", "sahel", "coast", "medina", "voyage", "tourisme", "trip", "app", "application", "login", "compte",
            "نقل", "سكن", "مطعم", "نشاط", "فعالية", "منتج", "حرف", "تطبيق"
        );
        for (String keyword : keywords) {
            if (containsToken(normalizedQuestion, normalize(keyword))) {
                return true;
            }
        }
        return findMentionedCity(normalizedQuestion, cities).isPresent();
    }

    private boolean isSmallTalkOrPoliteness(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "hello", "hi", "hey", "good morning", "good evening", "thanks", "thank you", "please", "can i ask", "ask question", "i can ask you a question",
            "bonjour", "bonsoir", "salut", "merci", "s il vous plait", "stp", "je veux poser", "je peux poser", "poser des questions", "posez des questions",
            "السلام", "مرحبا", "شكرا", "من فضلك");
    }

    private boolean asksPriceQuestionWithoutDomain(String normalizedQuestion) {
        return containsAny(normalizedQuestion, "combien", "how much", "prix", "price")
            && !containsAny(normalizedQuestion, "restaurant", "activity", "activite", "transport", "event", "evenement", "hebergement", "hotel");
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
        // Avoid fuzzy collisions for very short tokens like "hi" vs "i".
        if (word.length() <= 2 || token.length() <= 2) {
            return word.equals(token);
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

    private boolean isLowSignalQuestion(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return true;
        }

        if (normalizedQuestion.length() <= 12) {
            return true;
        }

        return !containsAny(normalizedQuestion,
            "restaurant", "activity", "accommodation", "hebergement", "hotel", "transport", "event", "evenement", "product", "artisan", "city", "ville", "destination"
        );
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

    private boolean asksBestKeyword(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return false;
        }
        if (containsExactWord(normalizedQuestion, "best")
            || containsExactWord(normalizedQuestion, "top")
            || containsExactWord(normalizedQuestion, "highest")) {
            return true;
        }
        return containsAny(normalizedQuestion, "meilleur", "meilleure", "mieux", "افضل");
    }

    private boolean asksTransportMeansOnly(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "moyens de transport", "means of transport", "transport means", "types de transport", "transport types", "les transports disponibles");
    }

    private IntentAnswer answerTransportTypesOnly(Language language) {
        Set<String> types = transportRepository.findAll().stream()
            .filter(transport -> transport.getType() != null)
            .map(transport -> transport.getType().name())
            .collect(Collectors.toCollection(TreeSet::new));

        if (types.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Aucun type de transport n'est disponible pour le moment.",
                    "No transport type is available right now.",
                    "لا توجد أنواع نقل متاحة حاليا."),
                "TransportTypes=none",
                List.of("transport"),
                0.7
            );
        }

        String list = String.join(", ", types);
        return new IntentAnswer(
            t(language,
                "Moyens de transport disponibles: " + list + ".",
                "Available transport means: " + list + ".",
                "وسائل النقل المتاحة: " + list + "."),
            "TransportTypes=" + list,
            List.of("transport"),
            0.94
        );
    }

    private boolean asksLowestRated(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "moins note", "worst", "lowest rated", "اقل تقييم");
    }

    private Double extractMaxPrice(String normalizedQuestion) {
        List<Double> values = extractAllNumbers(normalizedQuestion);
        if (containsAny(normalizedQuestion, "entre", "between") && values.size() >= 2) {
            return Math.max(values.get(0), values.get(1));
        }
        if (!containsAny(normalizedQuestion,
            "moins de", "max", "maximum", "under", "below", "<", "ne depasse pas", "depasse pas", "au plus", "at most", "no more than")) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractMinPrice(String normalizedQuestion) {
        List<Double> values = extractAllNumbers(normalizedQuestion);
        if (containsAny(normalizedQuestion, "entre", "between") && values.size() >= 2) {
            return Math.min(values.get(0), values.get(1));
        }
        if (!containsAny(normalizedQuestion,
            "plus de", "min", "minimum", "above", "over", ">", "au moins", "at least", "not less than")) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractExactPrice(String normalizedQuestion) {
        if (containsAny(normalizedQuestion, "entre", "between", "plus de", "moins de", "minimum", "maximum", "above", "below", "under", "over", "<", ">")) {
            return null;
        }

        boolean explicitExact = containsAny(normalizedQuestion, "exact", "exactement", "exactly")
            || normalizedQuestion.matches(".*\\b(a|a|for|at)\\s*\\d+(?:[.,]\\d+)?\\b.*")
            || normalizedQuestion.matches(".*\\b=\\s*\\d+(?:[.,]\\d+)?\\b.*");

        if (!explicitExact) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractMinStars(String normalizedQuestion) {
        if (!containsAny(normalizedQuestion, "etoile", "etoiles", "star", "stars", "rating", "notation", "note")) {
            return null;
        }
        if (!containsAny(normalizedQuestion, "superieur", "supeieur", "supereur", "sup", "plus de", "above", ">")) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractMaxStars(String normalizedQuestion) {
        if (!containsAny(normalizedQuestion, "etoile", "etoiles", "star", "stars", "rating", "notation", "note")) {
            return null;
        }
        if (!containsAny(normalizedQuestion, "inferieur", "moins de", "below", "under", "<")) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractFirstNumber(String normalizedQuestion) {
        List<Double> values = extractAllNumbers(normalizedQuestion);
        return values.isEmpty() ? null : values.get(0);
    }

    private boolean asksAllResults(String normalizedQuestion) {
        return containsAny(normalizedQuestion, "tous", "toutes", "all", "toute");
    }

    private LocalDate extractRequestedDate(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return null;
        }

        Matcher numericDateMatcher = Pattern.compile("\\b(\\d{1,2})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?\\b").matcher(normalizedQuestion);
        if (numericDateMatcher.find()) {
            int day = Integer.parseInt(numericDateMatcher.group(1));
            int month = Integer.parseInt(numericDateMatcher.group(2));
            String yearGroup = numericDateMatcher.group(3);
            Integer year = yearGroup == null ? null : Integer.parseInt(yearGroup);
            LocalDate numericDate = safeBuildDate(day, month, year);
            if (numericDate != null) {
                return numericDate;
            }
        }

        Map<String, Integer> months = Map.ofEntries(
            Map.entry("janvier", 1), Map.entry("january", 1),
            Map.entry("fevrier", 2), Map.entry("february", 2),
            Map.entry("mars", 3), Map.entry("march", 3),
            Map.entry("avril", 4), Map.entry("april", 4),
            Map.entry("mai", 5), Map.entry("may", 5),
            Map.entry("juin", 6), Map.entry("june", 6),
            Map.entry("juillet", 7), Map.entry("july", 7),
            Map.entry("aout", 8), Map.entry("august", 8),
            Map.entry("septembre", 9), Map.entry("september", 9),
            Map.entry("octobre", 10), Map.entry("october", 10),
            Map.entry("novembre", 11), Map.entry("november", 11),
            Map.entry("decembre", 12), Map.entry("december", 12)
        );

        String[] parts = normalizedQuestion.split(" ");
        Integer day = null;
        Integer month = null;
        Integer year = null;

        for (int i = 0; i < parts.length; i++) {
            String p = parts[i];
            if (p.matches("\\d{1,2}")) {
                int d = Integer.parseInt(p);
                if (d >= 1 && d <= 31) {
                    day = d;
                    if (i + 1 < parts.length && months.containsKey(parts[i + 1])) {
                        month = months.get(parts[i + 1]);
                        if (i + 2 < parts.length && parts[i + 2].matches("\\d{4}")) {
                            year = Integer.parseInt(parts[i + 2]);
                        }
                        break;
                    }
                }
            }
        }

        if (day == null || month == null) {
            return null;
        }

        return safeBuildDate(day, month, year);
    }

    private LocalDate safeBuildDate(int day, int month, Integer year) {
        int resolvedYear = year != null ? year : LocalDate.now().getYear();
        try {
            LocalDate date = LocalDate.of(resolvedYear, month, day);
            if (year == null && date.isBefore(LocalDate.now())) {
                return date.plusYears(1);
            }
            return date;
        } catch (Exception ignored) {
            return null;
        }
    }

    private int extractRequestedParticipants(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return 1;
        }

        Matcher m = Pattern.compile("\\b(\\d{1,3})\\s*(personne|personnes|pers|participant|participants|pax|adult|adults)\\b").matcher(normalizedQuestion);
        if (m.find()) {
            try {
                int value = Integer.parseInt(m.group(1));
                return value > 0 ? value : 1;
            } catch (NumberFormatException ignored) {
                return 1;
            }
        }
        return 1;
    }

    private YearMonth extractRequestedActivityMonth(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return null;
        }

        if (containsAny(normalizedQuestion, "ce mois", "ce moins", "this month", "mois actuel")) {
            return YearMonth.now();
        }
        if (containsAny(normalizedQuestion, "mois prochain", "prochain mois", "next month", "moins prochain")) {
            return YearMonth.now().plusMonths(1);
        }

        YearMonth m = extractRequestedMonth(normalizedQuestion);
        return m;
    }

    private Optional<Activity> findActivityByKeyword(String normalizedQuestion, List<Activity> activities) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || activities == null || activities.isEmpty()) {
            return Optional.empty();
        }
        for (Activity activity : activities) {
            if (activity.getName() == null || activity.getName().isBlank()) {
                continue;
            }
            String n = normalize(activity.getName());
            if (containsToken(normalizedQuestion, n)) {
                return Optional.of(activity);
            }
            String[] words = n.split(" ");
            for (String w : words) {
                if (w.length() >= 4 && containsExactWord(normalizedQuestion, w)) {
                    return Optional.of(activity);
                }
            }
        }
        return Optional.empty();
    }

    private boolean isActivityAvailableForFilter(Activity activity, LocalDate requestedDate, YearMonth requestedMonth, int requestedParticipants) {
        if (requestedDate != null) {
            return isActivityAvailableForRequestedDate(activity, requestedDate, requestedParticipants);
        }
        if (requestedMonth != null) {
            return isActivityAvailableInMonth(activity, requestedMonth, requestedParticipants);
        }
        return true;
    }

    private boolean isActivityAvailableInMonth(Activity activity, YearMonth month, int requestedParticipants) {
        if (activity == null || month == null) {
            return false;
        }

        LocalDate now = LocalDate.now();
        LocalDate monthStart = month.atDay(1);
        LocalDate monthEnd = month.atEndOfMonth();
        LocalDate startDate = activity.getMaxParticipantsStartDate() != null
            ? activity.getMaxParticipantsStartDate()
            : now;

        LocalDate from = monthStart.isBefore(now) ? now : monthStart;
        if (from.isBefore(startDate)) {
            from = startDate;
        }
        if (from.isAfter(monthEnd)) {
            return false;
        }

        int neededParticipants = Math.max(1, requestedParticipants);

        Integer maxPerDay = activity.getMaxParticipantsPerDay();
        if (maxPerDay == null || maxPerDay <= 0) {
            return true;
        }

        for (LocalDate day = from; !day.isAfter(monthEnd); day = day.plusDays(1)) {
            Date dayStart = Date.from(day.atStartOfDay().toInstant(ZoneOffset.UTC));
            Date dayEnd = Date.from(day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
            Integer reserved = activityReservationRepository.sumPeopleForActivityAndDate(
                activity.getActivityId(),
                dayStart,
                dayEnd,
                List.of(ReservationStatus.PENDING, ReservationStatus.CONFIRMED)
            );
            int used = reserved == null ? 0 : reserved;
            if (used + neededParticipants <= maxPerDay) {
                return true;
            }
        }
        return false;
    }

    private boolean isActivityAvailableForRequestedDate(Activity activity, LocalDate requestedDate, int requestedParticipants) {
        if (requestedDate == null) {
            return true;
        }
        if (activity == null || activity.getActivityId() == null) {
            return false;
        }
        if (requestedDate.isBefore(LocalDate.now())) {
            return false;
        }

        LocalDate startDate = activity.getMaxParticipantsStartDate() != null
            ? activity.getMaxParticipantsStartDate()
            : LocalDate.now();
        if (requestedDate.isBefore(startDate)) {
            return false;
        }

        int neededParticipants = Math.max(1, requestedParticipants);

        Integer maxPerDay = activity.getMaxParticipantsPerDay();
        if (maxPerDay == null || maxPerDay <= 0) {
            return true;
        }

        Date dayStart = Date.from(requestedDate.atStartOfDay().toInstant(ZoneOffset.UTC));
        Date dayEnd = Date.from(requestedDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
        Integer reserved = activityReservationRepository.sumPeopleForActivityAndDate(
            activity.getActivityId(),
            dayStart,
            dayEnd,
            List.of(ReservationStatus.PENDING, ReservationStatus.CONFIRMED)
        );
        int used = reserved == null ? 0 : reserved;
        return used + neededParticipants <= maxPerDay;
    }

    private List<Double> extractAllNumbers(String normalizedQuestion) {
        Matcher matcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)").matcher(normalizedQuestion);
        List<Double> values = new java.util.ArrayList<>();
        while (matcher.find()) {
            String raw = matcher.group(1).replace(',', '.');
            try {
                values.add(Double.parseDouble(raw));
            } catch (NumberFormatException ignored) {
                // continue
            }
        }
        return values;
    }

    private Comparator<Restaurant> restaurantComparator(String normalizedQuestion, Map<Integer, Double> avgRatingByRestaurant) {
        if (asksLowestRated(normalizedQuestion)) {
            return Comparator.comparing(r -> avgRatingByRestaurant.getOrDefault(r.getRestaurantId(), 0.0));
        }
        return Comparator.comparing((Restaurant r) -> avgRatingByRestaurant.getOrDefault(r.getRestaurantId(), 0.0)).reversed();
    }

    private Map<Integer, Double> buildRestaurantAverageRatingMap() {
        return restaurantReviewRepository.findAll().stream()
            .filter(review -> review.getRestaurant() != null && review.getRestaurant().getRestaurantId() != null)
            .filter(review -> review.getStars() != null)
            .collect(Collectors.groupingBy(
                review -> review.getRestaurant().getRestaurantId(),
                HashMap::new,
                Collectors.averagingInt(review -> review.getStars())
            ));
    }

    private Map<Integer, Long> buildRestaurantReviewCountMap() {
        return restaurantReviewRepository.findAll().stream()
            .filter(review -> review.getRestaurant() != null && review.getRestaurant().getRestaurantId() != null)
            .filter(review -> review.getStars() != null)
            .collect(Collectors.groupingBy(
                review -> review.getRestaurant().getRestaurantId(),
                HashMap::new,
                Collectors.counting()
            ));
    }

    private String formatRestaurantRatingText(Integer restaurantId, Map<Integer, Double> avgRatingByRestaurant, Map<Integer, Long> reviewCountByRestaurant) {
        if (restaurantId == null) {
            return "";
        }
        long reviewCount = reviewCountByRestaurant.getOrDefault(restaurantId, 0L);
        if (reviewCount <= 0) {
            return "";
        }
        double avg = avgRatingByRestaurant.getOrDefault(restaurantId, 0.0);
        return String.format(Locale.ROOT, "%.1f/5 (%d reviews)", avg, reviewCount);
    }

    private Comparator<Activity> activityComparator(String normalizedQuestion, Map<Integer, Double> avgRatingByActivity) {
        if (asksTopRated(normalizedQuestion)) {
            return Comparator.comparing((Activity a) -> avgRatingByActivity.getOrDefault(a.getActivityId(), 0.0)).reversed();
        }
        if (asksLowestRated(normalizedQuestion)) {
            return Comparator.comparing(a -> avgRatingByActivity.getOrDefault(a.getActivityId(), 0.0));
        }
        if (asksMostExpensive(normalizedQuestion)) {
            return Comparator.comparing(Activity::getPrice, Comparator.nullsLast(Double::compareTo)).reversed();
        }
        if (asksCheapest(normalizedQuestion)) {
            return Comparator.comparing(Activity::getPrice, Comparator.nullsLast(Double::compareTo));
        }
        return Comparator.comparing(Activity::getActivityId, Comparator.nullsLast(Integer::compareTo)).reversed();
    }

    private Map<Integer, Double> buildActivityAverageRatingMap() {
        return activityReviewRepository.findAll().stream()
            .filter(review -> review.getActivity() != null && review.getActivity().getActivityId() != null)
            .filter(review -> review.getStars() != null)
            .collect(Collectors.groupingBy(
                review -> review.getActivity().getActivityId(),
                HashMap::new,
                Collectors.averagingInt(review -> review.getStars())
            ));
    }

    private Map<Integer, Long> buildActivityReviewCountMap() {
        return activityReviewRepository.findAll().stream()
            .filter(review -> review.getActivity() != null && review.getActivity().getActivityId() != null)
            .filter(review -> review.getStars() != null)
            .collect(Collectors.groupingBy(
                review -> review.getActivity().getActivityId(),
                HashMap::new,
                Collectors.counting()
            ));
    }

    private String formatActivityRatingText(Integer activityId, Map<Integer, Double> avgRatingByActivity, Map<Integer, Long> reviewCountByActivity) {
        if (activityId == null) {
            return "";
        }
        long reviewCount = reviewCountByActivity.getOrDefault(activityId, 0L);
        if (reviewCount <= 0) {
            return "";
        }
        double avg = avgRatingByActivity.getOrDefault(activityId, 0.0);
        return String.format(Locale.ROOT, "%.1f/5 (%d reviews)", avg, reviewCount);
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
        String normalizedCuisine = normalizeCuisineValue(restaurant.getCuisineType());
        String requestedCuisine = extractCuisinePreference(normalizedQuestion);

        if (requestedCuisine != null && !requestedCuisine.isBlank()) {
            return containsToken(normalizedCuisine, requestedCuisine)
                || containsToken(requestedCuisine, normalizedCuisine)
                || normalizedCuisine.contains(requestedCuisine)
                || requestedCuisine.contains(normalizedCuisine);
        }

        if (!containsAny(normalizedQuestion, "cuisine", "food", "restaurant", "resto", "مطعم")) {
            return true;
        }
        if (!containsAny(normalizedQuestion,
            "italien", "tunisien", "seafood", "fast", "oriental", "grill", "cafe",
            "japanese", "japonais", "japonaise", "italian", "tunisian", "mediterranean", "mediterraneen", "mediterraneenne")) {
            return true;
        }
        return containsToken(normalizedQuestion, normalizedCuisine)
            || containsToken(normalizedCuisine, normalizedQuestion);
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
        String requestedType = extractEventTypePreference(normalizedQuestion);
        if (requestedType != null && !requestedType.isBlank()) {
            String eventType = normalize(event.getEventType());
            return containsToken(eventType, requestedType)
                || containsToken(requestedType, eventType)
                || eventType.contains(requestedType)
                || requestedType.contains(eventType);
        }

        if (!containsAny(normalizedQuestion,
            "type", "festival", "concert", "conference", "workshop", "exhibition", "manifestation",
            "music", "musique", "sport", "culture", "art", "cinema", "theatre", "show")) {
            return true;
        }
        String normalizedEventType = normalize(event.getEventType());
        return containsToken(normalizedQuestion, normalizedEventType)
            || containsToken(normalizedEventType, normalizedQuestion);
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

    private YearMonth extractRequestedMonth(String normalizedQuestion) {
        YearMonth now = YearMonth.now();
        Map<String, Integer> months = Map.ofEntries(
            Map.entry("janvier", 1), Map.entry("january", 1),
            Map.entry("fevrier", 2), Map.entry("february", 2),
            Map.entry("mars", 3), Map.entry("march", 3),
            Map.entry("avril", 4), Map.entry("april", 4),
            Map.entry("mai", 5), Map.entry("may", 5),
            Map.entry("juin", 6), Map.entry("june", 6),
            Map.entry("juillet", 7), Map.entry("july", 7),
            Map.entry("aout", 8), Map.entry("august", 8),
            Map.entry("septembre", 9), Map.entry("september", 9),
            Map.entry("octobre", 10), Map.entry("october", 10),
            Map.entry("novembre", 11), Map.entry("november", 11),
            Map.entry("decembre", 12), Map.entry("december", 12)
        );

        for (Map.Entry<String, Integer> entry : months.entrySet()) {
            if (containsExactWord(normalizedQuestion, entry.getKey())) {
                int year = now.getYear();
                if (entry.getValue() < now.getMonthValue()) {
                    year += 1;
                }
                return YearMonth.of(year, entry.getValue());
            }
        }
        return null;
    }

    private boolean containsExactWord(String haystack, String word) {
        if (haystack == null || word == null || haystack.isBlank() || word.isBlank()) {
            return false;
        }
        String normalizedWord = normalize(word);
        for (String part : haystack.split(" ")) {
            if (part.equals(normalizedWord)) {
                return true;
            }
        }
        return false;
    }

    private boolean isInMonth(Date startDate, Date endDate, YearMonth month) {
        LocalDate start = toLocalDate(startDate);
        LocalDate end = endDate == null ? start : toLocalDate(endDate);
        if (start == null && end == null) {
            return false;
        }
        if (start == null) {
            return YearMonth.from(end).equals(month);
        }
        if (end == null) {
            return YearMonth.from(start).equals(month);
        }
        LocalDate firstDay = month.atDay(1);
        LocalDate lastDay = month.atEndOfMonth();
        return !end.isBefore(firstDay) && !start.isAfter(lastDay);
    }

    private boolean isOnDate(Date startDate, Date endDate, LocalDate targetDate) {
        if (targetDate == null) {
            return false;
        }
        return intersectsRange(startDate, endDate, targetDate, targetDate);
    }

    private boolean intersectsRange(Date startDate, Date endDate, LocalDate rangeStart, LocalDate rangeEnd) {
        LocalDate start = toLocalDate(startDate);
        LocalDate end = endDate == null ? start : toLocalDate(endDate);
        if (start == null && end == null) {
            return false;
        }
        if (start == null) {
            start = end;
        }
        if (end == null) {
            end = start;
        }
        if (rangeStart == null || rangeEnd == null) {
            return false;
        }
        return !end.isBefore(rangeStart) && !start.isAfter(rangeEnd);
    }

    private boolean isUpcomingEvent(Date startDate, Date endDate) {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate start = toLocalDate(startDate);
        LocalDate end = endDate == null ? start : toLocalDate(endDate);
        if (start == null && end == null) {
            return false;
        }
        if (start == null) {
            start = end;
        }
        return start != null && start.isAfter(today);
    }

    private boolean isOngoingEvent(Date startDate, Date endDate) {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate start = toLocalDate(startDate);
        LocalDate end = endDate == null ? start : toLocalDate(endDate);
        if (start == null && end == null) {
            return false;
        }
        if (start == null) {
            start = end;
        }
        if (end == null) {
            end = start;
        }
        return start != null && end != null && !start.isAfter(today) && !end.isBefore(today);
    }

    private boolean isCompletedEvent(Date startDate, Date endDate) {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate end = toLocalDate(endDate);
        LocalDate start = toLocalDate(startDate);
        LocalDate effectiveEnd = end == null ? start : end;
        return effectiveEnd != null && effectiveEnd.isBefore(today);
    }

    private String formatYearMonthLabel(YearMonth month, Language language) {
        if (month == null) {
            return "";
        }
        Locale locale = switch (language) {
            case FR -> Locale.FRENCH;
            case AR -> new Locale("ar");
            default -> Locale.ENGLISH;
        };
        return month.getMonth().getDisplayName(java.time.format.TextStyle.FULL, locale) + " " + month.getYear();
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

    private boolean asksDetailsQuery(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "plus information", "plus informations", "plus d information", "detail", "details", "info sur", "informations sur",
            "details about", "more info", "more information", "only", "seulement", "uniquement", "juste");
    }

    private Optional<Restaurant> findMentionedRestaurant(String normalizedQuestion, List<Restaurant> restaurants) {
        return restaurants.stream()
            .filter(r -> r.getName() != null && !r.getName().isBlank())
            .filter(r -> containsToken(normalizedQuestion, normalize(r.getName())))
            .findFirst();
    }

    private Optional<Activity> findMentionedActivity(String normalizedQuestion, List<Activity> activities) {
        return activities.stream()
            .filter(a -> a.getName() != null && !a.getName().isBlank())
            .filter(a -> containsToken(normalizedQuestion, normalize(a.getName())))
            .findFirst();
    }

    private Optional<Event> findMentionedEvent(String normalizedQuestion, List<Event> events) {
        return events.stream()
            .filter(e -> e.getTitle() != null && !e.getTitle().isBlank())
            .filter(e -> containsToken(normalizedQuestion, normalize(e.getTitle())))
            .findFirst();
    }

    private String extractCuisinePreference(String normalizedQuestion) {
        String[] markers = {"cuisine", "food", "culinary"};
        for (String marker : markers) {
            int idx = normalizedQuestion.indexOf(marker);
            if (idx >= 0) {
                String tail = normalizedQuestion.substring(idx + marker.length()).trim();
                if (!tail.isBlank()) {
                    String[] words = tail.split(" ");
                    if (words.length > 0) {
                        return normalizeCuisineValue(words[0]);
                    }
                }
            }
        }

        if (containsAny(normalizedQuestion, "japanese", "japonais", "japonaise")) {
            return "japanese";
        }
        if (containsAny(normalizedQuestion, "american", "americaine", "americain", "us", "usa")) {
            return "american";
        }
        if (containsAny(normalizedQuestion, "tunisien", "tunisienne", "tunisian")) {
            return "tunisian";
        }
        if (containsAny(normalizedQuestion, "italien", "italienne", "italian")) {
            return "italian";
        }

        return null;
    }

    private String normalizeCuisineValue(String value) {
        String v = normalize(value);
        v = v.replace("american s", "american").replace("japanese s", "japanese").replace("tunisian s", "tunisian");
        v = v.replace("japonaise", "japanese").replace("japonais", "japanese").replace("japan", "japanese");
        v = v.replace("americaine", "american").replace("americain", "american");
        v = v.replace("tunisienne", "tunisian").replace("tunisien", "tunisian");
        v = v.replace("italienne", "italian").replace("italien", "italian");
        v = v.replace("mediterraneenne", "mediterranean").replace("mediterraneen", "mediterranean");
        return v;
    }

    private String extractEventTypePreference(String normalizedQuestion) {
        if (containsAny(normalizedQuestion, "culture", "culturel", "culturelle", "cultural")) {
            return "cultural";
        }
        if (containsAny(normalizedQuestion, "technique", "technologique", "tech", "technology", "technical")) {
            return "tech";
        }
        if (containsAny(normalizedQuestion, "musique", "music", "concert")) {
            return "music";
        }
        if (containsAny(normalizedQuestion, "sport", "sports")) {
            return "sport";
        }
        return null;
    }

    private boolean looksCoastalCity(City city) {
        if (city == null) {
            return false;
        }
        String region = normalize(city.getRegion());
        String description = normalize(city.getDescription());
        String name = normalize(city.getName());

        if (Boolean.TRUE.equals(city.getHasPort())) {
            return true;
        }

        if (containsAny(region, "sahel", "coastal", "cote", "littoral")
            || containsAny(description, "plage", "beach", "mer", "coast", "littoral", "bord de mer", "sahel")) {
            return true;
        }

        return containsAny(name, "sousse", "monastir", "mahdia", "nabeul", "hammamet", "bizerte", "sfax", "gabes", "djerba");
    }

    private boolean looksCulturalCity(City city) {
        if (city == null) {
            return false;
        }
        String name = normalize(city.getName());
        String description = normalize(city.getDescription());
        return containsAny(name, "tunis", "kairouan", "sousse", "sfax", "nabeul", "tozeur", "dougga", "el jem")
            || containsAny(description, "medina", "historique", "heritage", "culture", "rome", "monument", "mosquee", "kasbah", "archeologique");
    }

    private boolean looksDesertCity(City city) {
        if (city == null) {
            return false;
        }
        String name = normalize(city.getName());
        String region = normalize(city.getRegion());
        String description = normalize(city.getDescription());
        return containsAny(name, "tozeur", "kebili", "tatouine", "tataouine", "douz")
            || containsAny(region, "sud", "desert", "sahara")
            || containsAny(description, "desert", "sahara", "oasis", "dunes", "sud");
    }

    private boolean looksMountainCity(City city) {
        if (city == null) {
            return false;
        }
        String name = normalize(city.getName());
        String region = normalize(city.getRegion());
        String description = normalize(city.getDescription());
        return containsAny(name, "kasserine", "zaghouan", "ain draham", "le kef")
            || containsAny(region, "montagne", "mountain", "hauteur")
            || containsAny(description, "montagne", "mountain", "foret", "randonnee", "altitude");
    }

    private boolean isTravelRouteQuery(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return false;
        }
        boolean travelWord = containsAny(normalizedQuestion, "voyage", "travel", "trip", "trajet", "transport", "route");
        boolean explicitPattern = normalizedQuestion.matches(".*\\b(de|from)\\b.*\\b(a|to|vers)\\b.*")
            || containsAny(normalizedQuestion, "departure", "destination");
        return travelWord && explicitPattern;
    }

    private boolean isCityOnlyQuestion(String normalizedQuestion, City city) {
        if (city == null || city.getName() == null || city.getName().isBlank()) {
            return false;
        }
        String cityToken = normalize(city.getName());
        String cleaned = normalizedQuestion == null ? "" : normalizedQuestion.trim();
        if (cleaned.equals(cityToken)) {
            return true;
        }
        String[] words = cleaned.split(" ");
        return words.length <= 3 && containsToken(cleaned, cityToken);
    }

    private String routeDistanceDurationText(City from, City to, Language language) {
        Double lat1 = from == null ? null : from.getLatitude();
        Double lon1 = from == null ? null : from.getLongitude();
        Double lat2 = to == null ? null : to.getLatitude();
        Double lon2 = to == null ? null : to.getLongitude();

        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
            return t(language,
                "Je peux estimer la durée si les coordonnées des villes sont disponibles.",
                "I can estimate travel duration when city coordinates are available.",
                "يمكنني تقدير مدة السفر عندما تكون إحداثيات المدن متوفرة.");
        }

        double distanceKm = haversineKm(lat1, lon1, lat2, lon2);
        double avgRoadSpeedKmh = 80.0;
        int totalMinutes = (int) Math.round((distanceKm / avgRoadSpeedKmh) * 60.0);
        int hours = totalMinutes / 60;
        int minutes = totalMinutes % 60;

        return t(language,
            String.format(Locale.ROOT, "Distance estimée: %.1f km, durée estimée: %dh %02d min.", distanceKm, hours, minutes),
            String.format(Locale.ROOT, "Estimated distance: %.1f km, estimated duration: %dh %02d min.", distanceKm, hours, minutes),
            String.format(Locale.ROOT, "المسافة التقديرية: %.1f كم، المدة التقديرية: %d س %02d د.", distanceKm, hours, minutes));
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return r * c;
    }

    private Language detectLanguage(String rawQuestion, String normalizedQuestion) {
        if (rawQuestion != null && rawQuestion.matches(".*[\\u0600-\\u06FF].*")) {
            return Language.AR;
        }
        if (containsAny(normalizedQuestion, "salam", "slm", "assalam", "marhba")) {
            return Language.AR;
        }
        int frScore = languageScore(normalizedQuestion, List.of(
            "bonjour", "bonsoir", "salut", "merci", "pourquoi", "comment", "est ce", "quel", "quelle", "quels", "quelles",
            "je", "veux", "propose", "ville", "plage", "transport", "moyens", "description", "informations", "avec", "pour", "de", "a"
        ));
        int enScore = languageScore(normalizedQuestion, List.of(
            "hello", "hi", "good", "morning", "evening", "i", "want", "show", "available", "events", "means", "transport", "description", "cities", "please", "thanks"
        ));

        if (frScore > enScore) {
            return Language.FR;
        }
        if (enScore > frScore) {
            return Language.EN;
        }

        if (containsAny(normalizedQuestion, "bonjour", "bonsoir", "salut", "je veux", "propose moi", "ville tunisienne")) {
            return Language.FR;
        }
        if (containsAny(normalizedQuestion, "hello", "hi", "i want", "show", "please")) {
            return Language.EN;
        }

        return Language.FR;
    }

    private int languageScore(String normalizedQuestion, List<String> words) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return 0;
        }
        int score = 0;
        for (String word : words) {
            String normalizedWord = normalize(word);
            if (normalizedWord.contains(" ")) {
                if (normalizedQuestion.contains(normalizedWord)) {
                    score++;
                }
            } else if (containsExactWord(normalizedQuestion, normalizedWord)) {
                score++;
            }
        }
        return score;
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
        SMALL_TALK,
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
