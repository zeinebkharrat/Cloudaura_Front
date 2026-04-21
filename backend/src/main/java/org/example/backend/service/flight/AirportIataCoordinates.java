package org.example.backend.service.flight;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Static IATA → WGS84 for map polylines (demo / PFE). Extend or replace with a DB later.
 */
public final class AirportIataCoordinates {

    private static final Map<String, double[]> COORDS;

    static {
        Map<String, double[]> m = new HashMap<>();
        m.put("TUN", new double[] {36.8510, 10.2272});
        m.put("NBE", new double[] {36.0758, 10.4386});
        m.put("SFA", new double[] {34.7179, 10.6910});
        m.put("DJE", new double[] {33.8750, 10.7755});
        m.put("MIR", new double[] {35.7581, 10.7547});
        m.put("CDG", new double[] {49.0097, 2.5479});
        m.put("ORY", new double[] {48.7233, 2.3794});
        m.put("LHR", new double[] {51.4700, -0.4543});
        m.put("STN", new double[] {51.8860, 0.2389});
        m.put("JFK", new double[] {40.6413, -73.7781});
        m.put("EWR", new double[] {40.6895, -74.1745});
        m.put("FCO", new double[] {41.8003, 12.2389});
        m.put("MXP", new double[] {45.6306, 8.7281});
        m.put("IST", new double[] {41.2753, 28.7519});
        m.put("SAW", new double[] {40.8986, 29.3092});
        m.put("DXB", new double[] {25.2532, 55.3657});
        m.put("DOH", new double[] {25.2731, 51.6081});
        m.put("MAD", new double[] {40.4983, -3.5676});
        m.put("BCN", new double[] {41.2974, 2.0833});
        m.put("BER", new double[] {52.3667, 13.5033});
        m.put("MUC", new double[] {48.3538, 11.7861});
        m.put("FRA", new double[] {50.0379, 8.5622});
        m.put("AMS", new double[] {52.3105, 4.7683});
        m.put("BRU", new double[] {50.9014, 4.4844});
        COORDS = Collections.unmodifiableMap(m);
    }

    private AirportIataCoordinates() {
    }

    public static double[] getOrNull(String iata) {
        if (iata == null) {
            return null;
        }
        return COORDS.get(iata.trim().toUpperCase());
    }
}
