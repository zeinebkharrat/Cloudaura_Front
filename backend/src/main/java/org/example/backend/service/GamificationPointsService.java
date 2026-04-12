package org.example.backend.service;

import org.example.backend.model.User;
import org.example.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GamificationPointsService {

    private final UserRepository userRepository;

    public GamificationPointsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public void addPoints(User user, int delta) {
        if (delta == 0) {
            return;
        }
        User u =
                userRepository
                        .findById(user.getUserId())
                        .orElseThrow();
        int p = u.getPoints() == null ? 0 : u.getPoints();
        u.setPoints(p + delta);
        userRepository.save(u);
    }
}
