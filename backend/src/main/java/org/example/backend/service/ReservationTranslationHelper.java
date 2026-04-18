package org.example.backend.service;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.example.backend.model.TransportReservation;
import org.springframework.stereotype.Component;

/**
 * Shared catalog keys for reservation / booking flows ({@code reservation.*}).
 */
@Component
@RequiredArgsConstructor
public class ReservationTranslationHelper {

    private final CatalogTranslationService catalog;

    public String statusLabel(Enum<?> status) {
        if (status == null) {
            return catalog.resolveForRequest("reservation.status.unknown", "—");
        }
        String low = status.name().toLowerCase(Locale.ROOT);
        return catalog.resolveForRequest("reservation.status." + low, defaultReservationStatusFr(low));
    }

    public String transportPaymentStatus(TransportReservation.PaymentStatus s) {
        if (s == null) {
            return catalog.resolveForRequest("reservation.payment.status.unknown", "—");
        }
        String low = s.name().toLowerCase(Locale.ROOT);
        return catalog.resolveForRequest("reservation.payment.status." + low, defaultPaymentStatusFr(low));
    }

    public String transportPaymentMethod(TransportReservation.PaymentMethod m) {
        if (m == null) {
            return catalog.resolveForRequest("reservation.payment.method.unknown", "—");
        }
        String low = m.name().toLowerCase(Locale.ROOT);
        return catalog.resolveForRequest("reservation.payment.method." + low, defaultPaymentMethodFr(low));
    }

    public String transportTypeLabel(String typeEnumName) {
        if (typeEnumName == null || typeEnumName.isBlank()) {
            return "";
        }
        String low = typeEnumName.trim().toLowerCase(Locale.ROOT);
        return catalog.resolveForRequest("reservation.transport_type." + low, defaultTransportTypeFr(low));
    }

    public String roomTypeLabel(String roomTypeEnumName) {
        if (roomTypeEnumName == null || roomTypeEnumName.isBlank()) {
            return "";
        }
        String low = roomTypeEnumName.trim().toLowerCase(Locale.ROOT);
        return catalog.resolveForRequest("reservation.room_type." + low, defaultRoomTypeFr(low));
    }

    public String cityName(int cityId, String dbFallback) {
        String fb = dbFallback != null ? dbFallback : "";
        return catalog.resolveForRequest("city." + cityId + ".name", fb);
    }

    public String accommodationName(int accommodationId, String dbFallback) {
        String fb = dbFallback != null ? dbFallback : "";
        return catalog.resolveForRequest("accommodation." + accommodationId + ".name", fb);
    }

    public String activityName(int activityId, String dbFallback) {
        String fb = dbFallback != null ? dbFallback : "";
        return catalog.resolveForRequest("activity." + activityId + ".name", fb);
    }

    public String activityAddress(int activityId, String dbFallback) {
        String fb = dbFallback != null ? dbFallback : "";
        return catalog.resolveForRequest("activity." + activityId + ".address", fb);
    }

    public String tr(String key, String frenchFallback) {
        return catalog.resolveForRequest(key, frenchFallback);
    }

    private static String defaultReservationStatusFr(String low) {
        return switch (low) {
            case "pending" -> "En attente";
            case "confirmed" -> "Confirmée";
            case "cancelled" -> "Annulée";
            default -> low;
        };
    }

    private static String defaultPaymentStatusFr(String low) {
        return switch (low) {
            case "pending" -> "Paiement en attente";
            case "paid" -> "Payé";
            case "refunded" -> "Remboursé";
            default -> low;
        };
    }

    private static String defaultPaymentMethodFr(String low) {
        return switch (low) {
            case "cash" -> "Espèces";
            case "konnect" -> "Konnect";
            case "stripe" -> "Carte bancaire (Stripe)";
            case "paypal" -> "PayPal";
            default -> low;
        };
    }

    private static String defaultTransportTypeFr(String low) {
        return switch (low) {
            case "bus" -> "Bus";
            case "taxi" -> "Taxi";
            case "van" -> "Louage / Van VIP";
            case "car" -> "Voiture (privée)";
            case "plane" -> "Avion";
            case "train" -> "Train";
            case "ferry" -> "Ferry";
            default -> low.toUpperCase(Locale.ROOT);
        };
    }

    private static String defaultRoomTypeFr(String low) {
        return switch (low) {
            case "single" -> "Chambre simple";
            case "double" -> "Chambre double";
            case "suite" -> "Suite";
            case "family" -> "Chambre familiale";
            case "studio" -> "Studio";
            default -> low.toUpperCase(Locale.ROOT);
        };
    }
}
