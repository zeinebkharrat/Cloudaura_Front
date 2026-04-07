package org.example.backend.dto.transport;

import org.example.backend.model.TransportReservation;

/**
 * Result of preparing a transport Stripe checkout: either a local simulation URL, or a pending
 * reservation and total (TND) for {@link org.example.backend.service.PaymentService#createTransportCheckoutSession}.
 */
public record TransportStripeCheckoutHandoff(String localSimulationUrl, TransportReservation reservation, double totalTnd) {}
