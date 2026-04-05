package org.example.backend.service;

import org.example.backend.model.City;
import org.example.backend.model.Distance;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.DistanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Populates the distances table on first startup.
 * For every pair of cities that have lat/lon coordinates, it computes
 * the Haversine aerial distance × 1.25 road factor and persists it.
 *
 * After the initial seed, subsequent startups are skipped (count > 0 guard).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(20) // runs after city / role seeders
public class DistanceSeeder implements ApplicationRunner {

    private final CityRepository     cityRepo;
    private final DistanceRepository distanceRepo;

    private static final double ROAD_FACTOR = 1.25;

    @Override
    public void run(ApplicationArguments args) {
        if (distanceRepo.count() > 0) {
            log.info("DistanceSeeder: table already populated – skipping.");
            return;
        }

        List<City> cities = cityRepo.findAll().stream()
            .filter(c -> c.getLatitude() != null && c.getLongitude() != null)
            .toList();

        if (cities.size() < 2) {
            log.warn("DistanceSeeder: fewer than 2 cities with coordinates – cannot seed distances.");
            return;
        }

        int inserted = 0;
        for (int i = 0; i < cities.size(); i++) {
            for (int j = i + 1; j < cities.size(); j++) {
                City a = cities.get(i);
                City b = cities.get(j);

                double aerial = haversine(
                    a.getLatitude(), a.getLongitude(),
                    b.getLatitude(), b.getLongitude());

                double road = round1(aerial * ROAD_FACTOR);

                try {
                    distanceRepo.save(Distance.builder()
                        .fromCity(a).toCity(b).distanceKm(road).build());
                    inserted++;
                } catch (Exception ex) {
                    log.warn("DistanceSeeder: could not insert {}-{}: {}",
                        a.getName(), b.getName(), ex.getMessage());
                }
            }
        }
        log.info("DistanceSeeder: inserted {} city-pair distances.", inserted);
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double R    = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double round1(double v) { return Math.round(v * 10.0) / 10.0; }
}
