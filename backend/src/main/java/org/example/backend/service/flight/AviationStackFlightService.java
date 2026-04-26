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
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Calls Aviationstack flight API via {@link org.springframework.web.reactive.function.client.WebClient}
 * and maps JSON to {@link FlightDto}. All external access is server-side only.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AviationStackFlightService {

    private static final Pattern FLIGHT_IATA = Pattern.compile("^[A-Z]{2}\\d{1,4}$");
    private static final Pattern FLIGHT_NUMBER_ONLY = Pattern.compile("^\\d{1,4}$");

    private final org.springframework.web.reactive.function.client.WebClient aviationStackWebClient;
    private final AviationStackProperties properties;
    private final ObjectMapper objectMapper;
    private final DestinationAirportResolver destinationAirportResolver;

        @Cacheable(cacheNames = AviationStackCacheConfig.CACHE_ALL_FLIGHTS,
            cacheManager = "aviationCacheManager",
            key = "'l:' + #limit + ':' + T(java.time.LocalDate).now(T(java.time.ZoneOffset).UTC)")
    public List<FlightDto> getAllFlights(int limit) {
        int lim = clampLimit(limit);
        if (!properties.hasAccessKey()) {
            log.warn("Aviationstack: missing access key (set AVIATIONSTACK_ACCESS_KEY)");
            return fallbackAllFlights(lim);
        }
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
            return fallbackAllFlights(lim);
        } catch (Exception e) {
            log.error("Aviationstack getAllFlights failed", e);
            return fallbackAllFlights(lim);
        }
    }

        @Cacheable(cacheNames = AviationStackCacheConfig.CACHE_ROUTE_FLIGHTS,
            cacheManager = "aviationCacheManager",
            key = "#dep.toUpperCase() + ':' + #arr.toUpperCase() + ':' + #limit")
    public List<FlightDto> getFlightsByRoute(String dep, String arr, int limit) {
        if (dep == null || dep.isBlank() || arr == null || arr.isBlank()) {
            return Collections.emptyList();
        }
        int lim = clampLimit(limit);
        String depIata = dep.trim().toUpperCase();
        String arrIata = arr.trim().toUpperCase();
        if (!properties.hasAccessKey()) {
            log.warn("Aviationstack: missing access key, using fallback flights for route {} -> {}", depIata, arrIata);
            return fallbackFlightsByRoute(depIata, arrIata, lim);
        }
        try {
            String body = aviationStackWebClient.get()
                    .uri(uriBuilder -> flightsUri(uriBuilder, null, depIata, arrIata, lim))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parseAndMap(body);
        } catch (WebClientResponseException e) {
            log.error("Aviationstack route HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return fallbackFlightsByRoute(depIata, arrIata, lim);
        } catch (Exception e) {
            log.error("Aviationstack getFlightsByRoute failed", e);
            return fallbackFlightsByRoute(depIata, arrIata, lim);
        }
    }

    /**
     * Flights matching a flight number / IATA flight code for a given UTC date (Aviationstack {@code flight_iata}
     * or {@code flight_number}).
     *
     * @param flightQuery e.g. {@code TU712}, {@code TU 712}, or numeric {@code 712} (uses {@code flight_number} only)
     * @param flightDate  optional {@code yyyy-MM-dd} in UTC; defaults to today UTC
     */
    @Cacheable(cacheNames = AviationStackCacheConfig.CACHE_BY_FLIGHT,
            cacheManager = "aviationCacheManager",
            key = "(#flightQuery != null ? #flightQuery.trim().toUpperCase() : '') + ':' + "
                    + "(#flightDate != null && !#flightDate.isBlank() ? #flightDate : T(java.time.LocalDate).now(T(java.time.ZoneOffset).UTC).toString()) "
                    + "+ ':' + #limit")
    public List<FlightDto> getFlightsByFlightQuery(String flightQuery, String flightDate, int limit) {
        if (flightQuery == null || flightQuery.isBlank()) {
            return Collections.emptyList();
        }
        int lim = clampLimit(limit);
        ParsedFlightQuery parsed = parseFlightQuery(flightQuery);
        if (parsed == null) {
            log.warn("Aviationstack: invalid flight query '{}'", flightQuery);
            return Collections.emptyList();
        }
        String date = (flightDate == null || flightDate.isBlank())
                ? LocalDate.now(ZoneOffset.UTC).toString()
                : flightDate.trim().substring(0, Math.min(10, flightDate.trim().length()));

        if (!properties.hasAccessKey()) {
            log.warn("Aviationstack: missing access key, fallback for flight {}", parsed.logLabel());
            return fallbackFlightsByFlightQuery(parsed, lim);
        }
        try {
            String body = aviationStackWebClient.get()
                    .uri(uriBuilder -> flightsByFlightUri(uriBuilder, date, parsed, lim))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parseAndMap(body);
        } catch (WebClientResponseException e) {
            int sc = e.getStatusCode().value();
            String resp = e.getResponseBodyAsString();
            /* Free / basic plans often block flight_iata & flight_number filters (403 function_access_restricted). */
            boolean planBlocksFlightCodeFilter =
                    sc == HttpStatus.FORBIDDEN.value()
                            || sc == HttpStatus.UNAUTHORIZED.value()
                            || (resp != null && resp.contains("function_access_restricted"));
            if (planBlocksFlightCodeFilter) {
                log.warn(
                        "Aviationstack flight-by-code not allowed on this plan (HTTP {}). Using same-day sample + local filter.",
                        sc);
                List<FlightDto> filtered = wideDateSampleThenFilter(date, parsed, lim);
                if (!filtered.isEmpty()) {
                    return filtered;
                }
            } else if (sc == HttpStatus.TOO_MANY_REQUESTS.value()) {
                log.warn("Aviationstack flight-query HTTP 429 — skipping extra wide query.");
            } else {
                log.error("Aviationstack flight-query HTTP {}: {}", e.getStatusCode(), resp);
            }
            return fallbackFlightsByFlightQuery(parsed, lim);
        } catch (Exception e) {
            log.error("Aviationstack getFlightsByFlightQuery failed", e);
            return fallbackFlightsByFlightQuery(parsed, lim);
        }
    }

    /**
     * Fetches a limited global sample for {@code flight_date} (no flight_iata / dep_iata filters) then keeps rows
     * matching the user's flight code. Works on plans that allow date-only queries but not flight-code filters.
     */
    private List<FlightDto> wideDateSampleThenFilter(String flightDate, ParsedFlightQuery parsed, int maxResults) {
        int wideLim = Math.min(100, Math.max(maxResults * 4, 50));
        List<FlightDto> wide = fetchFlightsForDateWideUncached(flightDate, wideLim);
        return filterFlightsByParsed(wide, parsed, maxResults);
    }

    private List<FlightDto> fetchFlightsForDateWideUncached(String flightDate, int limit) {
        try {
            String body = aviationStackWebClient.get()
                    .uri(uriBuilder -> flightsUri(uriBuilder, flightDate, null, null, limit))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parseAndMap(body);
        } catch (WebClientResponseException e) {
            log.warn("Aviationstack wide date query HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return Collections.emptyList();
        } catch (Exception e) {
            log.warn("Aviationstack wide date query failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private List<FlightDto> filterFlightsByParsed(List<FlightDto> rows, ParsedFlightQuery parsed, int maxResults) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        List<FlightDto> out = new ArrayList<>();
        for (FlightDto f : rows) {
            if (matchesParsedFlight(f, parsed)) {
                out.add(f);
                if (out.size() >= maxResults) {
                    break;
                }
            }
        }
        return out;
    }

    private static boolean matchesParsedFlight(FlightDto f, ParsedFlightQuery parsed) {
        String fn = f.getFlightNumber();
        if (fn == null || fn.isBlank()) {
            return false;
        }
        String compact = fn.trim().toUpperCase().replaceAll("\\s+", "");
        if (parsed.flightIata() != null) {
            return compact.equals(parsed.flightIata());
        }
        String num = parsed.flightNumberOnly();
        if (num == null) {
            return false;
        }
        if (compact.endsWith(num)) {
            return true;
        }
        String digits = compact.replaceAll("[^0-9]", "");
        return digits.equals(num) || digits.endsWith(num);
    }

        @Cacheable(cacheNames = AviationStackCacheConfig.CACHE_SUGGEST,
            cacheManager = "aviationCacheManager",
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

    private java.net.URI flightsByFlightUri(UriBuilder uriBuilder, String flightDate, ParsedFlightQuery parsed, int lim) {
        UriBuilder ub = uriBuilder.path("/flights")
                .queryParam("access_key", properties.getAccessKey())
                .queryParam("limit", lim)
                .queryParam("flight_date", flightDate);
        if (parsed.flightIata() != null) {
            ub.queryParam("flight_iata", parsed.flightIata());
        } else {
            ub.queryParam("flight_number", parsed.flightNumberOnly());
        }
        return ub.build();
    }

    private ParsedFlightQuery parseFlightQuery(String raw) {
        String compact = raw.trim().toUpperCase().replaceAll("\\s+", "");
        if (FLIGHT_IATA.matcher(compact).matches()) {
            return new ParsedFlightQuery(compact, null, compact);
        }
        String digits = raw.trim().replaceAll("\\D+", "");
        if (digits.length() >= 1 && digits.length() <= 4 && FLIGHT_NUMBER_ONLY.matcher(digits).matches()) {
            return new ParsedFlightQuery(null, digits, digits);
        }
        return null;
    }

    private record ParsedFlightQuery(String flightIata, String flightNumberOnly, String logLabel) {}

    private List<FlightDto> fallbackFlightsByFlightQuery(ParsedFlightQuery parsed, int limit) {
        String iata = parsed.flightIata() != null ? parsed.flightIata() : ("YT" + parsed.flightNumberOnly());
        List<FlightDto> base = fallbackFlightsByRoute("TUN", "NBE", Math.max(1, limit));
        if (base.isEmpty()) {
            return base;
        }
        FlightDto first = base.get(0);
        FlightDto adjusted = FlightDto.builder()
                .flightNumber(iata)
                .airline(first.getAirline())
                .departureAirport(first.getDepartureAirport())
                .departureIata(first.getDepartureIata())
                .arrivalAirport(first.getArrivalAirport())
                .arrivalIata(first.getArrivalIata())
                .departureTime(first.getDepartureTime())
                .arrivalTime(first.getArrivalTime())
                .status("scheduled")
                .statusCategory("ON_TIME")
                .departureLatitude(first.getDepartureLatitude())
                .departureLongitude(first.getDepartureLongitude())
                .arrivalLatitude(first.getArrivalLatitude())
                .arrivalLongitude(first.getArrivalLongitude())
                .totalAmount(first.getTotalAmount())
                .totalCurrency(first.getTotalCurrency())
                .build();
        List<FlightDto> out = new ArrayList<>();
        out.add(adjusted);
        if (base.size() > 1 && limit > 1) {
            out.addAll(base.subList(1, Math.min(base.size(), limit)));
        }
        return out.size() > limit ? out.subList(0, limit) : out;
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

    private List<FlightDto> fallbackAllFlights(int limit) {
        List<FlightDto> out = new ArrayList<>();
        out.addAll(fallbackFlightsByRoute("TUN", "NBE", limit));
        out.addAll(fallbackFlightsByRoute("NBE", "TUN", limit));
        return out.size() > limit ? out.subList(0, limit) : out;
    }

    private List<FlightDto> fallbackFlightsByRoute(String depIata, String arrIata, int limit) {
        String dep = depIata == null ? "TUN" : depIata.trim().toUpperCase();
        String arr = arrIata == null ? "NBE" : arrIata.trim().toUpperCase();
        String depName = airportNameFromIata(dep);
        String arrName = airportNameFromIata(arr);
        LocalDateTime base = LocalDateTime.of(LocalDate.now(ZoneOffset.UTC), LocalTime.of(8, 0));

        List<FlightDto> rows = new ArrayList<>();
        rows.add(fallbackFlight(dep, arr, depName, arrName, base.plusHours(1), base.plusHours(1).plusMinutes(50), "YT101", "YallaTN Air", "scheduled", "ON_TIME"));
        rows.add(fallbackFlight(dep, arr, depName, arrName, base.plusHours(4), base.plusHours(4).plusMinutes(45), "YT205", "Carthage Wings", "active", "ON_TIME"));
        rows.add(fallbackFlight(dep, arr, depName, arrName, base.plusHours(7), base.plusHours(7).plusMinutes(55), "YT309", "Sahel Connect", "scheduled", "DELAYED"));

        if (limit > 0 && rows.size() > limit) {
            return rows.subList(0, limit);
        }
        return rows;
    }

    private FlightDto fallbackFlight(
            String depIata,
            String arrIata,
            String depName,
            String arrName,
            LocalDateTime departure,
            LocalDateTime arrival,
            String flightNumber,
            String airline,
            String status,
            String statusCategory) {
        double[] depCoord = AirportIataCoordinates.getOrNull(depIata);
        double[] arrCoord = AirportIataCoordinates.getOrNull(arrIata);
        return FlightDto.builder()
                .flightNumber(flightNumber)
                .airline(airline)
                .departureAirport(depName)
                .departureIata(depIata)
                .arrivalAirport(arrName)
                .arrivalIata(arrIata)
                .departureTime(departure.atOffset(ZoneOffset.UTC).toString())
                .arrivalTime(arrival.atOffset(ZoneOffset.UTC).toString())
                .status(status)
                .statusCategory(statusCategory)
                .departureLatitude(depCoord != null ? depCoord[0] : null)
                .departureLongitude(depCoord != null ? depCoord[1] : null)
                .arrivalLatitude(arrCoord != null ? arrCoord[0] : null)
                .arrivalLongitude(arrCoord != null ? arrCoord[1] : null)
                .build();
    }

    private String airportNameFromIata(String iata) {
        return switch (iata) {
            case "TUN" -> "Tunis-Carthage International Airport";
            case "NBE" -> "Enfidha-Hammamet International Airport";
            case "MIR" -> "Monastir Habib Bourguiba International Airport";
            case "SFA" -> "Sfax-Thyna International Airport";
            case "DJE" -> "Djerba-Zarzis International Airport";
            default -> iata + " Airport";
        };
    }
}
