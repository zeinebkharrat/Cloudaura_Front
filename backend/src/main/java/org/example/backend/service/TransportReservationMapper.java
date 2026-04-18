package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Maps {@link TransportReservation} to API DTO with null-safe handling for incomplete DB rows.
 * User-facing labels use {@link CatalogTranslationService} (request language + French fallback).
 */
@Component
@RequiredArgsConstructor
public class TransportReservationMapper {

    private final ReservationTranslationHelper labels;

    public TransportReservationResponse toResponse(TransportReservation r) {
        if (r == null) {
            throw new ResourceNotFoundException("reservation.error.reservation_not_found");
        }
        Transport t = r.getTransport();

        City dep = t != null ? t.getDepartureCity() : null;
        City arr = t != null ? t.getArrivalCity() : null;
        String depName = resolveCityName(dep);
        String arrName = resolveCityName(arr);
        if (depName.isBlank()) {
            depName = "Unknown departure";
        }
        if (arrName.isBlank()) {
            arrName = "Unknown arrival";
        }

        String fn = r.getPassengerFirstName() != null ? r.getPassengerFirstName() : "";
        String ln = r.getPassengerLastName() != null ? r.getPassengerLastName() : "";

        double total = r.getTotalPrice() != null ? r.getTotalPrice() : 0.0;
        int seats = r.getNumberOfSeats() != null ? r.getNumberOfSeats() : 0;

        String statusCode = r.getStatus() != null ? r.getStatus().name() : "UNKNOWN";
        String payStatusCode = r.getPaymentStatus() != null ? r.getPaymentStatus().name() : "UNKNOWN";
        String payMethodCode = r.getPaymentMethod() != null ? r.getPaymentMethod().name() : "CASH";

        Integer tid = t != null ? t.getTransportId() : null;

        String qrToken = null;
        if (r.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
            qrToken = TransportTicketQrPayload.jsonForReservation(r);
        }

        String typeCode = (t != null && t.getType() != null) ? t.getType().name() : "UNKNOWN";
        String typeLocalized = labels.transportTypeLabel(typeCode);
        if (typeLocalized == null || typeLocalized.isBlank()) {
            typeLocalized = "Unknown transport";
        }

        LocalDateTime departureTime = t != null ? t.getDepartureTime() : null;
        LocalDateTime arrivalTime = t != null ? t.getArrivalTime() : null;

        return TransportReservationResponse.builder()
                .transportReservationId(r.getTransportReservationId() != null ? r.getTransportReservationId() : 0)
                .transportId(tid)
                .reservationRef(r.getReservationRef() != null ? r.getReservationRef() : "")
                .status(statusCode)
                .statusLabel(labels.statusLabel(r.getStatus()))
                .paymentStatus(payStatusCode)
                .paymentStatusLabel(labels.transportPaymentStatus(r.getPaymentStatus()))
                .paymentMethod(payMethodCode)
                .paymentMethodLabel(labels.transportPaymentMethod(r.getPaymentMethod()))
                .totalPrice(total)
                .numberOfSeats(seats)
                .passengerFullName((fn + " " + ln).trim())
                .passengerFirstName(fn)
                .passengerLastName(ln)
                .passengerEmail(r.getPassengerEmail() != null ? r.getPassengerEmail() : "")
                .passengerPhone(r.getPassengerPhone() != null ? r.getPassengerPhone() : "")
                .travelDate(r.getTravelDate())
                .departureCityName(depName)
                .arrivalCityName(arrName)
                .departureCityLabel(depName)
                .arrivalCityLabel(arrName)
                .transportType(typeCode)
                .type(typeCode)
                .transportTypeLabel(typeLocalized)
                .typeLabel(typeLocalized)
                .departureTime(departureTime)
                .arrivalTime(arrivalTime)
                .createdAt(r.getCreatedAt())
                .qrCodeToken(qrToken)
                .build();
    }

    private String resolveCityName(City c) {
        if (c == null) {
            return "";
        }
        String raw = c.getName() != null ? c.getName() : "";
        Integer id = c.getCityId();
        if (id == null) {
            return raw;
        }
        return labels.cityName(id, raw);
    }
}
