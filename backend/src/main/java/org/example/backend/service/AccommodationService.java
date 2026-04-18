package org.example.backend.service;

import org.example.backend.dto.accommodation.AccommodationSearchRequest;
import org.example.backend.dto.accommodation.AccommodationSearchResponse;
import org.example.backend.dto.accommodation.RoomResponse;
import org.example.backend.exception.ResourceNotFoundException;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.Accommodation;
import org.example.backend.model.Room;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccommodationService {
    private final AccommodationRepository accommodationRepository;
    private final RoomRepository roomRepository;
    private final CatalogTranslationService catalogTranslationService;

    @Transactional(readOnly = true)
    public List<AccommodationSearchResponse> searchAccommodations(AccommodationSearchRequest request) {
                Accommodation.AccommodationType type = null;
                if (request.getType() != null && !request.getType().isBlank()) {
                        try {
                                type = Accommodation.AccommodationType.valueOf(request.getType().trim().toUpperCase(Locale.ROOT));
                        } catch (IllegalArgumentException ignored) {
                                // Ignore unknown types instead of failing the whole search.
                                type = null;
                        }
                }

        Integer cityFilter = request.getCityId();
        if (cityFilter != null && cityFilter <= 0) {
            cityFilter = null;
        }
        List<Accommodation> accommodations = accommodationRepository.searchAccommodations(
                cityFilter, Accommodation.AccommodationStatus.AVAILABLE, type, request.getMinPrice(), request.getMaxPrice());

        LocalDateTime checkIn = request.getCheckIn() != null ? request.getCheckIn().atStartOfDay() : LocalDateTime.now();
        LocalDateTime checkOut = request.getCheckOut() != null ? request.getCheckOut().atStartOfDay() : LocalDateTime.now().plusDays(1);

        return accommodations.stream()
                .map(acc -> mapToResponse(acc, checkIn, checkOut))
                .filter(res -> request.getMinRating() == null || res.getRating() >= request.getMinRating())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AccommodationSearchResponse getAccommodationDetails(int id, LocalDateTime checkIn, LocalDateTime checkOut) {
        Accommodation acc = findAccommodation(id);

        return mapToResponse(acc,
                checkIn != null ? checkIn : LocalDateTime.now(),
                checkOut != null ? checkOut : LocalDateTime.now().plusDays(1));
    }

    @Transactional(readOnly = true)
    public Accommodation findAccommodation(Integer id) {
        return accommodationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("api.error.accommodation_not_found"));
    }

    private AccommodationSearchResponse mapToResponse(Accommodation acc, LocalDateTime checkIn, LocalDateTime checkOut) {
        List<Room> allRooms = roomRepository.findByAccommodation_AccommodationId(acc.getAccommodationId());
        List<Room> availableRooms = roomRepository.findAvailableRooms(acc.getAccommodationId(), checkIn, checkOut);
        Set<Integer> availableRoomIds = new HashSet<>(
                availableRooms.stream().map(Room::getRoomId).collect(Collectors.toSet()));

        List<RoomResponse> roomResponses = allRooms.stream()
                .map(r -> RoomResponse.builder()
                        .roomId(r.getRoomId())
                        .roomType(r.getRoomType().name())
                        .capacity(r.getCapacity())
                        .price(r.getPrice())
                        .available(availableRoomIds.contains(r.getRoomId()))
                        .build())
                .collect(Collectors.toList());

        int accId = acc.getAccommodationId();
        Integer cityId = acc.getCity() != null ? acc.getCity().getCityId() : null;

        String rawName = acc.getName();
        String resName = catalogTranslationService.resolveEntityField(accId, "accommodation", "name", rawName);
        String nameOut = CatalogKeyUtil.isBadI18nPlaceholder(rawName, resName) ? "" : resName;

        String rawCityName =
                acc.getCity() != null && acc.getCity().getName() != null ? acc.getCity().getName() : "";
        String rawCityRegion =
                acc.getCity() != null && acc.getCity().getRegion() != null ? acc.getCity().getRegion() : "";
        String cityNameOut = cityId != null
                ? catalogTranslationService.resolveEntityField(cityId, "city", "name", rawCityName)
                : rawCityName;
        String cityRegionOut = cityId != null
                ? catalogTranslationService.resolveEntityField(cityId, "city", "region", rawCityRegion)
                : rawCityRegion;

        List<String> amenitiesOut = acc.getAmenities() == null
                ? List.of()
                : acc.getAmenities().stream()
                        .filter(a -> a != null && !a.isBlank())
                        .map(String::trim)
                        .collect(Collectors.toCollection(ArrayList::new));

        return AccommodationSearchResponse.builder()
                .accommodationId(accId)
                .name(nameOut)
                .description(acc.getDescription())
                .amenities(amenitiesOut)
                .type(acc.getType().name())
                .pricePerNight(acc.getPricePerNight())
                .rating(acc.getRating())
                .status(acc.getStatus().name())
                .cityName(cityNameOut)
                .cityRegion(cityRegionOut)
                .availableRoomsCount(availableRooms.size())
                .rooms(roomResponses)
                .build();
    }
}
