package org.example.backend.repository;

import org.example.backend.model.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Integer> {
    List<Driver> findByIsActiveTrue();
    long countByIsActiveTrue();
}
