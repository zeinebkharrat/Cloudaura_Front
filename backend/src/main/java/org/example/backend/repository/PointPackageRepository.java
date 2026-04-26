package org.example.backend.repository;

import org.example.backend.model.PointPackage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PointPackageRepository extends JpaRepository<PointPackage, Long> {
    List<PointPackage> findByActiveTrue();
}
