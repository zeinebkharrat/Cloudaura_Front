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
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccommodationService {
    private final AccommodationRepository accommodationRepository;
    private final RoomRepository roomRepository;
    private final CatalogTranslationService catalogTranslationService;

    @Transactional(readOnly = true)
    public List<AccommodationSearchResponse> searchAccommodations(AccommodationSearchRequest request) {
        Accommodation.AccommodationType type = request.getType() != null ?
                Accommodation.AccommodationType.valueOf(request.getType()) : null;

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
                .filter(res -> res.getAvailableRoomsCount() > 0)
                .filter(res -> request.getMinRating() == null || res.getRating() >= request.getMinRating())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AccommodationSearchResponse getAccommodationDetails(int id, LocalDateTime checkIn, LocalDateTime checkOut) {
        Accommodation acc = accommodationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("api.error.accommodation_not_found"));

        return mapToResponse(acc,
                checkIn != null ? checkIn : LocalDateTime.now(),
                checkOut != null ? checkOut : LocalDateTime.now().plusDays(1));
    }

    private AccommodationSearchResponse mapToResponse(Accommodation acc, LocalDateTime checkIn, LocalDateTime checkOut) {
        List<Room> allRooms = roomRepository.findByAccommodation_AccommodationId(acc.getAccommodationId());
        List<Room> availableRooms = roomRepository.findAvailableRooms(acc.getAccommodationId(), checkIn, checkOut);

        List<RoomResponse> roomResponses = allRooms.stream()
                .map(r -> RoomResponse.builder()
                        .roomId(r.getRoomId())
                        .roomType(r.getRoomType().name())
                        .capacity(r.getCapacity())
                        .price(r.getPrice())
                        .available(availableRooms.contains(r))
                        .build())
                .collect(Collectors.toList());

        int accId = acc.getAccommodationId();
        int cityId = acc.getCity().getCityId();

        String rawName = acc.getName();
        String resName = catalogTranslationService.resolveEntityField(accId, "accommodation", "name", rawName);
        String nameOut = CatalogKeyUtil.isBadI18nPlaceholder(rawName, resName) ? "" : resName;

        return AccommodationSearchResponse.builder()
                .accommodationId(accId)
                .name(nameOut)
                .type(acc.getType().name())
                .pricePerNight(acc.getPricePerNight())
                .rating(acc.getRating())
                .status(acc.getStatus().name())
                .cityName(catalogTranslationService.resolveEntityField(cityId, "city", "name", acc.getCity().getName()))
                .cityRegion(
                        catalogTranslationService.resolveEntityField(
                                cityId, "city", "region", acc.getCity().getRegion()))
                .availableRoomsCount(availableRooms.size())
                .rooms(roomResponses)
                .build();
    }
}
