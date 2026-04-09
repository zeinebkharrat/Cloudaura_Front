package org.example.backend.dto.transport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Response for POST /api/transport/payments/checkout-session (always {@code url} only). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportPaymentStartDto {
    /**
     * Absolute Stripe Checkout URL (https://…) when Stripe secret key is configured,
     * or in-app path starting with {@code /transport/payment/return?...} for local simulation.
     */
    private String url;
}
