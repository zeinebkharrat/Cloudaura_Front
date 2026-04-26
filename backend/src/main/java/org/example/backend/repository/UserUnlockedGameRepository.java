package org.example.backend.repository;

import org.example.backend.model.UserUnlockedGame;
import org.example.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserUnlockedGameRepository extends JpaRepository<UserUnlockedGame, Long> {
    List<UserUnlockedGame> findByUser(User user);
    boolean existsByUserAndGameId(User user, String gameId);
}
