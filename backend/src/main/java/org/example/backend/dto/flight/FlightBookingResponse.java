package org.example.backend.dto.flight;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlightBookingResponse {

    private String orderId;
    private String bookingReference;
    private String owner;
    private String totalAmount;
    private String totalCurrency;
    private String status;
}
