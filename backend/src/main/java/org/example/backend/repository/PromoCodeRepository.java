package org.example.backend.repository;

import org.example.backend.model.PromoCode;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PromoCodeRepository extends JpaRepository<PromoCode, Integer> {
    Optional<PromoCode> findByCodeIgnoreCaseAndActiveTrue(String code);
}
