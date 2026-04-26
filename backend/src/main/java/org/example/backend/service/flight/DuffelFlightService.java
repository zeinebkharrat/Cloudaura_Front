package org.example.backend.service.flight;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.config.DuffelCacheConfig;
import org.example.backend.config.DuffelProperties;
import org.example.backend.dto.flight.AirportResolveResponse;
import org.example.backend.dto.flight.FlightBookingRequest;
import org.example.backend.dto.flight.FlightBookingResponse;
import org.example.backend.dto.flight.FlightDto;
import org.example.backend.dto.flight.FlightOfferDto;
import org.example.backend.dto.flight.FlightSuggestionResponse;
import org.example.backend.exception.InvalidInputException;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.TransportRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class DuffelFlightService {

    private static final String FLIGHT_TYPE_INTERNAL = "internal";
    private static final String FLIGHT_TYPE_EXTERNAL = "external";
    private static final String DEFAULT_TUNISIAN_DESTINATION = "TUN";
    private static final Duration DUFFEL_BLOCK_TIMEOUT = Duration.ofSeconds(10);
    private static final Set<String> TUNISIAN_AIRPORT_IATAS = Set.of(
            "TUN", "NBE", "MIR", "DJE", "SFA", "TOE", "GAF", "TBJ", "OIZ", "EBM"
    );
    private static final Set<String> EXTERNAL_ALLOWED_ARRIVAL_IATAS = Set.of("TUN", "DJE", "NBE", "SFA", "MIR");

    private final WebClient duffelWebClient;
    private final DuffelProperties properties;
    private final ObjectMapper objectMapper;
    private final DestinationAirportResolver destinationAirportResolver;
    private final TransportRepository transportRepository;
    private final CityRepository cityRepository;

    public List<FlightOfferDto> searchFlights(String depIata,
                                               String arrIata,
                                               LocalDate departureDate,
                                               int adults,
                                               String cabinClass,
                                               int limit) {
        return searchFlights(depIata, arrIata, departureDate, adults, cabinClass, limit, null);
    }

    @Cacheable(cacheNames = DuffelCacheConfig.CACHE_FLIGHT_SEARCH,
            key = "T(java.util.Objects).toString(#depIata, '').toUpperCase() + ':' + T(java.util.Objects).toString(#arrIata, '').toUpperCase() + ':' + #departureDate + ':' + #adults + ':' + T(java.util.Objects).toString(#cabinClass, '') + ':' + #limit + ':' + T(java.util.Objects).toString(#type, 'any').toLowerCase()")
    public List<FlightOfferDto> searchFlights(String depIata,
                                              String arrIata,
                                              LocalDate departureDate,
                                              int adults,
                                              String cabinClass,
                                              int limit,
                                              String type) {
        String normalizedType = normalizeFlightType(type);
        if (type != null && !type.isBlank() && normalizedType == null) {
            log.warn("Flight search validation failed: invalid type dep={} arr={} type={}", depIata, arrIata, type);
            throw new FlightValidationException(
                    "api.error.flight.validation.type",
                    "type must be one of: internal, external");
        }

        if (!properties.hasApiKey()) {
            log.warn("Duffel: missing API key (set DUFFEL_API_KEY)");
            return Collections.emptyList();
        }

        String dep = normalizeIata(depIata);
        if (dep == null) {
            log.warn("Flight search validation failed: invalid dep dep={} arr={} type={}", depIata, arrIata, normalizedType);
            throw new FlightValidationException(
                    "api.error.flight.validation.dep_iata",
                    "dep must be a valid IATA code (3 letters)");
        }

        String rawArr = arrIata == null ? null : arrIata.trim();
        String arr = (rawArr == null || rawArr.isBlank()) ? null : normalizeIata(rawArr);
        if (rawArr != null && !rawArr.isBlank() && arr == null) {
            log.warn("Flight search validation failed: invalid arr dep={} arr={} type={}", dep, arrIata, normalizedType);
            throw new FlightValidationException(
                    "api.error.flight.validation.arr_iata",
                    "arr must be a valid IATA code (3 letters)");
        }

        if (!FLIGHT_TYPE_EXTERNAL.equals(normalizedType) && arr == null) {
            log.warn("Flight search validation failed: missing arr dep={} type={}", dep, normalizedType);
            throw new FlightValidationException(
                    "api.error.flight.validation.arr_required",
                    "arr is required for flight search");
        }
        if (FLIGHT_TYPE_INTERNAL.equals(normalizedType) && (!isTunisianAirport(dep) || !isTunisianAirport(arr))) {
            log.warn("Flight search validation failed: internal route must be Tunisian dep={} arr={} type={}", dep, arr, normalizedType);
            throw new FlightValidationException(
                    "api.error.flight.validation.internal_tunisia_only",
                    "type=internal requires both dep and arr to be Tunisian airports");
        }
        if (FLIGHT_TYPE_EXTERNAL.equals(normalizedType)) {
            if (isTunisianAirport(dep)) {
                log.warn("Flight search validation failed: external dep must be non-Tunisian dep={} arr={} type={}", dep, arr, normalizedType);
                throw new FlightValidationException(
                        "api.error.flight.validation.external_dep_non_tunisian",
                        "type=external requires departure from a non-Tunisian airport");
            }
            if (arr == null) {
                log.warn("Flight search external request missing destination; defaulting to {} dep={} type={}", DEFAULT_TUNISIAN_DESTINATION, dep, normalizedType);
                arr = DEFAULT_TUNISIAN_DESTINATION;
            } else if (!isExternalAllowedArrivalAirport(arr)) {
                log.warn("Flight search validation failed: external destination not allowed dep={} arr={} type={}", dep, arr, normalizedType);
                throw new FlightValidationException(
                        "api.error.flight.validation.external_arrival_tunisia_only",
                        "type=external allows arrivals only in Tunisia (TUN, DJE, NBE, SFA, MIR)");
            }
        }

        String date = (departureDate == null ? LocalDate.now().plusDays(14) : departureDate).toString();
        int pax = Math.max(1, Math.min(adults, 9));
        int lim = clampLimit(limit);
        log.info("Duffel flight search dep={} arr={} type={} date={} adults={} cabinClass={} limit={}",
                dep,
                arr,
                normalizedType,
                date,
                pax,
                normalizeCabinClass(cabinClass),
                lim);

        try {
            JsonNode req = buildOfferRequest(dep, arr, date, pax, normalizeCabinClass(cabinClass));
            String body = blockBody(duffelWebClient.post()
                    .uri("/air/offer_requests")
                    .bodyValue(req));

            return parseOfferRequestResponse(body, lim);
        } catch (WebClientResponseException e) {
            log.error("Duffel search HTTP {} dep={} arr={} type={} body={}",
                    e.getStatusCode().value(), dep, arr, normalizedType, e.getResponseBodyAsString());
            throw new DuffelUpstreamException("Flight offer provider returned an error.", e.getStatusCode().value());
        } catch (Exception e) {
            log.error("Duffel search failed dep={} arr={} type={}", dep, arr, normalizedType, e);
            throw new DuffelUpstreamException("Could not reach flight offer provider.", HttpStatus.BAD_GATEWAY.value());
        }
    }

    @Cacheable(cacheNames = DuffelCacheConfig.CACHE_FLIGHT_OFFER, key = "#offerId")
    public FlightOfferDto getOfferById(String offerId) {
        if (!properties.hasApiKey()) {
            throw new DuffelUpstreamException("Duffel API key is not configured.", HttpStatus.BAD_REQUEST.value());
        }
        if (offerId == null || offerId.isBlank()) {
            throw new InvalidInputException("api.error.flight.validation.offer_id", "offerId is required");
        }

        try {
            String body = blockBody(duffelWebClient.get().uri("/air/offers/{id}", offerId.trim()));
            JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
            JsonNode data = root.path("data");
            if (data.isMissingNode() || data.isNull()) {
                throw new DuffelUpstreamException("Offer not found.", HttpStatus.NOT_FOUND.value());
            }
            return mapOffer(data);
        } catch (WebClientResponseException e) {
            log.error("Duffel offer HTTP {}: {}", e.getStatusCode().value(), e.getResponseBodyAsString());
            throw new DuffelUpstreamException("Could not fetch selected offer.", e.getStatusCode().value());
        } catch (DuffelUpstreamException e) {
            throw e;
        } catch (Exception e) {
            log.error("Duffel getOfferById failed", e);
            throw new DuffelUpstreamException("Could not reach flight offer provider.", HttpStatus.BAD_GATEWAY.value());
        }
    }

    @CacheEvict(cacheNames = DuffelCacheConfig.CACHE_FLIGHT_SEARCH, allEntries = true)
    public FlightBookingResponse createOrder(FlightBookingRequest request) {
        if (!properties.hasApiKey()) {
            throw new DuffelUpstreamException("Duffel API key is not configured.", HttpStatus.BAD_REQUEST.value());
        }
        try {
            OfferBookingContext staleContext = fetchOfferBookingContext(request.getOfferId());
            String freshOfferId = refreshOffer(
                    staleContext.depIata(),
                    staleContext.arrIata(),
                    staleContext.departureDate(),
                    staleContext.adults(),
                    staleContext.cabinClass());
            OfferBookingContext freshContext = fetchOfferBookingContext(freshOfferId);

            JsonNode orderPayload = buildOrderRequest(request, freshContext, freshOfferId);
            String body = blockBody(duffelWebClient.post()
                    .uri("/air/orders")
                    .bodyValue(orderPayload));
            return parseBookingResponse(body);
        } catch (WebClientResponseException e) {
            String providerBody = e.getResponseBodyAsString();
            log.error("Duffel booking HTTP {}: {}", e.getStatusCode().value(), providerBody);
            if (e.getStatusCode().value() == 422
                    && providerBody != null
                    && providerBody.toLowerCase(Locale.ROOT).contains("offer_request_already_booked")) {
                throw new DuffelUpstreamException(
                        "This offer has already been booked. Please start a new search.",
                        HttpStatus.CONFLICT.value());
            }
            throw new DuffelUpstreamException("Booking failed with flight provider.", e.getStatusCode().value());
        } catch (DuffelUpstreamException e) {
            throw e;
        } catch (Exception e) {
            log.error("Duffel createOrder failed", e);
            throw new DuffelUpstreamException("Could not complete flight booking.", HttpStatus.BAD_GATEWAY.value());
        }
    }

    @Cacheable(cacheNames = DuffelCacheConfig.CACHE_FLIGHT_SUGGEST,
            key = "T(java.util.Objects).toString(#originIata, '').toUpperCase() + ':' + #destinationQuery.trim().toLowerCase() + ':' + #limit")
    public FlightSuggestionResponse suggestForDestination(String originIata, String destinationQuery, int limit) {
        String origin = originIata == null ? "" : originIata.trim().toUpperCase(Locale.ROOT);
        if (origin.isBlank()) {
            return FlightSuggestionResponse.builder()
                    .originAirportIata(null)
                    .destinationAirportIata(null)
                    .resolvedDestinationLabel(null)
                    .hint("Select an origin airport (IATA), e.g. TUN, CDG, or DXB.")
                    .flights(Collections.emptyList())
                    .build();
        }
        if (origin.length() != 3 || !origin.chars().allMatch(Character::isLetter)) {
            return FlightSuggestionResponse.builder()
                .originAirportIata(origin)
                .destinationAirportIata(null)
                .resolvedDestinationLabel(null)
                .hint("Origin must be a 3-letter IATA code, e.g. TUN, CDG, or DXB.")
                .flights(Collections.emptyList())
                .build();
        }
        Optional<DestinationAirportResolver.ResolvedAirport> dest = destinationAirportResolver.resolve(destinationQuery);
        if (dest.isEmpty()) {
            return FlightSuggestionResponse.builder()
                    .originAirportIata(origin)
                    .destinationAirportIata(null)
                    .resolvedDestinationLabel(null)
                    .hint("Try an IATA code (e.g. CDG) or a known city name (Paris, London, Dubai).")
                    .flights(Collections.emptyList())
                    .build();
        }
        DestinationAirportResolver.ResolvedAirport resolved = dest.get();
        List<FlightDto> flights;
        try {
            flights = searchFlights(
                    origin,
                    resolved.iata(),
                    LocalDate.now().plusDays(14),
                    1,
                    "economy",
                    limit
            ).stream().map(this::toFlightDto).toList();
        } catch (DuffelUpstreamException ex) {
            log.warn("Suggest flights degraded gracefully for {} -> {} (provider status {}): {}",
                    origin, resolved.iata(), ex.getHttpStatus(), ex.getMessage());
            flights = Collections.emptyList();
        }
        return FlightSuggestionResponse.builder()
                .originAirportIata(origin)
                .destinationAirportIata(resolved.iata())
                .resolvedDestinationLabel(resolved.label())
                .hint(flights.isEmpty()
                        ? "No live offers available right now for " + origin + " -> " + resolved.iata() + "."
                        : "Showing available offers from " + origin + " to " + resolved.iata() + " (Duffel).")
                .flights(flights)
                .build();
    }

    private FlightDto toFlightDto(FlightOfferDto offer) {
        if (offer == null) {
            return FlightDto.builder().build();
        }
        return FlightDto.builder()
                .flightNumber(offer.getFlightNumber())
                .airline(offer.getAirline())
                .departureAirport(offer.getDepartureAirport())
                .departureIata(offer.getDepartureIata())
                .arrivalAirport(offer.getArrivalAirport())
                .arrivalIata(offer.getArrivalIata())
                .departureTime(offer.getDepartureTime())
                .arrivalTime(offer.getArrivalTime())
                .status(offer.getStatus())
                .statusCategory(offer.getStatusCategory())
                .departureLatitude(offer.getDepartureLatitude())
                .departureLongitude(offer.getDepartureLongitude())
                .arrivalLatitude(offer.getArrivalLatitude())
                .arrivalLongitude(offer.getArrivalLongitude())
                .totalAmount(offer.getTotalAmount())
                .totalCurrency(offer.getTotalCurrency())
                .build();
    }

    public AirportResolveResponse resolveAirportQuery(String query) {
        return destinationAirportResolver.resolve(query)
                .map(r -> AirportResolveResponse.builder()
                        .query(query)
                        .iata(r.iata())
                        .label(r.label())
                        .found(true)
                        .build())
                .orElseGet(() -> AirportResolveResponse.builder()
                        .query(query)
                        .iata(null)
                        .label(null)
                        .found(false)
                        .build());
    }

    private JsonNode buildOfferRequest(String depIata,
                                       String arrIata,
                                       String departureDate,
                                       int adults,
                                       String cabinClass) {
        List<Object> passengers = new ArrayList<>();
        for (int i = 0; i < adults; i++) {
            passengers.add(java.util.Map.of("type", "adult"));
        }

        java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("type", "offer_request");
        data.put("slices", List.of(java.util.Map.of(
                "origin", depIata,
                "destination", arrIata,
                "departure_date", departureDate
        )));
        data.put("passengers", passengers);
        data.put("cabin_class", cabinClass);

        java.util.Map<String, Object> root = new java.util.LinkedHashMap<>();
        root.put("data", data);
        return objectMapper.valueToTree(root);
    }

    private List<FlightOfferDto> parseOfferRequestResponse(String body, int limit) throws Exception {
        if (body == null || body.isBlank()) {
            return Collections.emptyList();
        }

        JsonNode root = objectMapper.readTree(body);
        JsonNode data = root.path("data");
        if (data.isMissingNode() || data.isNull()) {
            return Collections.emptyList();
        }

        JsonNode offers = data.path("offers");
        if (!offers.isArray()) {
            return Collections.emptyList();
        }

        List<FlightOfferDto> out = new ArrayList<>();
        for (JsonNode offer : offers) {
            out.add(mapOffer(offer));
            if (out.size() >= limit) {
                break;
            }
        }
        return out;
    }

    private JsonNode buildOrderRequest(FlightBookingRequest req, OfferBookingContext offerContext, String selectedOfferId) {
        String bornOn = (req.getBornOn() == null || req.getBornOn().isBlank()) ? "1990-01-01" : req.getBornOn();
        String phone = (req.getPhoneNumber() == null || req.getPhoneNumber().isBlank()) ? "+21600000000" : req.getPhoneNumber();

        java.util.Map<String, Object> passenger = new java.util.LinkedHashMap<>();
        passenger.put("id", offerContext.passengerId());
        passenger.put("type", "adult");
        passenger.put("gender", "m");
        passenger.put("title", "mr");
        passenger.put("given_name", req.getGivenName().trim());
        passenger.put("family_name", req.getFamilyName().trim());
        passenger.put("born_on", bornOn);
        passenger.put("email", req.getEmail().trim());
        passenger.put("phone_number", phone);

        java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("type", "order");
        data.put("selected_offers", List.of(selectedOfferId.trim()));
        data.put("passengers", List.of(passenger));
        data.put("payments", List.of(java.util.Map.of(
            "type", "balance",
            "amount", offerContext.totalAmount(),
            "currency", offerContext.totalCurrency()
        )));

        java.util.Map<String, Object> root = new java.util.LinkedHashMap<>();
        root.put("data", data);
        return objectMapper.valueToTree(root);
    }

    private OfferBookingContext fetchOfferBookingContext(String offerId) throws Exception {
        if (offerId == null || offerId.isBlank()) {
            throw new InvalidInputException("api.error.flight.validation.offer_id", "offerId is required");
        }

        String body = blockBody(duffelWebClient.get().uri("/air/offers/{id}", offerId.trim()));
        JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
        JsonNode data = root.path("data");
        JsonNode slices = data.path("slices");
        JsonNode passengers = data.path("passengers");

        if (!passengers.isArray() || passengers.isEmpty()) {
            throw new DuffelUpstreamException("Selected offer does not contain passengers.", HttpStatus.UNPROCESSABLE_ENTITY.value());
        }

        String passengerId = text(passengers.get(0), "id");
        if (passengerId == null || passengerId.isBlank()) {
            throw new DuffelUpstreamException("Selected offer passenger id is missing.", HttpStatus.UNPROCESSABLE_ENTITY.value());
        }

        String totalAmount = text(data, "total_amount");
        String totalCurrency = text(data, "total_currency");
        if (totalAmount == null || totalAmount.isBlank()) {
            throw new DuffelUpstreamException("Selected offer amount is missing.", HttpStatus.UNPROCESSABLE_ENTITY.value());
        }
        if (totalCurrency == null || totalCurrency.isBlank()) {
            throw new DuffelUpstreamException("Selected offer currency is missing.", HttpStatus.UNPROCESSABLE_ENTITY.value());
        }

        if (!slices.isArray() || slices.isEmpty()) {
            throw new DuffelUpstreamException("Selected offer route is missing.", HttpStatus.UNPROCESSABLE_ENTITY.value());
        }

        JsonNode firstSlice = slices.get(0);
        String depIata = text(firstSlice.path("origin"), "iata_code");
        String arrIata = text(firstSlice.path("destination"), "iata_code");
        if (depIata == null || depIata.isBlank() || arrIata == null || arrIata.isBlank()) {
            throw new DuffelUpstreamException("Selected offer route is incomplete.", HttpStatus.UNPROCESSABLE_ENTITY.value());
        }

        String departureDateRaw = text(firstSlice, "departure_date");
        if ((departureDateRaw == null || departureDateRaw.isBlank())
                && firstSlice.path("segments").isArray()
                && !firstSlice.path("segments").isEmpty()) {
            departureDateRaw = text(firstSlice.path("segments").get(0), "departing_at");
            if (departureDateRaw != null && departureDateRaw.length() >= 10) {
                departureDateRaw = departureDateRaw.substring(0, 10);
            }
        }
        LocalDate departureDate;
        try {
            departureDate = (departureDateRaw == null || departureDateRaw.isBlank())
                    ? LocalDate.now().plusDays(1)
                    : LocalDate.parse(departureDateRaw);
        } catch (Exception ignored) {
            departureDate = LocalDate.now().plusDays(1);
        }

        int adults = Math.max(1, passengers.size());
        String cabinClass = text(data, "cabin_class");
        if (cabinClass == null || cabinClass.isBlank()) {
            cabinClass = "economy";
        }

        return new OfferBookingContext(
                passengerId,
                totalAmount,
                totalCurrency,
                depIata,
                arrIata,
                departureDate,
                adults,
                cabinClass);
    }

    private String refreshOffer(String dep, String arr, LocalDate date, int adults, String cabinClass) throws Exception {
        String dateStr = (date == null ? LocalDate.now().plusDays(1) : date).toString();
        JsonNode req = buildOfferRequest(dep, arr, dateStr, Math.max(1, adults), normalizeCabinClass(cabinClass));
        String body = blockBody(duffelWebClient.post()
                .uri("/air/offer_requests")
                .bodyValue(req));

        List<FlightOfferDto> offers = parseOfferRequestResponse(body, 1);
        if (offers.isEmpty() || offers.get(0).getOfferId() == null || offers.get(0).getOfferId().isBlank()) {
            throw new DuffelUpstreamException("No live offers available for this route.", HttpStatus.CONFLICT.value());
        }
        return offers.get(0).getOfferId();
    }

    private record OfferBookingContext(
            String passengerId,
            String totalAmount,
            String totalCurrency,
            String depIata,
            String arrIata,
            LocalDate departureDate,
            int adults,
            String cabinClass) {}

    private FlightBookingResponse parseBookingResponse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
        JsonNode data = root.path("data");
        if (data.isMissingNode() || data.isNull()) {
            throw new DuffelUpstreamException("Booking failed: invalid provider payload.", HttpStatus.BAD_GATEWAY.value());
        }
        return FlightBookingResponse.builder()
                .orderId(text(data, "id"))
                .bookingReference(text(data, "booking_reference"))
                .owner(text(data.path("owner"), "name"))
                .totalAmount(text(data, "total_amount"))
                .totalCurrency(text(data, "total_currency"))
                .status(text(data, "type"))
                .build();
    }

    private FlightOfferDto mapOffer(JsonNode offer) {
        JsonNode firstSlice = offer.path("slices").isArray() && offer.path("slices").size() > 0
                ? offer.path("slices").get(0)
                : null;
        JsonNode firstSegment = firstSlice != null && firstSlice.path("segments").isArray() && firstSlice.path("segments").size() > 0
                ? firstSlice.path("segments").get(0)
                : null;
        JsonNode lastSegment = firstSlice != null && firstSlice.path("segments").isArray() && firstSlice.path("segments").size() > 0
                ? firstSlice.path("segments").get(firstSlice.path("segments").size() - 1)
                : null;

        String depIata = text(firstSegment == null ? null : firstSegment.path("origin"), "iata_code");
        String arrIata = text(lastSegment == null ? null : lastSegment.path("destination"), "iata_code");

        double[] depCoord = AirportIataCoordinates.getOrNull(depIata);
        double[] arrCoord = AirportIataCoordinates.getOrNull(arrIata);

        String depAirport = text(firstSegment == null ? null : firstSegment.path("origin"), "name");
        String arrAirport = text(lastSegment == null ? null : lastSegment.path("destination"), "name");

        String flightNumber = text(firstSegment, "marketing_carrier_flight_number");
        String carrierCode = text(firstSegment, "marketing_carrier_iata_code");
        String airline = text(offer.path("owner"), "name");
        if (flightNumber != null && carrierCode != null) {
            flightNumber = carrierCode + flightNumber;
        }

        Integer transportId = materializeFlightTransport(
            text(offer, "id"),
            flightNumber,
            airline,
            depAirport,
            depIata,
            arrAirport,
            arrIata,
            text(firstSegment, "departing_at"),
            text(lastSegment, "arriving_at"),
            text(offer, "total_amount")
        );

        return FlightOfferDto.builder()
                .offerId(text(offer, "id"))
            .transportId(transportId)
                .flightNumber(flightNumber != null ? flightNumber : "N/A")
                .airline(airline != null ? airline : "Unknown carrier")
                .departureAirport(depAirport != null ? depAirport : depIata)
                .departureIata(depIata)
                .arrivalAirport(arrAirport != null ? arrAirport : arrIata)
                .arrivalIata(arrIata)
                .departureTime(text(firstSegment, "departing_at"))
                .arrivalTime(text(lastSegment, "arriving_at"))
                .status("scheduled")
                .statusCategory("SCHEDULED")
                .departureLatitude(depCoord != null ? depCoord[0] : null)
                .departureLongitude(depCoord != null ? depCoord[1] : null)
                .arrivalLatitude(arrCoord != null ? arrCoord[0] : null)
                .arrivalLongitude(arrCoord != null ? arrCoord[1] : null)
                .totalAmount(text(offer, "total_amount"))
                .totalCurrency(text(offer, "total_currency"))
                .build();
    }

    private Integer materializeFlightTransport(
            String offerId,
            String flightNumber,
            String airline,
            String departureAirport,
            String departureIata,
            String arrivalAirport,
            String arrivalIata,
            String departureAt,
            String arrivalAt,
            String totalAmount) {
        LocalDateTime dep = parseDateTime(departureAt).orElse(null);
        LocalDateTime arr = parseDateTime(arrivalAt).orElse(dep != null ? dep.plusHours(2) : LocalDateTime.now().plusHours(2));
        if (dep == null) {
            dep = arr.minusHours(2);
        }
        if (arr.isBefore(dep)) {
            arr = dep.plusHours(2);
        }

        String code = normalizeFlightCode(flightNumber, offerId);
        String operator = airline == null || airline.isBlank() ? "Airline" : airline.trim();
        double price = parseAmountOrZero(totalAmount);

        City depCity = ensureAirportCity(departureIata, departureAirport);
        City arrCity = ensureAirportCity(arrivalIata, arrivalAirport);
        if (depCity.getCityId() != null && depCity.getCityId().equals(arrCity.getCityId())) {
            String fallbackArrName = (arrivalAirport == null || arrivalAirport.isBlank())
                ? ((arrivalIata == null || arrivalIata.isBlank()) ? "Arrival Airport" : arrivalIata.trim().toUpperCase(Locale.ROOT) + " Airport")
                : arrivalAirport.trim() + " (Arrival)";
            arrCity = ensureAirportCity(arrivalIata, fallbackArrName);
        }

        Optional<Transport> existing = transportRepository.findFirstByTypeAndFlightCodeAndDepartureTimeAndArrivalTime(
                Transport.TransportType.PLANE,
                code,
                dep,
                arr);

        if (existing.isEmpty() && depCity.getCityId() != null && arrCity.getCityId() != null) {
            existing = transportRepository.findFirstByTypeAndOperatorNameAndDepartureTimeAndArrivalTimeAndDepartureCity_CityIdAndArrivalCity_CityId(
                    Transport.TransportType.PLANE,
                    operator,
                    dep,
                    arr,
                    depCity.getCityId(),
                    arrCity.getCityId());
        }

        Transport transport = existing.orElseGet(Transport::new);

        transport.setType(Transport.TransportType.PLANE);
        transport.setFlightCode(code);
        transport.setOperatorName(operator);
        transport.setDepartureTime(dep);
        transport.setArrivalTime(arr);
        transport.setCapacity(180);
        transport.setPrice(price);
        transport.setIsActive(true);
        if (transport.getCreatedAt() == null) {
            transport.setCreatedAt(LocalDateTime.now());
        }
        transport.setDescription(buildFlightDescription(departureAirport, departureIata, arrivalAirport, arrivalIata));
        transport.setDepartureCity(depCity);
        transport.setArrivalCity(arrCity);

        try {
            return transportRepository.save(transport).getTransportId();
        } catch (DataIntegrityViolationException ex) {
            log.warn("Duplicate flight transport detected for {} ({} -> {}) at {} / {}. Reusing existing record.",
                    code,
                    depCity.getCityId(),
                    arrCity.getCityId(),
                    dep,
                    arr);

            Optional<Transport> reloaded = transportRepository.findFirstByTypeAndFlightCodeAndDepartureTimeAndArrivalTime(
                    Transport.TransportType.PLANE,
                    code,
                    dep,
                    arr);

            if (reloaded.isEmpty() && depCity.getCityId() != null && arrCity.getCityId() != null) {
                reloaded = transportRepository.findFirstByTypeAndOperatorNameAndDepartureTimeAndArrivalTimeAndDepartureCity_CityIdAndArrivalCity_CityId(
                        Transport.TransportType.PLANE,
                        operator,
                        dep,
                        arr,
                        depCity.getCityId(),
                        arrCity.getCityId());
            }

            if (reloaded.isPresent() && reloaded.get().getTransportId() != null) {
                return reloaded.get().getTransportId();
            }
            throw ex;
        }
    }

    private City ensureAirportCity(String iata, String airportName) {
        String code = (iata == null || iata.isBlank()) ? "UNK" : iata.trim().toUpperCase(Locale.ROOT);
        String normalizedAirport = airportName == null ? "" : airportName.trim();
        String preferredName = !normalizedAirport.isBlank() ? normalizedAirport : code + " Airport";

        Optional<String> tnGovernorate = TunisiaAirportIataGovernorateMap.governorateNameForIata(code);
        if (tnGovernorate.isPresent()) {
            Optional<City> resolvedGovernorate =
                    cityRepository.findFirstByNameIgnoreCase(tnGovernorate.get());
            if (resolvedGovernorate.isPresent()) {
                return resolvedGovernorate.get();
            }
            log.warn(
                    "Duffel: Tunisian IATA {} maps to governorate '{}' but no matching City row — check DataInitializer seed",
                    code,
                    tnGovernorate.get());
        }

        Optional<City> existing = cityRepository.findFirstByNameIgnoreCase(preferredName);
        if (existing.isEmpty() && !preferredName.equalsIgnoreCase(code + " Airport")) {
            existing = cityRepository.findFirstByNameIgnoreCase(code + " Airport");
        }
        if (existing.isPresent()) {
            return existing.get();
        }

        City city = new City();
        city.setName(preferredName);
        city.setRegion("Airport");
        city.setDescription("Virtual airport / foreign endpoint for flight booking (" + code + ").");
        city.setHasAirport(true);
        city.setHasBusStation(false);
        city.setHasTrainStation(false);
        city.setHasPort(false);
        return cityRepository.save(city);
    }

    private String buildFlightDescription(String depAirport, String depIata, String arrAirport, String arrIata) {
        String dep = depAirport != null && !depAirport.isBlank() ? depAirport : (depIata != null ? depIata : "N/A");
        String arr = arrAirport != null && !arrAirport.isBlank() ? arrAirport : (arrIata != null ? arrIata : "N/A");
        return "Live flight offer: " + dep + " -> " + arr;
    }

    private String normalizeFlightCode(String flightNumber, String offerId) {
        if (flightNumber != null && !flightNumber.isBlank()) {
            return flightNumber.trim().toUpperCase(Locale.ROOT);
        }
        if (offerId != null && !offerId.isBlank()) {
            String compact = offerId.replaceAll("[^A-Za-z0-9]", "");
            return ("OFF-" + compact).substring(0, Math.min(20, 4 + compact.length())).toUpperCase(Locale.ROOT);
        }
        return "OFF-UNKNOWN";
    }

    private double parseAmountOrZero(String totalAmount) {
        if (totalAmount == null || totalAmount.isBlank()) {
            return 0.0;
        }
        try {
            return Double.parseDouble(totalAmount.trim());
        } catch (NumberFormatException ex) {
            return 0.0;
        }
    }

    private Optional<LocalDateTime> parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(OffsetDateTime.parse(value.trim()).toLocalDateTime());
        } catch (Exception ignore) {
        }
        try {
            return Optional.of(LocalDateTime.parse(value.trim()));
        } catch (Exception ignore) {
            return Optional.empty();
        }
    }

    private int clampLimit(int limit) {
        int def = Math.max(1, properties.getDefaultLimit());
        if (limit <= 0) {
            return def;
        }
        return Math.min(limit, 50);
    }

    private String normalizeCabinClass(String cabinClass) {
        String value = cabinClass == null ? "economy" : cabinClass.trim().toLowerCase(Locale.ROOT);
        return switch (value) {
            case "premium_economy", "business", "first" -> value;
            default -> "economy";
        };
    }

    private String normalizeFlightType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case FLIGHT_TYPE_INTERNAL, FLIGHT_TYPE_EXTERNAL -> normalized;
            default -> null;
        };
    }

    private String normalizeIata(String iata) {
        if (iata == null || iata.isBlank()) {
            return null;
        }
        String normalized = iata.trim().toUpperCase(Locale.ROOT);
        if (!isValidIata(normalized)) {
            return null;
        }
        return normalized;
    }

    private boolean isValidIata(String code) {
        if (code == null) {
            return false;
        }
        String normalized = code.trim();
        return normalized.length() == 3 && normalized.chars().allMatch(Character::isLetter);
    }

    private boolean isTunisianAirport(String iata) {
        return iata != null && TUNISIAN_AIRPORT_IATAS.contains(iata.trim().toUpperCase(Locale.ROOT));
    }

    private boolean isExternalAllowedArrivalAirport(String iata) {
        return iata != null && EXTERNAL_ALLOWED_ARRIVAL_IATAS.contains(iata.trim().toUpperCase(Locale.ROOT));
    }

    private String blockBody(WebClient.RequestHeadersSpec<?> requestSpec) {
        String body = requestSpec
                .retrieve()
                .bodyToMono(String.class)
            .timeout(DUFFEL_BLOCK_TIMEOUT)
            .block();

        if (body == null || body.isBlank()) {
            throw new DuffelUpstreamException("Flight provider returned an empty response.", HttpStatus.BAD_GATEWAY.value());
        }
        return body;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        JsonNode val = node.get(field);
        if (val == null || val.isNull() || val.isMissingNode()) {
            return null;
        }
        String s = val.asText(null);
        return s == null || s.isBlank() ? null : s;
    }
}
