package org.example.backend.service;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityRequest;
import org.example.backend.dto.CityResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.model.City;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.AccommodationReviewRepository;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.ActivityMediaRepository;
import org.example.backend.repository.ActivityReviewRepository;
import org.example.backend.repository.CityMediaRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.DistanceRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.RestaurantRepository;
import org.example.backend.repository.RestaurantMenuImageRepository;
import org.example.backend.repository.RestaurantReviewRepository;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.RoomRepository;
import org.example.backend.repository.SpecialOfferRepository;
import org.example.backend.repository.TicketTypeRepository;
import org.example.backend.repository.TransportRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.example.backend.repository.UserRepository;
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
    private final UserRepository userRepository;
    private final DistanceRepository distanceRepository;
    private final SpecialOfferRepository specialOfferRepository;
    private final TransportReservationRepository transportReservationRepository;
    private final ReservationRepository reservationRepository;
    private final TransportRepository transportRepository;
    private final EventReservationRepository eventReservationRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final EventRepository eventRepository;
    private final AccommodationReviewRepository accommodationReviewRepository;
    private final RoomRepository roomRepository;
    private final AccommodationRepository accommodationRepository;
    private final RestaurantMenuImageRepository restaurantMenuImageRepository;
    private final RestaurantReviewRepository restaurantReviewRepository;
    private final ActivityReservationRepository activityReservationRepository;
    private final ActivityReviewRepository activityReviewRepository;
    private final ActivityMediaRepository activityMediaRepository;
    private final RestaurantRepository restaurantRepository;
    private final ActivityRepository activityRepository;

    public Page<CityResponse> list(String q, Pageable pageable) {
        Specification<City> spec = (root, query, cb) -> {
            var predicate = cb.or(
                cb.isNull(root.get("region")),
                cb.notEqual(cb.lower(cb.coalesce(root.get("region"), "")), "airport")
            );

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
        Integer cityId = city.getCityId();

        // Preserve users while removing city links.
        userRepository.clearCityByCityId(cityId);

        // Delete transport-related reservations before deleting transports.
        transportReservationRepository.deleteByTransportDepartureCityCityIdOrTransportArrivalCityCityId(cityId, cityId);
        reservationRepository.deleteByTransportDepartureCityCityIdOrTransportArrivalCityCityId(cityId, cityId);

        // Delete event-related children before events.
        eventReservationRepository.deleteByEventCityCityId(cityId);
        ticketTypeRepository.deleteByEventCityCityId(cityId);
        eventRepository.deleteByCityCityId(cityId);

        // Delete accommodation-related children before accommodations.
        accommodationReviewRepository.deleteByAccommodationCityCityId(cityId);
        reservationRepository.deleteByRoomAccommodationCityCityId(cityId);
        roomRepository.deleteByAccommodationCityCityId(cityId);
        accommodationRepository.deleteByCity_CityId(cityId);

        // Delete restaurant-related children before restaurants.
        restaurantMenuImageRepository.deleteByRestaurantCityCityId(cityId);
        restaurantReviewRepository.deleteByRestaurantCityCityId(cityId);
        restaurantRepository.deleteByCityCityId(cityId);

        // Delete activity-related children before activities.
        activityReservationRepository.deleteByActivityCityCityId(cityId);
        activityReviewRepository.deleteByActivityCityCityId(cityId);
        activityMediaRepository.deleteByActivityCityCityId(cityId);
        activityRepository.deleteByCityCityId(cityId);

        // Delete direct city-linked content.
        transportRepository.deleteByDepartureCity_CityIdOrArrivalCity_CityId(cityId, cityId);
        distanceRepository.deleteByFromCity_CityIdOrToCity_CityId(cityId, cityId);
        specialOfferRepository.deleteByCityCityId(cityId);
        cityMediaRepository.deleteByCityCityId(cityId);

        // passport_city_stamp and passport_photo are handled by DB constraints.
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
