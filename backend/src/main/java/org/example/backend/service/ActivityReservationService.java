package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.publicapi.ActivityReservationResponse;
import org.example.backend.dto.publicapi.CreateActivityReservationRequest;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityReservation;
import org.example.backend.model.ReservationStatus;
import org.example.backend.model.User;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Date;

@Service
@RequiredArgsConstructor
public class ActivityReservationService {

    private final ActivityRepository activityRepository;
    private final ActivityReservationRepository reservationRepository;
    private final UserRepository userRepository;

    @Transactional
    public ActivityReservationResponse create(Integer activityId, CreateActivityReservationRequest request) {
        Activity activity = activityRepository.findById(activityId)
            .orElseThrow(() -> new ResourceNotFoundException("Activité introuvable: " + activityId));

        User user = null;
        if (request.getUserId() != null) {
            user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable: " + request.getUserId()));
        }

        LocalDate date = LocalDate.parse(request.getReservationDate());
        if (date.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("La date de réservation doit être aujourd'hui ou plus tard");
        }

        ActivityReservation reservation = new ActivityReservation();
        reservation.setUser(user);
        reservation.setActivity(activity);
        reservation.setReservationDate(Date.from(date.atStartOfDay().toInstant(ZoneOffset.UTC)));
        reservation.setNumberOfPeople(request.getNumberOfPeople());

        double unitPrice = activity.getPrice() == null ? 0.0 : activity.getPrice();
        reservation.setTotalPrice(unitPrice * request.getNumberOfPeople());
        reservation.setStatus(ReservationStatus.PENDING);

        ActivityReservation saved = reservationRepository.save(reservation);
        return new ActivityReservationResponse(
            saved.getActivityReservationId(),
            activity.getActivityId(),
            activity.getName(),
            date.toString(),
            saved.getNumberOfPeople(),
            saved.getTotalPrice(),
            saved.getStatus()
        );
    }
}