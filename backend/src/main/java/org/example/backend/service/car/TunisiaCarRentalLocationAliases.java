package org.example.backend.service.car;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Maps common traveller spellings / tourism names to canonical {@code cities.name}
 * from the 24 Tunisian governorates seed (see {@code DataInitializer}).
 */
public final class TunisiaCarRentalLocationAliases {

    private TunisiaCarRentalLocationAliases() {}

    /** Keys: {@link #foldKey(String)} of user input. Values: exact {@code City#getName()} in DB. */
    private static final Map<String, String> ALIAS_TO_CANONICAL = Map.ofEntries(
            Map.entry("djerba", "Médenine"),
            Map.entry("jerba", "Médenine"),
            Map.entry("zarzis", "Médenine"),
            Map.entry("houmt souk", "Médenine"),
            Map.entry("hammamet", "Nabeul"),
            Map.entry("yasmine hammamet", "Nabeul"),
            Map.entry("enfidha", "Sousse"),
            Map.entry("enfidha hammamet", "Sousse"),
            Map.entry("kef", "Le Kef"),
            Map.entry("le kef", "Le Kef"),
            Map.entry("gabes", "Gabès"),
            Map.entry("beja", "Béja"),
            Map.entry("tabarka", "Jendouba"),
            Map.entry("ain draham", "Jendouba"),
            Map.entry("sfax", "Sfax"),
            Map.entry("sousse", "Sousse"),
            Map.entry("tunis", "Tunis"),
            Map.entry("tunisia", "Tunis"),
            Map.entry("monastir", "Monastir"),
            Map.entry("mahdia", "Mahdia"),
            Map.entry("bizerte", "Bizerte"),
            Map.entry("bizerta", "Bizerte"),
            Map.entry("kairouan", "Kairouan"),
            Map.entry("tozeur", "Tozeur"),
            Map.entry("gafsa", "Gafsa"),
            Map.entry("medenine", "Médenine"));

    public static Optional<String> canonicalCityNameForAlias(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String key = foldKey(raw.trim());
        return Optional.ofNullable(ALIAS_TO_CANONICAL.get(key));
    }

    /** ASCII-style fold for map keys and city-name equality (strip combining marks, lower case). */
    public static String foldKey(String s) {
        if (s == null) {
            return "";
        }
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return n.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }
}
