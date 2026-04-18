package org.example.backend.controller;

import org.example.backend.dto.ApiResponse;
import org.example.backend.model.Accommodation;
import org.example.backend.model.Room;
import org.example.backend.model.City;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.RoomRepository;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.CityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/accommodations")
@RequiredArgsConstructor
public class AdminAccommodationController {

    private final AccommodationRepository accommodationRepository;
    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;
    private final CityRepository cityRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<List<AccommodationDTO>> getAllAccommodations() {
        List<Accommodation> accommodations = accommodationRepository.findAll();
        List<AccommodationDTO> dtos = accommodations.stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
        return ApiResponse.success(dtos);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ApiResponse<AccommodationDTO> getAccommodation(@PathVariable Integer id) {
        Accommodation acc = accommodationRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Accommodation not found"));
        return ApiResponse.success(toDTO(acc));
    }

    @PostMapping
    @Transactional
    public ApiResponse<AccommodationDTO> createAccommodation(@RequestBody AccommodationRequest request) {
        City city = cityRepository.findById(request.cityId())
            .orElseThrow(() -> new RuntimeException("Ville non trouvée"));

        Accommodation acc = Accommodation.builder()
            .name(request.name())
            .description(request.description())
            .type(Accommodation.AccommodationType.valueOf(request.type()))
            .pricePerNight(request.pricePerNight())
            .rating(request.rating())
            .status(Accommodation.AccommodationStatus.valueOf(request.status()))
            .city(city)
            .amenities(request.amenities() != null ? new ArrayList<>(request.amenities()) : new ArrayList<>())
            .build();

        acc = accommodationRepository.save(acc);
        return ApiResponse.success(toDTO(acc));
    }

    @PutMapping("/{id}")
    @Transactional
    public ApiResponse<AccommodationDTO> updateAccommodation(
            @PathVariable Integer id,
            @RequestBody AccommodationRequest request) {
        Accommodation acc = accommodationRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Accommodation not found"));

        City city = cityRepository.findById(request.cityId())
            .orElseThrow(() -> new RuntimeException("Ville non trouvée"));

        acc.setName(request.name());
        acc.setDescription(request.description());
        acc.setType(Accommodation.AccommodationType.valueOf(request.type()));
        acc.setPricePerNight(request.pricePerNight());
        acc.setRating(request.rating());
        acc.setStatus(Accommodation.AccommodationStatus.valueOf(request.status()));
        acc.setCity(city);
        acc.setAmenities(request.amenities() != null ? new ArrayList<>(request.amenities()) : new ArrayList<>());

        acc = accommodationRepository.save(acc);
        return ApiResponse.success(toDTO(acc));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ApiResponse<Void> deleteAccommodation(@PathVariable Integer id) {
        // Delete reservations for rooms first, then rooms, then accommodation
        List<Room> rooms = roomRepository.findByAccommodation_AccommodationId(id);
        for (Room room : rooms) {
            // Delete reservations for this room
            reservationRepository.deleteByRoom_RoomId(room.getRoomId());
        }
        // Delete all rooms
        if (!rooms.isEmpty()) {
            roomRepository.deleteAll(rooms);
        }
        accommodationRepository.deleteById(id);
        return ApiResponse.<Void>success(null);
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ApiResponse<AccommodationDTO> toggleStatus(@PathVariable Integer id, @RequestBody StatusRequest request) {
        Accommodation acc = accommodationRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Accommodation not found"));
        acc.setStatus(Accommodation.AccommodationStatus.valueOf(request.status()));
        acc = accommodationRepository.save(acc);
        return ApiResponse.success(toDTO(acc));
    }

    // Room management endpoints
    @PostMapping("/{id}/rooms")
    @Transactional
    public ApiResponse<RoomDTO> addRoom(@PathVariable Integer id, @RequestBody RoomRequest request) {
        Accommodation acc = accommodationRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Accommodation not found"));

        Room room = Room.builder()
            .roomType(Room.RoomType.valueOf(request.roomType()))
            .capacity(request.capacity())
            .price(request.price())
            .accommodation(acc)
            .build();

        room = roomRepository.save(room);
        return ApiResponse.success(toRoomDTO(room));
    }

    @PutMapping("/{accId}/rooms/{roomId}")
    @Transactional
    public ApiResponse<RoomDTO> updateRoom(
            @PathVariable Integer accId,
            @PathVariable Integer roomId,
            @RequestBody RoomRequest request) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Chambre non trouvée"));

        room.setRoomType(Room.RoomType.valueOf(request.roomType()));
        room.setCapacity(request.capacity());
        room.setPrice(request.price());

        room = roomRepository.save(room);
        return ApiResponse.success(toRoomDTO(room));
    }

    @DeleteMapping("/{accId}/rooms/{roomId}")
    @Transactional
    public ApiResponse<Void> deleteRoom(@PathVariable Integer accId, @PathVariable Integer roomId) {
        roomRepository.deleteById(roomId);
        return ApiResponse.<Void>success(null);
    }

    // DTOs
    private AccommodationDTO toDTO(Accommodation acc) {
        return new AccommodationDTO(
            acc.getAccommodationId(),
            acc.getName(),
            acc.getDescription(),
            acc.getAmenities() != null ? List.copyOf(acc.getAmenities()) : List.of(),
            acc.getType().name(),
            acc.getPricePerNight(),
            acc.getRating(),
            acc.getStatus().name(),
            acc.getCity() != null ? acc.getCity().getCityId() : null,
            acc.getCity() != null ? acc.getCity().getName() : null,
            acc.getRooms() != null ? acc.getRooms().stream().map(this::toRoomDTO).collect(Collectors.toList()) : null
        );
    }

    private RoomDTO toRoomDTO(Room room) {
        return new RoomDTO(
            room.getRoomId(),
            room.getRoomType().name(),
            room.getCapacity(),
            room.getPrice()
        );
    }

    public record AccommodationDTO(
        Integer accommodationId,
        String name,
        String description,
        List<String> amenities,
        String type,
        Double pricePerNight,
        Double rating,
        String status,
        Integer cityId,
        String cityName,
        List<RoomDTO> rooms
    ) {}

    public record RoomDTO(Integer roomId, String roomType, Integer capacity, Double price) {}

    public record AccommodationRequest(
        String name,
        String description,
        List<String> amenities,
        String type,
        Double pricePerNight,
        Double rating,
        String status,
        Integer cityId
    ) {}

    public record RoomRequest(String roomType, Integer capacity, Double price) {}

    public record StatusRequest(String status) {}
}
