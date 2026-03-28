package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityRequest;
import org.example.backend.dto.ActivityResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.Activity;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.ActivityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityRepository activityRepository;
    private final ActivityMediaRepository activityMediaRepository;
    private final CityService cityService;

    public Page<ActivityResponse> list(String q, Pageable pageable) {
        Specification<Activity> spec = (root, query, cb) -> {
            if (q == null || q.isBlank()) {
                return cb.conjunction();
            }
            String like = "%" + q.trim().toLowerCase() + "%";
            return cb.or(
                cb.like(cb.lower(root.get("name")), like),
                cb.like(cb.lower(root.get("type")), like),
                cb.like(cb.lower(cb.coalesce(root.get("address"), "")), like),
                cb.like(cb.lower(root.get("city").get("name")), like)
            );
        };

        return activityRepository.findAll(spec, pageable).map(this::toResponse);
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
}