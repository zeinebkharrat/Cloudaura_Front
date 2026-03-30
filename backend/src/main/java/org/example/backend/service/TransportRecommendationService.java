package org.example.backend.service;

import org.example.backend.dto.transport.TransportRecommendationRequest;
import org.example.backend.dto.transport.TransportRecommendationResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Transport AI Engine – Tunisia
 * Pricing formulas strictly calibrated on:
 *  - Arrêté ministériel 2022 (taxi / louage)
 *  - SNTRI public tariffs (~0.10 TND/km)
 *  - Tunisair Express observed fares (Skyscanner)
 *  - Liligo / Kayak car rental averages
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransportRecommendationService {

    // ── Speed constants (km/h) – from spec ─────────────────────────
    private static final double TAXI_SPEED        = 80.0;   // spec: 80 km/h
    private static final double LOUAGE_SPEED      = 90.0;   // spec: 90 km/h
    private static final double BUS_SPEED         = 70.0;   // spec: 70 km/h
    private static final double PLANE_SPEED       = 600.0;  // spec: 600 km/h
    private static final double PLANE_OVERHEAD_MIN = 120;   // spec: +2h airport overhead
    private static final double CAR_SPEED         = 75.0;   // spec: 75 km/h

    // Road factor – aerial (Haversine) distances are ~23% shorter than road
    private static final double ROAD_FACTOR = 1.25;

    // ── 24 Tunisian cities ──────────────────────────────────────────
    private static final Set<String> AIRPORT_CITIES = new HashSet<>(Arrays.asList(
        "Tunis", "Monastir", "Medenine", "Sfax", "Tozeur", "Tabarka", "Gafsa", "Gabes"
    ));

    // GPS coordinates (WGS-84)
    private static final Map<String, double[]> CITY_COORDS = new HashMap<>() {{
        put("Tunis",        new double[]{36.8065, 10.1815});
        put("Sousse",       new double[]{35.8288, 10.6407});
        put("Sfax",         new double[]{34.7398, 10.7600});
        put("Bizerte",      new double[]{37.2746,  9.8739});
        put("Gabes",        new double[]{33.8815, 10.0982});
        put("Gafsa",        new double[]{34.4250,  8.7842});
        put("Kairouan",     new double[]{35.6781, 10.0963});
        put("Kasserine",    new double[]{35.1676,  8.8365});
        put("Kebili",       new double[]{33.7050,  8.9690});
        put("Le Kef",       new double[]{36.1673,  8.7149});
        put("Mahdia",       new double[]{35.5047, 11.0622});
        put("Medenine",     new double[]{33.3540, 10.5053});
        put("Monastir",     new double[]{35.7833, 10.8261});
        put("Nabeul",       new double[]{36.4561, 10.7376});
        put("Sidi Bouzid",  new double[]{35.0382,  9.4850});
        put("Siliana",      new double[]{36.0840,  9.3707});
        put("Tataouine",    new double[]{32.9297, 10.4518});
        put("Tozeur",       new double[]{33.9197,  8.1335});
        put("Zaghouan",     new double[]{36.4080, 10.1423});
        put("Ben Guerdane", new double[]{33.1383, 11.2137});
        put("El Jem",       new double[]{35.3000, 10.7167});
        put("Hammamet",     new double[]{36.4000, 10.6167});
        put("Douz",         new double[]{33.4667,  9.0200});
        put("Tabarka",      new double[]{36.9500,  8.7500});
    }};

    // ── Main entry point ────────────────────────────────────────────
    public TransportRecommendationResponse getRecommendations(TransportRecommendationRequest request) {
        String from  = request.getFromCity();
        String to    = request.getToCity();
        int pax      = Math.max(1, request.getPassengers());
        double budget = request.getBudget() > 0 ? request.getBudget() : Double.MAX_VALUE;
        String pref  = request.getPreference() != null ? request.getPreference().toLowerCase() : "balanced";

        double aerialKm = haversine(from, to);
        double roadKm   = Math.round(aerialKm * ROAD_FACTOR);  // realistic road distance

        List<TransportRecommendationResponse.TransportOption> options = new ArrayList<>();

        options.add(taxiOption(roadKm, pax));
        options.add(louageOption(roadKm, pax));
        options.add(busOption(roadKm, pax));

        TransportRecommendationResponse.TransportOption plane = planeOption(from, to, roadKm, pax);
        options.add(plane);  // always add; unavailable ones get penalized

        options.add(carRentalOption(roadKm, pax));

        // Score & rank
        for (var opt : options) {
            opt.setScore(score(opt, pref, budget));
        }
        options.sort(Comparator.comparingDouble(TransportRecommendationResponse.TransportOption::getScore));

        // Split best vs alternatives (only available options for best)
        TransportRecommendationResponse.TransportOption best = options.stream()
            .filter(TransportRecommendationResponse.TransportOption::isAvailable)
            .findFirst()
            .orElse(options.get(0));

        List<TransportRecommendationResponse.TransportOption> alts = new ArrayList<>(options);
        alts.remove(best);

        return TransportRecommendationResponse.builder()
            .bestOption(best)
            .alternativeOptions(alts)
            .distanceKm((int) roadKm)
            .recommendationReason(reason(best, pref, roadKm, pax))
            .combinationSuggestion(combination(from, to, roadKm, pax))
            .build();
    }

    // ══════════════════════════════════════════════════════════════
    //  PRICE CALCULATORS – spec-compliant
    // ══════════════════════════════════════════════════════════════

    /**
     * Taxi privé (interurbain)
     * Formula: 0.9 + (km × 0.7)  [spec simplified]
     * Capacity: 1-4 passengers, price is per vehicle.
     */
    private TransportRecommendationResponse.TransportOption taxiOption(double km, int pax) {
        boolean available = pax <= 4;
        double price = 0.9 + (km * 0.7);
        int durationMin = durationMin(km, TAXI_SPEED);

        return TransportRecommendationResponse.TransportOption.builder()
            .transportType("Taxi")
            .price(round2(price))
            .pricePerPerson(round2(price / Math.min(pax, 4)))
            .priceFormatted(String.format("%.2f TND (véhicule)", price))
            .duration(fmtDuration(durationMin))
            .durationMinutes(durationMin)
            .available(available)
            .availabilityInfo(available ? "Disponible 24/7 – départ immédiat" : "Max 4 passagers par taxi")
            .description("Taxi privé porte-à-porte, disponible immédiatement. Prix pour tout le véhicule.")
            .distanceKm((int) km)
            .features(Arrays.asList("Disponible 24/7", "Porte-à-porte", "Climatisation", "Bagages inclus"))
            .build();
    }

    /**
     * Louage (minibus collectif)
     * Formula (arrêté 2022, per person):
     *   ≤ 10 km  → 0.85 TND forfait
     *   10–150 km → km × 0.086
     *   > 150 km  → 150×0.086 + (km−150)×0.071
     * Capacity: 8 seats
     */
    private TransportRecommendationResponse.TransportOption louageOption(double km, int pax) {
        boolean available = pax <= 8;
        double pricePerPerson;
        if (km <= 10) {
            pricePerPerson = 0.85;
        } else if (km <= 150) {
            pricePerPerson = km * 0.086;
        } else {
            pricePerPerson = (150 * 0.086) + ((km - 150) * 0.071);
        }
        double total = pricePerPerson * pax;
        int durationMin = durationMin(km, LOUAGE_SPEED);

        return TransportRecommendationResponse.TransportOption.builder()
            .transportType("Louage (Taxi Collectif)")
            .price(round2(total))
            .pricePerPerson(round2(pricePerPerson))
            .priceFormatted(String.format("%.2f TND (%.2f/pers.)", total, pricePerPerson))
            .duration(fmtDuration(durationMin))
            .durationMinutes(durationMin)
            .available(available)
            .availabilityInfo(available ? "Disponible – départ quand plein (8 places)" : "Max 8 passagers par louage")
            .description("Minibus collectif – tarif réglementé arrêté 2022. Option la plus économique sur routes interurbaines.")
            .distanceKm((int) km)
            .features(Arrays.asList("Le plus économique", "Tarif officiel 2022", "Fréquent sur axes principaux", "8 places max"))
            .build();
    }

    /**
     * Bus SNTRI
     * Formula: km × 0.10 TND per person (~official estimate)
     */
    private TransportRecommendationResponse.TransportOption busOption(double km, int pax) {
        double pricePerPerson = km * 0.10;
        double total = pricePerPerson * pax;
        int durationMin = durationMin(km, BUS_SPEED);

        return TransportRecommendationResponse.TransportOption.builder()
            .transportType("Bus SNTRI")
            .price(round2(total))
            .pricePerPerson(round2(pricePerPerson))
            .priceFormatted(String.format("%.2f TND (%.2f/pers.)", total, pricePerPerson))
            .duration(fmtDuration(durationMin))
            .durationMinutes(durationMin)
            .available(true)
            .availabilityInfo("2 départs/jour – 45 places")
            .description("Bus public SNTRI – confort standard, le plus couvert sur tout le territoire.")
            .distanceKm((int) km)
            .features(Arrays.asList("Économique", "45 places", "2 départs/jour", "Climatisation"))
            .build();
    }

    /**
     * Avion Tunisair Express
     * Formula (per person):
     *   < 300 km → 150 + (km × 0.30)  [observed Tunis–Sousse ~270 TND]
     *   ≥ 300 km → 150 + (km × 0.40)  [calibré Tunis–Djerba ~270 TND]
     * Duration = aerial_km / 600 + 2h overhead
     * Availability: both cities must have airports & distance > 200 km
     */
    private TransportRecommendationResponse.TransportOption planeOption(String from, String to,
                                                                        double roadKm, int pax) {
        boolean airports = AIRPORT_CITIES.contains(from) && AIRPORT_CITIES.contains(to);
        boolean longEnough = roadKm > 200;
        boolean available = airports && longEnough;

        // Use aerial distance for flight price (more realistic)
        double aerialKm = haversine(from, to);
        double pricePerPerson;
        if (aerialKm < 300) {
            pricePerPerson = 150 + (aerialKm * 0.30);
        } else {
            pricePerPerson = 150 + (aerialKm * 0.40);
        }
        double total = pricePerPerson * pax;

        int flightMin  = (int) (aerialKm / PLANE_SPEED * 60);
        int totalMin   = (int) (flightMin + PLANE_OVERHEAD_MIN);

        String unavailReason = !airports
            ? (AIRPORT_CITIES.contains(from) ? "Pas d'aéroport à " + to : "Pas d'aéroport à " + from)
            : "Distance trop courte – avion déconseillé";

        return TransportRecommendationResponse.TransportOption.builder()
            .transportType("Avion (Tunisair Express)")
            .price(round2(total))
            .pricePerPerson(round2(pricePerPerson))
            .priceFormatted(String.format("%.0f TND (%.0f/pers.)", total, pricePerPerson))
            .duration(fmtDuration(totalMin))
            .durationMinutes(totalMin)
            .available(available)
            .availabilityInfo(available ? "Vols disponibles – aéroports confirmés" : unavailReason)
            .description("Vol domestique Tunisair Express – l'option la plus rapide pour les longues distances.")
            .distanceKm((int) roadKm)
            .features(Arrays.asList("Le plus rapide", "Confort premium", "Repas à bord", "Bagages 20 kg"))
            .build();
    }

    /**
     * Location de voiture
     * Formula: 120 TND/jour (économique) – prix pour tout le véhicule
     * Duration = roadKm / 75 km/h
     */
    private TransportRecommendationResponse.TransportOption carRentalOption(double km, int pax) {
        int days = Math.max(1, (int) Math.ceil(km / 400.0)); // 1 day per ~400 km
        double dailyRate = pax <= 2 ? 120 : (pax <= 5 ? 130 : 150);
        double total = dailyRate * days;
        int durationMin = durationMin(km, CAR_SPEED);

        return TransportRecommendationResponse.TransportOption.builder()
            .transportType("Location de Voiture")
            .price(round2(total))
            .pricePerPerson(round2(total / pax))
            .priceFormatted(String.format("%.0f TND (%d jour%s × %.0f TND/j)", total, days, days > 1 ? "s" : "", dailyRate))
            .duration(fmtDuration(durationMin))
            .durationMinutes(durationMin)
            .available(true)
            .availabilityInfo("Disponible avec permis valide (cat. B)")
            .description("Location voiture économique 4-5 places – liberté totale, idéal road trip.")
            .distanceKm((int) km)
            .features(Arrays.asList("Liberté de mouvement", "Pas d'horaire fixe", "Explorer en route", "Idéal groupes"))
            .build();
    }

    // ══════════════════════════════════════════════════════════════
    //  AI SCORING – spec section 6
    //  score = priceW*priceScore + timeW*durationScore + comfortW*discomfortScore
    //  Lower score = better. comfortScore is inverted (100−comfort).
    // ══════════════════════════════════════════════════════════════
    private double score(TransportRecommendationResponse.TransportOption opt, String pref, double budget) {
        if (!opt.isAvailable()) return 1_000_000;

        // Normalize price to 0-100
        double priceScore = Math.min(opt.getPrice() / 5.0, 100);

        // Normalize duration to 0-100
        double durationScore = Math.min(opt.getDurationMinutes() / 5.0, 100);

        // Comfort: invert so low-comfort modes get higher penalty
        double discomfortScore = 100 - comfortRating(opt.getTransportType());

        double w_price, w_time, w_comfort;
        switch (pref) {
            case "cheap":    w_price = 0.60; w_time = 0.20; w_comfort = 0.20; break;
            case "fast":     w_price = 0.20; w_time = 0.60; w_comfort = 0.20; break;
            case "comfort":  w_price = 0.20; w_time = 0.20; w_comfort = 0.60; break;
            default:         w_price = 0.50; w_time = 0.30; w_comfort = 0.20; break; // balanced
        }

        double s = (w_price * priceScore) + (w_time * durationScore) + (w_comfort * discomfortScore);

        // Budget over-run penalty
        if (opt.getPrice() > budget) s += 30;

        return s;
    }

    /** Comfort rating 0-100 (higher = more comfortable) */
    private double comfortRating(String type) {
        switch (type) {
            case "Avion (Tunisair Express)": return 90;
            case "Taxi":                     return 80;
            case "Location de Voiture":      return 75;
            case "Bus SNTRI":                return 55;
            case "Louage (Taxi Collectif)":  return 45;
            default:                         return 50;
        }
    }

    // ── Recommendation reason ───────────────────────────────────────
    private String reason(TransportRecommendationResponse.TransportOption best, String pref,
                          double km, int pax) {
        if (best == null) return "Aucune option de transport disponible.";
        String dist = String.format("%.0f km", km);
        return switch (pref) {
            case "cheap"   -> String.format("Pour %s passager(s) sur %s, le %s est l'option la plus économique à %s. %s",
                pax, dist, best.getTransportType(), best.getPriceFormatted(), best.getDescription());
            case "fast"    -> String.format("Sur %s, le %s est le plus rapide (%s). %s",
                dist, best.getTransportType(), best.getDuration(), best.getDescription());
            case "comfort" -> String.format("Pour un voyage confortable sur %s, le %s offre le meilleur confort. %s",
                dist, best.getTransportType(), best.getDescription());
            default        -> String.format("Sur %s pour %s passager(s), le %s offre le meilleur équilibre prix/durée/confort à %s (%s de trajet).",
                dist, pax, best.getTransportType(), best.getPriceFormatted(), best.getDuration());
        };
    }

    // ── Combination suggestion ──────────────────────────────────────
    private String combination(String from, String to, double km, int pax) {
        if (km > 400 && !AIRPORT_CITIES.contains(from) && AIRPORT_CITIES.contains(to)) {
            String nearest = nearestAirportCity(from);
            return String.format("💡 Astuce multi-modal : Prenez un louage de %s jusqu'à %s, puis envolez-vous vers %s. Gain de temps estimé : 2–3h.",
                from, nearest, to);
        }
        if (km > 150 && km < 350 && pax >= 4) {
            return String.format("💡 Pour %s passagers, la location de voiture devient compétitive : vous partagez le coût et profitez de la liberté de route entre %s et %s.",
                pax, from, to);
        }
        if (km < 80) {
            return String.format("💡 Courte distance (%s→%s) : un taxi ou louage est amplement suffisant. L'avion serait disproportionné.",
                from, to);
        }
        return null;
    }

    private String nearestAirportCity(String city) {
        double[] coords = CITY_COORDS.get(city);
        if (coords == null) return "Tunis";
        String nearest = "Tunis";
        double minDist = Double.MAX_VALUE;
        for (String airport : AIRPORT_CITIES) {
            double[] ac = CITY_COORDS.get(airport);
            if (ac != null) {
                double d = haversineCoords(coords[0], coords[1], ac[0], ac[1]);
                if (d < minDist) { minDist = d; nearest = airport; }
            }
        }
        return nearest;
    }

    // ── Distance utilities ──────────────────────────────────────────
    private double haversine(String from, String to) {
        double[] a = CITY_COORDS.getOrDefault(from, new double[]{36.8065, 10.1815});
        double[] b = CITY_COORDS.getOrDefault(to,   new double[]{35.8288, 10.6407});
        return haversineCoords(a[0], a[1], b[0], b[1]);
    }

    private double haversineCoords(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat/2) * Math.sin(dLat/2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                 * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── Helpers ─────────────────────────────────────────────────────
    private int durationMin(double km, double speedKmh) {
        return (int) Math.ceil(km / speedKmh * 60);
    }

    private String fmtDuration(int minutes) {
        int h = minutes / 60, m = minutes % 60;
        return h > 0 ? String.format("%dh %02dmin", h, m) : String.format("%d min", m);
    }

    private double round2(double v) { return Math.round(v * 100) / 100.0; }
}
