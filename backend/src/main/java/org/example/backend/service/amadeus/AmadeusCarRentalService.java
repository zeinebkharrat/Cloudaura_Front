package org.example.backend.service.amadeus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.config.AmadeusProperties;
import org.example.backend.dto.car.AmadeusCarOfferDto;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Integrates Amadeus <strong>Cars &amp; Transfers</strong> Self-Service API.
 * <p>
 * <strong>Important:</strong> Amadeus does not publish {@code GET /v1/shopping/cars} in Self-Service.
 * Ground mobility (private car, chauffeur, taxi, etc.) is searched via
 * {@code POST https://test.api.amadeus.com/v1/shopping/transfer-offers} with a JSON body.
 * This service maps those offers to {@link AmadeusCarOfferDto} for Yalla TN.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AmadeusCarRentalService {

    private static final DateTimeFormatter ISO_LOCAL = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    /** Minimal drop-off hints so Amadeus can price a PRIVATE transfer from an airport IATA code. */
    private static final Map<String, DropSpec> DROP_BY_IATA = Map.ofEntries(
            Map.entry("TUN", new DropSpec("Tunis", "TN", "Avenue Habib Bourguiba", "1000")),
            Map.entry("MIR", new DropSpec("Monastir", "TN", "Avenue Taieb Mhiri", "5000")),
            Map.entry("NBE", new DropSpec("Hammamet", "TN", "Avenue de la République", "8050")),
            Map.entry("SFA", new DropSpec("Sfax", "TN", "Avenue Hédi Chaker", "3000")),
            Map.entry("DJE", new DropSpec("Houmt Souk", "TN", "Avenue Habib Bourguiba", "4180")),
            // Well-known sandbox-friendly pair (Amadeus docs use CDG → Paris)
            Map.entry("CDG", new DropSpec("Paris", "FR", "Avenue Anatole France, 5", "75007")),
            Map.entry("ORY", new DropSpec("Paris", "FR", "Place Charles de Gaulle", "75008"))
    );

    private final AmadeusProperties amadeusProperties;
    private final AmadeusOAuthService amadeusOAuthService;
    private final WebClient amadeusWebClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Searches private transfer offers (car-like) for pickup at {@code locationIata} on {@code startDate}.
     *
     * @param locationIata 3-letter IATA (e.g. TUN, CDG)
     * @param startDate    rental pickup date
     * @param endDate      rental return date (used for UI / future hourly logic; transfer search uses pickup datetime)
     * @param passengers   1–8
     */
    public List<AmadeusCarOfferDto> searchCars(String locationIata, LocalDate startDate, LocalDate endDate, int passengers) {
        if (!amadeusProperties.isEnabled()) {
            throw new IllegalStateException("amadeus.disabled");
        }
        if (locationIata == null || locationIata.length() != 3) {
            throw new IllegalArgumentException("car.error.location_iata");
        }
        String iata = locationIata.trim().toUpperCase(Locale.ROOT);
        if (endDate != null && startDate != null && endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("car.error.date_range");
        }
        int pax = Math.min(8, Math.max(1, passengers));

        DropSpec drop = DROP_BY_IATA.getOrDefault(iata, new DropSpec("Tunis", "TN", "Centre-ville", "1000"));

        LocalDateTime pickup = LocalDateTime.of(startDate, LocalTime.of(10, 0));
        ObjectNode body = objectMapper.createObjectNode();
        body.put("startLocationCode", iata);
        body.put("endCityName", drop.cityName());
        body.put("endCountryCode", drop.countryCode());
        body.put("endAddressLine", drop.addressLine());
        body.put("endZipCode", drop.zipCode());
        body.put("transferType", "PRIVATE");
        body.put("startDateTime", pickup.format(ISO_LOCAL));
        body.put("passengers", pax);
        ArrayNode paxChars = body.putArray("passengerCharacteristics");
        ObjectNode adt = paxChars.addObject();
        adt.put("passengerTypeCode", "ADT");
        adt.put("age", 30);

        String token = amadeusOAuthService.getAccessToken();
        String raw = postTransferOffers(body, token);
        return mapOffers(raw, iata, drop.cityName(), pickup.format(ISO_LOCAL));
    }

    private String postTransferOffers(ObjectNode body, String token) {
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                return amadeusWebClient.post()
                        .uri("/v1/shopping/transfer-offers")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .header(HttpHeaders.CONTENT_TYPE, "application/json")
                        .bodyValue(body.toString())
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();
            } catch (WebClientResponseException e) {
                if (e.getStatusCode().value() == 401 && attempt == 0) {
                    amadeusOAuthService.invalidate();
                    token = amadeusOAuthService.getAccessToken();
                    continue;
                }
                log.warn("Amadeus transfer-offers HTTP {}: {}", e.getStatusCode().value(), e.getResponseBodyAsString());
                throw e;
            }
        }
        throw new IllegalStateException("amadeus.transfer_retry_exhausted");
    }

    private List<AmadeusCarOfferDto> mapOffers(String json, String startIata, String dropCity, String pickupIso) {
        List<AmadeusCarOfferDto> out = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.get("data");
            if (data == null || !data.isArray()) {
                log.warn("Amadeus response missing data[]: {}", json != null && json.length() > 400 ? json.substring(0, 400) : json);
                return out;
            }
            for (JsonNode offer : data) {
                out.add(mapOne(offer, startIata, dropCity, pickupIso));
            }
        } catch (Exception e) {
            log.error("Failed to parse Amadeus transfer-offers JSON", e);
            throw new IllegalStateException("amadeus.parse_error", e);
        }
        return out;
    }

    private AmadeusCarOfferDto mapOne(JsonNode offer, String startIata, String dropCity, String pickupIso) {
        String id = textOr(offer, "id", "unknown");
        String transferType = textOr(offer, "transferType", "PRIVATE");

        JsonNode vehicle = offer.get("vehicle");
        String model = vehicle != null && vehicle.has("description") && !vehicle.get("description").asText("").isBlank()
                ? vehicle.get("description").asText()
                : (vehicle != null && vehicle.has("category") ? vehicle.get("category").asText("Vehicle") : "Vehicle");

        JsonNode sp = offer.get("serviceProvider");
        String provider = sp != null && sp.has("name") ? sp.get("name").asText("Provider") : "Provider";

        JsonNode q = offer.get("quotation");
        double price = 0.0;
        String currency = "EUR";
        if (q != null) {
            if (q.has("monetaryAmount")) {
                price = parseAmount(q.get("monetaryAmount").asText("0"));
            }
            if (q.has("currencyCode")) {
                currency = q.get("currencyCode").asText("EUR");
            }
        }

        String location = startIata + " → " + dropCity;

        return AmadeusCarOfferDto.builder()
                .offerId(id)
                .provider(provider)
                .model(model)
                .price(price)
                .currency(currency)
                .location(location)
                .transferType(transferType)
                .pickupDateTime(pickupIso)
                .build();
    }

    private static String textOr(JsonNode n, String field, String def) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? def : v.asText(def);
    }

    private static double parseAmount(String raw) {
        try {
            return Double.parseDouble(raw.replace(',', '.'));
        } catch (Exception e) {
            return 0.0;
        }
    }

    private record DropSpec(String cityName, String countryCode, String addressLine, String zipCode) {}
}
