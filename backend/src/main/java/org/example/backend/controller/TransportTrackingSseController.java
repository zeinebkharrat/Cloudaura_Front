package org.example.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.transport.TrackingPositionDto;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.TransportReservation;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.service.TransportTrackingSseService;
import org.example.backend.service.TransportTrackingStageService;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/transport/tracking")
@RequiredArgsConstructor
public class TransportTrackingSseController {

    private final TransportTrackingSseService transportTrackingSseService;
    private final TransportTrackingStageService transportTrackingStageService;
    private final TransportReservationRepository reservationRepository;
    private final UserIdentityResolver userIdentityResolver;

    @GetMapping(value = "/stream/{reservationId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable int reservationId, Authentication authentication) {
        assertOwner(reservationId, authentication);
        return transportTrackingSseService.subscribe(reservationId);
    }

    @PostMapping("/{reservationId}/position")
    public void postPosition(
            @PathVariable int reservationId,
            @Valid @RequestBody TrackingPositionDto body,
            Authentication authentication) {
        assertOwner(reservationId, authentication);
        transportTrackingStageService.handlePosition(reservationId, body.getLat(), body.getLng());
    }

    private void assertOwner(int reservationId, Authentication authentication) {
        Integer uid = userIdentityResolver.resolveUserId(authentication);
        if (uid == null) {
            throw new AccessDeniedException("api.error.unauthorized");
        }
        TransportReservation res = reservationRepository
                .findByIdWithAssociations(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("reservation.error.reservation_not_found"));
        if (res.getUser() == null || !uid.equals(res.getUser().getUserId())) {
            throw new AccessDeniedException("api.error.ticket.reservation_wrong_user");
        }
    }
}
