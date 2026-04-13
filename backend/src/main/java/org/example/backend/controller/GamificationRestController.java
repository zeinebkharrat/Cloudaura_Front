package org.example.backend.controller;

import org.example.backend.dto.gamification.GamificationReportRequest;
import org.example.backend.model.User;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.GamificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gamification")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class GamificationRestController {

    private final GamificationService gamificationService;

    public GamificationRestController(GamificationService gamificationService) {
        this.gamificationService = gamificationService;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        return gamificationService.getMe(currentUser());
    }

    @GetMapping("/challenges/today")
    public List<Map<String, Object>> todayChallenges() {
        return gamificationService.todayChallenges(currentUser());
    }

    @GetMapping("/tournaments/active")
    public List<Map<String, Object>> activeTournaments() {
        return gamificationService.listActiveTournaments();
    }

    @PostMapping("/report-game")
    public ResponseEntity<Void> reportGame(@RequestBody GamificationReportRequest body) {
        if (body.gameKind() == null || body.gameId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.gamification_params_required");
        }
        gamificationService.onStandaloneGame(
                currentUser(), body.gameKind(), body.gameId(), body.score(), body.maxScore());
        return ResponseEntity.ok().build();
    }

    private static User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetailsService.CustomUserDetails d) {
            return d.getUser();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.unauthorized");
    }
}
