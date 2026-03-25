package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityRequest;
import org.example.backend.dto.ActivityResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Activity;
import org.example.backend.repository.ActivityRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityRepository activityRepository;
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
        activityRepository.delete(findActivity(id));
    }

    private Activity findActivity(Integer id) {
        return activityRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Activité introuvable: " + id));
    }

    private void apply(Activity activity, ActivityRequest request) {
        activity.setCity(cityService.findCity(request.getCityId()));
        activity.setName(request.getName());
        activity.setType(request.getType());
        activity.setPrice(request.getPrice());
    }

    private ActivityResponse toResponse(Activity activity) {
        return new ActivityResponse(
            activity.getActivityId(),
            activity.getCity().getCityId(),
            activity.getCity().getName(),
            activity.getName(),
            activity.getType(),
            activity.getPrice()
        );
    }
}