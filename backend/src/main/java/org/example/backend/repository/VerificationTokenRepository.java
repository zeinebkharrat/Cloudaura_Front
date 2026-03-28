package org.example.backend.repository;

import org.example.backend.model.User;
import org.example.backend.model.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {
    Optional<VerificationToken> findByTokenAndTokenType(String token, String tokenType);

    List<VerificationToken> findByUserAndTokenTypeAndUsedAtIsNull(User user, String tokenType);
}
