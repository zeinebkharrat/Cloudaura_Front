package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityReservationListItemResponse;
import org.example.backend.dto.publicapi.ActivityAvailabilityDayResponse;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ActivityReservationService {

    private static final List<ReservationStatus> CAPACITY_STATUSES = List.of(
        ReservationStatus.PENDING,
        ReservationStatus.CONFIRMED
    );

    private final ActivityRepository activityRepository;
    private final ActivityReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final ReservationTranslationHelper reservationLabels;

    @Transactional
    public ActivityReservationResponse create(Integer activityId, CreateActivityReservationRequest request) {
        ActivityReservation saved = createPendingReservation(activityId, request);
        return toResponse(saved);
    }

    @Transactional
    public ActivityReservation createPendingReservation(Integer activityId, CreateActivityReservationRequest request) {
        Activity activity = activityRepository
            .findById(activityId)
            .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_not_found"));

        User user = currentAuthenticatedUser();

        LocalDate date;
        try {
            date = LocalDate.parse(request.getReservationDate());
        } catch (DateTimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.reservation_date_iso");
        }

        if (date.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.reservation_date_future");
        }

        Integer numberOfPeople = request.getNumberOfPeople();
        if (numberOfPeople == null || numberOfPeople < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.number_of_people");
        }

        if (isQuotaEnabledOnDate(activity, date)) {
            int remainingPlaces = remainingPlaces(activity, date);
            if (numberOfPeople > remainingPlaces) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "reservation.error.quota_exceeded");
            }
        }

        ActivityReservation reservation = new ActivityReservation();
        reservation.setUser(user);
        reservation.setActivity(activity);
        reservation.setReservationDate(toUtcStartOfDay(date));
        reservation.setNumberOfPeople(numberOfPeople);

        double unitPrice = activity.getPrice() == null ? 0.0 : activity.getPrice();
        reservation.setTotalPrice(unitPrice * numberOfPeople);
        reservation.setStatus(ReservationStatus.PENDING);

        return reservationRepository.save(reservation);
    }

    public ActivityReservationResponse toResponse(ActivityReservation reservation) {
        LocalDate date = reservation.getReservationDate()
            .toInstant()
            .atOffset(ZoneOffset.UTC)
            .toLocalDate();

        var act = reservation.getActivity();
        int aid = act.getActivityId();
        String actName = reservationLabels.activityName(aid, act.getName() != null ? act.getName() : "");
        var city = act.getCity();
        Integer cid = city != null ? city.getCityId() : null;
        String cityRaw = city != null && city.getName() != null ? city.getName() : "";
        String cityDisp = cid != null ? reservationLabels.cityName(cid, cityRaw) : cityRaw;

        return new ActivityReservationResponse(
            reservation.getActivityReservationId(),
            aid,
            actName,
            date.toString(),
            reservation.getNumberOfPeople(),
            reservation.getTotalPrice(),
            reservation.getStatus(),
            reservationLabels.statusLabel(reservation.getStatus()),
            cid,
            cityDisp,
            actName
        );
    }

    @Transactional(readOnly = true)
    public List<ActivityAvailabilityDayResponse> availability(Integer activityId, LocalDate from, int days, int participants) {
        Activity activity = activityRepository
            .findById(activityId)
            .orElseThrow(() -> new ResourceNotFoundException("reservation.error.activity_not_found"));

        if (days < 1 || days > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.days_range");
        }
        if (participants < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reservation.error.participants_min");
        }

        LocalDate start = from != null ? from : LocalDate.now();
        List<ActivityAvailabilityDayResponse> rows = new ArrayList<>();

        for (int index = 0; index < days; index++) {
            LocalDate date = start.plusDays(index);
            if (!isQuotaEnabledOnDate(activity, date)) {
                rows.add(new ActivityAvailabilityDayResponse(
                    date.toString(),
                    null,
                    0,
                    null,
                    !date.isBefore(LocalDate.now())
                ));
                continue;
            }

            int reserved = reservedPeople(activity.getActivityId(), date);
            int remaining = Math.max(activity.getMaxParticipantsPerDay() - reserved, 0);

            rows.add(new ActivityAvailabilityDayResponse(
                date.toString(),
                activity.getMaxParticipantsPerDay(),
                reserved,
                remaining,
                !date.isBefore(LocalDate.now()) && remaining >= participants
            ));
        }

        return rows;
    }

    @Transactional(readOnly = true)
    public Page<ActivityReservationListItemResponse> listCurrentUserReservations(Pageable pageable) {
        User user = currentAuthenticatedUser();
        return reservationRepository.findByUserUserIdOrderByReservationDateDesc(user.getUserId(), pageable)
            .map(this::toListItem);
    }

    @Transactional(readOnly = true)
    public Page<ActivityReservationListItemResponse> listAdmin(
        String q,
        Integer activityId,
        Integer userId,
        ReservationStatus status,
        LocalDate reservationDate,
        Pageable pageable
    ) {
        Specification<ActivityReservation> spec = (root, query, cb) -> cb.conjunction();

        if (q != null && !q.isBlank()) {
            String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("activity").get("name")), like),
                cb.like(cb.lower(cb.coalesce(root.get("user").get("username"), "")), like),
                cb.like(cb.lower(cb.coalesce(root.get("user").get("email"), "")), like)
            ));
        }

        if (activityId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("activity").get("activityId"), activityId));
        }

        if (userId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("user").get("userId"), userId));
        }

        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        if (reservationDate != null) {
            Date dayStart = toUtcStartOfDay(reservationDate);
            Date dayEnd = toUtcStartOfDay(reservationDate.plusDays(1));
            spec = spec.and((root, query, cb) -> cb.and(
                cb.greaterThanOrEqualTo(root.get("reservationDate"), dayStart),
                cb.lessThan(root.get("reservationDate"), dayEnd)
            ));
        }

        return reservationRepository.findAll(spec, pageable).map(this::toListItem);
    }

    private ActivityReservationListItemResponse toListItem(ActivityReservation reservation) {
        LocalDate date = reservation.getReservationDate()
            .toInstant()
            .atOffset(ZoneOffset.UTC)
            .toLocalDate();

        User user = reservation.getUser();
        var act = reservation.getActivity();
        int aid = act.getActivityId();
        String actName = reservationLabels.activityName(aid, act.getName() != null ? act.getName() : "");
        var city = act.getCity();
        Integer cityId = city != null ? city.getCityId() : null;
        String cityRaw = city != null && city.getName() != null ? city.getName() : "";
        String cityName =
                cityId != null ? reservationLabels.cityName(cityId, cityRaw) : cityRaw;

        return new ActivityReservationListItemResponse(
            reservation.getActivityReservationId(),
            aid,
            actName,
            cityId,
            cityName,
            date.toString(),
            reservation.getNumberOfPeople(),
            reservation.getTotalPrice(),
            reservation.getStatus(),
            reservationLabels.statusLabel(reservation.getStatus()),
            user != null ? user.getUserId() : null,
            user != null ? user.getUsername() : null,
            user != null ? user.getEmail() : null,
            actName,
            cityName
        );
    }

    private boolean isQuotaEnabledOnDate(Activity activity, LocalDate date) {
        Integer maxParticipants = activity.getMaxParticipantsPerDay();
        if (maxParticipants == null) {
            return false;
        }

        LocalDate startDate = activity.getMaxParticipantsStartDate() != null
            ? activity.getMaxParticipantsStartDate()
            : LocalDate.now();
        return !date.isBefore(startDate);
    }

    private int remainingPlaces(Activity activity, LocalDate date) {
        if (!isQuotaEnabledOnDate(activity, date)) {
            return Integer.MAX_VALUE;
        }
        Integer maxParticipants = activity.getMaxParticipantsPerDay();
        if (maxParticipants == null) {
            return Integer.MAX_VALUE;
        }
        return Math.max(maxParticipants - reservedPeople(activity.getActivityId(), date), 0);
    }

    private int reservedPeople(Integer activityId, LocalDate date) {
        Date dayStart = toUtcStartOfDay(date);
        Date dayEnd = toUtcStartOfDay(date.plusDays(1));
        Integer total = reservationRepository.sumPeopleForActivityAndDate(activityId, dayStart, dayEnd, CAPACITY_STATUSES);
        return total != null ? total : 0;
    }

    private Date toUtcStartOfDay(LocalDate date) {
        return Date.from(date.atStartOfDay().toInstant(ZoneOffset.UTC));
    }

    private User currentAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "reservation.error.auth_required");
        }

        String username = authentication.getName();
        return userRepository.findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(username, username)
            .orElseThrow(
                    () ->
                            new ResponseStatusException(
                                    HttpStatus.UNAUTHORIZED, "reservation.error.user_auth_missing"));
    }
}
