package org.example.backend.dto.car;

import lombok.Data;

@Data
public class CarBookSimulationRequest {
    /** Amadeus transfer offer id from search. */
    private String offerId;
}
