package org.example.backend.dto.car;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Simulated booking — no call to Amadeus Transfer Booking (avoids test charges / incomplete passenger payloads).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CarBookSimulationResponse {
    private boolean simulated;
    private String confirmationRef;
    private String offerId;
    private String message;
}
