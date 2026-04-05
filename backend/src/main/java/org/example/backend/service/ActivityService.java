package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityRequest;
import org.example.backend.dto.ActivityResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.Activity;
import org.example.backend.model.ReservationStatus;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityReviewRepository;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private static final List<ReservationStatus> CAPACITY_STATUSES = List.of(
        ReservationStatus.PENDING,
        ReservationStatus.CONFIRMED
    );

    private final ActivityRepository activityRepository;
    private final ActivityMediaRepository activityMediaRepository;
    private final ActivityReservationRepository activityReservationRepository;
    private final ActivityReviewRepository activityReviewRepository;
    private final CityService cityService;

    public Page<ActivityResponse> list(String q, Pageable pageable) {
        return list(q, null, null, null, null, 1, pageable);
    }

    public Page<ActivityResponse> list(
        String q,
        Integer cityId,
        Double minPrice,
        Double maxPrice,
        LocalDate availableDate,
        Integer participants,
        Pageable pageable
    ) {
        Specification<Activity> spec = (root, query, cb) -> {
            var predicate = cb.conjunction();

            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                predicate = cb.and(predicate, cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("type")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("address"), "")), like),
                    cb.like(cb.lower(root.get("city").get("name")), like)
                ));
            }

            if (cityId != null) {
                predicate = cb.and(predicate, cb.equal(root.get("city").get("cityId"), cityId));
            }

            if (minPrice != null) {
                predicate = cb.and(predicate, cb.greaterThanOrEqualTo(root.get("price"), minPrice));
            }

            if (maxPrice != null) {
                predicate = cb.and(predicate, cb.lessThanOrEqualTo(root.get("price"), maxPrice));
            }

            return predicate;
        };

        if (availableDate == null) {
            return activityRepository.findAll(spec, pageable).map(this::toResponse);
        }

        int normalizedParticipants = participants == null || participants < 1 ? 1 : participants;
        List<ActivityResponse> filtered = activityRepository.findAll(spec, pageable.getSort())
            .stream()
            .filter((activity) -> isAvailableOnDate(activity, availableDate, normalizedParticipants))
            .map(this::toResponse)
            .toList();

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<ActivityResponse> content = start >= filtered.size() ? List.of() : filtered.subList(start, end);
        return new PageImpl<>(content, pageable, filtered.size());
    }

    public ActivityResponse getById(Integer id) {
        return toResponse(findActivity(id));
    }

    @Transactional
    public ActivityResponse create(ActivityRequest request) {
        Activity activity = new Activity();
        apply(activity, request);
        return toResponse(activityRepository.save(activity));
    }

    @Transactional
    public ActivityResponse update(Integer id, ActivityRequest request) {
        Activity activity = findActivity(id);
        apply(activity, request);
        return toResponse(activityRepository.save(activity));
    }

    @Transactional
    public void delete(Integer id) {
        Activity activity = findActivity(id);
        activityReservationRepository.deleteByActivityActivityId(activity.getActivityId());
        activityReviewRepository.deleteByActivityActivityId(activity.getActivityId());
        activityMediaRepository.deleteByActivityActivityId(activity.getActivityId());
        activityRepository.delete(activity);
    }

    public Activity findActivity(Integer id) {
        return activityRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Activité introuvable: " + id));
    }

    private void apply(Activity activity, ActivityRequest request) {
        activity.setCity(cityService.findCity(request.getCityId()));
        activity.setName(request.getName());
        activity.setType(request.getType());
        activity.setPrice(request.getPrice());
        activity.setDescription(request.getDescription());
        activity.setAddress(request.getAddress());
        activity.setLatitude(request.getLatitude());
        activity.setLongitude(request.getLongitude());

        Integer maxParticipants = request.getMaxParticipantsPerDay();
        if (maxParticipants != null && maxParticipants < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nombre maximal de participants doit être >= 1");
        }

        if (maxParticipants == null) {
            activity.setMaxParticipantsPerDay(null);
            activity.setMaxParticipantsStartDate(LocalDate.now());
            return;
        }

        activity.setMaxParticipantsPerDay(maxParticipants);
        activity.setMaxParticipantsStartDate(
            request.getMaxParticipantsStartDate() != null ? request.getMaxParticipantsStartDate() : LocalDate.now()
        );
    }

    private ActivityResponse toResponse(Activity activity) {
        String imageUrl = activityMediaRepository.findByActivityActivityIdOrderByMediaIdDesc(activity.getActivityId())
            .stream()
            .findFirst()
            .map(ActivityMedia::getUrl)
            .orElse(null);

        return new ActivityResponse(
            activity.getActivityId(),
            activity.getCity().getCityId(),
            activity.getCity().getName(),
            activity.getName(),
            activity.getType(),
            activity.getPrice(),
            activity.getDescription(),
            activity.getAddress(),
            activity.getLatitude(),
            activity.getLongitude(),
            imageUrl,
            activity.getMaxParticipantsPerDay(),
            activity.getMaxParticipantsStartDate()
        );
    }

    private boolean isAvailableOnDate(Activity activity, LocalDate date, int participants) {
        if (date.isBefore(LocalDate.now())) {
            return false;
        }

        if (!isQuotaEnabledOnDate(activity, date)) {
            return true;
        }

        Integer maxParticipants = activity.getMaxParticipantsPerDay();
        if (maxParticipants == null) {
            return true;
        }

        int reserved = reservedPeople(activity.getActivityId(), date);
        int remaining = Math.max(maxParticipants - reserved, 0);
        return remaining >= participants;
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

    private int reservedPeople(Integer activityId, LocalDate date) {
        Date dayStart = toUtcStartOfDay(date);
        Date dayEnd = toUtcStartOfDay(date.plusDays(1));
        Integer total = activityReservationRepository.sumPeopleForActivityAndDate(
            activityId,
            dayStart,
            dayEnd,
            CAPACITY_STATUSES
        );
        return total != null ? total : 0;
    }

    private Date toUtcStartOfDay(LocalDate date) {
        return Date.from(date.atStartOfDay().toInstant(ZoneOffset.UTC));
    }
}
