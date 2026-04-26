package org.example.backend.service;

import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.model.TransportReservation;
import org.springframework.stereotype.Component;

/**
 * Maps {@link TransportReservation} to API DTO with null-safe handling for incomplete DB rows.
 */
@Component
public class TransportReservationMapper {

    public TransportReservationResponse toResponse(TransportReservation r) {
        if (r == null) {
            throw new ResourceNotFoundException("Réservation non trouvée.");
        }
        Transport t = r.getTransport();
        if (t == null) {
            throw new ResourceNotFoundException("Réservation incomplète : transport manquant.");
        }

        City dep = t.getDepartureCity();
        City arr = t.getArrivalCity();
        String depName = dep != null && dep.getName() != null ? dep.getName() : "";
        String arrName = arr != null && arr.getName() != null ? arr.getName() : "";

        String fn = r.getPassengerFirstName() != null ? r.getPassengerFirstName() : "";
        String ln = r.getPassengerLastName() != null ? r.getPassengerLastName() : "";

        double total = r.getTotalPrice() != null ? r.getTotalPrice() : 0.0;
        int seats = r.getNumberOfSeats() != null ? r.getNumberOfSeats() : 0;

        String status = r.getStatus() != null ? r.getStatus().name() : "UNKNOWN";
        String payStatus = r.getPaymentStatus() != null ? r.getPaymentStatus().name() : "UNKNOWN";
        String payMethod = r.getPaymentMethod() != null ? r.getPaymentMethod().name() : "CASH";

        Integer tid = t.getTransportId();

        String qrToken = null;
        if (r.getStatus() == TransportReservation.ReservationStatus.CONFIRMED) {
            qrToken = TransportTicketQrPayload.jsonForReservation(r);
        }

        return TransportReservationResponse.builder()
                .transportReservationId(r.getTransportReservationId() != null ? r.getTransportReservationId() : 0)
                .transportId(tid)
                .reservationRef(r.getReservationRef() != null ? r.getReservationRef() : "")
                .status(status)
                .paymentStatus(payStatus)
                .paymentMethod(payMethod)
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
                .transportType(t.getType() != null ? t.getType().name() : "")
                .createdAt(r.getCreatedAt())
                .qrCodeToken(qrToken)
                .build();
    }
}
