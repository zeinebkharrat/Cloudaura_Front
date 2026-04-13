package org.example.backend.controller;

import org.example.backend.dto.gamification.BadgeRequest;
import org.example.backend.dto.gamification.DailyChallengeRequest;
import org.example.backend.dto.gamification.TournamentRequest;
import org.example.backend.dto.gamification.TournamentRoundRequest;
import org.example.backend.model.*;
import org.example.backend.repository.BadgeRepository;
import org.example.backend.repository.DailyChallengeRepository;
import org.example.backend.repository.TournamentRepository;
import org.example.backend.service.GamificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/gamification")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class GamificationAdminController {

    private final BadgeRepository badgeRepository;
    private final DailyChallengeRepository dailyChallengeRepository;
    private final TournamentRepository tournamentRepository;
    private final GamificationService gamificationService;

    public GamificationAdminController(
            BadgeRepository badgeRepository,
            DailyChallengeRepository dailyChallengeRepository,
            TournamentRepository tournamentRepository,
            GamificationService gamificationService) {
        this.badgeRepository = badgeRepository;
        this.dailyChallengeRepository = dailyChallengeRepository;
        this.tournamentRepository = tournamentRepository;
        this.gamificationService = gamificationService;
    }

    @GetMapping("/badges")
    public List<Badge> listBadges() {
        return badgeRepository.findAll();
    }

    @PostMapping("/badges")
    public Badge createBadge(@RequestBody BadgeRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.gamification_name_required");
        }
        Badge b = new Badge();
        b.setName(req.name().trim());
        b.setDescription(req.description());
        b.setIconUrl(req.iconUrl());
        return badgeRepository.save(b);
    }

    @PutMapping("/badges/{id}")
    public Badge updateBadge(@PathVariable Integer id, @RequestBody BadgeRequest req) {
        Badge b =
                badgeRepository
                        .findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.not_found"));
        if (req.name() != null && !req.name().isBlank()) {
            b.setName(req.name().trim());
        }
        if (req.description() != null) {
            b.setDescription(req.description());
        }
        if (req.iconUrl() != null) {
            b.setIconUrl(req.iconUrl());
        }
        return badgeRepository.save(b);
    }

    @DeleteMapping("/badges/{id}")
    public ResponseEntity<Void> deleteBadge(@PathVariable Integer id) {
        badgeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/daily-challenges")
    public List<DailyChallenge> listChallenges() {
        return dailyChallengeRepository.findAll();
    }

    @PostMapping("/daily-challenges")
    public DailyChallenge createChallenge(@RequestBody DailyChallengeRequest req) {
        DailyChallenge c = new DailyChallenge();
        applyChallenge(c, req);
        if (c.getGameKind() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.gamification_game_kind_required");
        }
        Date now = new Date();
        c.setValidFrom(now);
        c.setValidTo(Date.from(now.toInstant().plus(24, ChronoUnit.HOURS)));
        return dailyChallengeRepository.save(c);
    }

    @PutMapping("/daily-challenges/{id}")
    public DailyChallenge updateChallenge(@PathVariable Integer id, @RequestBody DailyChallengeRequest req) {
        DailyChallenge c =
                dailyChallengeRepository
                        .findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.not_found"));
        applyChallenge(c, req);
        return dailyChallengeRepository.save(c);
    }

    @DeleteMapping("/daily-challenges/{id}")
    public ResponseEntity<Void> deleteChallenge(@PathVariable Integer id) {
        dailyChallengeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static void applyChallenge(DailyChallenge c, DailyChallengeRequest req) {
        if (req.title() != null) {
            c.setTitle(req.title());
        }
        if (req.description() != null) {
            c.setDescription(req.description());
        }
        if (req.pointsReward() != null) {
            c.setPointsReward(req.pointsReward());
        }
        if (req.gameKind() != null) {
            c.setGameKind(req.gameKind());
        }
        if (req.targetId() != null) {
            c.setTargetId(req.targetId());
        }
        if (req.active() != null) {
            c.setActive(req.active());
        }
    }

    @GetMapping("/tournaments")
    public List<Tournament> listTournaments() {
        return tournamentRepository.findAll();
    }

    @PostMapping("/tournaments")
    public Tournament createTournament(@RequestBody TournamentRequest req) {
        if (req.title() == null || req.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.gamification_title_required");
        }
        Tournament t = new Tournament();
        t.setTitle(req.title().trim());
        t.setDescription(req.description());
        t.setStartsAt(req.startsAt());
        t.setEndsAt(req.endsAt());
        t.setStatus(TournamentStatus.DRAFT);
        if (req.winnerBadgeId() != null) {
            t.setWinnerBadge(badgeRepository.getReferenceById(req.winnerBadgeId()));
        }
        if (req.rounds() != null) {
            List<TournamentRoundRequest> sorted =
                    req.rounds().stream()
                            .sorted(Comparator.comparing(TournamentRoundRequest::sequenceOrder))
                            .toList();
            for (TournamentRoundRequest rr : sorted) {
                TournamentRound tr = new TournamentRound();
                tr.setTournament(t);
                tr.setSequenceOrder(rr.sequenceOrder());
                tr.setGameKind(rr.gameKind());
                tr.setGameId(rr.gameId());
                t.getRounds().add(tr);
            }
        }
        return tournamentRepository.save(t);
    }

    @PostMapping("/tournaments/{id}/go-live")
    public ResponseEntity<Map<String, Object>> goLive(@PathVariable Integer id) {
        Tournament t =
                tournamentRepository
                        .findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.not_found"));
        t.setStatus(TournamentStatus.LIVE);
        tournamentRepository.save(t);
        return ResponseEntity.ok(Map.of("status", "LIVE", "tournamentId", id));
    }

    @PostMapping("/tournaments/{id}/finalize")
    public ResponseEntity<Map<String, Object>> finalize(@PathVariable Integer id) {
        gamificationService.finalizeTournament(id);
        return ResponseEntity.ok(Map.of("status", "FINISHED", "tournamentId", id));
    }

    @DeleteMapping("/tournaments/{id}")
    public ResponseEntity<Void> deleteTournament(@PathVariable Integer id) {
        tournamentRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
