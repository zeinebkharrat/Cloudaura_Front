package org.example.backend.service.car;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.model.City;
import org.example.backend.model.RentalFleetCar;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.RentalFleetCarRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Seeds two bookable vehicles per public governorate city when the fleet table is empty.
 */
@Component
@Order(10_000)
@RequiredArgsConstructor
@Slf4j
public class LocalCarRentalFleetBootstrap implements ApplicationRunner {

    private final RentalFleetCarRepository fleetRepo;
    private final CityRepository cityRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (fleetRepo.count() > 0) {
            return;
        }
        int added = 0;
        for (City city : cityRepository.findAll()) {
            if (city.isExcludedFromPublicCityCatalog()) {
                continue;
            }
            int id = city.getCityId() != null ? city.getCityId() : 0;
            BigDecimal economy = BigDecimal.valueOf(85 + (id % 25)).setScale(2, java.math.RoundingMode.HALF_UP);
            BigDecimal compact = BigDecimal.valueOf(115 + (id % 35)).setScale(2, java.math.RoundingMode.HALF_UP);
            fleetRepo.save(RentalFleetCar.builder()
                    .city(city)
                    .category("ECONOMY")
                    .modelLabel("Citroën C3 / Renault Clio ou équivalent")
                    .dailyRateTnd(economy)
                    .isActive(true)
                    .build());
            fleetRepo.save(RentalFleetCar.builder()
                    .city(city)
                    .category("COMPACT")
                    .modelLabel("Peugeot 308 / VW Golf ou équivalent")
                    .dailyRateTnd(compact)
                    .isActive(true)
                    .build());
            added += 2;
        }
        log.info("Seeded internal rental fleet: {} vehicles across public cities.", added);
    }
}
