package org.example.backend.repository;

import org.example.backend.model.ActivityMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface ActivityMediaRepository extends JpaRepository<ActivityMedia, Integer>, JpaSpecificationExecutor<ActivityMedia> {
    void deleteByActivityActivityId(Integer activityId);
    void deleteByActivityCityCityId(Integer cityId);
    List<ActivityMedia> findByActivityActivityIdOrderByMediaIdDesc(Integer activityId);
}
