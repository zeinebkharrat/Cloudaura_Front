package org.example.backend.repository;

import org.example.backend.model.Activity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ActivityRepository extends JpaRepository<Activity, Integer>, JpaSpecificationExecutor<Activity> {
    void deleteByCityCityId(Integer cityId);
}