package org.example.backend.controller;

import org.example.backend.dto.gamification.BadgeRequest;
import org.example.backend.dto.gamification.DailyChallengeRequest;
import org.example.backend.model.*;
import org.example.backend.repository.BadgeRepository;
import org.example.backend.repository.DailyChallengeRepository;
import org.example.backend.repository.GameUnlockCostRepository;
import org.example.backend.repository.PointPackageRepository;
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
    private final GamificationService gamificationService;
    private final GameUnlockCostRepository gameUnlockCostRepository;
    private final PointPackageRepository pointPackageRepository;

    public GamificationAdminController(
            BadgeRepository badgeRepository,
            DailyChallengeRepository dailyChallengeRepository,
            GamificationService gamificationService,
            GameUnlockCostRepository gameUnlockCostRepository,
            PointPackageRepository pointPackageRepository) {
        this.badgeRepository = badgeRepository;
        this.dailyChallengeRepository = dailyChallengeRepository;
        this.gamificationService = gamificationService;
        this.gameUnlockCostRepository = gameUnlockCostRepository;
        this.pointPackageRepository = pointPackageRepository;
    }

    @GetMapping("/badges")
    public List<Badge> listBadges() {
        return badgeRepository.findAll();
    }

    @PostMapping("/badges")
    public Badge createBadge(@RequestBody BadgeRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name required");
        }
        Badge b = new Badge();
        b.setName(req.name().trim());
        b.setDescription(req.description());
        b.setIconUrl(req.iconUrl());
        b.setTargetGameId(req.targetGameId());
        b.setTargetGameKind(req.targetGameKind());
        return badgeRepository.save(b);
    }

    @PutMapping("/badges/{id}")
    public Badge updateBadge(@PathVariable Integer id, @RequestBody BadgeRequest req) {
        Badge b = badgeRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (req.name() != null && !req.name().isBlank()) {
            b.setName(req.name().trim());
        }
        if (req.description() != null) {
            b.setDescription(req.description());
        }
        if (req.iconUrl() != null) {
            b.setIconUrl(req.iconUrl());
        }
        b.setTargetGameId(req.targetGameId());
        b.setTargetGameKind(req.targetGameKind());
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "gameKind required");
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
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
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



    @GetMapping("/unlock-costs")
    public List<GameUnlockCost> listUnlockCosts() {
        return gameUnlockCostRepository.findAll();
    }

    @PostMapping("/unlock-costs")
    public GameUnlockCost saveUnlockCost(@RequestBody GameUnlockCost req) {
        if (req.getGameId() == null || req.getGameId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "gameId is required");
        }
        if (req.getCostPoints() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "costPoints is required");
        }
        return gameUnlockCostRepository.save(req);
    }

    @DeleteMapping("/unlock-costs/{gameId}")
    public ResponseEntity<Void> deleteUnlockCost(@PathVariable String gameId) {
        gameUnlockCostRepository.deleteById(gameId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/point-packages")
    public List<PointPackage> listPointPackages() {
        return pointPackageRepository.findAll();
    }

    @PostMapping("/point-packages")
    public PointPackage createPointPackage(@RequestBody PointPackage pkg) {
        if (pkg.getName() == null || pkg.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name required");
        }
        return pointPackageRepository.save(pkg);
    }

    @PutMapping("/point-packages/{id}")
    public PointPackage updatePointPackage(@PathVariable Long id, @RequestBody PointPackage req) {
        PointPackage pkg = pointPackageRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (req.getName() != null && !req.getName().isBlank()) {
            pkg.setName(req.getName());
        }
        if (req.getPointsAmount() > 0) {
            pkg.setPointsAmount(req.getPointsAmount());
        }
        if (req.getPrice() >= 0) {
            pkg.setPrice(req.getPrice());
        }
        pkg.setActive(req.isActive());
        return pointPackageRepository.save(pkg);
    }

    @DeleteMapping("/point-packages/{id}")
    public ResponseEntity<Void> deletePointPackage(@PathVariable Long id) {
        pointPackageRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
