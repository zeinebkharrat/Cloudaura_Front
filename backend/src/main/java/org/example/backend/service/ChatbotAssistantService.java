package org.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.publicapi.ChatbotQueryResponse;
import org.example.backend.model.Accommodation;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityReservation;
import org.example.backend.model.Cart;
import org.example.backend.model.CartItem;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.model.EventReservation;
import org.example.backend.model.Product;
import org.example.backend.model.ProductCategory;
import org.example.backend.model.ProductVariant;
import org.example.backend.model.Reservation;
import org.example.backend.model.ReservationStatus;
import org.example.backend.model.Restaurant;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.example.backend.model.User;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.ActivityReviewRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.CartItemRepository;
import org.example.backend.repository.CartRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.ProductVariantRepository;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.RestaurantRepository;
import org.example.backend.repository.RestaurantReviewRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
import java.time.format.DateTimeFormatter;
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

    private static final DateTimeFormatter RESERVATION_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

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
    private final ReservationRepository reservationRepository;
    private final TransportReservationRepository transportReservationRepository;
    private final UserIdentityResolver userIdentityResolver;
    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductVariantRepository productVariantRepository;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    public ChatbotQueryResponse answer(String question) {
        return answer(question, List.of());
    }

    public ChatbotQueryResponse answer(String question, List<String> conversation) {
        String rawQuestion = question == null ? "" : question.trim();
        String normalizedQuestion = normalize(question);
        String normalizedConversation = normalize(buildConversationContext(conversation));
        String normalizedUserConversation = normalize(buildUserConversationContext(conversation));
        Language language = detectLanguage(rawQuestion, normalizedQuestion.isBlank() ? normalizedUserConversation : normalizedQuestion);

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

        Intent intent = detectIntent(normalizedQuestion);

        List<City> allCities = citiesForNlpMatching();
        Optional<City> city = findMentionedCity(normalizedQuestion, allCities);
        List<City> mentionedCities = findMentionedCitiesInQuestionOrder(normalizedQuestion, allCities);

        boolean allowCityFallbackFromConversation = intent != Intent.WEATHER
            && intent != Intent.CITY_COUNT
            && intent != Intent.CART_ACTION
            && intent != Intent.MY_RESERVATIONS;

        // Use conversation as fallback for city context only on short follow-up prompts.
        if (allowCityFallbackFromConversation
            && city.isEmpty()
            && isLowSignalQuestion(normalizedQuestion)
            && !normalizedUserConversation.isBlank()) {
            city = findMentionedCity(normalizedUserConversation, allCities);
        }
        if (allowCityFallbackFromConversation
            && mentionedCities.isEmpty()
            && isLowSignalQuestion(normalizedQuestion)
            && !normalizedUserConversation.isBlank()) {
            mentionedCities = findMentionedCitiesInQuestionOrder(normalizedUserConversation, allCities);
        }

        boolean inScope = isInScope(normalizedQuestion, allCities)
            || (isLowSignalQuestion(normalizedQuestion) && isInScope(normalizedUserConversation, allCities));

        if (!inScope) {
            return new ChatbotQueryResponse(
                outOfScope(language),
                true,
                List.of("scope-guard"),
                1.0
            );
        }

        if (intent == Intent.GENERAL_TUNISIA
            && isLowSignalQuestion(normalizedQuestion)
            && !normalizedUserConversation.isBlank()) {
            Intent conversationIntent = detectConversationIntent(conversation, normalizedUserConversation);
            if (conversationIntent != Intent.GENERAL_TUNISIA && conversationIntent != Intent.SMALL_TALK) {
                intent = conversationIntent;
            }
            if (conversationLooksLikeEventClarification(normalizedConversation)) {
                intent = Intent.EVENT;
            }
        }

        if (intent == Intent.GENERAL_TUNISIA
            && conversationLooksLikeCartClearConfirmation(normalizedConversation)
            && (looksLikeConfirmationReply(normalizedQuestion) || looksLikeCancellationReply(normalizedQuestion))) {
            intent = Intent.CART_ACTION;
        }

        Intent entityIntent = inferEntityIntentFromNames(normalizedQuestion, city);
        if (shouldAllowEntityIntentOverride(intent, entityIntent, normalizedQuestion, city)) {
            intent = entityIntent;
        }

        if (intent == Intent.GENERAL_TUNISIA
            && isLowSignalQuestion(normalizedQuestion)
            && geminiApiKey != null
            && !geminiApiKey.isBlank()) {
            try {
                Intent geminiIntent = inferIntentWithGemini(rawQuestion, normalizedUserConversation);
                if (geminiIntent != null && geminiIntent != Intent.GENERAL_TUNISIA && geminiIntent != Intent.SMALL_TALK) {
                    intent = geminiIntent;
                }
            } catch (Exception ignored) {
                // keep deterministic routing when Gemini intent inference fails
            }
        }

        if (requiresAuthentication(intent, normalizedQuestion, normalizedUserConversation) && resolveAuthenticatedUserId() == null) {
            return new ChatbotQueryResponse(
                loginRequiredMessage(language, normalizedQuestion),
                false,
                List.of("auth"),
                0.97
            );
        }

        IntentAnswer intentAnswer = buildIntentAnswer(intent, city, mentionedCities, allCities, language, normalizedQuestion, normalizedUserConversation);

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

        if (intent != Intent.CART_ACTION && intent != Intent.CITY_COUNT && geminiApiKey != null && !geminiApiKey.isBlank()) {
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

        boolean asksCityCount = isCityCountQuestion(normalizedQuestion);
        boolean asksCitySuggestion = containsAny(normalizedQuestion,
            "propose moi une ville", "propose une ville", "ville tunisienne", "ville en tunisie", "suggest a city", "recommend city", "city in tunisia", "ville avec plage", "beach city", "sahel");
        boolean asksInfo = containsAny(normalizedQuestion, "info", "infos", "information", "informations", "detail", "details", "detailles", "detaillé", "details");
        boolean asksCityList = containsAny(normalizedQuestion,
            "nom des villes", "noms des villes", "villes tunisiennes", "toutes les villes", "tous les villes", "all cities", "city names");
        boolean asksBest = asksBestKeyword(normalizedQuestion);
        boolean asksTravelPlan = containsAny(normalizedQuestion,
            "plan", "itineraire", "itinerary", "programme", "ideal", "voyager", "voyage a", "voyage a", "travel plan", "trip plan")
            && containsAny(normalizedQuestion, "jour", "jours", "day", "days", "voyage", "travel", "trip", "sejour", "stay");
        boolean asksGoToCity = containsAny(normalizedQuestion,
            "i want to go to", "want to go to", "go to", "travel to",
            "je veux aller", "aller a", "aller vers", "voyager a", "voyage a",
            "اريد ان اذهب الى", "اريد الذهاب الى", "اذهب الى", "الذهاب الى")
            && !hasFromToRoutePattern(normalizedQuestion);
        boolean asksWeather = containsAny(normalizedQuestion,
            "meteo", "météo", "weather", "temperature", "climat", "wind", "pluie")
            || containsExactWord(normalizedQuestion, "vent");
        boolean asksMyReservations = containsAny(normalizedQuestion,
            "mes reservations", "mes reservation", "my reservations", "my booking", "my bookings", "mes voyages", "mes sejours", "mes billets",
            "j ai une reservation", "j ai des reservations", "ai je une reservation", "ai je des reservations",
            "do i have a reservation", "do i have reservations", "have i booked", "have i any reservation");
        boolean asksRestaurant = containsAny(normalizedQuestion, "restaurant", "restaurants", "cuisine", "food", "مطعم", "مطاعم");
        boolean asksWorstRestaurant = asksLowestRated(normalizedQuestion) && asksRestaurant;
        boolean asksRestaurantStars = asksRestaurant
            && containsAny(normalizedQuestion, "notation", "note", "rating", "etoile", "etoiles", "star", "stars")
            && (containsAny(normalizedQuestion, "superieur", "inferieur", "plus de", "moins de", "above", "below", ">", "<")
                || extractFirstNumber(normalizedQuestion) != null);
        boolean asksActivity = containsAny(normalizedQuestion,
            "activity", "activities", "activite", "activites", "activies", "activis", "visit", "thing to do",
            "نشاط", "انشطة", "الانشطة", "الأنشطة", "نشاطات");
        boolean asksAccommodation = containsAny(normalizedQuestion, "hotel", "accommodation", "accommodations", "accomodation", "accomodations", "stay", "guesthouse", "maison d hote", "hebergement", "سكن", "اقامة");
        boolean asksTransport = containsAny(normalizedQuestion,
            "transport", "tansport", "transports", "bus", "train", "taxi", "plane", "ferry", "route", "trajet", "voyage", "travel", "trip", "departure", "destination", "vers", "نقل", "حافلة", "قطار")
            || hasFromToRoutePattern(normalizedQuestion)
            || isTravelRouteQuery(normalizedQuestion);
        boolean asksEvent = containsAny(normalizedQuestion,
            "event", "events", "even", "evnt", "festival", "concert",
            "evenement", "evenements", "evenemnt", "evenemnts", "enennement", "enennements", "manifestation",
            "حدث", "فعاليات", "فعالية");
        boolean asksProduct = containsAny(normalizedQuestion, "product", "products", "article", "articles", "item", "items", "artisanat", "artisan", "souvenir", "craft", "market", "produit", "منتج", "حرف", "صناعة تقليدية");
        boolean asksProductAdvanced = containsAny(normalizedQuestion,
            "categorie", "category", "textile", "couleur", "colors", "color", "taille", "tailles", "size", "sizes", "stock", "artisan", "cher", "moins cher", "plus cher", "inferieur", "superieur", "depasse");
        boolean asksMyShopData = containsAny(normalizedQuestion,
            "mes favoris", "mes favorits", "my favorites", "my favourites", "wishlist", "favoris", "favoriris", "favori", "favourites",
            "ma cart", "mon panier", "mes paniers", "my cart", "cart", "panier", "panier produit");
        boolean asksCartAction = asksCartClearAction(normalizedQuestion);
        boolean asksAppHelp = containsAny(normalizedQuestion,
            "application", "app", "compte", "account", "login", "connexion", "inscription", "reservation", "booking", "payment",
            "cart", "panier", "checkout", "commande", "order", "favoris", "profile", "profil");
        boolean asksReservationAvailability = containsAny(normalizedQuestion,
            "reserver", "reservation", "booking", "book", "reserve", "حجز", "الحجز", "احجز", "حجوزات")
            && (extractRequestedDate(normalizedQuestion) != null || extractRequestedActivityMonth(normalizedQuestion) != null
                || containsAny(normalizedQuestion, "personne", "personnes", "participant", "participants", "pax"))
            && !asksTransport
            && !asksEvent
            && !asksAccommodation;

        if (asksCityCount) {
            return Intent.CITY_COUNT;
        }
        if (asksCitySuggestion) {
            return Intent.GENERAL_TUNISIA;
        }
        if (asksCartAction) {
            return Intent.CART_ACTION;
        }
        if (asksTravelPlan) {
            return Intent.TRAVEL_PLAN;
        }
        if (asksGoToCity) {
            return Intent.TRAVEL_PLAN;
        }
        if (asksRestaurantStars) {
            return Intent.RESTAURANT;
        }
        if (asksWorstRestaurant) {
            return Intent.WORST_RESTAURANT;
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
        if (asksWeather) {
            return Intent.WEATHER;
        }
        if (asksMyReservations) {
            return Intent.MY_RESERVATIONS;
        }
        if (asksEvent) {
            return Intent.EVENT;
        }
        if (asksTransport) {
            return Intent.TRANSPORT;
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
        if (asksProduct || asksProductAdvanced || asksMyShopData || asksPriceQuestionWithoutDomain(normalizedQuestion)) {
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
        boolean hasReservationAction = asksReservationAction(normalizedQuestion);
        boolean hasDirectEntityMention = inferEntityIntentFromNames(normalizedQuestion, city) != null;
        boolean shouldPreserveCurrentQuestion = hasReservationAction || hasDirectEntityMention;

        if (intent != Intent.SMALL_TALK
            && isLowSignalQuestion(normalizedQuestion)
            && !shouldPreserveCurrentQuestion
            && normalizedConversation != null
            && !normalizedConversation.isBlank()) {
            // Preserve conversational continuity on short follow-ups.
            effectiveQuestion = normalizedConversation + " " + normalizedQuestion;
        }

        if (intent == Intent.GENERAL_TUNISIA && asksDetailsQuery(effectiveQuestion)) {
            IntentAnswer detailsFallback = answerSpecificEntityDetails(city, language, effectiveQuestion);
            if (detailsFallback != null) {
                return detailsFallback;
            }
        }

        return switch (intent) {
            case CITY_COUNT -> answerCityCount(allCities, language);
            case WORST_RESTAURANT -> answerWorstRestaurant(city, language);
            case BEST_RESTAURANT -> answerBestRestaurant(city, language);
            case BEST_ACTIVITY -> answerBestActivity(city, language);
            case BEST_ACCOMMODATION -> answerBestAccommodation(city, language);
            case RESTAURANT -> answerRestaurantOverview(city, language, effectiveQuestion);
            case ACTIVITY -> answerActivityOverview(city, language, effectiveQuestion);
            case ACCOMMODATION -> answerAccommodationOverview(city, language, effectiveQuestion);
            case TRAVEL_PLAN -> answerTravelPlan(city, language, effectiveQuestion);
            case WEATHER -> answerWeatherOverview(city, language);
            case MY_RESERVATIONS -> answerMyReservations(language, effectiveQuestion, normalizedConversation);
            case TRANSPORT -> answerTransportOverview(mentionedCities, language, effectiveQuestion);
            case EVENT -> answerEventOverview(city, language, effectiveQuestion);
            case PRODUCT -> answerProductOverview(city, language, effectiveQuestion);
            case CART_ACTION -> answerCartAction(language, normalizedQuestion, normalizedConversation);
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
                + optionalText(cuisineText(r.getCuisineType()), " - ")
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
        if (containsAny(normalizedQuestion, "merci", "thanks", "thank you", "شكرا")) {
            return new IntentAnswer(
                t(language,
                    "Avec plaisir. Si vous voulez, je peux aussi vous aider a trouver une ville, un restaurant, une activite, un transport ou un hebergement.",
                    "You're welcome. If you want, I can also help you find a city, restaurant, activity, transport, or accommodation.",
                    "على الرحب والسعة. إذا أردت، يمكنني أيضا مساعدتك في العثور على مدينة أو مطعم أو نشاط أو نقل أو إقامة."),
                "SmallTalk=thanks",
                List.of("application"),
                0.98
            );
        }

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
        if (containsAny(normalizedQuestion, "salut")) {
            return t(language, "Salut! Comment puis-je vous aider?", "Hi! How can I help you?", "مرحبا! كيف يمكنني مساعدتك؟");
        }
        if (containsAny(normalizedQuestion, "salam", "marhba", "assalam", "السلام", "مرحبا")) {
            return t(language, "Salam! Comment puis-je vous aider?", "Salam! How can I help you?", "سلام! كيف يمكنني مساعدتك؟");
        }
        return null;
    }

    private IntentAnswer answerCityCount(List<City> allCities, Language language) {
        int cityCount = allCities == null ? 0 : allCities.size();
        return new IntentAnswer(
            String.valueOf(cityCount),
            "CitiesCount=" + cityCount,
            List.of("cities"),
            0.98
        );
    }

    private IntentAnswer answerWorstRestaurant(Optional<City> cityOpt, Language language) {
        if (cityOpt.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Pour trouver le restaurant le moins bien noté, indiquez une ville tunisienne (ex: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "To find the lowest-rated restaurant, please mention a Tunisian city (for example: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "للعثور على أقل مطعم تقييما، اذكر مدينة تونسية مثل تونس أو سوسة أو صفاقس أو نابل أو الحمامات."),
                "No city provided. Need a city to rank restaurants by lowest rating.",
                List.of("cities"),
                0.74
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

        Restaurant worst = restaurants.stream()
            .min(Comparator.comparing(r -> avgRatingByRestaurant.getOrDefault(r.getRestaurantId(), 0.0)))
            .orElse(restaurants.get(0));

        double avgStars = avgRatingByRestaurant.getOrDefault(worst.getRestaurantId(), 0.0);
        long totalReviews = reviewCountByRestaurant.getOrDefault(worst.getRestaurantId(), 0L);
        String ratingText = totalReviews <= 0
            ? t(language, "pas encore noté", "not rated yet", "غير مقيم بعد")
            : String.format(Locale.ROOT, "%.1f/5 (%d reviews)", avgStars, totalReviews);

        String answer = t(language,
            "Le restaurant le moins bien noté à " + city.getName() + " est " + worst.getName()
                + " (note " + ratingText + ")"
                + optionalText(cuisineText(worst.getCuisineType()), ", cuisine: ")
                + optionalText(worst.getAddress(), ", adresse: ")
                + ".",
            "The lowest-rated restaurant in " + city.getName() + " is " + worst.getName()
                + " (rating " + ratingText + ")"
                + optionalText(cuisineText(worst.getCuisineType()), ", cuisine: ")
                + optionalText(worst.getAddress(), ", address: ")
                + ".",
            "أقل مطعم تقييما في " + city.getName() + " هو " + worst.getName()
                + " (التقييم " + ratingText + ")"
                + optionalText(cuisineText(worst.getCuisineType()), "، النوع: ")
                + optionalText(worst.getAddress(), "، العنوان: ")
                + ".");

        String facts = "City=" + city.getName() + "; WorstRestaurant=" + worst.getName() + "; Rating=" + ratingText
            + optionalText(cuisineText(worst.getCuisineType()), "; Cuisine=")
            + optionalText(worst.getAddress(), "; Address=");
        return new IntentAnswer(answer, facts, List.of("restaurants", "cities"), 0.93);
    }

    private IntentAnswer answerCartAction(Language language, String normalizedQuestion, String normalizedConversation) {
        Integer userId = resolveAuthenticatedUserId();
        if (userId == null) {
            return new IntentAnswer(
                t(language,
                    "Pour gérer votre panier, connectez-vous d'abord à votre compte.",
                    "To manage your cart, please sign in to your account first.",
                    "لإدارة سلتك، يرجى تسجيل الدخول أولا."),
                "CartAction=unauthenticated",
                List.of("auth", "cart"),
                0.96
            );
        }

        boolean pendingConfirmation = conversationLooksLikeCartClearConfirmation(normalizedConversation);
        boolean isDirectClearRequest = asksCartClearAction(normalizedQuestion);

        if (!isDirectClearRequest && looksLikeCancellationReply(normalizedQuestion)) {
            return new IntentAnswer(
                t(language,
                    "D'accord, je n'ai pas vidé votre panier.",
                    "Okay, I did not clear your cart.",
                    "حسنا، لم أقم بتفريغ سلتك."),
                "CartClear=cancelled",
                List.of("cart"),
                0.97
            );
        }

        if (!isDirectClearRequest && (pendingConfirmation || looksLikeConfirmationReply(normalizedQuestion))) {
            int removedUnits = clearCartForUser(userId);
            return new IntentAnswer(
                t(language,
                    removedUnits <= 0
                        ? "Votre panier est déjà vide."
                        : "C'est fait. Votre panier a été vidé (" + removedUnits + " article(s) supprimé(s)).",
                    removedUnits <= 0
                        ? "Your cart is already empty."
                        : "Done. Your cart has been cleared (" + removedUnits + " item(s) removed).",
                    removedUnits <= 0
                        ? "سلتك فارغة بالفعل."
                        : "تم. تم تفريغ سلتك (" + removedUnits + " عنصر/عناصر أزيلت)."),
                "CartClear=success; removed=" + removedUnits,
                List.of("cart"),
                0.98
            );
        }

        if (isDirectClearRequest) {
            int totalUnits = 0;
            int totalLines = 0;
            try {
                Optional<Cart> cart = cartRepository.findByUser_UserId(userId);
                if (cart.isPresent()) {
                    List<CartItem> items = cartItemRepository.findByCartIdWithProduct(cart.get().getCartId());
                    totalLines = items.size();
                    totalUnits = items.stream().mapToInt(item -> item.getQuantity() == null ? 1 : item.getQuantity()).sum();
                }
            } catch (Exception ignored) {
                totalUnits = 0;
                totalLines = 0;
            }

            if (totalLines == 0 || totalUnits == 0) {
                return new IntentAnswer(
                    t(language,
                        "Votre panier est déjà vide.",
                        "Your cart is already empty.",
                        "سلتك فارغة بالفعل."),
                    "CartClear=already-empty",
                    List.of("cart"),
                    0.98
                );
            }

            return new IntentAnswer(
                t(language,
                    "Confirmez la suppression de tous les produits de votre panier (" + totalUnits + " article(s), " + totalLines + " ligne(s)). Répondez par oui pour confirmer ou non pour annuler.",
                    "Please confirm clearing all products from your cart (" + totalUnits + " item(s), " + totalLines + " line(s)). Reply yes to confirm or no to cancel.",
                    "يرجى تأكيد حذف كل منتجات السلة (" + totalUnits + " عنصر/عناصر، " + totalLines + " سطر/أسطر). أجب بنعم للتأكيد أو لا للإلغاء."),
                "CartClearConfirmation=pending",
                List.of("cart"),
                0.97
            );
        }

        return answerMyProductCollections(language, normalizedQuestion);
    }

    private int clearCartForUser(Integer userId) {
        if (userId == null) {
            return 0;
        }
        Optional<Cart> cartOpt = cartRepository.findByUser_UserId(userId);
        if (cartOpt.isEmpty()) {
            return 0;
        }

        List<CartItem> items = cartItemRepository.findByCartIdWithProduct(cartOpt.get().getCartId());
        int removedUnits = items.stream().mapToInt(item -> item.getQuantity() == null ? 1 : item.getQuantity()).sum();
        if (!items.isEmpty()) {
            cartItemRepository.deleteAll(items);
        }
        return removedUnits;
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
                + optionalText(cuisineText(best.getCuisineType()), ", cuisine: ")
                + optionalText(best.getAddress(), ", adresse: ")
                + ".",
            "A top restaurant choice in " + city.getName() + " is " + best.getName()
                + " (rating " + ratingText + ")"
                + optionalText(cuisineText(best.getCuisineType()), ", cuisine: ")
                + optionalText(best.getAddress(), ", address: ")
                + ".",
            "أفضل خيار مطعم في " + city.getName() + " هو " + best.getName()
                + " (التقييم " + ratingText + ")"
                + optionalText(cuisineText(best.getCuisineType()), "، النوع: ")
                + optionalText(best.getAddress(), "، العنوان: ")
                + ".");

        String facts = "City=" + city.getName() + "; BestRestaurant=" + best.getName() + "; Rating=" + ratingText
            + optionalText(cuisineText(best.getCuisineType()), "; Cuisine=")
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
                    + optionalText(cuisineText(r.getCuisineType()), " - ")
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
        boolean asksReservationAction = asksReservationAction(normalizedQuestion);
        boolean asksYesNo = containsAny(normalizedQuestion,
            "est ce", "est-ce", "peux", "puis je", "puis-je", "can i", "may i", "do i", "is there", "are there", "existe", "exists", "reserv", "booking", "book")
            || asksReservationAction;

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

        if (askedActivity.isPresent()
            && !asksReservationAction
            && !asksYesNo
            && !asksDetails
            && requestedDate == null
            && requestedMonth == null
            && exactPrice == null
            && maxPrice == null
            && minPrice == null
            && minStars == null
            && maxStars == null
            && isLowSignalQuestion(normalizedQuestion)) {
            Activity selected = askedActivity.get();
            String ratingText = formatActivityRatingText(selected.getActivityId(), avgRatingByActivity, reviewCountByActivity);
            String details = "• " + selected.getName()
                + optionalText(selected.getType(), "\n➤ type: ")
                + optionalText(ratingText, "\n➤ rating: ")
                + optionalText(selected.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", selected.getPrice()), "\n➤ prix: ")
                + optionalText(selected.getAddress(), "\n📍 ")
                + optionalText(shorten(selected.getDescription(), 120), "\n➤ ");
            String bookingLink = buildActivityBookingLink(selected);
            return new IntentAnswer(
                t(language,
                    "Parfait, vous avez choisi " + selected.getName() + ". Pour réserver immédiatement, utilisez ce lien:\n" + bookingLink + "\n" + details,
                    "Great, you selected " + selected.getName() + ". To book it now, use this link:\n" + bookingLink + "\n" + details,
                    "ممتاز، لقد اخترت " + selected.getName() + ". للحجز مباشرة استخدم هذا الرابط:\n" + bookingLink + "\n" + details),
                "ActivitySelected=" + selected.getName() + "; ActivityBookingLink=" + bookingLink,
                List.of("activities", "link"),
                0.96
            );
        }

        if (asksYesNo && askedActivity.isPresent()) {
            Activity activity = askedActivity.get();
            Integer maxPerDay = activity.getMaxParticipantsPerDay();
            boolean capacityOk = maxPerDay == null || maxPerDay <= 0 || requestedParticipants <= maxPerDay;
            boolean available = isActivityAvailableForFilter(activity, requestedDate, requestedMonth, requestedParticipants)
                && (requestedDate != null || requestedMonth != null || isActivityBookableSoon(activity, requestedParticipants))
                && capacityOk
                && (exactPrice == null || (activity.getPrice() != null && Math.abs(activity.getPrice() - exactPrice) <= 0.5))
                && (maxPrice == null || (activity.getPrice() != null && activity.getPrice() <= maxPrice))
                && (minPrice == null || (activity.getPrice() != null && activity.getPrice() >= minPrice))
                && (minStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) >= minStars)
                && (maxStars == null || avgRatingByActivity.getOrDefault(activity.getActivityId(), 0.0) <= maxStars);

            String ratingText = formatActivityRatingText(activity.getActivityId(), avgRatingByActivity, reviewCountByActivity);
            String capacityText = maxPerDay == null || maxPerDay <= 0
                ? ""
                : "\n➤ capacité max: " + maxPerDay + " personne(s)/jour";
            String details = "• " + activity.getName()
                + optionalText(activity.getType(), "\n➤ type: ")
                + optionalText(ratingText, "\n➤ rating: ")
                + optionalText(activity.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", activity.getPrice()), "\n➤ prix: ")
                + capacityText
                + optionalText(activity.getAddress(), "\n📍 ")
                + optionalText(shorten(activity.getDescription(), 120), "\n➤ ");

            if (asksReservationAction) {
                String bookingLink = buildActivityBookingLink(activity);
                return new IntentAnswer(
                    available
                        ? t(language,
                            "Oui. Cette activité est réservable. Utilisez ce lien pour réserver:\n" + bookingLink + "\n" + details,
                            "Yes. This activity can be booked. Use this link to reserve:\n" + bookingLink + "\n" + details,
                            "نعم. يمكن حجز هذا النشاط. هذا رابط الحجز:\n" + bookingLink + "\n" + details)
                        : t(language,
                            "Cette activité n'est pas disponible selon vos critères pour le moment. Vous pouvez quand même ouvrir ce lien:\n" + bookingLink,
                            "This activity is not available for your criteria right now. You can still open this link:\n" + bookingLink,
                            "هذا النشاط غير متاح حاليا حسب معاييرك. هذا الرابط على كل حال:\n" + bookingLink),
                    "ActivityBookingLink=" + bookingLink,
                    List.of("activities", "link"),
                    0.95
                );
            }

            return new IntentAnswer(
                available
                    ? t(language,
                        "Oui. Cette activité peut être réservée pour " + requestedParticipants + " personne(s).\n" + details,
                        "Yes. This activity can be booked for " + requestedParticipants + " person(s).\n" + details,
                        "نعم. يمكن حجز هذا النشاط لـ " + requestedParticipants + " شخص(أشخاص).\n" + details)
                    : t(language,
                        maxPerDay != null && maxPerDay > 0 && requestedParticipants > maxPerDay
                            ? "Non. Cette activité accepte au maximum " + maxPerDay + " personne(s) par jour."
                            : "Non. Cette activité n'est pas disponible selon vos critères pour le moment.",
                        maxPerDay != null && maxPerDay > 0 && requestedParticipants > maxPerDay
                            ? "No. This activity accepts at most " + maxPerDay + " person(s) per day."
                            : "No. This activity is not available for your criteria at the moment.",
                        maxPerDay != null && maxPerDay > 0 && requestedParticipants > maxPerDay
                            ? "لا. هذا النشاط يقبل على الأكثر " + maxPerDay + " شخص(أشخاص) في اليوم."
                            : "لا. هذا النشاط غير متاح حاليا حسب المعايير المطلوبة."),
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
        boolean asksReservationAction = asksReservationAction(normalizedQuestion);
        if (cityOpt.isPresent()) {
            City city = cityOpt.get();
            List<Accommodation> stays = accommodationRepository.findByCity_CityId(city.getCityId()).stream()
                .filter(accommodation -> matchesAccommodationType(accommodation, normalizedQuestion))
                .filter(accommodation -> accommodation.getPricePerNight() == null || maxPrice == null || accommodation.getPricePerNight() <= maxPrice)
                .filter(accommodation -> accommodation.getPricePerNight() == null || minPrice == null || accommodation.getPricePerNight() >= minPrice)
                .sorted(accommodationComparator(normalizedQuestion))
                .limit(6)
                .toList();

            if (asksReservationAction) {
                Optional<Accommodation> matched = findMentionedAccommodation(normalizedQuestion, stays);
                if (matched.isPresent() || !stays.isEmpty()) {
                    Accommodation target = matched.orElse(stays.get(0));
                    String bookingLink = buildAccommodationBookingLink(target);
                    return new IntentAnswer(
                        t(language,
                            "Utilisez ce lien pour réserver cet hébergement:\n" + bookingLink,
                            "Use this link to book this accommodation:\n" + bookingLink,
                            "هذا رابط حجز هذا السكن:\n" + bookingLink),
                        "AccommodationBookingLink=" + bookingLink,
                        List.of("accommodations", "link"),
                        0.95
                    );
                }
            }

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

        if (asksReservationAction) {
            Optional<Accommodation> matched = findMentionedAccommodation(normalizedQuestion, stays);
            if (matched.isPresent() || !stays.isEmpty()) {
                Accommodation target = matched.orElse(stays.get(0));
                String bookingLink = buildAccommodationBookingLink(target);
                return new IntentAnswer(
                    t(language,
                        "Utilisez ce lien pour réserver cet hébergement:\n" + bookingLink,
                        "Use this link to book this accommodation:\n" + bookingLink,
                        "هذا رابط حجز هذا السكن:\n" + bookingLink),
                    "AccommodationBookingLink=" + bookingLink,
                    List.of("accommodations", "link"),
                    0.95
                );
            }
        }

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

    private IntentAnswer answerTravelPlan(Optional<City> cityOpt, Language language, String normalizedQuestion) {
        if (cityOpt.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Pour construire un plan de voyage idéal, indiquez une ville tunisienne (ex: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "To build an ideal travel plan, please mention a Tunisian city (for example: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "لإعداد خطة سفر مثالية، اذكر مدينة تونسية مثل تونس أو سوسة أو صفاقس أو نابل أو الحمامات."),
                "TravelPlan=need-city",
                List.of("cities"),
                0.84
            );
        }

        City city = cityOpt.get();
        int days = extractRequestedTripDays(normalizedQuestion);
        boolean hasDays = days > 0;

        List<Activity> activities = activityRepository.findByCityCityIdOrderByActivityIdDesc(city.getCityId()).stream()
            .filter(activity -> isActivityAvailableForFilter(activity, null, null, 1))
            .limit(4)
            .toList();

        List<Event> events = eventRepository.findByCityCityId(city.getCityId()).stream()
            .filter(event -> !isCompletedEvent(event.getStartDate(), event.getEndDate()))
            .sorted(Comparator.comparing(Event::getStartDate, Comparator.nullsLast(Date::compareTo)))
            .limit(3)
            .toList();

        List<Restaurant> restaurants = restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(city.getCityId()).stream()
            .limit(3)
            .toList();

        List<Accommodation> accommodations = accommodationRepository.findByCity_CityId(city.getCityId()).stream()
            .filter(a -> a.getStatus() == null || a.getStatus() == Accommodation.AccommodationStatus.AVAILABLE)
            .limit(3)
            .toList();

        String activityBlock = activities.stream()
            .map(a -> "• " + a.getName() + optionalText(a.getType(), " (") + (a.getType() == null ? "" : ")"))
            .collect(Collectors.joining("\n"));
        String eventBlock = events.stream()
            .map(e -> "• " + e.getTitle() + optionalText(formatEventDate(e.getStartDate()), " - "))
            .collect(Collectors.joining("\n"));
        String restaurantBlock = restaurants.stream()
            .map(r -> "• " + r.getName() + optionalText(cuisineText(r.getCuisineType()), " - "))
            .collect(Collectors.joining("\n"));
        String stayBlock = accommodations.stream()
            .map(a -> "• " + a.getName() + optionalText(a.getPricePerNight() == null ? null : String.format(Locale.ROOT, "%.0f DT/night", a.getPricePerNight()), " - "))
            .collect(Collectors.joining("\n"));

        String answer = t(language,
            (hasDays ? "Plan idéal " + days + " jours à " + city.getName() + ":\n" : "Plan idéal à " + city.getName() + ":\n")
                + "Activités proposées:\n" + (activityBlock.isBlank() ? "• Aucune activité disponible pour le moment." : activityBlock) + "\n"
                + "Événements disponibles:\n" + (eventBlock.isBlank() ? "• Aucun événement disponible pour le moment." : eventBlock) + "\n"
                + "Restaurants disponibles:\n" + (restaurantBlock.isBlank() ? "• Aucun restaurant disponible pour le moment." : restaurantBlock) + "\n"
                + "Hébergements disponibles:\n" + (stayBlock.isBlank() ? "• Aucun hébergement disponible pour le moment." : stayBlock),
            (hasDays ? "Ideal " + days + "-day plan in " + city.getName() + ":\n" : "Ideal plan in " + city.getName() + ":\n")
                + "Suggested activities:\n" + (activityBlock.isBlank() ? "• No activity available right now." : activityBlock) + "\n"
                + "Available events:\n" + (eventBlock.isBlank() ? "• No event available right now." : eventBlock) + "\n"
                + "Available restaurants:\n" + (restaurantBlock.isBlank() ? "• No restaurant available right now." : restaurantBlock) + "\n"
                + "Available accommodations:\n" + (stayBlock.isBlank() ? "• No accommodation available right now." : stayBlock),
            (hasDays ? "خطة مثالية لمدة " + days + " أيام في " + city.getName() + ":\n" : "خطة مثالية في " + city.getName() + ":\n")
                + "الأنشطة المقترحة:\n" + (activityBlock.isBlank() ? "• لا توجد أنشطة متاحة حاليا." : activityBlock) + "\n"
                + "الفعاليات المتاحة:\n" + (eventBlock.isBlank() ? "• لا توجد فعاليات متاحة حاليا." : eventBlock) + "\n"
                + "المطاعم المتاحة:\n" + (restaurantBlock.isBlank() ? "• لا توجد مطاعم متاحة حاليا." : restaurantBlock) + "\n"
                + "الإقامات المتاحة:\n" + (stayBlock.isBlank() ? "• لا توجد إقامات متاحة حاليا." : stayBlock));

        return new IntentAnswer(answer, "TravelPlanCity=" + city.getName(), List.of("cities", "activities", "events", "restaurants", "accommodations"), 0.9);
    }

    private IntentAnswer answerWeatherOverview(Optional<City> cityOpt, Language language) {
        if (cityOpt.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Pour la météo, indiquez une ville tunisienne (ex: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "For weather, please mention a Tunisian city (for example: Tunis, Sousse, Sfax, Nabeul, Hammamet).",
                    "للحصول على الطقس، اذكر مدينة تونسية مثل تونس أو سوسة أو صفاقس أو نابل أو الحمامات."),
                "Weather=need-city",
                List.of("cities"),
                0.82
            );
        }

        City city = cityOpt.get();
        if (city.getLatitude() == null || city.getLongitude() == null) {
            return new IntentAnswer(
                t(language,
                    "Je n'ai pas les coordonnées météo pour " + city.getName() + " dans la base actuelle.",
                    "I do not have weather coordinates for " + city.getName() + " in the current dataset.",
                    "لا أملك إحداثيات الطقس لمدينة " + city.getName() + " في البيانات الحالية."),
                "Weather=missing-coordinates",
                List.of("cities"),
                0.74
            );
        }

        String weather = fetchCurrentWeather(city.getLatitude(), city.getLongitude(), language);
        return new IntentAnswer(
            t(language,
                "Météo actuelle à " + city.getName() + ": " + weather + ".",
                "Current weather in " + city.getName() + ": " + weather + ".",
                "الطقس الحالي في " + city.getName() + ": " + weather + "."),
            "WeatherCity=" + city.getName() + "; Weather=" + weather,
            List.of("cities", "weather"),
            0.88
        );
    }

    private IntentAnswer answerMyReservations(Language language, String normalizedQuestion, String normalizedConversation) {
        Integer userId = resolveAuthenticatedUserId();
        if (userId == null) {
            return new IntentAnswer(
                t(language,
                    "Pour voir vos réservations, connectez-vous d'abord à votre compte.",
                    "To view your reservations, please sign in to your account first.",
                    "لعرض حجوزاتك، يرجى تسجيل الدخول أولا."),
                "Reservations=unauthenticated",
                List.of("auth", "reservations"),
                0.95
            );
        }

        String reservationQuery = normalizedQuestion;
        if ((isLowSignalQuestion(normalizedQuestion) || asksDetailsQuery(normalizedQuestion)) && normalizedConversation != null && !normalizedConversation.isBlank()) {
            reservationQuery = normalizedConversation + " " + normalizedQuestion;
        }

        // Extract requested date from question (e.g. "6/08/2026", "6 aout 2026", "August 6, 2026")
        LocalDate requestedDate = extractRequestedDate(reservationQuery);
        boolean asksReservationDetails = requestedDate != null && asksDetailsQuery(normalizedQuestion);
        boolean asksYesNoReservationCheck = requestedDate != null && !asksReservationDetails && containsAny(normalizedQuestion,
            "est ce que j ai", "est ce que jai", "j ai une reservation", "j ai des reservations",
            "ai je", "do i have", "have i", "est ce que j'ai", "ai-je");

        boolean wantsActivities = containsAny(reservationQuery, "activite", "activites", "activity", "activities");
        boolean wantsEvents = containsAny(reservationQuery, "evenement", "evenements", "event", "events", "festival", "concert");
        boolean wantsAccommodations = containsAny(reservationQuery, "hebergement", "hebergements", "accommodation", "accommodations", "hotel", "stay");
        boolean wantsTransport = containsAny(reservationQuery, "transport", "transports", "trajet", "trip", "voyage", "bus", "train", "taxi");
        boolean wantsSpecific = wantsActivities || wantsEvents || wantsAccommodations || wantsTransport;
        if (!wantsSpecific) {
            wantsActivities = wantsEvents = wantsAccommodations = wantsTransport = true;
        }

        List<ActivityReservation> activityReservations = activityReservationRepository
            .findByUserUserIdOrderByReservationDateDesc(userId, PageRequest.of(0, 20))
            .getContent()
            .stream()
            .filter(r -> requestedDate == null || (r.getReservationDate() != null && r.getReservationDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate().equals(requestedDate)))
            .limit(6)
            .toList();
        List<EventReservation> eventReservations = eventReservationRepository.findByUserUserIdOrderByEventReservationIdDesc(userId)
            .stream()
            .filter(r -> requestedDate == null || (r.getEvent() != null && r.getEvent().getStartDate() != null && r.getEvent().getStartDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate().equals(requestedDate)))
            .limit(6)
            .toList();
        List<Reservation> accommodationReservations = reservationRepository.findByUser_UserId(userId)
            .stream()
            .filter(r -> requestedDate == null || (r.getCheckInDate() != null && r.getCheckInDate().toLocalDate().equals(requestedDate)))
            .limit(6)
            .toList();
        List<TransportReservation> transportReservations = transportReservationRepository.findByUser_UserId(userId)
            .stream()
            .filter(r -> requestedDate == null || (r.getTravelDate() != null && r.getTravelDate().toLocalDate().equals(requestedDate)))
            .limit(6)
            .toList();

        String activityLines = wantsActivities ? activityReservations.stream()
            .map(reservation -> {
                String activityName = "Activity";
                // Try to get activity name from lazy-loaded entity
                try {
                    if (reservation.getActivity() != null) {
                        String name = reservation.getActivity().getName();
                        if (name != null && !name.isBlank()) {
                            activityName = name;
                        }
                    }
                } catch (Exception e1) {
                    // If lazy loading fails, try to fetch from repository
                    try {
                        Integer activityId = reservation.getActivity() != null ? reservation.getActivity().getActivityId() : null;
                        if (activityId != null && activityRepository != null) {
                            Optional<Activity> activity = activityRepository.findById(activityId);
                            if (activity.isPresent() && activity.get().getName() != null && !activity.get().getName().isBlank()) {
                                activityName = activity.get().getName();
                            }
                        }
                    } catch (Exception e2) {
                        // fallback to "Activity"
                    }
                }
                String date = reservation.getReservationDate() == null ? "" : formatEventDate(reservation.getReservationDate());
                String participants = reservation.getNumberOfPeople() == null ? "" : reservation.getNumberOfPeople() + " pax";
                return "• " + activityName + optionalText(date, " - ") + optionalText(participants, " - ") + optionalText(reservation.getStatus() == null ? null : reservation.getStatus().name(), " - ");
            })
            .collect(Collectors.joining("\n")) : "";

        String eventLines = wantsEvents ? eventReservations.stream()
            .map(reservation -> {
                String title;
                String date;
                try {
                    title = reservation.getEvent() == null ? "Event" : reservation.getEvent().getTitle();
                    date = reservation.getEvent() == null ? "" : formatEventDate(reservation.getEvent().getStartDate());
                } catch (Exception ignored) {
                    title = "Event";
                    date = "";
                }
                String status = reservation.getStatus() == null ? "" : reservation.getStatus().name();
                return "• " + title + optionalText(date, " - ") + optionalText(status, " - ");
            })
            .collect(Collectors.joining("\n")) : "";

        String accommodationLines = wantsAccommodations ? accommodationReservations.stream()
            .map(reservation -> {
                String name;
                try {
                    name = reservation.getRoom() == null || reservation.getRoom().getAccommodation() == null
                        ? "Accommodation"
                        : reservation.getRoom().getAccommodation().getName();
                } catch (Exception ignored) {
                    name = "Accommodation";
                }
                String checkIn = reservation.getCheckInDate() == null ? "" : reservation.getCheckInDate().toLocalDate().toString();
                String checkOut = reservation.getCheckOutDate() == null ? "" : reservation.getCheckOutDate().toLocalDate().toString();
                String status = reservation.getStatus() == null ? "" : reservation.getStatus().name();
                return "• " + name + optionalText(checkIn, " - ") + optionalText(checkOut, " -> ") + optionalText(status, " - ");
            })
            .collect(Collectors.joining("\n")) : "";

        String transportLines = wantsTransport ? transportReservations.stream()
            .map(reservation -> {
                String route;
                try {
                    route = reservation.getTransport() == null
                        ? "Transport"
                        : safeCityName(reservation.getTransport().getDepartureCity()) + " -> " + safeCityName(reservation.getTransport().getArrivalCity());
                } catch (Exception ignored) {
                    route = "Transport";
                }
                String date = reservation.getTravelDate() == null ? "" : reservation.getTravelDate().toLocalDate().toString();
                String seats = reservation.getNumberOfSeats() == null ? "" : reservation.getNumberOfSeats() + " seats";
                String status = reservation.getStatus() == null ? "" : reservation.getStatus().name();
                return "• " + route + optionalText(date, " - ") + optionalText(seats, " - ") + optionalText(status, " - ");
            })
            .collect(Collectors.joining("\n")) : "";

        boolean hasAny = !activityLines.isBlank() || !eventLines.isBlank() || !accommodationLines.isBlank() || !transportLines.isBlank();
        if (!hasAny) {
            if (requestedDate != null) {
                String formattedDate = formatReservationDate(requestedDate);
                return new IntentAnswer(
                    t(language,
                        (asksYesNoReservationCheck ? "Non. " : "") + "Vous n'avez pas de réservation le " + formattedDate + ".",
                        (asksYesNoReservationCheck ? "No. " : "") + "You don't have any reservations on " + formattedDate + ".",
                        (asksYesNoReservationCheck ? "لا. " : "") + "ليس لديك حجوزات في " + formattedDate + "."),
                    "Reservations=none-for-date",
                    List.of("reservations"),
                    0.90
                );
            }
            return new IntentAnswer(
                t(language,
                    "Vous n'avez pas encore de réservations.",
                    "You do not have any reservations yet.",
                    "ليس لديك أي حجوزات بعد."),
                "Reservations=none",
                List.of("reservations"),
                0.94
            );
        }

        if (asksYesNoReservationCheck) {
            int total = activityReservations.size() + eventReservations.size() + accommodationReservations.size() + transportReservations.size();
            String formattedDate = formatReservationDate(requestedDate);
            String answer = t(language,
                "Oui. Vous avez " + total + " réservation(s) le " + formattedDate + ".",
                "Yes. You have " + total + " reservation(s) on " + formattedDate + ".",
                "نعم. لديك " + total + " حجز(ات) بتاريخ " + formattedDate + ".");
            return new IntentAnswer(answer, "Reservations=yes-no-date", List.of("reservations"), 0.95);
        }

        // Build response dynamically based on what was requested
        StringBuilder responseFr = new StringBuilder();
        StringBuilder responseEn = new StringBuilder();
        StringBuilder responseAr = new StringBuilder();
        
        if (requestedDate != null) {
            String formattedDate = formatReservationDate(requestedDate);
            responseFr.append("Vos réservations pour le ").append(formattedDate).append(":\n");
            responseEn.append("Your reservations for ").append(formattedDate).append(":\n");
            responseAr.append("حجوزاتك ليوم ").append(formattedDate).append(":\n");
        } else {
            responseFr.append("Voici vos réservations:\n");
            responseEn.append("Here are your reservations:\n");
            responseAr.append("هذه حجوزاتك:\n");
        }
        
        if (requestedDate != null) {
            // For specific date queries, only show types with reservations
            if (!activityLines.isBlank()) {
                responseFr.append("Activités:\n").append(activityLines).append("\n");
                responseEn.append("Activities:\n").append(activityLines).append("\n");
                responseAr.append("الأنشطة:\n").append(activityLines).append("\n");
            }
            if (!eventLines.isBlank()) {
                responseFr.append("Événements:\n").append(eventLines).append("\n");
                responseEn.append("Events:\n").append(eventLines).append("\n");
                responseAr.append("الفعاليات:\n").append(eventLines).append("\n");
            }
            if (!accommodationLines.isBlank()) {
                responseFr.append("Hébergements:\n").append(accommodationLines).append("\n");
                responseEn.append("Accommodations:\n").append(accommodationLines).append("\n");
                responseAr.append("الإقامات:\n").append(accommodationLines).append("\n");
            }
            if (!transportLines.isBlank()) {
                responseFr.append("Transports:\n").append(transportLines);
                responseEn.append("Transport:\n").append(transportLines);
                responseAr.append("النقل:\n").append(transportLines);
            }
        } else {
            // For general queries, show all requested types with "Aucune" for empty ones
            if (wantsActivities && (!activityLines.isBlank() || wantsSpecific)) {
                responseFr.append("Activités:\n").append(activityLines.isBlank() ? "• Aucune" : activityLines).append("\n");
                responseEn.append("Activities:\n").append(activityLines.isBlank() ? "• None" : activityLines).append("\n");
                responseAr.append("الأنشطة:\n").append(activityLines.isBlank() ? "• لا يوجد" : activityLines).append("\n");
            }
            
            if (wantsEvents && (!eventLines.isBlank() || wantsSpecific)) {
                responseFr.append("Événements:\n").append(eventLines.isBlank() ? "• Aucune" : eventLines).append("\n");
                responseEn.append("Events:\n").append(eventLines.isBlank() ? "• None" : eventLines).append("\n");
                responseAr.append("الفعاليات:\n").append(eventLines.isBlank() ? "• لا يوجد" : eventLines).append("\n");
            }
            
            if (wantsAccommodations && (!accommodationLines.isBlank() || wantsSpecific)) {
                responseFr.append("Hébergements:\n").append(accommodationLines.isBlank() ? "• Aucune" : accommodationLines).append("\n");
                responseEn.append("Accommodations:\n").append(accommodationLines.isBlank() ? "• None" : accommodationLines).append("\n");
                responseAr.append("الإقامات:\n").append(accommodationLines.isBlank() ? "• لا يوجد" : accommodationLines).append("\n");
            }
            
            if (wantsTransport && (!transportLines.isBlank() || wantsSpecific)) {
                responseFr.append("Transports:\n").append(transportLines.isBlank() ? "• Aucune" : transportLines);
                responseEn.append("Transport:\n").append(transportLines.isBlank() ? "• None" : transportLines);
                responseAr.append("النقل:\n").append(transportLines.isBlank() ? "• لا يوجد" : transportLines);
            }
        }
        
        String response = t(language, responseFr.toString(), responseEn.toString(), responseAr.toString());

        return new IntentAnswer(response, "Reservations=user-" + userId, List.of("reservations", "events", "activities", "transport", "accommodations"), 0.92);
    }

    private IntentAnswer answerTransportOverview(List<City> mentionedCities, Language language, String normalizedQuestion) {
        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        boolean asksReservationAction = asksReservationAction(normalizedQuestion);
        LocalDate requestedDate = extractRequestedDate(normalizedQuestion);
        int requestedPassengers = Math.max(1, extractRequestedParticipants(normalizedQuestion));
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
                if (asksReservationAction) {
                    String bookingType = requestedTransportType(normalizedQuestion);
                    String bookingLink = buildTransportPrefilledLink(from, to, requestedDate, requestedPassengers, bookingType);
                    return new IntentAnswer(
                        t(language,
                            "Aucun trajet actif trouvé pour le moment entre " + from.getName() + " et " + to.getName() + ". Utilisez ce lien pour lancer une réservation pré-remplie:\n"
                                + bookingLink + "\n" + routeDistanceDurationText(from, to, language),
                            "No active route found right now from " + from.getName() + " to " + to.getName() + ". Use this pre-filled booking link:\n"
                                + bookingLink + "\n" + routeDistanceDurationText(from, to, language),
                            "لم أجد رحلة نشطة حاليا من " + from.getName() + " إلى " + to.getName() + ". استخدم هذا الرابط المعبأ مسبقا للحجز:\n"
                                + bookingLink + "\n" + routeDistanceDurationText(from, to, language)),
                        "TransportBookingLink=" + bookingLink,
                        List.of("transport", "link", "cities"),
                        0.93
                    );
                }
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

            if (asksReservationAction) {
                String typeForLink = selected.getType() == null ? "BUS" : selected.getType().name();
                String bookingLink = buildTransportPrefilledLink(from, to, requestedDate, requestedPassengers, typeForLink);
                return new IntentAnswer(
                    t(language,
                        "Utilisez ce lien de réservation transport pré-rempli:\n" + bookingLink,
                        "Use this pre-filled transport booking link:\n" + bookingLink,
                        "هذا رابط حجز النقل مع تعبئة تلقائية:\n" + bookingLink),
                    "TransportBookingLink=" + bookingLink,
                    List.of("transport", "link"),
                    0.95
                );
            }

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
            if (asksReservationAction && mentionedCities.size() >= 2) {
                City from = mentionedCities.get(0);
                City to = mentionedCities.get(1);
                String bookingLink = buildTransportPrefilledLink(from, to, requestedDate, requestedPassengers, requestedTransportType(normalizedQuestion));
                return new IntentAnswer(
                    t(language,
                        "Je n'ai pas trouvé d'option de transport active pour le moment entre " + from.getName() + " et " + to.getName() + ". Utilisez ce lien pour ouvrir une réservation pré-remplie:\n" + bookingLink,
                        "I could not find any active transport option right now from " + from.getName() + " to " + to.getName() + ". Use this link to open a pre-filled booking:\n" + bookingLink,
                        "لم أجد خيار نقل نشط حاليا من " + from.getName() + " إلى " + to.getName() + ". استخدم هذا الرابط لفتح حجز معبأ مسبقا:\n" + bookingLink),
                    "TransportBookingLink=" + bookingLink,
                    List.of("transport", "link", "cities"),
                    0.93
                );
            }
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

        boolean asksUpcoming = containsAny(normalizedQuestion,
            "a venir", "avenir", "upcoming", "coming", "prochains", "prochaines", "disponible", "disponibles", "available", "availables", "قادمة", "متاحة");
        boolean asksOngoing = containsAny(normalizedQuestion, "en cours", "ongoing", "live now", "maintenant", "الان", "الآن");
        boolean asksCompleted = containsAny(normalizedQuestion, "passe", "passes", "termines", "completed", "past", "historique", "archive", "منتهية", "سابقة");

        YearMonth requestedMonth = extractRequestedMonth(normalizedQuestion);
        boolean asksFree = containsAny(normalizedQuestion,
            "gratuit", "gratuits", "free", "sans frais", "مجاني", "مجانا");
        boolean asksPaid = containsAny(normalizedQuestion,
            "payant", "payants", "paid", "ticket", "tickets", "مدفوع", "تذاكر");
        boolean asksReservationAction = asksReservationAction(normalizedQuestion);
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

        if (cityOpt.isEmpty()) {
            List<Event> cityMentionedEvents = eventRepository.findAll().stream()
                .filter(event -> event.getCity() != null && event.getCity().getName() != null)
                .filter(event -> containsCityAlias(normalizedQuestion, normalize(event.getCity().getName()))
                    || containsCityAlias(normalizedQuestion, normalize(event.getVenue()))
                    || containsCityAlias(normalizedQuestion, normalize(event.getTitle())))
                .toList();
            if (!cityMentionedEvents.isEmpty()) {
                baseEvents = cityMentionedEvents;
            }
        }

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

        if (asksReservationAction) {
            Optional<Event> matched = findMentionedEvent(normalizedQuestion, baseEvents);
            Event event = matched.orElse(null);
            if (event != null) {
                String bookingLink = buildEventPopupLink(event);
                return new IntentAnswer(
                    t(language,
                        "Utilisez ce lien pour ouvrir cet événement et réserver directement:\n" + bookingLink,
                        "Use this link to open this event and reserve directly:\n" + bookingLink,
                        "هذا الرابط لفتح هذا الحدث والحجز مباشرة:\n" + bookingLink),
                    "EventBookingLink=" + bookingLink,
                    List.of("events", "link"),
                    0.95
                );
            }

            List<Event> candidates = baseEvents.stream()
                .filter(e -> !isCompletedEvent(e.getStartDate(), e.getEndDate()))
                .filter(e -> cityOpt.isEmpty() || matchesEventCity(e, cityOpt.get(), normalizedQuestion))
                .sorted(Comparator.comparing(Event::getStartDate, Comparator.nullsLast(Date::compareTo)))
                .limit(5)
                .toList();

            String candidateNames = candidates.stream()
                .map(Event::getTitle)
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .collect(Collectors.joining(", "));

            return new IntentAnswer(
                t(language,
                    "D'accord. De quel événement exact voulez-vous parler pour la réservation?"
                        + (candidateNames.isBlank() ? "" : " Exemples: " + candidateNames + ".")
                        + " Répondez avec le nom exact de l'événement.",
                    "Okay. Which exact event do you want to reserve?"
                        + (candidateNames.isBlank() ? "" : " Examples: " + candidateNames + ".")
                        + " Reply with the exact event name.",
                    "حسنا، ما هو الحدث المحدد الذي تريد حجزه؟"
                        + (candidateNames.isBlank() ? "" : " أمثلة: " + candidateNames + ".")
                        + " أرسل الاسم الدقيق للحدث."),
                "EventReservation=need-specific-event",
                List.of("events"),
                0.93
            );
        }

        Optional<Event> askedEvent = findMentionedEvent(normalizedQuestion, baseEvents);
        if (askedEvent.isPresent()
            && !asksDetails
            && !hasExplicitStatusFilter
            && !hasExplicitTimeFilter
            && exactPrice == null
            && maxPrice == null
            && minPrice == null
            && isLowSignalQuestion(normalizedQuestion)) {
            Event selected = askedEvent.get();
            String bookingLink = buildEventPopupLink(selected);
            String details = selected.getTitle()
                + optionalText(selected.getEventType(), " - ")
                + optionalText(selected.getCity() == null ? null : selected.getCity().getName(), " - ")
                + optionalText(selected.getVenue(), " - ")
                + optionalText(formatEventDate(selected.getStartDate()), " - ")
                + optionalText(selected.getStatus(), " - ")
                + optionalText(selected.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", selected.getPrice()), " - ");
            return new IntentAnswer(
                t(language,
                    "J'ai trouvé cet événement: " + details + ". Pour ouvrir/réserver, utilisez ce lien:\n" + bookingLink,
                    "I found this event: " + details + ". To open/book it, use this link:\n" + bookingLink,
                    "وجدت هذه الفعالية: " + details + ". لفتحها/حجزها استخدم هذا الرابط:\n" + bookingLink),
                "EventSelected=" + selected.getTitle() + "; EventBookingLink=" + bookingLink,
                List.of("events", "link"),
                0.96
            );
        }

        int resultLimit = (asksCheapest(normalizedQuestion) || asksMostExpensive(normalizedQuestion)) ? 1 : 6;
        boolean questionMentionsCity = findMentionedCity(normalizedQuestion, citiesForNlpMatching()).isPresent();

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
            .filter(event -> maxPrice == null || (event.getPrice() != null && event.getPrice() <= maxPrice))
            .filter(event -> minPrice == null || (event.getPrice() != null && event.getPrice() >= minPrice))
            .filter(event -> matchesEventType(event, normalizedQuestion))
            .filter(event -> cityOpt.isPresent()
                ? matchesEventCity(event, cityOpt.get(), normalizedQuestion)
                : !questionMentionsCity || matchesEventCityFromQuestion(event, normalizedQuestion))
            .sorted(Comparator.comparing(Event::getStartDate, Comparator.nullsLast(Date::compareTo)))
            .limit(resultLimit)
            .toList();

        if (events.isEmpty() && cityOpt.isPresent()) {
            events = eventRepository.findAll().stream()
                .filter(event -> matchesEventCity(event, cityOpt.get(), normalizedQuestion))
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
                .filter(event -> maxPrice == null || (event.getPrice() != null && event.getPrice() <= maxPrice))
                .filter(event -> minPrice == null || (event.getPrice() != null && event.getPrice() >= minPrice))
                .filter(event -> matchesEventType(event, normalizedQuestion))
                .sorted(Comparator.comparing(Event::getStartDate, Comparator.nullsLast(Date::compareTo)))
                .limit(resultLimit)
                .toList();
        }

        if (events.isEmpty() && cityOpt.isEmpty()) {
            events = eventRepository.findAll().stream()
                .filter(event -> !questionMentionsCity || matchesEventCityFromQuestion(event, normalizedQuestion))
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
                .filter(event -> maxPrice == null || (event.getPrice() != null && event.getPrice() <= maxPrice))
                .filter(event -> minPrice == null || (event.getPrice() != null && event.getPrice() >= minPrice))
                .filter(event -> matchesEventType(event, normalizedQuestion))
                .sorted(Comparator.comparing(Event::getStartDate, Comparator.nullsLast(Date::compareTo)))
                .limit(resultLimit)
                .toList();
        }

        if (events.isEmpty()) {
            String cityName = cityOpt.map(City::getName).orElse("");
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
                                                    : cityName.isBlank()
                                                        ? "Je suis désolé, je n'ai pas encore d'événements disponibles dans l'application."
                                                        : "Je suis désolé, je n'ai pas trouvé d'événements disponibles pour le moment à " + cityName + ".",
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
                                                    : cityName.isBlank()
                                                        ? "I am sorry, I do not have events available in the app yet."
                                                        : "I am sorry, I could not find available events in " + cityName + " for now.",
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
                            : cityName.isBlank()
                                ? "عذرا، لا توجد فعاليات متاحة حاليا في التطبيق."
                                : "عذرا، لم أجد فعاليات متاحة حاليا في " + cityName + "."),
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
        if (containsAny(normalizedQuestion,
            "mes favoris", "mes favorits", "my favorites", "my favourites", "wishlist", "favoris", "favoriris", "favori", "favourites",
            "ma cart", "mon panier", "mes paniers", "my cart", "cart", "panier")) {
            return answerMyProductCollections(language, normalizedQuestion);
        }
        if (containsAny(normalizedQuestion, "mes produits", "my products", "produits de mon compte", "my artisan products")) {
            return answerMyArtisanProducts(language);
        }

        Double maxPrice = extractMaxPrice(normalizedQuestion);
        Double minPrice = extractMinPrice(normalizedQuestion);
        ProductCategory requestedCategory = extractProductCategoryPreference(normalizedQuestion);
        String requestedColor = extractColorPreference(normalizedQuestion);
        String artisanTerm = extractArtisanFilter(normalizedQuestion);
        boolean shouldFilterByArtisan = artisanTerm != null && !isIgnoredProductTerm(artisanTerm);
        boolean asksStock = containsAny(normalizedQuestion, "stock", "disponibilite", "disponibilité", "quantite", "quantité");
        boolean asksWhere = containsAny(normalizedQuestion, "ou", "where");
        boolean asksInStock = containsAny(normalizedQuestion, "en stock", "disponible", "available", "in stock");
        boolean asksOutOfStock = containsAny(normalizedQuestion, "rupture", "out of stock", "epuise", "épuisé", "non disponible");
        boolean asksTextile = containsAny(normalizedQuestion, "textile", "vetement", "vêtement", "habit", "clothes", "cloth");
        boolean asksColorQuery = containsAny(normalizedQuestion, "couleur", "couleurs", "color", "colors", "coloris");
        boolean asksSizeQuery = containsAny(normalizedQuestion, "taille", "tailles", "size", "sizes");
        boolean asksOnlyCheapest = asksCheapest(normalizedQuestion) || containsAny(normalizedQuestion, "moins cher", "low cost");
        boolean asksOnlyMostExpensive = asksMostExpensive(normalizedQuestion) || containsAny(normalizedQuestion, "cher", "plus cher", "premium");
        boolean genericProductAvailabilityQuery = isGenericProductAvailabilityQuery(normalizedQuestion);
        boolean questionMentionsCity = findMentionedCity(normalizedQuestion, citiesForNlpMatching()).isPresent();
        Optional<Product> matchedProduct = findBestMatchingProduct(normalizedQuestion, cityOpt);
        boolean asksProductPurchaseAction = asksProductPurchaseAction(normalizedQuestion);

        if (asksProductPurchaseAction) {
            if (matchedProduct.isPresent()) {
                Product product = matchedProduct.get();
                String price = product.getPrice() == null
                    ? t(language, "prix non disponible", "price not available", "السعر غير متوفر")
                    : String.format(Locale.ROOT, "%.0f DT", product.getPrice());
                int stock = effectiveProductStock(product);
                String seller = describeProductSeller(product);

                String answer = t(language,
                    "Pour acheter " + product.getName() + ": ouvrez la fiche produit, choisissez la couleur/taille si disponible, ajoutez au panier, puis passez au paiement. Prix: "
                        + price + ", stock: " + stock + "."
                        + optionalText(seller, " Artisan: "),
                    "To buy " + product.getName() + ": open the product details, choose color/size if available, add it to cart, then proceed to checkout. Price: "
                        + price + ", stock: " + stock + "."
                        + optionalText(seller, " Seller: "),
                    "لشراء " + product.getName() + ": افتح صفحة المنتج، اختر اللون/المقاس إن وُجد، أضف إلى السلة، ثم أكمل الدفع. السعر: "
                        + price + "، المخزون: " + stock + "."
                        + optionalText(seller, " البائع: "));

                return new IntentAnswer(answer, "ProductPurchase=" + product.getName(), List.of("products", "cart", "orders"), 0.95);
            }

            return new IntentAnswer(
                t(language,
                    "Pour acheter un produit artisanal: ouvrez sa fiche, choisissez les options, ajoutez-le au panier, puis validez le paiement.",
                    "To buy an artisan product: open its details page, choose options, add it to cart, then complete checkout.",
                    "لشراء منتج حرفي: افتح صفحة المنتج، اختر الخيارات، أضف إلى السلة، ثم أكمل الدفع."),
                "ProductPurchase=generic",
                List.of("products", "cart", "orders"),
                0.91
            );
        }

        if (genericProductAvailabilityQuery) {
            List<Product> broadList = productRepository.findAllPublished().stream()
                .filter(product -> product.getPrice() == null || maxPrice == null || product.getPrice() <= maxPrice)
                .filter(product -> product.getPrice() == null || minPrice == null || product.getPrice() >= minPrice)
                .filter(product -> requestedCategory == null || product.getCategory() == requestedCategory)
                .filter(product -> !asksTextile || product.getCategory() == ProductCategory.TEXTILE)
                .filter(product -> !shouldFilterByArtisan || matchesArtisan(product, artisanTerm))
                .filter(product -> requestedColor == null || matchesProductColor(product, requestedColor))
                .filter(product -> !asksInStock || effectiveProductStock(product) > 0)
                .filter(product -> !asksOutOfStock || effectiveProductStock(product) <= 0)
                .sorted(productComparator(normalizedQuestion))
                .limit(asksOnlyCheapest || asksOnlyMostExpensive ? 1 : 8)
                .toList();
            if (!broadList.isEmpty()) {
                return buildProductListAnswer(broadList, language);
            }
        }

        if ((asksColorQuery || asksSizeQuery) && matchedProduct.isPresent()) {
            Product product = matchedProduct.get();
            String colors = describeAvailableColors(product);
            String sizes = describeAvailableSizes(product);
            String details = "• " + product.getName()
                + optionalText(product.getCategory() == null ? null : product.getCategory().name(), " - ")
                + optionalText(product.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", product.getPrice()), " - ")
                + optionalText(String.valueOf(effectiveProductStock(product)), " - stock: ")
                + optionalText(describeProductSeller(product), " - artisan: ")
                + optionalText(describeProductCity(product), " - ville: ");

            String answer = t(language,
                (asksColorQuery ? "Couleurs disponibles pour " + product.getName() + ": " + (colors.isBlank() ? "non disponibles" : colors) + ".\n" : "")
                    + (asksSizeQuery ? "Tailles disponibles pour " + product.getName() + ": " + (sizes.isBlank() ? "non disponibles" : sizes) + ".\n" : "")
                    + details,
                (asksColorQuery ? "Available colors for " + product.getName() + ": " + (colors.isBlank() ? "not available" : colors) + ".\n" : "")
                    + (asksSizeQuery ? "Available sizes for " + product.getName() + ": " + (sizes.isBlank() ? "not available" : sizes) + ".\n" : "")
                    + details,
                (asksColorQuery ? "الألوان المتاحة لـ " + product.getName() + ": " + (colors.isBlank() ? "غير متاحة" : colors) + ".\n" : "")
                    + (asksSizeQuery ? "المقاسات المتاحة لـ " + product.getName() + ": " + (sizes.isBlank() ? "غير متاحة" : sizes) + ".\n" : "")
                    + details);
            return new IntentAnswer(answer, "ProductVariants=" + product.getName(), List.of("products", "product-variants"), 0.96);
        }

        if (containsAny(normalizedQuestion, "prix", "price")
            || (containsAny(normalizedQuestion, "combien", "how much") && !asksStock)
            || asksWhere) {
            Optional<Product> matched = matchedProduct;

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

                String answer = asksWhere
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

        if (asksStock) {
            if (matchedProduct.isPresent()) {
                Product product = matchedProduct.get();
                int stock = effectiveProductStock(product);
                String variantStocks = describeVariantStocks(product);
                String answer = t(language,
                    "Stock pour " + product.getName() + ": " + stock + " unité(s)"
                        + (variantStocks.isBlank() ? "" : " (" + variantStocks + ")") + ".",
                    "Stock for " + product.getName() + ": " + stock + " unit(s)"
                        + (variantStocks.isBlank() ? "" : " (" + variantStocks + ")") + ".",
                    "المخزون لمنتج " + product.getName() + ": " + stock + " وحدة"
                        + (variantStocks.isBlank() ? "" : " (" + variantStocks + ")") + ".");
                return new IntentAnswer(answer, "ProductStock=" + product.getName() + "; Stock=" + stock, List.of("products", "product-variants"), 0.95);
            }
        }

        List<Product> baseProducts = questionMentionsCity
            ? cityOpt.map(city -> productRepository.findPublishedByCity(city.getCityId())).orElseGet(productRepository::findAllPublished)
            : productRepository.findAllPublished();

        List<Product> products = baseProducts
            .stream()
            .filter(product -> product.getPrice() == null || maxPrice == null || product.getPrice() <= maxPrice)
            .filter(product -> product.getPrice() == null || minPrice == null || product.getPrice() >= minPrice)
            .filter(product -> requestedCategory == null || product.getCategory() == requestedCategory)
            .filter(product -> !asksTextile || product.getCategory() == ProductCategory.TEXTILE)
            .filter(product -> !shouldFilterByArtisan || matchesArtisan(product, artisanTerm))
            .filter(product -> requestedColor == null || matchesProductColor(product, requestedColor))
            .filter(product -> !asksInStock || effectiveProductStock(product) > 0)
            .filter(product -> !asksOutOfStock || effectiveProductStock(product) <= 0)
            // Keep broad listing queries resilient to typos and wording variations.
            .filter(product -> genericProductAvailabilityQuery || matchesProductQuery(product, normalizedQuestion))
            .sorted(productComparator(normalizedQuestion))
            .limit(asksOnlyCheapest || asksOnlyMostExpensive ? 1 : 8)
            .toList();

        if (products.isEmpty() && genericProductAvailabilityQuery) {
            products = productRepository.findAllPublished().stream()
                .filter(product -> product.getPrice() == null || maxPrice == null || product.getPrice() <= maxPrice)
                .filter(product -> product.getPrice() == null || minPrice == null || product.getPrice() >= minPrice)
                .filter(product -> requestedCategory == null || product.getCategory() == requestedCategory)
                .filter(product -> !asksTextile || product.getCategory() == ProductCategory.TEXTILE)
                .filter(product -> !shouldFilterByArtisan || matchesArtisan(product, artisanTerm))
                .filter(product -> requestedColor == null || matchesProductColor(product, requestedColor))
                .filter(product -> !asksInStock || effectiveProductStock(product) > 0)
                .filter(product -> !asksOutOfStock || effectiveProductStock(product) <= 0)
                .sorted(productComparator(normalizedQuestion))
                .limit(asksOnlyCheapest || asksOnlyMostExpensive ? 1 : 8)
                .toList();
        }

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

        return buildProductListAnswer(products, language);
    }

    private IntentAnswer buildProductListAnswer(List<Product> products, Language language) {
        String names = products.stream()
            .map(product -> {
                String seller = describeProductSeller(product);
                String sellerCity = describeProductCity(product);
                String category = product.getCategory() == null ? "" : product.getCategory().name();
                String stock = String.valueOf(effectiveProductStock(product));
                return "• " + product.getName()
                    + optionalText(category, " - ")
                    + optionalText(product.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", product.getPrice()), " - ")
                    + optionalText(stock, " - stock: ")
                    + optionalText(seller, " - artisan: ")
                    + optionalText(sellerCity, " - ville: ")
                    + optionalText(shorten(product.getDescription(), 100), " - ");
            })
            .collect(Collectors.joining("\n"));
        return new IntentAnswer(
            t(language,
                "Produits d'artisanat disponibles:\n" + names,
                "Available artisan products:\n" + names,
                "المنتجات الحرفية المتاحة:\n" + names),
            "Products=" + names,
            List.of("products"),
            0.84
        );
    }

    private IntentAnswer answerMyArtisanProducts(Language language) {
        Integer userId = resolveAuthenticatedUserId();
        if (userId == null) {
            return new IntentAnswer(
                t(language,
                    "Pour voir vos produits, connectez-vous à votre compte artisan.",
                    "To view your products, sign in to your artisan account.",
                    "لعرض منتجاتك، يرجى تسجيل الدخول إلى حسابك الحرفي."),
                "MyProducts=unauthenticated",
                List.of("auth", "products"),
                0.93
            );
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty() || userOpt.get().getUsername() == null || userOpt.get().getUsername().isBlank()) {
            return new IntentAnswer(
                t(language,
                    "Je n'ai pas pu identifier votre compte artisan.",
                    "I could not identify your artisan account.",
                    "لم أتمكن من تحديد حسابك الحرفي."),
                "MyProducts=no-user",
                List.of("products"),
                0.85
            );
        }

        String username = userOpt.get().getUsername();
        List<Product> myProducts = productRepository.findAllByArtisan(username);
        if (myProducts.isEmpty()) {
            return new IntentAnswer(
                t(language,
                    "Vous n'avez pas encore de produits publiés.",
                    "You do not have products yet.",
                    "ليس لديك منتجات بعد."),
                "MyProducts=none",
                List.of("products"),
                0.9
            );
        }

        String lines = myProducts.stream()
            .limit(20)
            .map(product -> "• " + product.getName()
                + optionalText(product.getCategory() == null ? null : product.getCategory().name(), " - ")
                + optionalText(product.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", product.getPrice()), " - ")
                + optionalText(String.valueOf(effectiveProductStock(product)), " - stock: "))
            .collect(Collectors.joining("\n"));

        return new IntentAnswer(
            t(language,
                "Vos produits:\n" + lines,
                "Your products:\n" + lines,
                "منتجاتك:\n" + lines),
            "MyProducts=" + username,
            List.of("products"),
            0.95
        );
    }

    private IntentAnswer answerMyProductCollections(Language language, String normalizedQuestion) {
        Integer userId = resolveAuthenticatedUserId();
        if (userId == null) {
            return new IntentAnswer(
                t(language,
                    "Pour voir vos favoris et votre panier, connectez-vous d'abord à votre compte.",
                    "To view your favorites and cart, please sign in first.",
                    "لعرض المفضلة والسلة، يرجى تسجيل الدخول أولا."),
                "ShopCollections=unauthenticated",
                List.of("auth", "products", "cart"),
                0.95
            );
        }

        // Correct logic: explicitly choose what the user asked for
        boolean wantsFavorites = containsAny(normalizedQuestion, "favoris", "favorits", "favoriris", "favori", "favorites", "favourites", "wishlist", "mes favoris", "my favorites");
        boolean wantsCart = containsAny(normalizedQuestion, "cart", "panier", "basket", "mon panier", "ma cart", "my cart");
        
        // If neither specified explicitly, show both
        if (!wantsFavorites && !wantsCart) {
            wantsFavorites = true;
            wantsCart = true;
        }

        List<Product> favorites = List.of();
        try {
            favorites = productRepository.findFavoritesByUserId(userId);
        } catch (Exception ignored) {
            favorites = List.of();
        }

        List<CartItem> cartItems = List.of();
        try {
            cartItems = cartRepository.findByUser_UserId(userId)
                .map(cart -> cartItemRepository.findByCartIdWithProduct(cart.getCartId()))
                .orElse(List.of());
        } catch (Exception ignored) {
            cartItems = List.of();
        }

        String favoritesText = favorites.stream()
            .limit(10)
            .map(product -> "• " + product.getName()
                + optionalText(product.getPrice() == null ? null : String.format(Locale.ROOT, "%.0f DT", product.getPrice()), " - ")
                + optionalText(String.valueOf(effectiveProductStock(product)), " - stock: "))
            .collect(Collectors.joining("\n"));

        String cartText = cartItems.stream()
            .limit(15)
            .map(item -> {
                String name = item.getProduct() == null ? "Produit" : item.getProduct().getName();
                String quantity = item.getQuantity() == null ? "1" : String.valueOf(item.getQuantity());
                String color = item.getVariant() == null ? "" : optionalText(item.getVariant().getColor(), " - color: ");
                return "• " + name + " - qte: " + quantity + color;
            })
            .collect(Collectors.joining("\n"));

        String answer = t(language,
            (wantsFavorites ? "Vos favoris:\n" + (favoritesText.isBlank() ? "• Aucun produit favori." : favoritesText) + "\n" : "")
                + (wantsCart ? "Produits dans votre panier:\n" + (cartText.isBlank() ? "• Votre panier est vide." : cartText) : ""),
            (wantsFavorites ? "Your favorites:\n" + (favoritesText.isBlank() ? "• No favorite products." : favoritesText) + "\n" : "")
                + (wantsCart ? "Products in your cart:\n" + (cartText.isBlank() ? "• Your cart is empty." : cartText) : ""),
            (wantsFavorites ? "منتجاتك المفضلة:\n" + (favoritesText.isBlank() ? "• لا توجد منتجات مفضلة." : favoritesText) + "\n" : "")
                + (wantsCart ? "منتجات سلتك:\n" + (cartText.isBlank() ? "• سلتك فارغة." : cartText) : ""));

        return new IntentAnswer(answer, "ShopCollections=user-" + userId, List.of("products", "cart", "favorites"), 0.94);
    }

    private boolean requiresAuthentication(Intent intent, String normalizedQuestion, String normalizedConversation) {
        if (intent == Intent.MY_RESERVATIONS || intent == Intent.CART_ACTION) {
            return true;
        }

        String current = normalize(normalizedQuestion == null ? "" : normalizedQuestion);
        return containsAny(current,
            "mes reservations", "mes reservation", "my reservations", "my booking", "my bookings", "reservation personnelle", "personal reservation",
            "mes favoris", "mes favorits", "favoris", "favori", "favorites", "favourites", "wishlist",
            "mon panier", "ma cart", "my cart", "panier", "basket", "cart",
            "mes produits", "my products", "produits de mon compte", "my artisan products");
    }

    private String loginRequiredMessage(Language language, String normalizedQuestion) {
        if (containsAny(normalizedQuestion, "reservation", "reservations", "book", "booking", "reservation personnelle", "mes voyages", "mes sejours")) {
            return t(language,
                "Pour voir vos réservations, connectez-vous d'abord à votre compte.",
                "To view your reservations, please sign in to your account first.",
                "لعرض حجوزاتك، يرجى تسجيل الدخول أولا.");
        }
        if (containsAny(normalizedQuestion, "favoris", "favorits", "favorites", "favourites", "wishlist", "cart", "panier", "basket", "products", "produits", "mes produits")) {
            return t(language,
                "Pour voir vos données personnelles, connectez-vous d'abord à votre compte.",
                "To view your personal data, please sign in to your account first.",
                "لعرض بياناتك الشخصية، يرجى تسجيل الدخول أولا.");
        }
        return t(language,
            "Pour voir vos données personnelles, connectez-vous d'abord à votre compte.",
            "To view your personal data, please sign in to your account first.",
            "لعرض بياناتك الشخصية، يرجى تسجيل الدخول أولا.");
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
        if (isCityCountQuestion(normalizedQuestion)) {
            return answerCityCount(allCities, language);
        }

        if (mentionedCity.isPresent() && containsAny(normalizedQuestion,
            "go to", "travel to", "want to go", "i want to go", "u want to go",
            "visit", "je veux aller", "aller a", "aller vers", "visiter", "voyager a", "voyage a",
            "اريد ان اذهب الى", "اريد الذهاب الى", "اذهب الى", "الذهاب الى")) {
            return answerTravelPlan(mentionedCity, language, normalizedQuestion);
        }

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

    private Intent inferIntentWithGemini(String question, String normalizedUserConversation) throws IOException, InterruptedException {
        String base = geminiBaseUrl.endsWith("/") ? geminiBaseUrl.substring(0, geminiBaseUrl.length() - 1) : geminiBaseUrl;
        String modelPath = geminiModel.startsWith("models/") ? geminiModel : "models/" + geminiModel;
        String endpoint = base + "/" + modelPath + ":generateContent?key=" + encode(geminiApiKey);

        String allowed = Arrays.stream(Intent.values())
            .map(Intent::name)
            .collect(Collectors.joining(", "));

        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode contents = root.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");

        parts.addObject().put("text",
            "You are a strict intent classifier for YallaTN chatbot. "
                + "Classify the current user question into exactly one allowed intent label. "
                + "Allowed intents: " + allowed + ". "
                + "Use recent user context for workflow continuation when needed. "
                + "Reply ONLY valid JSON with this schema: {\"intent\":\"LABEL\"}. "
                + "If uncertain, return {\"intent\":\"GENERAL_TUNISIA\"}. "
                + "Current user question: " + (question == null ? "" : question) + ". "
                + "Recent user context: " + (normalizedUserConversation == null ? "" : normalizedUserConversation));

        ObjectNode generationConfig = root.putObject("generationConfig");
        generationConfig.put("temperature", 0.0);
        generationConfig.put("maxOutputTokens", 48);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(endpoint))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("x-goog-api-key", geminiApiKey)
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            return null;
        }

        String geminiText = extractGeminiText(objectMapper.readTree(response.body()));
        return parseGeminiIntent(geminiText);
    }

    private Intent parseGeminiIntent(String geminiText) {
        if (geminiText == null || geminiText.isBlank()) {
            return null;
        }

        String cleaned = geminiText.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace("```json", "").replace("```", "").trim();
        }

        try {
            JsonNode node = objectMapper.readTree(cleaned);
            Intent parsed = safeIntent(node.path("intent").asText(""));
            if (parsed != null) {
                return parsed;
            }
        } catch (Exception ignored) {
            // fallback to label scan
        }

        String upper = cleaned.toUpperCase(Locale.ROOT);
        for (Intent value : Intent.values()) {
            if (upper.contains("\"" + value.name() + "\"") || upper.matches(".*\\b" + value.name() + "\\b.*")) {
                return value;
            }
        }

        return null;
    }

    private Intent safeIntent(String label) {
        if (label == null || label.isBlank()) {
            return null;
        }
        try {
            return Intent.valueOf(label.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ignored) {
            return null;
        }
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

    private List<City> citiesForNlpMatching() {
        return cityRepository.findAll().stream()
                .filter(c -> !c.isExcludedFromPublicCityCatalog())
                .collect(Collectors.toList());
    }

    private Optional<City> findMentionedCity(String normalizedQuestion, List<City> cities) {
        for (City city : cities) {
            if (city.getName() == null || city.getName().isBlank()) {
                continue;
            }
            String token = normalize(city.getName());
            if (containsCityAlias(normalizedQuestion, token)) {
                return Optional.of(city);
            }
        }
        return Optional.empty();
    }

    private List<City> findMentionedCities(String normalizedQuestion, List<City> cities) {
        return cities.stream()
            .filter(city -> city.getName() != null && !city.getName().isBlank())
            .filter(city -> containsCityAlias(normalizedQuestion, normalize(city.getName())))
            .limit(2)
            .toList();
    }

    private List<City> findMentionedCitiesInQuestionOrder(String normalizedQuestion, List<City> cities) {
        return cities.stream()
            .filter(city -> city.getName() != null && !city.getName().isBlank())
            .map(city -> Map.entry(city, cityMentionIndex(normalizedQuestion, normalize(city.getName()))))
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
            "plage", "beach", "sahel", "coast", "medina", "voyage", "tourisme", "trip", "plan", "itineraire", "weather", "meteo", "météo", "temperature", "app", "application", "login", "compte",
            "نقل", "سكن", "مطعم", "نشاط", "انشطة", "الانشطة", "الأنشطة", "فعالية", "منتج", "حرف", "تطبيق", "مدينة", "مدن", "حجز", "الحجز", "حجوزات", "اذهب", "سفر"
        );
        for (String keyword : keywords) {
            if (containsToken(normalizedQuestion, normalize(keyword))) {
                return true;
            }
        }
        return findMentionedCity(normalizedQuestion, cities).isPresent();
    }

    private boolean isSmallTalkOrPoliteness(String normalizedQuestion) {
        if (containsAny(normalizedQuestion,
            "reservation", "reserver", "book", "booking", "activity", "activite", "event", "evenement", "transport",
            "hotel", "accommodation", "hebergement", "restaurant", "product", "artisan", "weather", "meteo", "météo",
            "cart", "panier", "ville", "city")) {
            return false;
        }
        return containsAny(normalizedQuestion,
            "hello", "hi", "hey", "good morning", "good evening", "thanks", "thank you", "please", "can i ask", "ask question", "i can ask you a question",
            "how are you", "are you fine", "you are fine", "you re fine", "are you ok", "you re ok", "you okay",
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
        // Avoid fuzzy collisions for very short tokens.
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

        // Keep edit-distance matching for longer words only to avoid cases like "buy" matching "bus".
        if (wordStem.length() < 4 || tokenStem.length() < 4) {
            return false;
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

    private String buildUserConversationContext(List<String> conversation) {
        if (conversation == null || conversation.isEmpty()) {
            return "";
        }
        return conversation.stream()
            .filter(line -> line != null && !line.isBlank())
            .skip(Math.max(0, conversation.size() - 10))
            .map(String::trim)
            .filter(line -> line.toLowerCase(Locale.ROOT).startsWith("user:"))
            .map(line -> line.substring("user:".length()).trim())
            .filter(line -> !line.isBlank())
            .collect(Collectors.joining(" "));
    }

    private Intent detectConversationIntent(List<String> conversation, String normalizedUserConversation) {
        if (conversation != null && !conversation.isEmpty()) {
            for (int i = conversation.size() - 1; i >= 0; i--) {
                String line = conversation.get(i);
                if (line == null || line.isBlank()) {
                    continue;
                }
                String trimmed = line.trim();
                if (!trimmed.toLowerCase(Locale.ROOT).startsWith("user:")) {
                    continue;
                }
                String userTurn = normalize(trimmed.substring("user:".length()).trim());
                if (userTurn.isBlank()) {
                    continue;
                }
                Intent turnIntent = detectIntent(userTurn);
                if (turnIntent != Intent.SMALL_TALK && turnIntent != Intent.GENERAL_TUNISIA) {
                    return turnIntent;
                }
            }
        }

        if (normalizedUserConversation == null || normalizedUserConversation.isBlank()) {
            return Intent.GENERAL_TUNISIA;
        }

        Intent fallback = detectIntent(normalizedUserConversation);
        return fallback == Intent.SMALL_TALK ? Intent.GENERAL_TUNISIA : fallback;
    }

    private boolean conversationLooksLikeEventClarification(String normalizedConversation) {
        if (normalizedConversation == null || normalizedConversation.isBlank()) {
            return false;
        }
        return containsAny(normalizedConversation,
            "de quel evenement exact", "which exact event", "exact event", "nom exact de l evenement",
            "reply with the exact event name", "eventreservation=need-specific-event", "reserve evenement");
    }

    private boolean asksReservationAction(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "reservation", "reservations", "reserver", "réserver", "book", "booking", "reserve", "reservate", "make reservation", "make a reservation", "book me", "book it", "payer", "payment", "checkout", "buy ticket",
            "حجز", "الحجز", "احجز", "حجوزات", "دفع");
    }

    private boolean asksProductPurchaseAction(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "buy", "how to buy", "purchase", "acheter", "comment acheter", "commander",
            "order this product", "add to cart", "ajouter au panier", "checkout", "payer", "payment");
    }

    private Intent inferEntityIntentFromNames(String normalizedQuestion, Optional<City> cityOpt) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return null;
        }

        if (cityOpt.isPresent() && isCityOnlyQuestion(normalizedQuestion, cityOpt.get())) {
            return null;
        }

        List<Activity> activities = cityOpt
            .map(city -> activityRepository.findByCityCityIdOrderByActivityIdDesc(city.getCityId()))
            .orElseGet(activityRepository::findAll);
        if (findMentionedActivity(normalizedQuestion, activities).isPresent()
            || findActivityByKeyword(normalizedQuestion, activities).isPresent()) {
            return Intent.ACTIVITY;
        }

        List<Event> events = cityOpt
            .map(city -> eventRepository.findByCityCityId(city.getCityId()))
            .orElseGet(eventRepository::findAll);
        if (findMentionedEvent(normalizedQuestion, events).isPresent()) {
            return Intent.EVENT;
        }

        List<Accommodation> accommodations = cityOpt
            .map(city -> accommodationRepository.findByCity_CityId(city.getCityId()))
            .orElseGet(accommodationRepository::findAll);
        if (findMentionedAccommodation(normalizedQuestion, accommodations).isPresent()) {
            return Intent.ACCOMMODATION;
        }

        if (findBestMatchingProduct(normalizedQuestion, cityOpt).isPresent()) {
            return Intent.PRODUCT;
        }

        return null;
    }

    private boolean shouldAllowEntityIntentOverride(Intent currentIntent, Intent entityIntent, String normalizedQuestion, Optional<City> cityOpt) {
        if (entityIntent == null) {
            return false;
        }
        if (currentIntent == entityIntent) {
            return false;
        }
        if (isCityCountQuestion(normalizedQuestion)) {
            return false;
        }
        if (cityOpt.isPresent() && isCityOnlyQuestion(normalizedQuestion, cityOpt.get())) {
            return false;
        }

        // Keep strict domain intent when route/weather/cart/city-count is explicit.
        if (currentIntent == Intent.TRANSPORT
            || currentIntent == Intent.WEATHER
            || currentIntent == Intent.CITY_COUNT
            || currentIntent == Intent.CART_ACTION
            || hasFromToRoutePattern(normalizedQuestion)
            || isTravelRouteQuery(normalizedQuestion)
            || containsAny(normalizedQuestion, "weather", "meteo", "météo", "temperature", "climat")) {
            return false;
        }

        if (asksReservationAction(normalizedQuestion)) {
            return currentIntent == Intent.GENERAL_TUNISIA || currentIntent == Intent.APPLICATION_HELP;
        }

        return currentIntent == Intent.GENERAL_TUNISIA || currentIntent == Intent.APPLICATION_HELP;
    }

    private boolean conversationLooksLikeCartClearConfirmation(String normalizedConversation) {
        if (normalizedConversation == null || normalizedConversation.isBlank()) {
            return false;
        }
        return containsAny(normalizedConversation,
            "cartclearconfirmation", "confirmez la suppression", "vider votre panier", "repondez par oui",
            "confirm clearing", "clear your cart", "reply yes to confirm", "reply yes",
            "تأكيد", "حذف كل منتجات السلة", "أجب بنعم");
    }

    private boolean looksLikeConfirmationReply(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "oui", "yes", "confirm", "confirmer", "d accord", "ok", "okay", "yep", "sure", "نعم", "ايوه", "أيوا");
    }

    private boolean looksLikeCancellationReply(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "non", "no", "annuler", "cancel", "stop", "laisse", "laisser", "لا", "الغاء", "إلغاء");
    }

    private boolean isCityCountQuestion(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return false;
        }
        boolean asksCount = containsAny(normalizedQuestion,
            "combien", "how many", "nombre", "number", "count", "كم", "عدد");
        boolean asksCities = containsAny(normalizedQuestion,
            "ville", "villes", "city", "cities", "مدن", "مدينة");
        boolean mentionsTunisia = containsAny(normalizedQuestion,
            "tunisie", "tunisia", "tunisian", "tunisienne", "تونس");
        boolean mentionsOtherCountry = containsAny(normalizedQuestion,
            "france", "maroc", "morocco", "algerie", "algeria", "egypte", "egypt",
            "libye", "libya", "italy", "italie", "spain", "espagne", "germany", "allemagne",
            "usa", "united states", "uk", "royaume uni");
        if (mentionsOtherCountry && !mentionsTunisia) {
            return false;
        }
        return asksCount && asksCities;
    }

    private boolean asksCartClearAction(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return false;
        }
        boolean hasCartWord = containsAny(normalizedQuestion,
            "panier", "cart", "basket", "ma cart", "mon panier", "my cart", "سلة");
        boolean hasClearVerb = containsAny(normalizedQuestion,
            "vider", "vide", "supprime", "supprimer", "enlever tout", "clear", "empty", "remove all", "delete all", "purge", "افرغ", "امسح");
        return hasCartWord && hasClearVerb;
    }

    private String requestedTransportType(String normalizedQuestion) {
        if (containsAny(normalizedQuestion, "train")) {
            return "TRAIN";
        }
        if (containsAny(normalizedQuestion, "taxi")) {
            return "TAXI";
        }
        if (containsAny(normalizedQuestion, "plane", "avion")) {
            return "PLANE";
        }
        if (containsAny(normalizedQuestion, "ferry")) {
            return "FERRY";
        }
        if (containsAny(normalizedQuestion, "bus")) {
            return "BUS";
        }
        return "BUS";
    }

    private String frontendBaseUrlNormalized() {
        String base = frontendBaseUrl == null ? "http://localhost:4200" : frontendBaseUrl.trim();
        if (base.isBlank()) {
            return "http://localhost:4200";
        }
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private String buildActivityBookingLink(Activity activity) {
        Integer id = activity == null ? null : activity.getActivityId();
        if (id == null) {
            return frontendBaseUrlNormalized() + "/activities";
        }
        return frontendBaseUrlNormalized() + "/activities/" + id;
    }

    private String buildEventPopupLink(Event event) {
        Integer id = event == null ? null : event.getEventId();
        if (id == null) {
            return frontendBaseUrlNormalized() + "/evenements";
        }
        return frontendBaseUrlNormalized() + "/evenements?eventId=" + id + "&action=book";
    }

    private String buildAccommodationBookingLink(Accommodation accommodation) {
        Integer id = accommodation == null ? null : accommodation.getAccommodationId();
        if (id == null) {
            return frontendBaseUrlNormalized() + "/hebergement";
        }
        return frontendBaseUrlNormalized() + "/hebergement/" + id;
    }

    private String buildTransportPrefilledLink(City from, City to, LocalDate date, int passengers, String transportType) {
        String fromId = from == null || from.getCityId() == null ? "" : String.valueOf(from.getCityId());
        String toId = to == null || to.getCityId() == null ? "" : String.valueOf(to.getCityId());
        String dateValue = date == null ? "" : date + "T09:00:00";
        String type = transportType == null || transportType.isBlank() ? "BUS" : transportType;
        return frontendBaseUrlNormalized()
            + "/transport?from=" + encode(fromId)
            + "&to=" + encode(toId)
            + "&date=" + encode(dateValue)
            + "&passengers=" + Math.max(1, passengers)
            + "&transportType=" + encode(type);
    }

    private Optional<Accommodation> findMentionedAccommodation(String normalizedQuestion, List<Accommodation> accommodations) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || accommodations == null || accommodations.isEmpty()) {
            return Optional.empty();
        }
        int minScore = minimumEntityMentionScore(normalizedQuestion);
        return accommodations.stream()
            .filter(a -> a.getName() != null && !a.getName().isBlank())
            .map(accommodation -> Map.entry(accommodation, activityMentionScore(normalizedQuestion, accommodation.getName())))
            .filter(entry -> entry.getValue() >= minScore)
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey);
    }

    private int minimumEntityMentionScore(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return 6;
        }
        int words = normalizedQuestion.split(" ").length;
        if (words <= 2) {
            return 6;
        }
        return 4;
    }

    private int activityMentionScore(String normalizedQuestion, String entityName) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || entityName == null || entityName.isBlank()) {
            return 0;
        }
        String normalizedName = normalize(entityName);
        int score = 0;
        if (containsToken(normalizedQuestion, normalizedName) || containsToken(normalizedName, normalizedQuestion)) {
            score += 10;
        }
        for (String token : normalizedName.split(" ")) {
            if (token.length() < 4) {
                continue;
            }
            if (containsExactWord(normalizedQuestion, token)) {
                score += 4;
            } else if (containsToken(normalizedQuestion, token)) {
                score += 2;
            }
        }
        return score;
    }

    private boolean isLowSignalQuestion(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return true;
        }

        if (normalizedQuestion.length() <= 12) {
            if (containsAny(normalizedQuestion,
                "event", "evenement", "events", "weather", "meteo", "météo", "transport", "restaurant",
                "activity", "activite", "hotel", "accommodation", "product", "products", "produit", "produits",
                "article", "artisan", "artisans", "artisanat", "cart", "panier",
                "reservation", "booking", "city", "ville")) {
                return false;
            }
            return true;
        }

        return !containsAny(normalizedQuestion,
            "restaurant", "activity", "accommodation", "hebergement", "hotel", "transport", "event", "evenement",
            "product", "products", "produit", "produits", "artisan", "artisans", "artisanat",
            "city", "ville", "destination", "weather", "meteo", "météo", "temperature", "climat",
            "cart", "panier", "reservation", "booking", "villes", "cities", "combien", "how many"
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
            "moins note", "plus mauvais", "pire", "moins bon", "worst", "most bad", "bad restaurant", "lowest rated", "اقل تقييم");
    }

    private Double extractMaxPrice(String normalizedQuestion) {
        List<Double> values = extractAllNumbers(normalizedQuestion);
        if (containsAny(normalizedQuestion, "entre", "between") && values.size() >= 2) {
            return Math.max(values.get(0), values.get(1));
        }
        boolean hasUpperBoundKeyword = containsAny(normalizedQuestion,
            "moins de", "moins que", "maximum", "under", "below", "inferieur", "inferieure", "<", "ne depasse pas", "depasse pas", "au plus", "at most", "no more than")
            || containsExactWord(normalizedQuestion, "max");
        if (!hasUpperBoundKeyword) {
            return null;
        }
        return extractFirstNumber(normalizedQuestion);
    }

    private Double extractMinPrice(String normalizedQuestion) {
        List<Double> values = extractAllNumbers(normalizedQuestion);
        if (containsAny(normalizedQuestion, "entre", "between") && values.size() >= 2) {
            return Math.min(values.get(0), values.get(1));
        }
        boolean hasLowerBoundKeyword = containsAny(normalizedQuestion,
            "plus de", "plus que", "superieur", "superieure", "depasse", "minimum", "above", "over", ">", "au moins", "at least", "not less than")
            || containsExactWord(normalizedQuestion, "min");
        if (!hasLowerBoundKeyword) {
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

        Matcher separatedDateMatcher = Pattern.compile("\\b(\\d{1,2})[\\/\\-](\\d{1,2})(?:[\\/\\-](\\d{2,4}))?\\b").matcher(normalizedQuestion);
        while (separatedDateMatcher.find()) {
            int first = Integer.parseInt(separatedDateMatcher.group(1));
            int second = Integer.parseInt(separatedDateMatcher.group(2));
            String yearGroup = separatedDateMatcher.group(3);
            Integer year = yearGroup == null ? null : Integer.parseInt(yearGroup.length() == 2 ? "20" + yearGroup : yearGroup);

            LocalDate dayMonth = safeBuildDate(first, second, year);
            if (dayMonth != null) {
                return dayMonth;
            }

            LocalDate monthDay = safeBuildDate(second, first, year);
            if (monthDay != null) {
                return monthDay;
            }
        }

        Matcher numericDateMatcher = Pattern.compile("\\b(\\d{1,2})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?\\b").matcher(normalizedQuestion);
        if (numericDateMatcher.find()) {
            int first = Integer.parseInt(numericDateMatcher.group(1));
            int second = Integer.parseInt(numericDateMatcher.group(2));
            String yearGroup = numericDateMatcher.group(3);
            Integer year = yearGroup == null ? null : Integer.parseInt(yearGroup);

            LocalDate dayMonth = safeBuildDate(first, second, year);
            if (dayMonth != null) {
                return dayMonth;
            }

            LocalDate monthDay = safeBuildDate(second, first, year);
            if (monthDay != null) {
                return monthDay;
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

        Matcher m = Pattern.compile("\\b(\\d{1,3})\\s*(personne|personnes|pers|participant|participants|pax|adult|adults|people|person|passenger|passengers|traveler|travelers|traveller|travellers)\\b").matcher(normalizedQuestion);
        Integer day = null;
        Integer month = null;
        Integer year = null;
        String[] parts = normalizedQuestion.split(" ");

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

        Matcher m = Pattern.compile("\\b(\\d{1,3})\\s*(personne|personnes|pers|participant|participants|pax|adult|adults|people|person|passenger|passengers|traveler|travelers|traveller|travellers)\\b").matcher(normalizedQuestion);
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
        int questionWords = normalizedQuestion.split(" ").length;
        for (Activity activity : activities) {
            if (activity.getName() == null || activity.getName().isBlank()) {
                continue;
            }
            String n = normalize(activity.getName());
            if (containsToken(normalizedQuestion, n)) {
                return Optional.of(activity);
            }
            String[] words = n.split(" ");
            int tokenMatches = 0;
            for (String w : words) {
                if (w.length() >= 4 && containsExactWord(normalizedQuestion, w)) {
                    tokenMatches++;
                }
            }
            if (tokenMatches >= 2 || (tokenMatches == 1 && questionWords >= 4)) {
                return Optional.of(activity);
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

    private boolean isActivityBookableSoon(Activity activity, int requestedParticipants) {
        if (activity == null) {
            return false;
        }

        LocalDate today = LocalDate.now();
        LocalDate startDate = activity.getMaxParticipantsStartDate() != null
            ? activity.getMaxParticipantsStartDate()
            : today;
        LocalDate from = startDate.isAfter(today) ? startDate : today;
        LocalDate until = from.plusDays(90);
        int neededParticipants = Math.max(1, requestedParticipants);

        Integer maxPerDay = activity.getMaxParticipantsPerDay();
        if (maxPerDay == null || maxPerDay <= 0) {
            return true;
        }

        for (LocalDate day = from; !day.isAfter(until); day = day.plusDays(1)) {
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
        String normalizedCuisine = normalizeCuisineValue(cuisineText(restaurant.getCuisineType()));
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

        if (containsAny(normalizedQuestion,
            "artisan", "artisans", "artisanat", "craft",
            "product", "products", "produit", "produits",
            "category", "categorie", "stock", "prix", "price",
            "disponible", "disponibles", "available")) {
            return true;
        }

        return containsToken(normalizedQuestion, name)
            || containsToken(normalizedQuestion, description)
            || containsToken(normalizedQuestion, category)
            || isLikelyGenericProductQuery(normalizedQuestion);
    }

    private boolean isLikelyGenericProductQuery(String normalizedQuestion) {
        return containsAny(normalizedQuestion,
            "produit", "produits", "products", "product", "artisan", "artisans", "artisanat",
            "souvenir", "craft", "marche", "market", "textile", "ceramique", "bois", "tapis",
            "disponible", "disponibles", "available");
    }

    private boolean isGenericProductAvailabilityQuery(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return false;
        }
        boolean asksProducts = containsAny(normalizedQuestion,
            "produit", "produits", "product", "products", "article", "articles",
            "artisan", "artisans", "artisanat", "souvenir", "craft");
        boolean asksAvailability = containsAny(normalizedQuestion,
            "disponible", "disponibles", "available", "availability", "liste", "list", "montre", "affiche", "show", "display");
        boolean asksByArtisans = containsAny(normalizedQuestion,
            "selon les artisans", "par artisan", "par les artisans", "by artisan", "by artisans");
        return asksProducts && (asksAvailability || asksByArtisans);
    }

    private ProductCategory extractProductCategoryPreference(String normalizedQuestion) {
        if (containsExactWord(normalizedQuestion, "textile")
            || containsExactWord(normalizedQuestion, "vetement")
            || containsExactWord(normalizedQuestion, "vêtement")
            || containsExactWord(normalizedQuestion, "habit")
            || containsExactWord(normalizedQuestion, "clothes")) {
            return ProductCategory.TEXTILE;
        }
        if (containsExactWord(normalizedQuestion, "bijou")
            || containsExactWord(normalizedQuestion, "bijoux")
            || containsExactWord(normalizedQuestion, "jewelry")
            || containsExactWord(normalizedQuestion, "jewellery")) {
            return ProductCategory.BIJOUX;
        }
        if (containsExactWord(normalizedQuestion, "ceramique")
            || containsExactWord(normalizedQuestion, "poterie")
            || containsExactWord(normalizedQuestion, "ceramic")) {
            return ProductCategory.CERAMIQUE;
        }
        if (containsExactWord(normalizedQuestion, "bois")
            || containsExactWord(normalizedQuestion, "wood")) {
            return ProductCategory.BOIS;
        }
        if (containsExactWord(normalizedQuestion, "tapis")
            || containsExactWord(normalizedQuestion, "carpet")
            || containsExactWord(normalizedQuestion, "rug")) {
            return ProductCategory.TAPIS;
        }
        return null;
    }

    private String extractColorPreference(String normalizedQuestion) {
        for (String color : List.of("rouge", "bleu", "vert", "noir", "blanc", "beige", "jaune", "marron", "red", "blue", "green", "black", "white", "brown", "yellow")) {
            if (containsExactWord(normalizedQuestion, color)) {
                return normalize(color);
            }
        }
        return null;
    }

    private String extractSizePreference(String normalizedQuestion) {
        for (String size : List.of("xs", "s", "m", "l", "xl", "xxl", "small", "medium", "large")) {
            if (containsExactWord(normalizedQuestion, size)) {
                return normalize(size);
            }
        }
        return null;
    }

    private String extractArtisanFilter(String normalizedQuestion) {
        if (!containsAny(normalizedQuestion, "artisan", "artisant", "artisane", "vendeur", "seller", "par", "de")) {
            return null;
        }
        Matcher explicitMatcher = Pattern.compile("(?:artisan|artisant|artisane|vendeur|seller|par)\\s+(?:de\\s+)?(?:l\\s+|la\\s+|le\\s+)?([a-z0-9._-]{3,}(?:\\s+[a-z0-9._-]{3,}){0,2})").matcher(normalizedQuestion);
        if (explicitMatcher.find()) {
            String candidate = explicitMatcher.group(1).trim();
            if (!isIgnoredProductTerm(candidate)) {
                return candidate;
            }
        }

        Matcher productsMatcher = Pattern.compile("(?:produit|produits|product|products)\\s+de\\s+(?:l\\s+|la\\s+|le\\s+)?([a-z0-9._-]{3,}(?:\\s+[a-z0-9._-]{3,}){0,2})").matcher(normalizedQuestion);
        if (productsMatcher.find()) {
            String candidate = productsMatcher.group(1).trim();
            if (!isIgnoredProductTerm(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private boolean isIgnoredProductTerm(String candidate) {
        String normalizedCandidate = normalize(candidate);
        return containsAny(normalizedCandidate,
            "bijou", "bijoux", "textile", "ceramique", "bois", "tapis", "product", "produit", "artisan", "artisant", "artisane", "stock", "prix", "couleur", "color", "taille", "size");
    }

    private boolean matchesArtisan(Product product, String artisanTerm) {
        if (product == null || artisanTerm == null || artisanTerm.isBlank()) {
            return true;
        }
        try {
            if (product.getUser() == null) {
                return false;
            }
            String username = normalize(product.getUser().getUsername());
            String firstName = normalize(product.getUser().getFirstName());
            String lastName = normalize(product.getUser().getLastName());
            String fullName = normalize((product.getUser().getFirstName() == null ? "" : product.getUser().getFirstName()) + " " + (product.getUser().getLastName() == null ? "" : product.getUser().getLastName()));
            return termMatchesAny(artisanTerm, username, firstName, lastName, fullName);
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean termMatchesAny(String term, String... values) {
        String normalizedTerm = normalize(term);
        if (normalizedTerm.isBlank()) {
            return false;
        }
        for (String value : values) {
            String normalizedValue = normalize(value);
            if (normalizedValue.isBlank()) {
                continue;
            }
            if (containsToken(normalizedValue, normalizedTerm) || containsToken(normalizedTerm, normalizedValue)) {
                return true;
            }
            for (String part : normalizedTerm.split(" ")) {
                if (part.length() < 3) {
                    continue;
                }
                if (containsToken(normalizedValue, part) || levenshteinDistanceAtMostTwo(normalizedValue, part)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean matchesProductColor(Product product, String requestedColor) {
        if (product == null || requestedColor == null || requestedColor.isBlank()) {
            return true;
        }
        String name = normalize(product.getName());
        String description = normalize(product.getDescription());
        if (containsToken(name, requestedColor) || containsToken(description, requestedColor)) {
            return true;
        }
        return loadProductVariants(product).stream()
            .map(ProductVariant::getColor)
            .filter(color -> color != null && !color.isBlank())
            .map(this::normalize)
            .anyMatch(color -> containsToken(color, requestedColor) || containsToken(requestedColor, color));
    }

    private Optional<Product> findBestMatchingProduct(String normalizedQuestion, Optional<City> cityOpt) {
        List<Product> candidates = cityOpt
            .map(city -> productRepository.findPublishedByCity(city.getCityId()))
            .orElseGet(productRepository::findAllPublished);

        return candidates.stream()
            .filter(product -> product.getName() != null && !product.getName().isBlank())
            .map(product -> Map.entry(product, productMentionScore(normalizedQuestion, product)))
            .filter(entry -> entry.getValue() > 0)
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey);
    }

    private String describeProductSeller(Product product) {
        try {
            if (product != null && product.getUser() != null) {
                User user = product.getUser();
                String firstName = user.getFirstName() != null ? user.getFirstName().trim() : "";
                String lastName = user.getLastName() != null ? user.getLastName().trim() : "";
                String fullName = (firstName + " " + lastName).trim();
                if (!fullName.isBlank()) {
                    return fullName;
                }
                if (user.getUsername() != null) {
                    return user.getUsername();
                }
            }
        } catch (Exception ignored) {
            // ignore
        }
        return "";
    }

    private String describeProductCity(Product product) {
        try {
            if (product != null && product.getUser() != null && product.getUser().getCity() != null) {
                String cityName = product.getUser().getCity().getName();
                return cityName == null ? "" : cityName;
            }
        } catch (Exception ignored) {
            // ignore
        }
        return "";
    }

    private String describeAvailableColors(Product product) {
        return loadProductVariants(product).stream()
            .map(ProductVariant::getColor)
            .filter(color -> color != null && !color.isBlank())
            .map(this::normalize)
            .distinct()
            .map(this::capitalizeWords)
            .collect(Collectors.joining(", "));
    }

    private String describeAvailableSizes(Product product) {
        return loadProductVariants(product).stream()
            .map(ProductVariant::getSize)
            .filter(size -> size != null && !size.isBlank())
            .map(this::normalize)
            .distinct()
            .map(this::capitalizeWords)
            .collect(Collectors.joining(", "));
    }

    private String capitalizeWords(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return Arrays.stream(value.split("\\s+"))
            .filter(part -> !part.isBlank())
            .map(part -> part.substring(0, 1).toUpperCase(Locale.ROOT) + part.substring(1))
            .collect(Collectors.joining(" "));
    }

    private List<ProductVariant> loadProductVariants(Product product) {
        if (product == null || product.getProductId() == null) {
            return List.of();
        }
        try {
            List<ProductVariant> direct = product.getVariants();
            if (direct != null && !direct.isEmpty()) {
                return direct;
            }
        } catch (Exception ignored) {
            // fallback repository
        }
        try {
            return productVariantRepository.findByProduct_ProductId(product.getProductId());
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private int effectiveProductStock(Product product) {
        if (product == null) {
            return 0;
        }
        List<ProductVariant> variants = loadProductVariants(product);
        int variantStock = variants.stream()
            .map(ProductVariant::getStock)
            .filter(stock -> stock != null && stock > 0)
            .mapToInt(Integer::intValue)
            .sum();
        if (variantStock > 0) {
            return variantStock;
        }
        return product.getStock() == null ? 0 : Math.max(0, product.getStock());
    }

    private String describeVariantStocks(Product product) {
        List<ProductVariant> variants = loadProductVariants(product);
        return variants.stream()
            .filter(variant -> variant.getStock() != null)
            .limit(6)
            .map(variant -> {
                String key = (variant.getColor() == null || variant.getColor().isBlank())
                    ? (variant.getSize() == null ? "variante" : variant.getSize())
                    : variant.getColor() + (variant.getSize() == null ? "" : "/" + variant.getSize());
                return key + ": " + variant.getStock();
            })
            .collect(Collectors.joining(", "));
    }

    private int productMentionScore(String normalizedQuestion, Product product) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || product == null || product.getName() == null || product.getName().isBlank()) {
            return 0;
        }

        String name = normalize(product.getName());
        int score = 0;
        if (containsToken(normalizedQuestion, name) || containsToken(name, normalizedQuestion)) {
            score += 10;
        }
        for (String token : name.split(" ")) {
            if (token.length() < 4) {
                continue;
            }
            if (containsExactWord(normalizedQuestion, token)) {
                score += 3;
            } else if (containsToken(normalizedQuestion, token)) {
                score += 1;
            } else if (levenshteinDistanceAtMostTwo(normalizedQuestion, token)) {
                score += 2;
            }
        }
        return score;
    }

    private boolean levenshteinDistanceAtMostTwo(String leftInput, String rightInput) {
        String left = normalize(leftInput);
        String right = normalize(rightInput);
        if (left.equals(right)) {
            return true;
        }
        if (Math.abs(left.length() - right.length()) > 2) {
            return false;
        }

        int[][] dp = new int[left.length() + 1][right.length() + 1];
        for (int i = 0; i <= left.length(); i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= right.length(); j++) {
            dp[0][j] = j;
        }

        for (int i = 1; i <= left.length(); i++) {
            int rowMin = Integer.MAX_VALUE;
            for (int j = 1; j <= right.length(); j++) {
                int cost = left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                    Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                    dp[i - 1][j - 1] + cost
                );
                rowMin = Math.min(rowMin, dp[i][j]);
            }
            if (rowMin > 2) {
                return false;
            }
        }
        return dp[left.length()][right.length()] <= 2;
    }

    private String optionalText(String value, String prefix) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return prefix + value;
    }

    private boolean containsCityAlias(String normalizedQuestion, String normalizedCityName) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || normalizedCityName == null || normalizedCityName.isBlank()) {
            return false;
        }
        for (String alias : cityAliasTokens(normalizedCityName)) {
            if (containsToken(normalizedQuestion, alias)) {
                return true;
            }
        }
        return false;
    }

    private List<String> cityAliasTokens(String normalizedCityName) {
        String baseName = normalize(normalizedCityName);
        if (baseName.isBlank()) {
            return List.of();
        }

        java.util.LinkedHashSet<String> aliases = new java.util.LinkedHashSet<>();
        aliases.add(baseName);

        String[] parts = baseName.split(" ");
        if (parts.length >= 2) {
            aliases.add(String.join("", parts));
            if (parts[0].length() >= 3 && parts[1].length() >= 3) {
                aliases.add(parts[0] + "-" + parts[1]);
            }
        }

        if (containsToken(baseName, "tunis")) {
            aliases.add("tunis");
            aliases.add("تونس");
        }

        aliases.addAll(arabicCityAliases(baseName));
        return aliases.stream()
            .filter(alias -> alias != null && !alias.isBlank())
            .map(this::normalize)
            .toList();
    }

    private List<String> arabicCityAliases(String normalizedCityName) {
        return switch (normalize(normalizedCityName)) {
            case "tunis" -> List.of("تونس");
            case "sfax" -> List.of("صفاقس");
            case "sousse" -> List.of("سوسة");
            case "kairouan" -> List.of("القيروان", "قيروان");
            case "ariana" -> List.of("اريانة");
            case "ben arous" -> List.of("بن عروس");
            case "bizerte" -> List.of("بنزرت");
            case "nabeul" -> List.of("نابل");
            case "jendouba" -> List.of("جندوبة");
            default -> List.of();
        };
    }

    private boolean matchesEventCity(Event event, City city, String normalizedQuestion) {
        if (event == null || city == null) {
            return false;
        }

        City eventCity = event.getCity();
        if (eventCity != null && eventCity.getCityId() != null && city.getCityId() != null
            && eventCity.getCityId().equals(city.getCityId())) {
            return true;
        }

        if (eventCity != null && eventCity.getName() != null && !eventCity.getName().isBlank()) {
            return containsCityAlias(normalize(eventCity.getName()), normalize(city.getName()));
        }

        String cityName = normalize(city.getName());
        String venue = normalize(event.getVenue());
        String title = normalize(event.getTitle());

        return containsToken(normalizedQuestion, cityName)
            || containsToken(venue, cityName)
            || containsToken(title, cityName);
    }

    private boolean matchesEventCityFromQuestion(Event event, String normalizedQuestion) {
        if (event == null || normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return false;
        }

        City eventCity = event.getCity();
        if (eventCity != null && eventCity.getName() != null && !eventCity.getName().isBlank()) {
            String eventCityName = normalize(eventCity.getName());
            if (containsToken(normalizedQuestion, eventCityName) || containsCityAlias(normalizedQuestion, eventCityName)) {
                return true;
            }
        }

        String venue = normalize(event.getVenue());
        String title = normalize(event.getTitle());
        return containsCityAlias(normalizedQuestion, venue) || containsCityAlias(normalizedQuestion, title);
    }

    private int cityMentionIndex(String normalizedQuestion, String normalizedCityName) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || normalizedCityName == null || normalizedCityName.isBlank()) {
            return -1;
        }
        int bestIndex = -1;
        for (String alias : cityAliasTokens(normalizedCityName)) {
            int index = normalizedQuestion.indexOf(alias);
            if (index >= 0 && (bestIndex < 0 || index < bestIndex)) {
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    private int extractRequestedTripDays(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return -1;
        }
        Matcher matcher = Pattern.compile("\\b(\\d{1,2})\\s*(jour|jours|day|days|nuit|nuits|night|nights)\\b").matcher(normalizedQuestion);
        if (matcher.find()) {
            try {
                int days = Integer.parseInt(matcher.group(1));
                if (days >= 1 && days <= 30) {
                    return days;
                }
            } catch (NumberFormatException ignored) {
                return -1;
            }
        }
        return -1;
    }

    private Integer resolveAuthenticatedUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            return userIdentityResolver.resolveUserId(authentication);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String fetchCurrentWeather(Double latitude, Double longitude, Language language) {
        if (latitude == null || longitude == null) {
            return t(language, "données indisponibles", "data unavailable", "البيانات غير متوفرة");
        }

        String endpoint = "https://api.open-meteo.com/v1/forecast?latitude="
            + latitude + "&longitude=" + longitude + "&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Accept", "application/json")
                .GET()
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return t(language, "service météo indisponible", "weather service unavailable", "خدمة الطقس غير متاحة");
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode current = root.path("current");
            if (current.isMissingNode()) {
                return t(language, "service météo indisponible", "weather service unavailable", "خدمة الطقس غير متاحة");
            }

            double temperature = current.path("temperature_2m").asDouble(Double.NaN);
            double wind = current.path("wind_speed_10m").asDouble(Double.NaN);
            int weatherCode = current.path("weather_code").asInt(-1);

            String codeLabel = weatherCodeLabel(weatherCode, language);
            String tempLabel = Double.isNaN(temperature) ? "" : String.format(Locale.ROOT, "%.1f°C", temperature);
            String windLabel = Double.isNaN(wind)
                ? ""
                : t(language,
                    String.format(Locale.ROOT, "vent %.0f km/h", wind),
                    String.format(Locale.ROOT, "wind %.0f km/h", wind),
                    String.format(Locale.ROOT, "رياح %.0f كم/س", wind));

            String summary = String.join(" - ", java.util.stream.Stream.of(codeLabel, tempLabel, windLabel)
                .filter(part -> part != null && !part.isBlank())
                .toList());

            return summary.isBlank()
                ? t(language, "données indisponibles", "data unavailable", "البيانات غير متوفرة")
                : summary;
        } catch (Exception ignored) {
            return t(language, "service météo indisponible", "weather service unavailable", "خدمة الطقس غير متاحة");
        }
    }

    private String weatherCodeLabel(int code, Language language) {
        return switch (code) {
            case 0 -> t(language, "ciel dégagé", "clear sky", "سماء صافية");
            case 1, 2, 3 -> t(language, "partiellement nuageux", "partly cloudy", "غيوم جزئية");
            case 45, 48 -> t(language, "brouillard", "fog", "ضباب");
            case 51, 53, 55, 56, 57 -> t(language, "bruine", "drizzle", "رذاذ");
            case 61, 63, 65, 66, 67 -> t(language, "pluie", "rain", "مطر");
            case 71, 73, 75, 77 -> t(language, "neige", "snow", "ثلج");
            case 80, 81, 82 -> t(language, "averses", "showers", "زخات");
            case 95, 96, 99 -> t(language, "orage", "thunderstorm", "عاصفة رعدية");
            default -> t(language, "conditions variables", "variable conditions", "حالة جوية متغيرة");
        };
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
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
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

    private String formatReservationDate(LocalDate date) {
        if (date == null) {
            return "";
        }
        return date.format(RESERVATION_DATE_FORMAT);
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
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || activities == null || activities.isEmpty()) {
            return Optional.empty();
        }

        int minScore = minimumEntityMentionScore(normalizedQuestion);

        return activities.stream()
            .filter(a -> a.getName() != null && !a.getName().isBlank())
            .map(activity -> Map.entry(activity, activityMentionScore(normalizedQuestion, activity)))
            .filter(entry -> entry.getValue() >= minScore)
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey);
    }

    private int activityMentionScore(String normalizedQuestion, Activity activity) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank() || activity == null || activity.getName() == null || activity.getName().isBlank()) {
            return 0;
        }

        String normalizedName = normalize(activity.getName());
        int score = 0;

        if (containsToken(normalizedQuestion, normalizedName) || containsToken(normalizedName, normalizedQuestion)) {
            score += 10;
        }

        for (String token : normalizedName.split(" ")) {
            if (token.length() < 4) {
                continue;
            }
            if (containsExactWord(normalizedQuestion, token)) {
                score += 4;
            } else if (containsToken(normalizedQuestion, token)) {
                score += 2;
            }
        }

        if (activity.getCity() != null && activity.getCity().getName() != null) {
            String cityName = normalize(activity.getCity().getName());
            if (containsToken(normalizedQuestion, cityName)) {
                score += 2;
            }
        }

        return score;
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

    private String cuisineText(org.example.backend.model.CuisineType cuisineType) {
        return cuisineType == null ? null : cuisineType.label();
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
        boolean explicitPattern = hasFromToRoutePattern(normalizedQuestion)
            || containsAny(normalizedQuestion, "departure", "destination");
        return travelWord && explicitPattern;
    }

    private boolean hasFromToRoutePattern(String normalizedQuestion) {
        if (normalizedQuestion == null || normalizedQuestion.isBlank()) {
            return false;
        }
        return normalizedQuestion.matches(".*\\b(de|from)\\b.*\\b(a|to|vers)\\b.*");
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
            "je", "j ai", "j ai", "j aimerais", "voudrais", "veux", "propose", "ville", "plage", "moyens", "description", "informations", "donne", "montre", "meilleur", "jours",
            "vers", "reserver", "reservation", "personnes", "activite", "evenement", "transport", "hebergement", "ce lien"
        ));
        int enScore = languageScore(normalizedQuestion, List.of(
            "hello", "hi", "good", "morning", "evening", "i", "i want", "i need", "show", "available", "events", "transport", "description", "cities", "please", "thanks", "thank", "thank you", "give", "best", "from", "to", "days", "reservation", "reservations", "this link", "book", "booking", "how", "activity", "reservate", "want to", "go to", "travel to", "visit", "u want"
        ));

        // Strong language-specific structures
        if (normalizedQuestion.contains("je ") || normalizedQuestion.contains("j ai") || normalizedQuestion.contains("j aimerais") || normalizedQuestion.contains("est ce") || normalizedQuestion.contains("s il")) {
            frScore += 3;
        }
        if (normalizedQuestion.contains("i ")
            || normalizedQuestion.contains("i want")
            || normalizedQuestion.contains("can you")
            || normalizedQuestion.contains("please")
            || normalizedQuestion.contains("give me")
            || normalizedQuestion.contains("show me")
            || normalizedQuestion.contains("how many")) {
            enScore += 3;
        }

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

        if (containsAny(normalizedQuestion, "thanks", "thank", "thank you", "go to", "travel to", "want to go", "u want")) {
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
        CITY_COUNT,
        WORST_RESTAURANT,
        BEST_RESTAURANT,
        BEST_ACTIVITY,
        BEST_ACCOMMODATION,
        RESTAURANT,
        ACTIVITY,
        ACCOMMODATION,
        TRAVEL_PLAN,
        WEATHER,
        MY_RESERVATIONS,
        TRANSPORT,
        EVENT,
        PRODUCT,
        CART_ACTION,
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
