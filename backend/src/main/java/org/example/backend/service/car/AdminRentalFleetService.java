package org.example.backend.service.car;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.admin.AdminRentalFleetCarDto;
import org.example.backend.dto.admin.AdminRentalFleetCarUpsertRequest;
import org.example.backend.dto.admin.AdminRentalFleetStatsDto;
import org.example.backend.model.City;
import org.example.backend.model.RentalFleetCar;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.RentalCarReservationRepository;
import org.example.backend.repository.RentalFleetCarRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminRentalFleetService {

    private final RentalFleetCarRepository fleetRepo;
    private final RentalCarReservationRepository rentalReservationRepo;
    private final CityRepository cityRepository;

    @Transactional(readOnly = true)
    public AdminRentalFleetStatsDto stats() {
        long total = fleetRepo.count();
        long active = fleetRepo.countByIsActiveTrue();
        long cities = fleetRepo.countDistinctCities();
        long res = rentalReservationRepo.count();
        return new AdminRentalFleetStatsDto(total, active, cities, res);
    }

    @Transactional(readOnly = true)
    public List<AdminRentalFleetCarDto> listAll() {
        return fleetRepo.findAllWithCityOrdered().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public AdminRentalFleetCarDto get(int id) {
        RentalFleetCar car = fleetRepo.findById(id).orElseThrow(() -> notFound(id));
        return toDto(car);
    }

    @Transactional
    public AdminRentalFleetCarDto create(AdminRentalFleetCarUpsertRequest req) {
        City city = resolveCatalogCity(req.cityId());
        RentalFleetCar car = RentalFleetCar.builder()
                .city(city)
                .category(normalizeCategory(req.category()))
                .modelLabel(normalizeModel(req.modelLabel()))
                .dailyRateTnd(validateRate(req.dailyRateTnd()))
                .isActive(req.isActive() == null || req.isActive())
                .build();
        car = fleetRepo.save(car);
        return toDto(car);
    }

    @Transactional
    public AdminRentalFleetCarDto update(int id, AdminRentalFleetCarUpsertRequest req) {
        RentalFleetCar car = fleetRepo.findById(id).orElseThrow(() -> notFound(id));
        City city = resolveCatalogCity(req.cityId());
        car.setCity(city);
        car.setCategory(normalizeCategory(req.category()));
        car.setModelLabel(normalizeModel(req.modelLabel()));
        car.setDailyRateTnd(validateRate(req.dailyRateTnd()));
        if (req.isActive() != null) {
            car.setIsActive(req.isActive());
        }
        car = fleetRepo.save(car);
        return toDto(car);
    }

    @Transactional
    public AdminRentalFleetCarDto setActive(int id, boolean active) {
        RentalFleetCar car = fleetRepo.findById(id).orElseThrow(() -> notFound(id));
        car.setIsActive(active);
        car = fleetRepo.save(car);
        return toDto(car);
    }

    /**
     * Hard-delete when there is no reservation history; otherwise deactivate and keep row for FK integrity.
     */
    @Transactional
    public boolean deleteOrDeactivate(int id) {
        RentalFleetCar car = fleetRepo.findById(id).orElseThrow(() -> notFound(id));
        long linked = rentalReservationRepo.countByFleetCar_FleetCarId(id);
        if (linked > 0) {
            car.setIsActive(false);
            fleetRepo.save(car);
            return false;
        }
        fleetRepo.delete(car);
        return true;
    }

    private AdminRentalFleetCarDto toDto(RentalFleetCar car) {
        City city = car.getCity();
        long rc = rentalReservationRepo.countByFleetCar_FleetCarId(car.getFleetCarId());
        return new AdminRentalFleetCarDto(
                car.getFleetCarId(),
                city.getCityId(),
                city.getName(),
                car.getCategory(),
                car.getModelLabel(),
                car.getDailyRateTnd(),
                Boolean.TRUE.equals(car.getIsActive()),
                rc);
    }

    private City resolveCatalogCity(Integer cityId) {
        if (cityId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.city_required");
        }
        City city = cityRepository
                .findById(cityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "admin.rental_fleet.city_not_found"));
        if (city.isExcludedFromPublicCityCatalog()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.city_not_allowed");
        }
        return city;
    }

    private static String normalizeCategory(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.category_required");
        }
        String s = raw.trim();
        if (s.length() > 32) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.category_too_long");
        }
        return s.toUpperCase();
    }

    private static String normalizeModel(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.model_required");
        }
        String s = raw.trim();
        if (s.length() > 160) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.model_too_long");
        }
        return s;
    }

    private static BigDecimal validateRate(BigDecimal rate) {
        if (rate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.rate_required");
        }
        if (rate.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.rate_positive");
        }
        return rate.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static ResponseStatusException notFound(int id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "admin.rental_fleet.not_found:" + id);
    }
}
