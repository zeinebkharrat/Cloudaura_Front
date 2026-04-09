package org.example.backend.dto.accommodation;

import org.example.backend.model.Reservation;

/**
 * {@code localSimulationUrl} non-null → client navigates in-app; {@code reservation} may be null (unused).
 * {@code localSimulationUrl} null → create Stripe Checkout for {@code reservation} / {@code totalTnd}.
 */
public record AccommodationStripeCheckoutHandoff(String localSimulationUrl, Reservation reservation, double totalTnd) {}
