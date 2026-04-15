package org.example.backend.service.flight;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.config.AviationStackCacheConfig;
import org.example.backend.config.AviationStackProperties;
import org.example.backend.dto.flight.AirportResolveResponse;
import org.example.backend.dto.flight.FlightDto;
import org.example.backend.dto.flight.FlightSuggestionResponse;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriBuilder;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Calls Aviationstack flight API via {@link org.springframework.web.reactive.function.client.WebClient}
 * and maps JSON to {@link FlightDto}. All external access is server-side only.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AviationStackFlightService {

    private final org.springframework.web.reactive.function.client.WebClient aviationStackWebClient;
    private final AviationStackProperties properties;
    private final ObjectMapper objectMapper;
    private final DestinationAirportResolver destinationAirportResolver;

    @Cacheable(cacheNames = AviationStackCacheConfig.CACHE_ALL_FLIGHTS,
            key = "'l:' + #limit + ':' + T(java.time.LocalDate).now(T(java.time.ZoneOffset).UTC)")
    public List<FlightDto> getAllFlights(int limit) {
        if (!properties.hasAccessKey()) {
            log.warn("Aviationstack: missing access key (set AVIATIONSTACK_ACCESS_KEY)");
            return Collections.emptyList();
        }
        int lim = clampLimit(limit);
        String flightDate = LocalDate.now(ZoneOffset.UTC).toString();
        try {
            String body = aviationStackWebClient.get()
                    .uri(uriBuilder -> flightsUri(uriBuilder, flightDate, null, null, lim))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parseAndMap(body);
        } catch (WebClientResponseException e) {
            log.error("Aviationstack HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AviationStackUpstreamException("Flight data provider returned an error.", e.getStatusCode().value());
        } catch (Exception e) {
            log.error("Aviationstack getAllFlights failed", e);
            throw new AviationStackUpstreamException("Could not reach flight data provider.", HttpStatus.BAD_GATEWAY.value());
        }
    }

    @Cacheable(cacheNames = AviationStackCacheConfig.CACHE_ROUTE_FLIGHTS,
            key = "#dep.toUpperCase() + ':' + #arr.toUpperCase() + ':' + #limit")
    public List<FlightDto> getFlightsByRoute(String dep, String arr, int limit) {
        if (!properties.hasAccessKey()) {
            log.warn("Aviationstack: missing access key");
            return Collections.emptyList();
        }
        if (dep == null || dep.isBlank() || arr == null || arr.isBlank()) {
            return Collections.emptyList();
        }
        int lim = clampLimit(limit);
        String depIata = dep.trim().toUpperCase();
        String arrIata = arr.trim().toUpperCase();
        try {
            String body = aviationStackWebClient.get()
                    .uri(uriBuilder -> flightsUri(uriBuilder, null, depIata, arrIata, lim))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parseAndMap(body);
        } catch (WebClientResponseException e) {
            log.error("Aviationstack route HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AviationStackUpstreamException("Flight data provider returned an error.", e.getStatusCode().value());
        } catch (Exception e) {
            log.error("Aviationstack getFlightsByRoute failed", e);
            throw new AviationStackUpstreamException("Could not reach flight data provider.", HttpStatus.BAD_GATEWAY.value());
        }
    }

    @Cacheable(cacheNames = AviationStackCacheConfig.CACHE_SUGGEST,
            key = "#originIata.toUpperCase() + ':' + #destinationQuery.trim().toLowerCase() + ':' + #limit")
    public FlightSuggestionResponse suggestForDestination(String originIata, String destinationQuery, int limit) {
        String origin = originIata == null || originIata.isBlank() ? "TUN" : originIata.trim().toUpperCase();
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
        var d = dest.get();
        List<FlightDto> flights = getFlightsByRoute(origin, d.iata(), limit);
        return FlightSuggestionResponse.builder()
                .originAirportIata(origin)
                .destinationAirportIata(d.iata())
                .resolvedDestinationLabel(d.label())
                .hint("Showing scheduled / live flights from " + origin + " to " + d.iata() + " (provider data).")
                .flights(flights)
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

    private java.net.URI flightsUri(UriBuilder uriBuilder, String flightDate, String depIata, String arrIata, int lim) {
        UriBuilder ub = uriBuilder.path("/flights")
                .queryParam("access_key", properties.getAccessKey())
                .queryParam("limit", lim);
        if (flightDate != null && !flightDate.isBlank()) {
            ub.queryParam("flight_date", flightDate);
        }
        if (depIata != null && arrIata != null) {
            ub.queryParam("dep_iata", depIata).queryParam("arr_iata", arrIata);
        }
        return ub.build();
    }

    private int clampLimit(int limit) {
        int def = Math.max(1, properties.getDefaultLimit());
        if (limit <= 0) {
            return def;
        }
        return Math.min(limit, 100);
    }

    private List<FlightDto> parseAndMap(String body) throws java.io.IOException {
        if (body == null || body.isBlank()) {
            return Collections.emptyList();
        }
        JsonNode root = objectMapper.readTree(body);
        if (root.hasNonNull("error")) {
            JsonNode err = root.get("error");
            String info = err.has("info") ? err.get("info").asText() : err.toString();
            log.warn("Aviationstack API error object: {}", info);
            throw new AviationStackUpstreamException(
                    "Aviationstack: " + (info != null && !info.isBlank() ? info : "invalid request or quota exceeded."),
                    HttpStatus.BAD_GATEWAY.value());
        }
        JsonNode data = root.get("data");
        if (data == null || !data.isArray()) {
            return Collections.emptyList();
        }
        List<FlightDto> out = new ArrayList<>();
        for (JsonNode item : data) {
            out.add(mapFlight(item));
        }
        return out;
    }

    private FlightDto mapFlight(JsonNode item) {
        String flightIata = text(item, "flight", "iata");
        String flightNum = text(item, "flight", "number");
        String flightNumber = flightIata != null && !flightIata.isBlank() ? flightIata
                : (flightNum != null ? flightNum : "?");

        String airline = text(item, "airline", "name");
        if (airline == null) {
            airline = text(item, "airline", "iata");
        }

        String depIata = text(item, "departure", "iata");
        String depAirport = text(item, "departure", "airport");
        String depAirportLabel = depAirport != null ? depAirport : depIata;

        String arrIata = text(item, "arrival", "iata");
        String arrAirport = text(item, "arrival", "airport");
        String arrAirportLabel = arrAirport != null ? arrAirport : arrIata;

        String depTime = firstNonBlank(
                text(item, "departure", "scheduled"),
                text(item, "departure", "estimated"),
                text(item, "departure", "actual"));
        String arrTime = firstNonBlank(
                text(item, "arrival", "scheduled"),
                text(item, "arrival", "estimated"),
                text(item, "arrival", "actual"));

        String flightStatus = text(item, "flight_status");
        if (flightStatus == null) {
            flightStatus = "unknown";
        }
        int depDelay = intOrZero(item, "departure", "delay");
        int arrDelay = intOrZero(item, "arrival", "delay");
        String category = categorizeStatus(flightStatus, depDelay, arrDelay);

        double[] depCoord = AirportIataCoordinates.getOrNull(depIata);
        double[] arrCoord = AirportIataCoordinates.getOrNull(arrIata);

        return FlightDto.builder()
                .flightNumber(flightNumber)
                .airline(airline != null ? airline : "—")
                .departureAirport(depAirportLabel)
                .departureIata(depIata)
                .arrivalAirport(arrAirportLabel)
                .arrivalIata(arrIata)
                .departureTime(depTime)
                .arrivalTime(arrTime)
                .status(flightStatus)
                .statusCategory(category)
                .departureLatitude(depCoord != null ? depCoord[0] : null)
                .departureLongitude(depCoord != null ? depCoord[1] : null)
                .arrivalLatitude(arrCoord != null ? arrCoord[0] : null)
                .arrivalLongitude(arrCoord != null ? arrCoord[1] : null)
                .build();
    }

    private static String categorizeStatus(String flightStatus, int depDelay, int arrDelay) {
        String s = flightStatus == null ? "" : flightStatus.toLowerCase();
        if (s.contains("cancel")) {
            return "CANCELLED";
        }
        if (s.contains("incident") || s.contains("divert")) {
            return "DELAYED";
        }
        if (depDelay > 0 || arrDelay > 0) {
            return "DELAYED";
        }
        if (s.equals("scheduled") || s.equals("active") || s.equals("landed")) {
            return "ON_TIME";
        }
        return "UNKNOWN";
    }

    private static String firstNonBlank(String... vals) {
        if (vals == null) {
            return null;
        }
        for (String v : vals) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private static int intOrZero(JsonNode root, String... path) {
        JsonNode n = at(root, path);
        if (n == null || n.isNull() || !n.isNumber()) {
            return 0;
        }
        return n.asInt(0);
    }

    private static JsonNode at(JsonNode root, String... path) {
        JsonNode cur = root;
        for (String p : path) {
            if (cur == null || !cur.has(p)) {
                return null;
            }
            cur = cur.get(p);
        }
        return cur;
    }

    private static String text(JsonNode root, String... path) {
        JsonNode n = at(root, path);
        if (n == null || n.isNull() || n.isMissingNode()) {
            return null;
        }
        String s = n.asText(null);
        return s != null && !s.isBlank() ? s : null;
    }
}
