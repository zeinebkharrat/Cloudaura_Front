package org.example.backend.service;

import org.example.backend.model.*;
import org.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class GamificationService {

    private final GamificationPointsService pointsService;
    private final UserRepository userRepository;
    private final BadgeRepository badgeRepository;
    private final DailyChallengeRepository dailyChallengeRepository;
    private final UserDailyChallengeCompletionRepository dailyCompletionRepository;
    private final UserBadgeRepository userBadgeRepository;

    public GamificationService(
            GamificationPointsService pointsService,
            UserRepository userRepository,
            BadgeRepository badgeRepository,
            DailyChallengeRepository dailyChallengeRepository,
            UserDailyChallengeCompletionRepository dailyCompletionRepository,
            UserBadgeRepository userBadgeRepository) {
        this.pointsService = pointsService;
        this.userRepository = userRepository;
        this.badgeRepository = badgeRepository;
        this.dailyChallengeRepository = dailyChallengeRepository;
        this.dailyCompletionRepository = dailyCompletionRepository;
        this.userBadgeRepository = userBadgeRepository;
    }

    /** Called after roadmap step completion (game score). */
    @Transactional
    public void onRoadmapNodeCompleted(User user, RoadmapNode node, Integer score, Integer maxScore) {
        int pts = computeGamePoints(score, maxScore);
        pointsService.addPoints(user, pts);
        tryDailyChallengesFromNode(user, node);
        tryAwardBadgesFromNode(user, node);
    }

    /** Standalone game (direct URL, no roadmap step). */
    @Transactional
    public void onStandaloneGame(User user, LudificationGameKind kind, Integer gameId, Integer score, Integer maxScore) {
        int pts = computeGamePoints(score, maxScore);
        pointsService.addPoints(user, pts);
        tryDailyChallengesStandalone(user, kind, gameId);
        tryAwardBadgesStandalone(user, kind, gameId);
    }

    private static int computeGamePoints(Integer score, Integer maxScore) {
        int base = 10;
        if (score != null && maxScore != null && maxScore > 0) {
            base += (int) Math.round(20.0 * score / maxScore);
        }
        return base;
    }

    private void tryDailyChallengesFromNode(User user, RoadmapNode node) {
        Date now = new Date();
        List<DailyChallenge> list = dailyChallengeRepository.findActiveAt(now);
        for (DailyChallenge c : list) {
            if (!dailyCompletionRepository.existsByUser_UserIdAndChallenge_ChallengeId(user.getUserId(), c.getChallengeId())
                    && matchesChallengeFromNode(node, c)) {
                completeDailyChallenge(user, c);
            }
        }
    }

    private void tryDailyChallengesStandalone(User user, LudificationGameKind kind, Integer gameId) {
        Date now = new Date();
        List<DailyChallenge> list = dailyChallengeRepository.findActiveAt(now);
        for (DailyChallenge c : list) {
            if (!dailyCompletionRepository.existsByUser_UserIdAndChallenge_ChallengeId(user.getUserId(), c.getChallengeId())
                    && matchesChallengeStandalone(kind, gameId, c)) {
                completeDailyChallenge(user, c);
            }
        }
    }

    private void completeDailyChallenge(User user, DailyChallenge c) {
        UserDailyChallengeCompletion row = new UserDailyChallengeCompletion();
        row.setUser(userRepository.getReferenceById(user.getUserId()));
        row.setChallenge(c);
        row.setCompletedAt(new Date());
        int reward = c.getPointsReward() == null ? 0 : c.getPointsReward();
        row.setPointsEarned(reward);
        dailyCompletionRepository.save(row);
        pointsService.addPoints(user, reward);
    }

    private boolean matchesChallengeFromNode(RoadmapNode node, DailyChallenge c) {
        return switch (c.getGameKind()) {
            case ROADMAP_NODE -> {
                if (c.getTargetId() == null) {
                    yield true;
                }
                yield c.getTargetId().equals(node.getNodeId());
            }
            case QUIZ -> {
                if (node.getQuiz() == null) {
                    yield false;
                }
                if (c.getTargetId() == null) {
                    yield true;
                }
                yield c.getTargetId().equals(node.getQuiz().getQuizId());
            }
            case CROSSWORD -> {
                if (node.getCrossword() == null) {
                    yield false;
                }
                if (c.getTargetId() == null) {
                    yield true;
                }
                yield c.getTargetId().equals(node.getCrossword().getCrosswordId());
            }
            case PUZZLE -> {
                if (node.getPuzzleId() == null) {
                    yield false;
                }
                if (c.getTargetId() == null) {
                    yield true;
                }
                yield c.getTargetId().equals(node.getPuzzleId());
            }
            case LUDO -> false;
            case KARAOKE -> false;

            case GOVERNORATE_GUESS, EL_JEM_QUEST, CHEF_QUEST, CHKOBBA, MUSIC -> false;

        };
    }

    private boolean matchesChallengeStandalone(LudificationGameKind kind, Integer gameId, DailyChallenge c) {
        if (c.getGameKind() != kind) {
            return false;
        }
        if (c.getTargetId() == null) {
            return true;
        }
        return gameId != null && c.getTargetId().equals(gameId);
    }

    private void tryAwardBadgesFromNode(User user, RoadmapNode node) {
        // A roadmap node can be many types of games
        if (node.getQuiz() != null) {
            tryAwardBadgesStandalone(user, LudificationGameKind.QUIZ, node.getQuiz().getQuizId());
        }
        if (node.getCrossword() != null) {
            tryAwardBadgesStandalone(user, LudificationGameKind.CROSSWORD, node.getCrossword().getCrosswordId());
        }
        if (node.getPuzzleId() != null) {
            tryAwardBadgesStandalone(user, LudificationGameKind.PUZZLE, node.getPuzzleId());
        }
        // Also check if the node itself is linked
        tryAwardBadgesStandalone(user, LudificationGameKind.ROADMAP_NODE, node.getNodeId());
    }

    private void tryAwardBadgesStandalone(User user, LudificationGameKind kind, Integer gameId) {
        if (gameId == null) return;
        List<Badge> eligible = badgeRepository.findByTargetGameIdAndTargetGameKind(String.valueOf(gameId), kind.name());
        for (Badge b : eligible) {
            if (!userBadgeRepository.existsByUser_UserIdAndBadge_BadgeId(user.getUserId(), b.getBadgeId())) {
                awardBadge(user, b);
            }
        }
    }

    private void awardBadge(User user, Badge badge) {
        UserBadge ub = new UserBadge();
        ub.setUser(userRepository.getReferenceById(user.getUserId()));
        ub.setBadge(badgeRepository.getReferenceById(badge.getBadgeId()));
        ub.setEarnedAt(new Date());
        userBadgeRepository.save(ub);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getMe(User user) {
        User u = userRepository.findById(user.getUserId()).orElseThrow();
        int pts = u.getPoints() == null ? 0 : u.getPoints();
        List<Map<String, Object>> badges =
                userBadgeRepository.findByUser_UserIdOrderByEarnedAtDesc(user.getUserId()).stream()
                        .map(
                                ub -> {
                                    Badge b = ub.getBadge();
                                    Map<String, Object> m = new LinkedHashMap<>();
                                    m.put("badgeId", b.getBadgeId());
                                    m.put("name", b.getName());
                                    m.put("description", b.getDescription());
                                    m.put("iconUrl", b.getIconUrl());
                                    m.put("earnedAt", ub.getEarnedAt());
                                    return m;
                                })
                        .toList();
        return Map.of("points", pts, "badges", badges);
    }



    @Transactional(readOnly = true)
    public List<Map<String, Object>> todayChallenges(User user) {
        Date now = new Date();
        List<DailyChallenge> list = dailyChallengeRepository.findActiveAt(now);
        List<Map<String, Object>> out = new ArrayList<>();
        for (DailyChallenge c : list) {
            Map<String, Object> m = challengeToMap(c);
            m.put(
                    "completed",
                    dailyCompletionRepository.existsByUser_UserIdAndChallenge_ChallengeId(
                            user.getUserId(), c.getChallengeId()));
            out.add(m);
        }
        return out;
    }

    private Map<String, Object> challengeToMap(DailyChallenge c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("challengeId", c.getChallengeId());
        m.put("title", c.getTitle());
        m.put("description", c.getDescription());
        m.put("pointsReward", c.getPointsReward());
        m.put("validFrom", c.getValidFrom());
        m.put("validTo", c.getValidTo());
        m.put("gameKind", c.getGameKind().name());
        m.put("targetId", c.getTargetId());
        return m;
    }



    public void deductPoints(User user, int amount) {
        pointsService.addPoints(user, -amount);
    }
}
