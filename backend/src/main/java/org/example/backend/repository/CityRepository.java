package org.example.backend.repository;

import org.example.backend.model.City;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface CityRepository extends JpaRepository<City, Integer>, JpaSpecificationExecutor<City> {
	Optional<City> findFirstByNameIgnoreCase(String name);
}