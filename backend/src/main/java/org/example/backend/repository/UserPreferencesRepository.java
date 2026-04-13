package org.example.backend.repository;

import org.example.backend.model.UserPreferences;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserPreferencesRepository extends JpaRepository<UserPreferences, Integer> {
    Optional<UserPreferences> findByUserUserId(Integer userId);
}
