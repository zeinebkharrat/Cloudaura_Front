package org.example.backend.service.flight;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Maps Tunisian airport IATA codes to a single canonical {@code cities.name} row
 * (the 24 governorates seeded in {@link org.example.backend.service.DataInitializer}).
 * <p>
 * Aligns with the frontend transport hint map {@code AIRPORT_IATA_BY_CITY_KEY}
 * (transport-search-page): one governorate per airport for consistent {@code city_id} on flight transports.
 */
public final class TunisiaAirportIataGovernorateMap {

    /**
     * Primary airport IATA → exact {@link org.example.backend.model.City#getName()} spelling from seed data.
     */
    private static final Map<String, String> GOVERNORATE_BY_IATA = Map.ofEntries(
            Map.entry("TUN", "Tunis"),
            Map.entry("NBE", "Sousse"),
            Map.entry("MIR", "Monastir"),
            Map.entry("DJE", "Médenine"),
            Map.entry("SFA", "Sfax"),
            Map.entry("TOE", "Tozeur"),
            Map.entry("GAF", "Gafsa"),
            Map.entry("TBJ", "Jendouba"),
            Map.entry("GAE", "Gabès"),
            Map.entry("OIZ", "Médenine"),
            Map.entry("EBM", "Tataouine")
    );

    private TunisiaAirportIataGovernorateMap() {}

    /**
     * @param iata 3-letter airport code (any case)
     * @return seeded governorate city name, or empty if not a mapped Tunisian airport (e.g. foreign CDG)
     */
    public static Optional<String> governorateNameForIata(String iata) {
        if (iata == null || iata.isBlank()) {
            return Optional.empty();
        }
        String code = iata.trim().toUpperCase(Locale.ROOT);
        return Optional.ofNullable(GOVERNORATE_BY_IATA.get(code));
    }
}
