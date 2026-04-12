package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.transport.TransportReservationResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.service.QrCodeService;
import org.example.backend.service.TicketPdfService;
import org.example.backend.service.TransportReservationMapper;
import org.example.backend.service.TransportTicketQrPayload;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TransportReservationRepository reservationRepo;
    private final QrCodeService qrCodeService;
    private final TicketPdfService ticketPdfService;
    private final UserIdentityResolver userIdentityResolver;

    @GetMapping("/{reservationId}/qr")
    public ResponseEntity<byte[]> getQrCode(
            @PathVariable int reservationId,
            Authentication authentication) {
        TransportReservation res = reservationRepo.findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Réservation non trouvée."));
        assertReservationOwner(res, authentication);

        String content = TransportTicketQrPayload.jsonForReservation(res);

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

        TransportReservationResponse dto = TransportReservationMapper.toResponse(res);
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

}
