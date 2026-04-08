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
    private final TournamentRepository tournamentRepository;
    private final TournamentParticipationRepository participationRepository;
    private final UserBadgeRepository userBadgeRepository;

    public GamificationService(
            GamificationPointsService pointsService,
            UserRepository userRepository,
            BadgeRepository badgeRepository,
            DailyChallengeRepository dailyChallengeRepository,
            UserDailyChallengeCompletionRepository dailyCompletionRepository,
            TournamentRepository tournamentRepository,
            TournamentParticipationRepository participationRepository,
            UserBadgeRepository userBadgeRepository) {
        this.pointsService = pointsService;
        this.userRepository = userRepository;
        this.badgeRepository = badgeRepository;
        this.dailyChallengeRepository = dailyChallengeRepository;
        this.dailyCompletionRepository = dailyCompletionRepository;
        this.tournamentRepository = tournamentRepository;
        this.participationRepository = participationRepository;
        this.userBadgeRepository = userBadgeRepository;
    }

    /** Called after roadmap step completion (game score). */
    @Transactional
    public void onRoadmapNodeCompleted(User user, RoadmapNode node, Integer score, Integer maxScore) {
        int pts = computeGamePoints(score, maxScore);
        pointsService.addPoints(user, pts);
        tryDailyChallengesFromNode(user, node);
        addTournamentScoreFromNode(user, node, score, maxScore);
    }

    /** Standalone game (direct URL, no roadmap step). */
    @Transactional
    public void onStandaloneGame(User user, LudificationGameKind kind, Integer gameId, Integer score, Integer maxScore) {
        int pts = computeGamePoints(score, maxScore);
        pointsService.addPoints(user, pts);
        tryDailyChallengesStandalone(user, kind, gameId);
        addTournamentScoreStandalone(user, kind, gameId, score, maxScore);
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

    private void addTournamentScoreFromNode(User user, RoadmapNode node, Integer score, Integer maxScore) {
        Date now = new Date();
        List<Tournament> live = tournamentRepository.findLiveAt(TournamentStatus.LIVE, now);
        int delta = score != null && maxScore != null && maxScore > 0 ? (100 * score) / maxScore : 10;
        for (Tournament t : live) {
            for (TournamentRound r : t.getRounds()) {
                if (roundMatchesNode(r, node)) {
                    addParticipationScore(user, t, delta);
                }
            }
        }
    }

    private void addTournamentScoreStandalone(
            User user, LudificationGameKind kind, Integer gameId, Integer score, Integer maxScore) {
        Date now = new Date();
        List<Tournament> live = tournamentRepository.findLiveAt(TournamentStatus.LIVE, now);
        int delta = score != null && maxScore != null && maxScore > 0 ? (100 * score) / maxScore : 10;
        for (Tournament t : live) {
            for (TournamentRound r : t.getRounds()) {
                if (r.getGameKind() == kind && r.getGameId() != null && r.getGameId().equals(gameId)) {
                    addParticipationScore(user, t, delta);
                }
            }
        }
    }

    private static boolean roundMatchesNode(TournamentRound r, RoadmapNode node) {
        return switch (r.getGameKind()) {
            case ROADMAP_NODE -> r.getGameId() != null && r.getGameId().equals(node.getNodeId());
            case QUIZ ->
                    node.getQuiz() != null
                            && r.getGameId() != null
                            && r.getGameId().equals(node.getQuiz().getQuizId());
            case CROSSWORD ->
                    node.getCrossword() != null
                            && r.getGameId() != null
                            && r.getGameId().equals(node.getCrossword().getCrosswordId());
            case PUZZLE ->
                    node.getPuzzleId() != null
                            && r.getGameId() != null
                            && r.getGameId().equals(node.getPuzzleId());
            case LUDO -> false;
        };
    }

    private void addParticipationScore(User user, Tournament t, int delta) {
        TournamentParticipation p =
                participationRepository
                        .findByTournament_TournamentIdAndUser_UserId(t.getTournamentId(), user.getUserId())
                        .orElseGet(
                                () -> {
                                    TournamentParticipation row = new TournamentParticipation();
                                    row.setTournament(tournamentRepository.getReferenceById(t.getTournamentId()));
                                    row.setUser(userRepository.getReferenceById(user.getUserId()));
                                    row.setTotalScore(0);
                                    return participationRepository.save(row);
                                });
        p.setTotalScore((p.getTotalScore() == null ? 0 : p.getTotalScore()) + delta);
        participationRepository.save(p);
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
                                    if (ub.getTournament() != null) {
                                        m.put("tournamentId", ub.getTournament().getTournamentId());
                                        m.put("tournamentTitle", ub.getTournament().getTitle());
                                    }
                                    return m;
                                })
                        .toList();
        return Map.of("points", pts, "badges", badges);
    }

    @Transactional
    public void finalizeTournament(Integer tournamentId) {
        Tournament t =
                tournamentRepository
                        .findById(tournamentId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<TournamentParticipation> ranking =
                participationRepository.findByTournament_TournamentIdOrderByTotalScoreDesc(tournamentId);
        if (!ranking.isEmpty()) {
            TournamentParticipation top = ranking.get(0);
            t.setWinnerUser(top.getUser());
            if (t.getWinnerBadge() != null) {
                awardTournamentBadge(top.getUser(), t.getWinnerBadge(), t);
            }
        }
        t.setStatus(TournamentStatus.FINISHED);
        tournamentRepository.save(t);
    }

    private void awardTournamentBadge(User user, Badge badge, Tournament tournament) {
        if (userBadgeRepository.existsByUser_UserIdAndBadge_BadgeIdAndTournament_TournamentId(
                user.getUserId(), badge.getBadgeId(), tournament.getTournamentId())) {
            return;
        }
        UserBadge ub = new UserBadge();
        ub.setUser(userRepository.getReferenceById(user.getUserId()));
        ub.setBadge(badgeRepository.getReferenceById(badge.getBadgeId()));
        ub.setTournament(tournament);
        userBadgeRepository.save(ub);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listActiveTournaments() {
        Date now = new Date();
        return tournamentRepository.findLiveAt(TournamentStatus.LIVE, now).stream()
                .map(this::toTournamentMap)
                .toList();
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

    private Map<String, Object> toTournamentMap(Tournament t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tournamentId", t.getTournamentId());
        m.put("title", t.getTitle());
        m.put("description", t.getDescription());
        m.put("startsAt", t.getStartsAt());
        m.put("endsAt", t.getEndsAt());
        m.put("status", t.getStatus().name());
        if (t.getWinnerBadge() != null) {
            m.put("winnerBadgeId", t.getWinnerBadge().getBadgeId());
            m.put("winnerBadgeName", t.getWinnerBadge().getName());
        }
        List<Map<String, Object>> rounds = new ArrayList<>();
        t.getRounds().stream()
                .sorted(Comparator.comparing(TournamentRound::getSequenceOrder))
                .forEach(
                        r -> {
                            Map<String, Object> rm = new LinkedHashMap<>();
                            rm.put("roundId", r.getRoundId());
                            rm.put("sequenceOrder", r.getSequenceOrder());
                            rm.put("gameKind", r.getGameKind().name());
                            rm.put("gameId", r.getGameId());
                            rounds.add(rm);
                        });
        m.put("rounds", rounds);
        return m;
    }
}
