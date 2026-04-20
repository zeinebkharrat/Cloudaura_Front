package org.example.backend.service.flight;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.text.Normalizer;

/**
 * Resolves a user-typed city or region to a main airport IATA (demo rules for PFE).
 */
@Component
public class DestinationAirportResolver {

    private final Map<String, String> normalizedToIata = new LinkedHashMap<>();

    public DestinationAirportResolver() {
        put("paris", "CDG", "Paris (CDG)");
        put("france", "CDG", "France — Paris CDG");
        put("london", "LHR", "London (LHR)");
        put("uk", "LHR", "United Kingdom — London LHR");
        put("new york", "JFK", "New York (JFK)");
        put("nyc", "JFK", "New York (JFK)");
        put("rome", "FCO", "Rome (FCO)");
        put("milan", "MXP", "Milan (MXP)");
        put("istanbul", "IST", "Istanbul (IST)");
        put("dubai", "DXB", "Dubai (DXB)");
        put("doha", "DOH", "Doha (DOH)");
        put("madrid", "MAD", "Madrid (MAD)");
        put("barcelona", "BCN", "Barcelona (BCN)");
        put("berlin", "BER", "Berlin (BER)");
        put("munich", "MUC", "Munich (MUC)");
        put("frankfurt", "FRA", "Frankfurt (FRA)");
        put("amsterdam", "AMS", "Amsterdam (AMS)");
        put("brussels", "BRU", "Brussels (BRU)");
        put("tunis", "TUN", "Tunis (TUN)");
        put("tunisia", "TUN", "Tunisia — Tunis");
        put("sfax", "SFA", "Sfax (SFA)");
        put("sousse", "NBE", "Enfidha / Monastir area (NBE)");
        put("djerba", "DJE", "Djerba (DJE)");
        put("medenine", "DJE", "Medenine area — Djerba (DJE)");
        put("mednin", "DJE", "Medenine area — Djerba (DJE)");
        put("mednine", "DJE", "Medenine area — Djerba (DJE)");
        put("midoun", "DJE", "Midoun — Djerba (DJE)");
        put("zarzis", "DJE", "Zarzis area — Djerba (DJE)");
        put("tataouine", "DJE", "Tataouine area — Djerba (DJE)");
        put("kebili", "TOE", "Kebili area — Tozeur (TOE)");
        put("douz", "TOE", "Douz area — Tozeur (TOE)");
        put("mahdia", "MIR", "Mahdia area — Monastir (MIR)");
        put("kairouan", "NBE", "Kairouan area — Enfidha (NBE)");
        put("bizerte", "TUN", "Bizerte area — Tunis (TUN)");
        put("nabeul", "NBE", "Nabeul area — Enfidha (NBE)");
    }

    private void put(String key, String iata, String label) {
        normalizedToIata.put(normalize(key), iata + "|" + label);
    }

    public Optional<ResolvedAirport> resolve(String query) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }
        String q = query.trim();
        if (q.length() == 3 && q.chars().allMatch(Character::isLetter)) {
            String iata = q.toUpperCase(Locale.ROOT);
            return Optional.of(new ResolvedAirport(iata, iata + " airport"));
        }
        String norm = normalize(q);
        String entry = normalizedToIata.get(norm);
        if (entry != null) {
            String[] parts = entry.split("\\|", 2);
            return Optional.of(new ResolvedAirport(parts[0], parts[1]));
        }
        for (Map.Entry<String, String> e : normalizedToIata.entrySet()) {
            if (norm.contains(e.getKey())) {
                String[] parts = e.getValue().split("\\|", 2);
                return Optional.of(new ResolvedAirport(parts[0], parts[1]));
            }
        }
        return Optional.empty();
    }

    private static String normalize(String value) {
        String nfd = Normalizer.normalize(value, Normalizer.Form.NFD);
        String noAccents = nfd.replaceAll("\\p{M}", "");
        return noAccents
                .toLowerCase(Locale.ROOT)
                .replace('-', ' ')
                .replaceAll("[^a-z\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    public record ResolvedAirport(String iata, String label) {
    }
}
