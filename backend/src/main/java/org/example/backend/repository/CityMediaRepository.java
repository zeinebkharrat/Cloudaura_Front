package org.example.backend.repository;

import org.example.backend.model.CityMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CityMediaRepository extends JpaRepository<CityMedia, Integer>, JpaSpecificationExecutor<CityMedia> {
    void deleteByCityCityId(Integer cityId);
}