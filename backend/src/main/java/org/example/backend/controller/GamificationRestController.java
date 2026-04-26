package org.example.backend.controller;

import org.example.backend.dto.gamification.GamificationReportRequest;
import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.GamificationService;
import org.example.backend.repository.GameUnlockCostRepository;
import org.example.backend.repository.UserUnlockedGameRepository;
import org.example.backend.model.GameUnlockCost;
import org.example.backend.model.UserUnlockedGame;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/gamification")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class GamificationRestController {

    private final GamificationService gamificationService;
    private final GameUnlockCostRepository gameUnlockCostRepository;
    private final UserUnlockedGameRepository userUnlockedGameRepository;

    public GamificationRestController(
            GamificationService gamificationService,
            GameUnlockCostRepository gameUnlockCostRepository,
            UserUnlockedGameRepository userUnlockedGameRepository) {
        this.gamificationService = gamificationService;
        this.gameUnlockCostRepository = gameUnlockCostRepository;
        this.userUnlockedGameRepository = userUnlockedGameRepository;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        return gamificationService.getMe(currentUser());
    }

    @GetMapping("/challenges/today")
    public List<Map<String, Object>> todayChallenges() {
        return gamificationService.todayChallenges(currentUser());
    }

    @PostMapping("/report-game")
    public ResponseEntity<Void> reportGame(@RequestBody GamificationReportRequest body) {
        if (body.gameKind() == null || body.gameId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "gameKind and gameId required");
        }
        gamificationService.onStandaloneGame(
                currentUser(), body.gameKind(), body.gameId(), body.score(), body.maxScore());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/unlock-costs")
    public List<GameUnlockCost> getUnlockCosts() {
        return gameUnlockCostRepository.findAll();
    }

    @GetMapping("/unlocked-games")
    public List<String> getUnlockedGames() {
        return userUnlockedGameRepository.findByUser(currentUser())
                .stream()
                .map(UserUnlockedGame::getGameId)
                .collect(Collectors.toList());
    }

    @PostMapping("/unlock-game/{gameId}")
    public ResponseEntity<Map<String, Object>> unlockGame(@PathVariable String gameId) {
        User user = currentUser();
        if (userUnlockedGameRepository.existsByUserAndGameId(user, gameId)) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Already unlocked"));
        }

        GameUnlockCost cost = gameUnlockCostRepository.findById(gameId)
                .orElse(null);

        // If there is no cost defined, it might be free, but let's assume it requires 0 or we reject.
        int requiredPoints = (cost != null && cost.getCostPoints() != null) ? cost.getCostPoints() : 0;

        if (requiredPoints > 0 && (user.getPoints() == null || user.getPoints() < requiredPoints)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not enough points to unlock this game.");
        }

        if (requiredPoints > 0) {
            gamificationService.deductPoints(user, requiredPoints);
        }

        UserUnlockedGame unlocked = new UserUnlockedGame(user, gameId);
        userUnlockedGameRepository.save(unlocked);

        return ResponseEntity.ok(Map.of("success", true, "message", "Game unlocked successfully"));
    }

    private static User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetailsService.CustomUserDetails d) {
            return d.getUser();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }
}
