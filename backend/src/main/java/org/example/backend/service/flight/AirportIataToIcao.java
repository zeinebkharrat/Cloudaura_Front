package org.example.backend.service.flight;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Minimal IATA → ICAO for OpenSky airport parameters (extend with DB later).
 */
public final class AirportIataToIcao {

    private static final Map<String, String> MAP;

    static {
        Map<String, String> m = new HashMap<>();
        m.put("TUN", "DTTA");
        m.put("NBE", "DTNH");
        m.put("DJE", "DTTJ");
        m.put("SFA", "DTTX");
        m.put("MIR", "DTMB");
        m.put("TOE", "DTTZ");
        m.put("GAF", "DTTF");
        m.put("CDG", "LFPG");
        m.put("ORY", "LFPO");
        m.put("LHR", "EGLL");
        m.put("STN", "EGSS");
        m.put("JFK", "KJFK");
        m.put("EWR", "KEWR");
        m.put("FCO", "LIRF");
        m.put("MXP", "LIMC");
        m.put("IST", "LTFM");
        m.put("SAW", "LTFJ");
        m.put("DXB", "OMDB");
        m.put("DOH", "OTHH");
        m.put("MAD", "LEMD");
        m.put("BCN", "LEBL");
        m.put("BER", "EDDB");
        m.put("MUC", "EDDM");
        m.put("FRA", "EDDF");
        m.put("AMS", "EHAM");
        m.put("BRU", "EBBR");
        MAP = Collections.unmodifiableMap(m);
    }

    private AirportIataToIcao() {
    }

    public static String toIcaoOrNull(String iata) {
        if (iata == null) {
            return null;
        }
        String k = iata.trim().toUpperCase();
        return MAP.get(k);
    }
}
