package org.example.backend.dto.flight;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Normalized ADS-B state for live map (OpenSky {@code /states/all}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AircraftTrackResponse {

    private boolean available;
    /** When {@code available} is false: e.g. NO_ICAO24, NO_STATE, ON_GROUND, UPSTREAM_ERROR. */
    private String unavailableReason;

    private String icao24;
    private String callsign;
    private Double latitude;
    private Double longitude;
    private Double baroAltitudeMeters;
    private Double geoAltitudeMeters;
    private Double headingTrueDeg;
    private Double groundSpeedMps;
    private Boolean onGround;
    private Double verticalRateMps;

    /** ISO-8601 instant from OpenSky {@code time_position} or server clock when missing. */
    private String updatedAt;

    /** Copy of schedule status when track was bootstrapped from Aviationstack (optional). */
    private String flightStatus;
}
