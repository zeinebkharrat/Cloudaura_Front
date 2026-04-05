package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.service.QrCodeService;
import org.example.backend.service.TicketPdfService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TransportReservationRepository reservationRepo;
    private final QrCodeService qrCodeService;
    private final TicketPdfService ticketPdfService;
    private final UserIdentityResolver userIdentityResolver;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @GetMapping("/{reservationId}/qr")
    public ResponseEntity<byte[]> getQrCode(
            @PathVariable int reservationId,
            Authentication authentication) {
        TransportReservation res = reservationRepo.findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        assertReservationOwner(res, authentication);

        String content = String.format(
                "{\"ref\":\"%s\",\"passenger\":\"%s %s\",\"route\":\"%s → %s\",\"date\":\"%s\"}",
                res.getReservationRef(),
                res.getPassengerFirstName(), res.getPassengerLastName(),
                res.getTransport().getDepartureCity().getName(),
                res.getTransport().getArrivalCity().getName(),
                res.getTravelDate() != null ? res.getTravelDate().format(FMT) : "N/A"
        );

        byte[] png = qrCodeService.generateQrPng(content, 300);

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CACHE_CONTROL, "max-age=86400")
                .body(png);
    }

    @GetMapping("/{reservationId}/pdf")
    public ResponseEntity<byte[]> getPdfTicket(
            @PathVariable int reservationId,
            Authentication authentication) {
        TransportReservation res = reservationRepo.findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        assertReservationOwner(res, authentication);

        TransportReservationResponse dto = mapToResponse(res);
        byte[] pdf = ticketPdfService.generateTicketPdf(dto);

        String filename = "billet-" + res.getReservationRef() + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(pdf);
    }

    private void assertReservationOwner(TransportReservation res, Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("Authentication required");
        }
        if (res.getUser() == null || !uid.equals(res.getUser().getUserId())) {
            throw new AccessDeniedException("Not your reservation");
        }
    }

    private TransportReservationResponse mapToResponse(TransportReservation r) {
        return TransportReservationResponse.builder()
                .transportReservationId(r.getTransportReservationId())
                .transportId(r.getTransport().getTransportId())
                .reservationRef(r.getReservationRef())
                .status(r.getStatus().name())
                .paymentStatus(r.getPaymentStatus().name())
                .paymentMethod(r.getPaymentMethod().name())
                .totalPrice(r.getTotalPrice())
                .numberOfSeats(r.getNumberOfSeats())
                .passengerFullName(r.getPassengerFirstName() + " " + r.getPassengerLastName())
                .travelDate(r.getTravelDate())
                .departureCityName(r.getTransport().getDepartureCity().getName())
                .arrivalCityName(r.getTransport().getArrivalCity().getName())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
