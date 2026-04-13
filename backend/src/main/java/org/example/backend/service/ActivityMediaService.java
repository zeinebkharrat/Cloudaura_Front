package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityMediaRequest;
import org.example.backend.dto.ActivityMediaResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.Activity;
import org.example.backend.model.ActivityMedia;
import org.example.backend.model.MediaType;
import org.example.backend.repository.ActivityMediaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ActivityMediaService {

    private final ActivityMediaRepository activityMediaRepository;
    private final ActivityService activityService;
    private final ImgBbService imgBbService;

    public Page<ActivityMediaResponse> list(Integer activityId, String q, Pageable pageable) {
        Specification<ActivityMedia> spec = (root, query, cb) -> {
            var predicate = cb.conjunction();

            if (activityId != null) {
                predicate = cb.and(predicate, cb.equal(root.get("activity").get("activityId"), activityId));
            }

            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                var textFilter = cb.or(
                    cb.like(cb.lower(root.get("url")), like),
                    cb.like(cb.lower(root.get("activity").get("name")), like)
                );

                MediaType parsedType = parseMediaType(q);
                if (parsedType != null) {
                    predicate = cb.and(predicate, cb.or(textFilter, cb.equal(root.get("mediaType"), parsedType)));
                } else {
                    predicate = cb.and(predicate, textFilter);
                }
            }

            return predicate;
        };

        return activityMediaRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public ActivityMediaResponse getById(Integer id) {
        return toResponse(findMedia(id));
    }

    @Transactional
    public ActivityMediaResponse create(ActivityMediaRequest request) {
        ActivityMedia media = new ActivityMedia();
        apply(media, request);
        return toResponse(activityMediaRepository.save(media));
    }

    @Transactional
    public ActivityMediaResponse update(Integer id, ActivityMediaRequest request) {
        ActivityMedia media = findMedia(id);
        apply(media, request);
        return toResponse(activityMediaRepository.save(media));
    }

    @Transactional
    public ActivityMediaResponse upload(Integer activityId, MediaType mediaType, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier image est obligatoire");
        }

        Activity activity = activityService.findActivity(activityId);
        String url = imgBbService.uploadImage(file);

        ActivityMedia media = new ActivityMedia();
        media.setActivity(activity);
        media.setMediaType(mediaType);
        media.setUrl(url);

        return toResponse(activityMediaRepository.save(media));
    }

    @Transactional
    public void delete(Integer id) {
        activityMediaRepository.delete(findMedia(id));
    }

    private ActivityMedia findMedia(Integer id) {
        return activityMediaRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("api.error.activity_media_not_found"));
    }

    private void apply(ActivityMedia media, ActivityMediaRequest request) {
        media.setActivity(activityService.findActivity(request.getActivityId()));
        media.setUrl(request.getUrl());
        media.setMediaType(request.getMediaType());
    }

    private ActivityMediaResponse toResponse(ActivityMedia media) {
        return new ActivityMediaResponse(
            media.getMediaId(),
            media.getActivity().getActivityId(),
            media.getActivity().getName(),
            media.getUrl(),
            media.getMediaType()
        );
    }

    private MediaType parseMediaType(String raw) {
        try {
            return MediaType.valueOf(raw.trim().toUpperCase());
        } catch (Exception ex) {
            return null;
        }
    }
}
