package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityMediaRequest;
import org.example.backend.dto.CityMediaResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.model.CityMedia;
import org.example.backend.model.MediaType;
import org.example.backend.repository.CityMediaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class CityMediaService {

    private final CityMediaRepository cityMediaRepository;
    private final CityService cityService;
    private final ImgBbService imgBbService;

    @Transactional(readOnly = true)
    public Page<CityMediaResponse> list(Integer cityId, String q, Pageable pageable) {
        Specification<CityMedia> spec = (root, query, cb) -> {
            var predicate = cb.conjunction();

            if (cityId != null) {
                predicate = cb.and(predicate, cb.equal(root.get("city").get("cityId"), cityId));
            }

            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                var textFilter = cb.or(
                    cb.like(cb.lower(root.get("url")), like),
                    cb.like(cb.lower(root.get("city").get("name")), like)
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

        return cityMediaRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public CityMediaResponse getById(Integer id) {
        return toResponse(findMedia(id));
    }

    @Transactional
    public CityMediaResponse create(CityMediaRequest request) {
        CityMedia media = new CityMedia();
        apply(media, request);
        return toResponse(cityMediaRepository.save(media));
    }

    @Transactional
    public CityMediaResponse update(Integer id, CityMediaRequest request) {
        CityMedia media = findMedia(id);
        apply(media, request);
        return toResponse(cityMediaRepository.save(media));
    }

    @Transactional
    public CityMediaResponse upload(Integer cityId, MediaType mediaType, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier image est obligatoire");
        }

        City city = cityService.findCity(cityId);
        String url = imgBbService.uploadImage(file);

        CityMedia media = new CityMedia();
        media.setCity(city);
        media.setMediaType(mediaType);
        media.setUrl(url);

        return toResponse(cityMediaRepository.save(media));
    }

    @Transactional
    public void delete(Integer id) {
        cityMediaRepository.delete(findMedia(id));
    }

    private CityMedia findMedia(Integer id) {
        return cityMediaRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("api.error.city_media_not_found"));
    }

    private void apply(CityMedia media, CityMediaRequest request) {
        media.setCity(cityService.findCity(request.getCityId()));
        media.setUrl(request.getUrl());
        media.setMediaType(request.getMediaType());
    }

    private CityMediaResponse toResponse(CityMedia media) {
        return new CityMediaResponse(
            media.getMediaId(),
            media.getCity().getCityId(),
            media.getCity().getName(),
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
