package org.example.backend.repository;

import org.example.backend.model.UserDigitalPassPort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserDigitalPassPortRepository extends JpaRepository<UserDigitalPassPort, Integer> {
    Optional<UserDigitalPassPort> findByUserUserId(Integer userId);
}
