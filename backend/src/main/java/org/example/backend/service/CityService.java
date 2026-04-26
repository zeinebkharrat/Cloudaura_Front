package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityRequest;
import org.example.backend.dto.CityResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.CityMediaRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.RestaurantRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Expression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CityService {

    private final CityRepository cityRepository;
    private final CityMediaRepository cityMediaRepository;
    private final ActivityMediaRepository activityMediaRepository;
    private final RestaurantRepository restaurantRepository;
    private final ActivityRepository activityRepository;

    public Page<CityResponse> list(String q, Pageable pageable) {
        Specification<City> spec = (root, query, cb) -> {
            Expression<String> safeDesc = cb.lower(cb.coalesce(root.get("description").as(String.class), ""));
            var notAirportRegion = cb.or(
                cb.isNull(root.get("region")),
                cb.notEqual(cb.lower(cb.coalesce(root.get("region"), "")), "airport")
            );
            var notIntlFlightAnchor = cb.not(
                cb.like(safeDesc, "%auto-created airport anchor for flight checkout%"));
            var predicate = cb.and(notAirportRegion, notIntlFlightAnchor);

            if (q == null || q.isBlank()) {
                return predicate;
            }
            String like = "%" + q.trim().toLowerCase() + "%";

            Expression<String> safeName = cb.lower(cb.coalesce(root.get("name"), ""));
            Expression<String> safeRegion = cb.lower(cb.coalesce(root.get("region"), ""));
            Expression<String> safeDescription = cb.lower(cb.coalesce(root.get("description").as(String.class), ""));

            return cb.and(
                predicate,
                cb.or(
                    cb.like(safeName, like),
                    cb.like(safeRegion, like),
                    cb.like(safeDescription, like)
                )
            );
        };

        return cityRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public CityResponse getById(Integer id) {
        return toResponse(findCity(id));
    }

    @Transactional
    public CityResponse create(CityRequest request) {
        City city = new City();
        apply(city, request);
        return toResponse(cityRepository.save(city));
    }

    @Transactional
    public CityResponse update(Integer id, CityRequest request) {
        City city = findCity(id);
        apply(city, request);
        return toResponse(cityRepository.save(city));
    }

    @Transactional
    public void delete(Integer id) {
        City city = findCity(id);
        cityMediaRepository.deleteByCityCityId(city.getCityId());
        activityMediaRepository.deleteByActivityCityCityId(city.getCityId());
        restaurantRepository.deleteByCityCityId(city.getCityId());
        activityRepository.deleteByCityCityId(city.getCityId());
        cityRepository.delete(city);
    }

    public City findCity(Integer id) {
        return cityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ville introuvable: " + id));
    }

    private void apply(City city, CityRequest request) {
        city.setName(request.getName());
        city.setRegion(request.getRegion());
        city.setDescription(request.getDescription());
        city.setLatitude(request.getLatitude());
        city.setLongitude(request.getLongitude());
    }

    private CityResponse toResponse(City city) {
        return new CityResponse(
            city.getCityId(),
            city.getName(),
            city.getRegion(),
            city.getDescription(),
            city.getLatitude(),
            city.getLongitude()
        );
    }
}
