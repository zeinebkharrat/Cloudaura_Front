package org.example.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.dto.publicapi.ChatbotQueryResponse;
import org.example.backend.model.Activity;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.model.Product;
import org.example.backend.model.ProductCategory;
import org.example.backend.model.Restaurant;
import org.example.backend.model.User;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.ActivityReviewRepository;
import org.example.backend.repository.CartItemRepository;
import org.example.backend.repository.CartRepository;
import org.example.backend.repository.CityRepository;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChatbotAssistantServiceWorkflowTest {

    private final CityRepository cityRepository = mock(CityRepository.class);
    private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
    private final ActivityRepository activityRepository = mock(ActivityRepository.class);
    private final ActivityReservationRepository activityReservationRepository = mock(ActivityReservationRepository.class);
    private final ActivityReviewRepository activityReviewRepository = mock(ActivityReviewRepository.class);
    private final AccommodationRepository accommodationRepository = mock(AccommodationRepository.class);
    private final EventRepository eventRepository = mock(EventRepository.class);
    private final EventReservationRepository eventReservationRepository = mock(EventReservationRepository.class);
    private final ProductRepository productRepository = mock(ProductRepository.class);
    private final TransportRepository transportRepository = mock(TransportRepository.class);
    private final RestaurantReviewRepository restaurantReviewRepository = mock(RestaurantReviewRepository.class);
    private final ReservationRepository reservationRepository = mock(ReservationRepository.class);
    private final TransportReservationRepository transportReservationRepository = mock(TransportReservationRepository.class);
    private final UserIdentityResolver userIdentityResolver = mock(UserIdentityResolver.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CartRepository cartRepository = mock(CartRepository.class);
    private final CartItemRepository cartItemRepository = mock(CartItemRepository.class);
    private final ProductVariantRepository productVariantRepository = mock(ProductVariantRepository.class);

    private ChatbotAssistantService service;

    @BeforeEach
    void setUp() {
        service = new ChatbotAssistantService(
            new ObjectMapper(),
            cityRepository,
            restaurantRepository,
            activityRepository,
            activityReservationRepository,
            activityReviewRepository,
            accommodationRepository,
            eventRepository,
            eventReservationRepository,
            productRepository,
            transportRepository,
            restaurantReviewRepository,
            reservationRepository,
            transportReservationRepository,
            userIdentityResolver,
            userRepository,
            cartRepository,
            cartItemRepository,
            productVariantRepository
        );

        ReflectionTestUtils.setField(service, "geminiApiKey", "");
        ReflectionTestUtils.setField(service, "frontendBaseUrl", "http://localhost:4200");

        when(userIdentityResolver.resolveUserId(any())).thenReturn(null);

        when(cityRepository.findAll()).thenReturn(List.of());
        when(activityRepository.findAll()).thenReturn(List.of());
        when(activityRepository.findByCityCityIdOrderByActivityIdDesc(anyInt())).thenReturn(List.of());
        when(activityReviewRepository.findAll()).thenReturn(List.of());

        when(accommodationRepository.findAll()).thenReturn(List.of());
        when(accommodationRepository.findByCity_CityId(anyInt())).thenReturn(List.of());

        when(eventRepository.findAll()).thenReturn(List.of());
        when(eventRepository.findByCityCityId(anyInt())).thenReturn(List.of());

        when(restaurantRepository.findAll()).thenReturn(List.of());
        when(restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(anyInt())).thenReturn(List.of());
        when(restaurantReviewRepository.findAll()).thenReturn(List.of());

        when(productRepository.findAllPublished()).thenReturn(List.of());
        when(productRepository.findPublishedByCity(anyInt())).thenReturn(List.of());
        when(productRepository.findFavoritesByUserId(anyInt())).thenReturn(List.of());

        when(transportRepository.findByIsActiveTrue()).thenReturn(List.of());
        when(transportRepository.findByDepartureCity_CityIdAndArrivalCity_CityIdAndIsActiveTrue(anyInt(), anyInt())).thenReturn(List.of());

        when(cartRepository.findByUser_UserId(anyInt())).thenReturn(Optional.empty());
        when(productVariantRepository.findByProduct_ProductId(anyInt())).thenReturn(List.of());
    }

    @Test
    void nameOnlyActivitySelection_keepsBookingWorkflowEvenAfterGreetingInHistory() {
        City tunis = city(1, "Tunis");
        Activity karting = activity(42, tunis, "Karting Tunisia");

        when(cityRepository.findAll()).thenReturn(List.of(tunis));
        when(activityRepository.findAll()).thenReturn(List.of(karting));

        List<String> conversation = List.of(
            "user: bonjour",
            "assistant: Bonjour! Comment puis-je vous aider?",
            "user: je veux reserver une activité"
        );

        ChatbotQueryResponse response = service.answer("Karting Tunisia", conversation);
        String answer = response.answer().toLowerCase(Locale.ROOT);

        assertTrue(answer.contains("/activities/42"));
        assertFalse(answer.contains("posez votre question"));
    }

    @Test
    void reserveNamedActivity_returnsDirectBookingLink() {
        City tunis = city(1, "Tunis");
        Activity karting = activity(42, tunis, "Karting Tunisia");

        when(cityRepository.findAll()).thenReturn(List.of(tunis));
        when(activityRepository.findAll()).thenReturn(List.of(karting));

        ChatbotQueryResponse response = service.answer("je veux reserver Karting Tunisia", List.of());

        assertTrue(response.answer().toLowerCase(Locale.ROOT).contains("/activities/42"));
    }

    @Test
    void eventKeyword_isHandledAsEventNotWeather() {
        when(cityRepository.findAll()).thenReturn(List.of(city(1, "Tunis")));

        ChatbotQueryResponse response = service.answer("event", List.of());
        String answer = response.answer().toLowerCase(Locale.ROOT);

        assertFalse(answer.contains("meteo"));
        assertFalse(answer.contains("météo"));
        assertFalse(answer.contains("for weather"));
        assertTrue(answer.contains("event") || answer.contains("événement") || answer.contains("evenement"));
    }

    @Test
    void eventsAvailableThisMonth_withoutCity_returnsMatchingEvents() {
        City tunis = city(1, "Tunis");
        Event yallaNghani = event(101, tunis, "yalla nghani", LocalDate.now().plusDays(2));

        when(cityRepository.findAll()).thenReturn(List.of(tunis));
        when(eventRepository.findAll()).thenReturn(List.of(yallaNghani));

        ChatbotQueryResponse response = service.answer("Evenements disponibles ce mois", List.of());

        assertTrue(response.answer().toLowerCase(Locale.ROOT).contains("yalla nghani"));
    }

    @Test
    void travelPlanPrompt_withActivitiesAndRestaurants_returnsTravelPlanSections() {
        City tunis = city(1, "Tunis");
        Activity karting = activity(42, tunis, "Karting Tunisia");
        Event yallaNghani = event(101, tunis, "yalla nghani", LocalDate.now().plusDays(2), 30.0);

        Restaurant darElJeld = new Restaurant();
        darElJeld.setRestaurantId(1);
        darElJeld.setCity(tunis);
        darElJeld.setName("Dar El Jeld");
        darElJeld.setCuisineType("tunisienne");

        when(cityRepository.findAll()).thenReturn(List.of(tunis));
        when(activityRepository.findByCityCityIdOrderByActivityIdDesc(tunis.getCityId())).thenReturn(List.of(karting));
        when(eventRepository.findByCityCityId(tunis.getCityId())).thenReturn(List.of(yallaNghani));
        when(restaurantRepository.findByCityCityIdOrderByRestaurantIdDesc(tunis.getCityId())).thenReturn(List.of(darElJeld));

        ChatbotQueryResponse response = service.answer(
            "j'ai planifié un voyage a tunis pour 2 jours, propose moi les activités et les restaurants",
            List.of()
        );
        String answer = response.answer().toLowerCase(Locale.ROOT);

        assertTrue(answer.contains("plan idéal") || answer.contains("plan ideal"));
        assertTrue(answer.contains("activit"));
        assertTrue(answer.contains("restaurants disponibles"));
        assertFalse(answer.contains("voici des restaurants pertinents"));
    }

    @Test
    void eventBudgetMax_withDinars_excludesEventsAbovePrice() {
        City tunis = city(1, "Tunis");

        Event festivalRoman = event(201, tunis, "festival roman", LocalDate.now().plusDays(1), 20.0);
        Event yallaNghani = event(202, tunis, "yalla nghani", LocalDate.now().plusDays(3), 30.0);
        Event galaPremium = event(203, tunis, "gala premium", LocalDate.now().plusDays(7), 50.0);

        when(cityRepository.findAll()).thenReturn(List.of(tunis));
        when(eventRepository.findAll()).thenReturn(List.of(festivalRoman, yallaNghani, galaPremium));
        when(eventRepository.findByCityCityId(tunis.getCityId())).thenReturn(List.of(festivalRoman, yallaNghani, galaPremium));

        ChatbotQueryResponse response = service.answer("donne moi un evenement a tunis qui a prix moins de 40 dinars", List.of());
        String answer = response.answer().toLowerCase(Locale.ROOT);

        assertTrue(answer.contains("festival roman") || answer.contains("yalla nghani"), answer);
        assertFalse(answer.contains("gala premium"));
        assertFalse(answer.contains("50 dt"));
    }

    @Test
    void eventBudgetMax_withoutMatches_doesNotFallbackToUnfilteredEvents() {
        City tunis = city(1, "Tunis");
        City nabeul = city(2, "Nabeul");

        Event festivalRoman = event(201, tunis, "festival roman", LocalDate.now().plusDays(1), 20.0);
        Event yallaNghani = event(202, tunis, "yalla nghani", LocalDate.now().plusDays(3), 30.0);
        Event hackathon = event(203, nabeul, "hackathon", LocalDate.now().plusDays(7), 50.0);

        when(cityRepository.findAll()).thenReturn(List.of(tunis, nabeul));
        when(eventRepository.findAll()).thenReturn(List.of(festivalRoman, yallaNghani, hackathon));
        when(eventRepository.findByCityCityId(anyInt())).thenReturn(List.of(festivalRoman, yallaNghani, hackathon));

        ChatbotQueryResponse response = service.answer("donne moi un evenement qui a prix moins de 10 dinars", List.of());
        String answer = response.answer().toLowerCase(Locale.ROOT);

        assertFalse(answer.contains("festival roman"));
        assertFalse(answer.contains("yalla nghani"));
        assertFalse(answer.contains("hackathon"));
    }

    @Test
    void typoArtisanProductPrompt_returnsAvailableProducts() {
        Product chachia = product(1, "chachia Tunisienne", ProductCategory.TEXTILE, 10.0, 30, "chachia", "farah", "chebaane");
        Product ceramique = product(2, "Ceramique tunisienne", ProductCategory.CERAMIQUE, 50.0, 30, "", "dorraa", "bdayy");

        when(productRepository.findAllPublished()).thenReturn(List.of(chachia, ceramique));

        ChatbotQueryResponse response = service.answer("donne moi les produiyts disponible selon les artisans", List.of());
        String answer = response.answer().toLowerCase(Locale.ROOT);

        assertTrue(answer.contains("chachia tunisienne") || answer.contains("ceramique tunisienne"));
        assertFalse(answer.contains("i do not have artisan product listings yet"));
        assertFalse(answer.contains("pas encore de produits d'artisanat"));
    }

    @Test
    void typoFollowUpProductPrompt_returnsAvailableProducts() {
        Product chachia = product(1, "chachia Tunisienne", ProductCategory.TEXTILE, 10.0, 30, "chachia", "farah", "chebaane");
        Product ceramique = product(2, "Ceramique tunisienne", ProductCategory.CERAMIQUE, 50.0, 30, "", "dorraa", "bdayy");

        when(productRepository.findAllPublished()).thenReturn(List.of(chachia, ceramique));

        ChatbotQueryResponse response = service.answer("je veux le sproduits disponible", List.of("user: sfax"));
        String answer = response.answer().toLowerCase(Locale.ROOT);

        assertTrue(answer.contains("chachia tunisienne") || answer.contains("ceramique tunisienne"));
        assertFalse(answer.contains("i do not have artisan product listings yet"));
        assertFalse(answer.contains("pas encore de produits d'artisanat"));
    }

    private static City city(int id, String name) {
        City city = new City();
        city.setCityId(id);
        city.setName(name);
        return city;
    }

    private static Activity activity(int id, City city, String name) {
        Activity activity = new Activity();
        activity.setActivityId(id);
        activity.setCity(city);
        activity.setName(name);
        activity.setType("SPORT");
        activity.setPrice(50.0);
        activity.setAddress("Tunis");
        activity.setDescription("Karting activity");
        return activity;
    }

    private static Event event(int id, City city, String title, LocalDate startDate) {
        return event(id, city, title, startDate, 30.0);
    }

    private static Event event(int id, City city, String title, LocalDate startDate, double price) {
        Event event = new Event();
        event.setEventId(id);
        event.setCity(city);
        event.setTitle(title);
        event.setEventType("CULTURAL");
        event.setVenue("Tunis");
        event.setStatus("UPCOMING");
        event.setPrice(price);
        event.setStartDate(Date.from(startDate.atStartOfDay().toInstant(ZoneOffset.UTC)));
        event.setEndDate(Date.from(startDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC)));
        return event;
    }

    private static Product product(int id, String name, ProductCategory category, double price, int stock, String description, String firstName, String lastName) {
        Product product = new Product();
        product.setProductId(id);
        product.setName(name);
        product.setCategory(category);
        product.setPrice(price);
        product.setStock(stock);
        product.setDescription(description);

        User user = new User();
        String username = (firstName + "." + lastName).replace(" ", "").toLowerCase(Locale.ROOT);
        user.setUsername(username);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        product.setUser(user);
        return product;
    }
}
