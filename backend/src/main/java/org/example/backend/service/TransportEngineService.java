package org.example.backend.service;

import org.example.backend.dto.transport.EngineRecommendationRequest;
import org.example.backend.dto.transport.EngineRecommendationResponse;
import org.example.backend.dto.transport.EngineRecommendationResponse.TransportOption;
import org.example.backend.model.City;
import org.example.backend.model.Distance;
import org.example.backend.model.Transport;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.DistanceRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Complete Intelligent Transport Engine for Tunisia.
 *
 * Pipeline (per spec):
 *  STEP 1 – Read data from DB (transports, cities, distances, reservations)
 *  STEP 2 – Calculate dynamic values (price, duration, arrival_time, seatsLeft)
 *  STEP 3 – Validation engine (auto-correct inconsistencies)
 *  STEP 4 – AI scoring & ranking
 *  STEP 5 – Return best option + alternatives in standard format
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransportEngineService {

    private final TransportRepository             transportRepo;
    private final DistanceRepository              distanceRepo;
    private final TransportReservationRepository  reservationRepo;
    private final CityRepository                  cityRepo;

    // ── Speed constants (km/h) from specification ──────────────────────────
    private static final double TAXI_SPEED          = 75.0;
    private static final double LOUAGE_SPEED        = 85.0;
    private static final double BUS_SPEED           = 65.0;
    private static final double PLANE_SPEED         = 600.0;
    private static final double PLANE_OVERHEAD_MIN  = 120.0;  // 2h airport overhead
    private static final double CAR_SPEED           = 75.0;
    private static final double TRAIN_SPEED         = 90.0;

    private static final double ROAD_FACTOR         = 1.25;   // aerial → road distance
    private static final double MIN_PRICE           = 0.5;
    private static final int    MIN_PLANE_DISTANCE  = 100;    // km

    /** Only generate virtual options for these types in the recommendation engine. */
    private static final Transport.TransportType[] ENGINE_TYPES = {
        Transport.TransportType.TAXI,
        Transport.TransportType.VAN,
        Transport.TransportType.BUS,
        Transport.TransportType.PLANE,
        Transport.TransportType.CAR,
    };

    // ──────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────────────────────

    public EngineRecommendationResponse recommend(EngineRecommendationRequest req) {

        // ── STEP 1a: Resolve cities ──────────────────────────────────────
        City fromCity = resolveCity(req.getFromCityId(), req.getFromCity());
        City toCity   = resolveCity(req.getToCityId(),   req.getToCity());

        if (fromCity.getCityId().equals(toCity.getCityId())) {
            throw new IllegalArgumentException("La ville de départ et d'arrivée doivent être différentes.");
        }

        int        passengers = Math.max(1, req.getPassengers());
        LocalDate  travelDate = parseDateOrToday(req.getDate());
        String     preference = normalizePreference(req.getPreference());

        // ── STEP 1b: Read distance ───────────────────────────────────────
        double distanceKm = resolveDistance(fromCity, toCity);

        // ── STEP 1c: Read real DB transports for this route & date ───────
        List<Transport> dbTransports = loadTransports(
            fromCity.getCityId(), toCity.getCityId(), travelDate);

        // ── STEP 2: Calculate dynamic values for real DB transports ──────
        List<TransportOption> options     = new ArrayList<>();
        Set<Transport.TransportType> covered = new HashSet<>();

        for (Transport t : dbTransports) {
            int seatsLeft = computeSeatsLeft(t);
            TransportOption opt = buildRealOption(t, distanceKm, passengers, seatsLeft, travelDate);
            opt = applyValidation(opt, distanceKm, passengers, fromCity, toCity);
            if (opt != null) {
                options.add(opt);
                covered.add(t.getType());
            }
        }

        // ── STEP 2 (virtual): Fill missing transport types with formula options ─
        for (Transport.TransportType type : ENGINE_TYPES) {
            if (!covered.contains(type)) {
                TransportOption virt = buildVirtualOption(
                    type, distanceKm, passengers, travelDate, fromCity, toCity);
                if (virt != null) options.add(virt);
            }
        }

        // ── STEP 4: AI scoring ───────────────────────────────────────────
        options.forEach(o -> {
            double s = score(o, preference);
            o.setScore(s);
            o.setAiScore((int) Math.round((1.0 - Math.min(s, 1.0)) * 100));
        });

        // Sort all options by score for comparison table
        options.sort(Comparator.comparingDouble(TransportOption::getScore));

        List<TransportOption> available = options.stream()
            .filter(o -> o.isAvailable() && o.getSeatsLeft() >= passengers)
            .collect(Collectors.toList()); // already sorted

        // ── STEP 5: Build response ───────────────────────────────────────
        if (available.isEmpty()) {
            return EngineRecommendationResponse.builder()
                .bestOption(null)
                .alternatives(Collections.emptyList())
                .allOptions(options)
                .distanceKm((int) Math.round(distanceKm))
                .fromCity(fromCity.getName())
                .toCity(toCity.getName())
                .passengers(passengers)
                .recommendationReason(
                    "Aucun transport disponible pour ce trajet à la date sélectionnée. "
                    + "Essayez une autre date ou modifiez votre recherche.")
                .build();
        }

        TransportOption      best         = available.get(0);
        List<TransportOption> alternatives = available.stream().skip(1).limit(3).collect(Collectors.toList());

        return EngineRecommendationResponse.builder()
            .bestOption(best)
            .alternatives(alternatives)
            .allOptions(options)
            .distanceKm((int) Math.round(distanceKm))
            .fromCity(fromCity.getName())
            .toCity(toCity.getName())
            .passengers(passengers)
            .recommendationReason(generateReason(best, preference, distanceKm, passengers))
            .combinationSuggestion(generateCombination(best, fromCity, toCity, distanceKm))
            .build();
    }

    // ──────────────────────────────────────────────────────────────────────
    // STEP 1: DATA LOADING
    // ──────────────────────────────────────────────────────────────────────

    private City resolveCity(Integer id, String name) {
        if (id != null) {
            return cityRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ville introuvable (id=" + id + ")"));
        }
        if (name != null && !name.isBlank()) {
            return cityRepo.findByName(name)
                .orElseThrow(() -> new IllegalArgumentException("Ville introuvable : " + name));
        }
        throw new IllegalArgumentException("Ville non spécifiée (id ou nom requis)");
    }

    /** Looks up distances table → reverse → Haversine fallback. Persists computed entry. */
    private double resolveDistance(City from, City to) {
        Optional<Distance> d = distanceRepo
            .findByFromCity_CityIdAndToCity_CityId(from.getCityId(), to.getCityId());
        if (d.isPresent()) return d.get().getDistanceKm();

        Optional<Distance> rev = distanceRepo
            .findByFromCity_CityIdAndToCity_CityId(to.getCityId(), from.getCityId());
        if (rev.isPresent()) return rev.get().getDistanceKm();

        // Haversine × road factor
        if (from.getLatitude() != null && from.getLongitude() != null
                && to.getLatitude() != null && to.getLongitude() != null) {
            double aerial = haversine(from.getLatitude(), from.getLongitude(),
                                      to.getLatitude(),   to.getLongitude());
            double road = round1(aerial * ROAD_FACTOR);
            try {
                distanceRepo.save(Distance.builder()
                    .fromCity(from).toCity(to).distanceKm(road).build());
                log.info("Persisted computed distance {}→{}: {} km",
                    from.getName(), to.getName(), road);
            } catch (Exception ex) {
                log.warn("Could not persist distance: {}", ex.getMessage());
            }
            return road;
        }

        throw new IllegalArgumentException(
            "Distance introuvable entre " + from.getName() + " et " + to.getName()
            + ". Vérifiez que les coordonnées GPS des villes sont renseignées.");
    }

    private List<Transport> loadTransports(int fromId, int toId, LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end   = date.atTime(23, 59, 59);
        return transportRepo
            .findByDepartureCity_CityIdAndArrivalCity_CityIdAndDepartureTimeBetweenAndIsActiveTrue(
                fromId, toId, start, end);
    }

    // ──────────────────────────────────────────────────────────────────────
    // STEP 2: DYNAMIC CALCULATION
    // ──────────────────────────────────────────────────────────────────────

    /** seatsLeft = capacity − SUM(confirmed/pending reservations). */
    private int computeSeatsLeft(Transport t) {
        int capacity = t.getCapacity() != null ? t.getCapacity() : 0;
        int booked   = reservationRepo.countBookedSeats(t.getTransportId());
        return Math.max(0, capacity - booked);
    }

    /** Build a TransportOption from a REAL database Transport record. */
    private TransportOption buildRealOption(Transport t, double distanceKm,
                                            int passengers, int seatsLeft, LocalDate date) {
        Transport.TransportType type = t.getType();

        double price    = computePrice(type, distanceKm, passengers);
        int    duration = computeDurationMins(type, distanceKm);

        LocalDateTime dep = t.getDepartureTime() != null
            ? t.getDepartureTime()
            : date.atTime(defaultDeparture(type));
        LocalDateTime arr = dep.plusMinutes(duration);

        return TransportOption.builder()
            .transportId(t.getTransportId())
            .type(typeLabel(type))
            .rawType(type.name())
            .price(round2(price))
            .pricePerPerson(round2(price / passengers))
            .priceFormatted(String.format("%.2f TND", price))
            .duration(fmtDuration(duration))
            .durationMinutes(duration)
            .departureTime(dep.format(DateTimeFormatter.ofPattern("HH:mm")))
            .arrivalTime(arr.format(DateTimeFormatter.ofPattern("HH:mm")))
            .seatsLeft(seatsLeft)
            .available(seatsLeft >= passengers)
            .virtual(false)
            .description(t.getDescription() != null ? t.getDescription() : typeLabel(type))
            .features(buildFeatures(type, distanceKm))
            .build();
    }

    /** Build a virtual (formula-derived) option for a type not in the DB. */
    private TransportOption buildVirtualOption(Transport.TransportType type, double distanceKm,
                                               int passengers, LocalDate date,
                                               City from, City to) {
        String unavailReason = checkAvailability(type, distanceKm, from, to);

        double price    = computePrice(type, distanceKm, passengers);
        int    duration = computeDurationMins(type, distanceKm);

        LocalDateTime dep = date.atTime(defaultDeparture(type));
        LocalDateTime arr = dep.plusMinutes(duration);

        TransportOption.TransportOptionBuilder b = TransportOption.builder()
            .transportId(null)
            .type(typeLabel(type))
            .rawType(type.name())
            .price(round2(price))
            .pricePerPerson(round2(price / passengers))
            .priceFormatted(String.format("%.2f TND", price))
            .duration(fmtDuration(duration))
            .durationMinutes(duration)
            .departureTime(dep.format(DateTimeFormatter.ofPattern("HH:mm")))
            .arrivalTime(arr.format(DateTimeFormatter.ofPattern("HH:mm")))
            .virtual(true)
            .description(defaultDesc(type, from, to))
            .features(buildFeatures(type, distanceKm));

        if (unavailReason != null) {
            b.seatsLeft(0).available(false).availabilityInfo(unavailReason);
        } else {
            b.seatsLeft(defaultCapacity(type)).available(true);
        }

        return b.build();
    }

    /** City infrastructure check → null means available. */
    private String checkAvailability(Transport.TransportType type, double distanceKm,
                                     City from, City to) {
        return switch (type) {
            case PLANE -> {
                if (!Boolean.TRUE.equals(from.getHasAirport()))
                    yield "Pas d'aéroport à " + from.getName();
                if (!Boolean.TRUE.equals(to.getHasAirport()))
                    yield "Pas d'aéroport à " + to.getName();
                if (distanceKm < MIN_PLANE_DISTANCE)
                    yield "Distance trop courte pour un vol (" + Math.round(distanceKm) + " km)";
                yield null;
            }
            case TRAIN -> {
                if (!Boolean.TRUE.equals(from.getHasTrainStation()))
                    yield "Pas de gare ferroviaire à " + from.getName();
                if (!Boolean.TRUE.equals(to.getHasTrainStation()))
                    yield "Pas de gare ferroviaire à " + to.getName();
                yield null;
            }
            case FERRY -> "Pas de liaison maritime sur ce trajet";
            default    -> null;
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // PRICE CALCULATION (spec formulas, per type)
    // ──────────────────────────────────────────────────────────────────────

    double computePrice(Transport.TransportType type, double km, int passengers) {
        return switch (type) {
            case TAXI -> {
                // Total vehicle price (shared by ≤4 passengers)
                double total = 0.9 + (km * 0.7);
                yield round2(Math.max(MIN_PRICE, total));
            }
            case VAN -> {
                // Louage – per-person tiered pricing
                double perPerson;
                if (km <= 10)       perPerson = 0.85;
                else if (km <= 150) perPerson = km * 0.086;
                else                perPerson = (150 * 0.086) + ((km - 150) * 0.071);
                yield round2(Math.max(MIN_PRICE, perPerson) * passengers);
            }
            case BUS  -> round2(Math.max(MIN_PRICE, km * 0.07) * passengers);
            case PLANE -> {
                // Per person, tiered by distance
                double perPerson = (km < 200) ? 145.0 : (km < 400) ? 215.0 : 300.0;
                yield round2(perPerson * passengers);
            }
            case CAR -> {
                // Daily car-rental rate; 1 day per 400 km of road travel
                int days = Math.max(1, (int) Math.ceil(km / 400.0));
                yield round2(days * 120.0);
            }
            case TRAIN -> round2(Math.max(MIN_PRICE, km * 0.065) * passengers);
            default    -> round2(Math.max(MIN_PRICE, km * 0.10)  * passengers);
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // DURATION CALCULATION
    // ──────────────────────────────────────────────────────────────────────

    int computeDurationMins(Transport.TransportType type, double km) {
        double speed = switch (type) {
            case TAXI  -> TAXI_SPEED;
            case VAN   -> LOUAGE_SPEED;
            case BUS   -> BUS_SPEED;
            case PLANE -> PLANE_SPEED;
            case CAR   -> CAR_SPEED;
            case TRAIN -> TRAIN_SPEED;
            default    -> 70.0;
        };
        int mins = (int) Math.round((km / speed) * 60.0);
        if (type == Transport.TransportType.PLANE) mins += (int) PLANE_OVERHEAD_MIN;
        return Math.max(1, mins);
    }

    // ──────────────────────────────────────────────────────────────────────
    // VALIDATION ENGINE (auto-correction)
    // ──────────────────────────────────────────────────────────────────────

    private TransportOption applyValidation(TransportOption opt, double distanceKm,
                                            int passengers, City from, City to) {
        if (opt == null) return null;

        // Rule 1: seatsLeft must be ≥ 0
        if (opt.getSeatsLeft() < 0) {
            opt.setSeatsLeft(0);
            opt.setAvailable(false);
            opt.setAvailabilityInfo("Complet");
        }

        // Rule 2: price must be within realistic range
        if (opt.getPrice() < MIN_PRICE) {
            double corrected = computePrice(
                Transport.TransportType.valueOf(opt.getRawType()), distanceKm, passengers);
            opt.setPrice(corrected);
            opt.setPricePerPerson(round2(corrected / passengers));
            opt.setPriceFormatted(String.format("%.2f TND", corrected));
        }

        // Rule 3: duration must match distance (auto-correct if wildly wrong > 50% off)
        int expected = computeDurationMins(
            Transport.TransportType.valueOf(opt.getRawType()), distanceKm);
        if (opt.getDurationMinutes() <= 0
                || Math.abs(opt.getDurationMinutes() - expected) > expected * 0.5) {
            opt.setDurationMinutes(expected);
            opt.setDuration(fmtDuration(expected));
        }

        // Rule 4: PLANE only if both cities have airports
        if ("PLANE".equals(opt.getRawType())) {
            String reason = checkAvailability(Transport.TransportType.PLANE, distanceKm, from, to);
            if (reason != null) {
                opt.setAvailable(false);
                opt.setAvailabilityInfo(reason);
                opt.setSeatsLeft(0);
            }
        }

        // Rule 5: arrival_time must be consistent with duration
        // (Re-compute arrival from existing departureTime + corrected duration)
        try {
            LocalTime dep = LocalTime.parse(opt.getDepartureTime());
            LocalTime arr = dep.plusMinutes(opt.getDurationMinutes());
            opt.setArrivalTime(arr.format(DateTimeFormatter.ofPattern("HH:mm")));
        } catch (Exception ignored) { /* keep original if parse fails */ }

        return opt;
    }

    // ──────────────────────────────────────────────────────────────────────
    // AI SCORING (Step 4)
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Returns a score in [0, 1] — LOWER is better.
     * Components: price (normalized), duration (normalized), comfort (normalized).
     * Weights depend on user preference.
     */
    double score(TransportOption opt, String preference) {
        double maxPrice    = 2000.0;
        double maxDuration = 900.0; // 15 h

        double priceScore    = Math.min(opt.getPrice() / maxPrice, 1.0);
        double durationScore = Math.min(opt.getDurationMinutes() / maxDuration, 1.0);
        double comfortScore  = comfortScore(opt.getRawType()); // 0 = most comfortable

        double[] w = switch (preference) {
            case "budget", "cheap" -> new double[]{ 0.70, 0.20, 0.10 };
            case "fast"            -> new double[]{ 0.10, 0.70, 0.20 };
            case "comfort"         -> new double[]{ 0.20, 0.20, 0.60 };
            case "family"          -> new double[]{ 0.30, 0.30, 0.40 };
            default                -> new double[]{ 0.40, 0.35, 0.25 };
        };

        return (w[0] * priceScore) + (w[1] * durationScore) + (w[2] * comfortScore);
    }

    private double comfortScore(String rawType) {
        if (rawType == null) return 0.5;
        return switch (rawType) {
            case "PLANE" -> 0.10;
            case "TAXI"  -> 0.20;
            case "CAR"   -> 0.25;
            case "TRAIN" -> 0.40;
            case "VAN"   -> 0.55;
            case "BUS"   -> 0.80;
            default      -> 0.50;
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    // RECOMMENDATION REASON & COMBINATION TIP
    // ──────────────────────────────────────────────────────────────────────

    private String generateReason(TransportOption best, String pref,
                                  double km, int passengers) {
        String type  = best.getType();
        String price = best.getPriceFormatted();
        String dur   = best.getDuration();

        return switch (pref) {
            case "budget", "cheap" -> String.format(
                "%s est la solution la plus économique pour ce trajet de %.0f km : %s pour %d passager(s), avec un voyage de %s.",
                type, km, price, passengers, dur);
            case "fast" -> String.format(
                "%s est le transport le plus rapide disponible : arrivée en %s. Idéal pour optimiser votre temps.",
                type, dur);
            case "comfort" -> String.format(
                "%s offre le meilleur niveau de confort pour ce trajet (%s, %s). Un voyage serein garanti.",
                type, price, dur);
            case "family" -> String.format(
                "%s est recommandé pour votre groupe de %d passager(s) : espace, flexibilité et confort.",
                type, passengers);
            default -> String.format(
                "%s offre le meilleur équilibre prix/durée/confort : %s, %s de voyage sur %.0f km.",
                type, price, dur, km);
        };
    }

    private String generateCombination(TransportOption best, City from, City to, double km) {
        if ("PLANE".equals(best.getRawType())) return null;
        boolean fromAirport = Boolean.TRUE.equals(from.getHasAirport());
        boolean toAirport   = Boolean.TRUE.equals(to.getHasAirport());

        if (fromAirport && toAirport && km > 300) {
            return "Suggestion combinée : Louage jusqu'à l'aéroport de " + from.getName()
                + " → vol direct vers " + to.getName()
                + ". Idéal pour réduire significativement la durée totale sur les longues distances.";
        }
        if (km > 200 && !fromAirport && !toAirport) {
            return "Pour ce trajet de " + Math.round(km)
                + " km, un louage direct reste l'option la plus pratique et économique en Tunisie.";
        }
        return null;
    }

    // ──────────────────────────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────────────────────────

    private String typeLabel(Transport.TransportType t) {
        return switch (t) {
            case TAXI  -> "Taxi";
            case VAN   -> "Louage (Taxi Collectif)";
            case BUS   -> "Bus SNTRI";
            case PLANE -> "Avion (Tunisair Express)";
            case CAR   -> "Location de Voiture";
            case TRAIN -> "Train SNCFT";
            case FERRY -> "Ferry";
        };
    }

    private List<String> buildFeatures(Transport.TransportType type, double km) {
        return switch (type) {
            case TAXI  -> List.of("Porte-à-porte", "Flexible", "Climatisé");
            case VAN   -> List.of("Économique", "Départ gare routière", "Option la plus utilisée en Tunisie");
            case BUS   -> List.of("Très économique", "Ponctuel", "Clim + bagages inclus");
            case PLANE -> List.of("Ultra-rapide", "Confort élevé", "Idéal > 300 km");
            case CAR   -> List.of("Liberté totale", "Bagages illimités", "Flexibilité horaire");
            case TRAIN -> List.of("Confortable", "Économique", "Sans bouchons");
            default    -> List.of();
        };
    }

    private LocalTime defaultDeparture(Transport.TransportType t) {
        return switch (t) {
            case BUS   -> LocalTime.of(6, 30);
            case VAN   -> LocalTime.of(7, 0);
            case PLANE -> LocalTime.of(9, 0);
            case TRAIN -> LocalTime.of(7, 30);
            default    -> LocalTime.of(8, 0);
        };
    }

    private int defaultCapacity(Transport.TransportType t) {
        return switch (t) {
            case TAXI  -> 4;
            case VAN   -> 8;
            case BUS   -> 50;
            case PLANE -> 80;
            case CAR   -> 5;
            case TRAIN -> 120;
            default    -> 10;
        };
    }

    private String defaultDesc(Transport.TransportType type, City from, City to) {
        return switch (type) {
            case TAXI  -> "Taxi privé " + from.getName() + " → " + to.getName();
            case VAN   -> "Louage collectif – départ gare routière de " + from.getName();
            case BUS   -> "Bus SNTRI – liaison directe " + from.getName() + " → " + to.getName();
            case PLANE -> "Vol Tunisair Express " + from.getName() + " → " + to.getName();
            case CAR   -> "Location de voiture – Flexibilité totale";
            case TRAIN -> "Train SNCFT – Confort et ponctualité";
            default    -> "Transport " + from.getName() + " → " + to.getName();
        };
    }

    private String normalizePreference(String raw) {
        if (raw == null || raw.isBlank()) return "balanced";
        return raw.toLowerCase().trim();
    }

    private LocalDate parseDateOrToday(String s) {
        if (s == null || s.isBlank()) return LocalDate.now();
        try { return LocalDate.parse(s); } catch (Exception e) { return LocalDate.now(); }
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double R    = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private String fmtDuration(int mins) {
        if (mins < 60) return mins + " min";
        int h = mins / 60, m = mins % 60;
        return m == 0 ? h + "h" : h + "h" + String.format("%02d", m);
    }

    private double round2(double v) { return Math.round(v * 100.0) / 100.0; }
    private double round1(double v) { return Math.round(v * 10.0)  / 10.0;  }
}
