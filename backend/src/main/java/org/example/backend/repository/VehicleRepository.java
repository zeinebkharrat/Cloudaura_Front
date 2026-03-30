package org.example.backend.repository;

import org.example.backend.model.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, Integer> {
    List<Vehicle> findByTypeInAndIsActiveTrue(List<Vehicle.VehicleType> types);
    List<Vehicle> findByIsActiveTrue();
    long countByIsActiveTrue();
}
