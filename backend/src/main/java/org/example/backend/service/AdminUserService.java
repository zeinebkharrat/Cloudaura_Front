package org.example.backend.service;

import org.example.backend.dto.AdminUserResponse;
import org.example.backend.dto.AdminUserRoleUpdateRequest;
import org.example.backend.dto.AdminUserInsightsResponse;
import org.example.backend.dto.AdminUserUpdateRequest;
import org.example.backend.dto.ArtisanDecisionRequest;
import org.example.backend.dto.BanUserRequest;
import org.example.backend.model.ActivityReservation;
import org.example.backend.model.Ban;
import org.example.backend.model.City;
import org.example.backend.model.Comment;
import org.example.backend.model.EventReservation;
import org.example.backend.model.LikeEntity;
import org.example.backend.model.Post;
import org.example.backend.model.Role;
import org.example.backend.model.UserPreferences;
import org.example.backend.model.User;
import org.example.backend.model.Reservation;
import org.example.backend.repository.BanRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.CommentRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.LikeEntityRepository;
import org.example.backend.repository.PostRepository;
import org.example.backend.repository.RoleRepository;
import org.example.backend.repository.UserPreferencesRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.repository.ReservationRepository;
import org.example.backend.repository.ActivityReservationRepository;
import org.example.backend.repository.TransportReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mail.MailException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.Date;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final BanRepository banRepository;
    private final CityRepository cityRepository;
    private final UserPreferencesRepository userPreferencesRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final LikeEntityRepository likeEntityRepository;
    private final ReservationRepository reservationRepository;
    private final ActivityReservationRepository activityReservationRepository;
    private final EventReservationRepository eventReservationRepository;
    private final TransportReservationRepository transportReservationRepository;
    private final AuditService auditService;
    private final EmailService emailService;
    private final JdbcTemplate jdbcTemplate;

    public AdminUserService(UserRepository userRepository,
                            RoleRepository roleRepository,
                            BanRepository banRepository,
                            CityRepository cityRepository,
                            UserPreferencesRepository userPreferencesRepository,
                            PostRepository postRepository,
                            CommentRepository commentRepository,
                            LikeEntityRepository likeEntityRepository,
                            ReservationRepository reservationRepository,
                            ActivityReservationRepository activityReservationRepository,
                            EventReservationRepository eventReservationRepository,
                            TransportReservationRepository transportReservationRepository,
                            AuditService auditService,
                            EmailService emailService,
                            JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.banRepository = banRepository;
        this.cityRepository = cityRepository;
        this.userPreferencesRepository = userPreferencesRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.likeEntityRepository = likeEntityRepository;
        this.reservationRepository = reservationRepository;
        this.activityReservationRepository = activityReservationRepository;
        this.eventReservationRepository = eventReservationRepository;
        this.transportReservationRepository = transportReservationRepository;
        this.auditService = auditService;
        this.emailService = emailService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers(String query) {
        List<User> users;
        if (query == null || query.isBlank()) {
            users = userRepository.findAll();
        } else {
            users = userRepository.searchByTerm(query.trim());
        }
        return users.stream().map(this::toAdminUserResponse).toList();
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUser(Integer userId) {
        User user = getExistingUser(userId);
        return toAdminUserResponse(user);
    }

        @Transactional(readOnly = true)
        public AdminUserInsightsResponse getUserInsights(Integer userId) {
        User user = getExistingUser(userId);
        AdminUserResponse userResponse = toAdminUserResponse(user);

        UserPreferences prefs = userPreferencesRepository.findByUserUserId(userId).orElse(null);
        AdminUserInsightsResponse.PreferenceSnapshot preferenceSnapshot = new AdminUserInsightsResponse.PreferenceSnapshot(
            prefs != null ? prefs.getTravelStyle() : null,
            prefs != null ? prefs.getPreferredRegion() : null,
            prefs != null ? prefs.getTravelWith() : null,
            budgetLevel(prefs),
            prefs != null ? prefs.getBudgetMin() : null,
            prefs != null ? prefs.getBudgetMax() : null,
            prefs != null ? prefs.getAccommodationType() : null,
            prefs != null ? prefs.getTransportPreference() : null,
            prefs != null ? prefs.getPreferredCuisine() : null
        );

        long postsCount = postRepository.countByAuthorUserId(userId);
        long commentsCount = commentRepository.countByAuthor_UserId(userId);
        long likesCount = likeEntityRepository.countByUserUserId(userId);

        List<AdminUserInsightsResponse.CommunityItem> recentPosts = postRepository.findTop5ByAuthorUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(this::toPostCommunityItem)
            .toList();
        List<AdminUserInsightsResponse.CommunityItem> recentComments = commentRepository.findTop5ByAuthor_UserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(this::toCommentCommunityItem)
            .toList();
        List<AdminUserInsightsResponse.CommunityItem> recentLikes = likeEntityRepository.findTop5ByUserUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(this::toLikeCommunityItem)
            .toList();

        AdminUserInsightsResponse.CommunitySummary communitySummary = new AdminUserInsightsResponse.CommunitySummary(
            postsCount,
            commentsCount,
            likesCount,
            recentPosts,
            recentComments,
            recentLikes
        );

        long accommodationsCount = reservationRepository.countByUser_UserId(userId);
        long activityCount = activityReservationRepository.countByUserUserId(userId);
        long eventCount = eventReservationRepository.countByUserUserId(userId);
        long transportCount = transportReservationRepository.countByUser_UserId(userId);

        List<AdminUserInsightsResponse.ReservationItem> recentActivityReservations = activityReservationRepository
            .findTop5ByUserUserIdOrderByReservationDateDesc(userId)
            .stream()
            .map(this::toActivityReservationItem)
            .toList();

        List<AdminUserInsightsResponse.ReservationItem> recentEventReservations = eventReservationRepository
            .findTop5ByUserUserIdOrderByEventReservationIdDesc(userId)
            .stream()
            .map(this::toEventReservationItem)
            .toList();

        AdminUserInsightsResponse.ReservationSummary reservationSummary = new AdminUserInsightsResponse.ReservationSummary(
            accommodationsCount,
            activityCount,
            eventCount,
            transportCount,
            recentActivityReservations,
            recentEventReservations
        );

        return new AdminUserInsightsResponse(userResponse, preferenceSnapshot, communitySummary, reservationSummary);
        }

    @Transactional
    public AdminUserResponse updateUser(Integer userId, AdminUserUpdateRequest request) {
        User user = getExistingUser(userId);
        String previousEmail = user.getEmail();
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        String currentNormalizedEmail = previousEmail == null ? "" : previousEmail.trim().toLowerCase(Locale.ROOT);
        if (!normalizedEmail.equals(currentNormalizedEmail)
            && userRepository.existsByEmailIgnoreCaseAndUserIdNot(normalizedEmail, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "api.error.duplicate_email");
        }

        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setEmail(normalizedEmail);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setNationality(request.nationality() != null ? request.nationality().trim() : null);
        user.setCity(resolveCityForNationality(user.getNationality(), request.cityId()));
        user.setProfileImageUrl(request.profileImageUrl() != null ? request.profileImageUrl().trim() : null);
        user.setStatus(request.status().trim().toUpperCase(Locale.ROOT));

        User saved = userRepository.save(user);
        if (!normalizedEmail.equalsIgnoreCase(previousEmail)) {
            auditService.log(
                AuditService.ACTION_EMAIL_CHANGE_ADMIN,
                saved,
                Map.of(
                    "oldEmail", previousEmail,
                    "newEmail", normalizedEmail,
                    "source", "admin-update"
                )
            );
        }

        return toAdminUserResponse(saved);
    }

    @Transactional
    public AdminUserResponse updateRoles(Integer userId, AdminUserRoleUpdateRequest request) {
        User user = getExistingUser(userId);
        Set<Role> updatedRoles = request.roles().stream()
                .map(roleName -> roleRepository.findByName(roleName)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.admin.unknown_role")))
                .collect(Collectors.toSet());

        user.setRoles(updatedRoles);
        return toAdminUserResponse(userRepository.save(user));
    }

    @Transactional
    public AdminUserResponse reviewArtisanRequest(Integer userId, ArtisanDecisionRequest request) {
        User user = getExistingUser(userId);
        boolean approved = Boolean.TRUE.equals(request.approved());

        if (approved) {
            Role artisanRole = roleRepository.findByName("ROLE_ARTISAN")
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.admin.role_artisan_missing"));
            Set<Role> roles = user.getRoles();
            roles.add(artisanRole);
            user.setRoles(roles);
        }

        user.setArtisanRequestPending(false);
        User saved = userRepository.save(user);
        if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
            try {
                emailService.sendArtisanRequestDecision(saved.getEmail(), saved.getFirstName(), approved);
            } catch (MailException ex) {
                System.err.println("Failed to send artisan review email: " + ex.getMessage());
            }
        }
        return toAdminUserResponse(saved);
    }

    @Transactional
    public void deleteUser(Integer userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.user_not_found");
        }

        try {
            deleteUserWithFkCleanup(userId, false);
        } catch (DataIntegrityViolationException firstFailure) {
            log.warn("Standard delete for user {} failed due to FK constraints, retrying with FK checks temporarily disabled", userId);
            deleteUserWithFkCleanup(userId, true);
        }
    }

    private void deleteUserWithFkCleanup(Integer userId, boolean disableFkChecks) {
        if (disableFkChecks) {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
        }

        try {
            deleteRowsReferencingUser(userId);
            userRepository.deleteById(userId);
            userRepository.flush();
        } finally {
            if (disableFkChecks) {
                jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
            }
        }
    }

    private void deleteRowsReferencingUser(Integer userId) {
        String sql = """
                SELECT TABLE_NAME, COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND REFERENCED_TABLE_NAME = 'users'
                  AND REFERENCED_COLUMN_NAME = 'user_id'
                """;

        List<Map<String, Object>> refs = jdbcTemplate.queryForList(sql);
        for (Map<String, Object> ref : refs) {
            String tableName = String.valueOf(ref.get("TABLE_NAME"));
            String columnName = String.valueOf(ref.get("COLUMN_NAME"));

            if (!isSafeSqlIdentifier(tableName) || !isSafeSqlIdentifier(columnName)) {
                continue;
            }
            if ("users".equalsIgnoreCase(tableName)) {
                continue;
            }

            String deleteSql = "DELETE FROM `" + tableName + "` WHERE `" + columnName + "` = ?";
            jdbcTemplate.update(deleteSql, userId);
        }
    }

    private boolean isSafeSqlIdentifier(String value) {
        return value != null && value.matches("[A-Za-z0-9_]+$");
    }

    @Transactional
    public AdminUserResponse banUser(Integer userId, BanUserRequest request) {
        User user = getExistingUser(userId);
        if (hasRole(user, "ROLE_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.admin.cannot_ban_admin");
        }

        boolean permanent = Boolean.TRUE.equals(request.permanent());
        if (!permanent && request.expiresAt() == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.admin.ban_expires_required");
        }
        if (permanent && request.expiresAt() != null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.admin.ban_expires_forbidden");
        }

        Ban previousBan = deactivateActiveBan(user);

        Ban ban = new Ban();
        ban.setUser(user);
        ban.setReason(request.reason().trim());
        ban.setCreatedAt(new java.util.Date());
        ban.setExpiresAt(permanent ? null : request.expiresAt());
        ban.setIsActive(true);
        banRepository.save(ban);

        Map<String, Object> details = new HashMap<>();
        details.put("reason", request.reason().trim());
        details.put("permanent", permanent);
        details.put("expiresAt", request.expiresAt());
        details.put("closedPreviousBan", previousBan != null);

        auditService.log(
            AuditService.ACTION_BAN_USER,
            user,
            details
        );

        return toAdminUserResponse(user);
    }

    @Transactional
    public AdminUserResponse unbanUser(Integer userId) {
        User user = getExistingUser(userId);
        Ban deactivatedBan = deactivateActiveBan(user);
        Map<String, Object> details = new HashMap<>();
        details.put("hadActiveBan", deactivatedBan != null);
        details.put("previousReason", deactivatedBan != null ? deactivatedBan.getReason() : null);
        auditService.log(
            AuditService.ACTION_UNBAN_USER,
            user,
            details
        );
        return toAdminUserResponse(user);
    }

    private User getExistingUser(Integer userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.user_not_found"));
    }

    private boolean hasRole(User user, String roleName) {
        return user.getRoles().stream().map(Role::getName).anyMatch(roleName::equals);
    }

    private Ban deactivateActiveBan(User user) {
        Ban existing = banRepository.findTopByUserAndIsActiveTrueOrderByCreatedAtDesc(user).orElse(null);
        if (existing == null) {
            return null;
        }
        existing.setIsActive(false);
        return banRepository.save(existing);
    }

    private City resolveCityForNationality(String nationality, Integer cityId) {
        boolean tunisian = isTunisiaNationality(nationality);
        if (!tunisian) {
            return null;
        }
        if (cityId == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.auth.city_id_required");
        }
        return cityRepository.findById(cityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.invalid_city_id"));
    }

    private boolean isTunisiaNationality(String nationality) {
        if (nationality == null) {
            return false;
        }
        String normalized = nationality.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("tunisia") || normalized.equals("tunisian") || normalized.equals("tunisie");
    }

    private String budgetLevel(UserPreferences prefs) {
        if (prefs == null || prefs.getBudgetMin() == null || prefs.getBudgetMax() == null) {
            return null;
        }
        if (Double.compare(prefs.getBudgetMin(), 0d) == 0 && Double.compare(prefs.getBudgetMax(), 70d) == 0) {
            return "low";
        }
        if (Double.compare(prefs.getBudgetMin(), 50d) == 0 && Double.compare(prefs.getBudgetMax(), 170d) == 0) {
            return "medium";
        }
        if (Double.compare(prefs.getBudgetMin(), 140d) == 0 && Double.compare(prefs.getBudgetMax(), 500d) == 0) {
            return "premium";
        }
        return "custom";
    }

    private AdminUserInsightsResponse.CommunityItem toPostCommunityItem(Post post) {
        String content = post.getContent() != null ? post.getContent().trim() : "";
        String preview = content.length() > 80 ? content.substring(0, 80) + "..." : content;
        String subtitle = "Likes " + safeInt(post.getLikesCount()) + " | Comments " + safeInt(post.getCommentsCount());
        return new AdminUserInsightsResponse.CommunityItem(post.getPostId(), preview.isBlank() ? "Post" : preview, subtitle, post.getCreatedAt());
    }

    private AdminUserInsightsResponse.CommunityItem toCommentCommunityItem(Comment comment) {
        String content = comment.getContent() != null ? comment.getContent().trim() : "";
        String preview = content.length() > 80 ? content.substring(0, 80) + "..." : content;
        Integer postId = comment.getPost() != null ? comment.getPost().getPostId() : null;
        String subtitle = postId != null ? "On post #" + postId : "Comment";
        return new AdminUserInsightsResponse.CommunityItem(comment.getCommentId(), preview.isBlank() ? "Comment" : preview, subtitle, comment.getCreatedAt());
    }

    private AdminUserInsightsResponse.CommunityItem toLikeCommunityItem(LikeEntity like) {
        Integer postId = like.getPost() != null ? like.getPost().getPostId() : null;
        String title = postId != null ? "Liked post #" + postId : "Liked a post";
        return new AdminUserInsightsResponse.CommunityItem(
                like.getLikeId(),
                title,
                "Community appreciation",
                like.getCreatedAt()
        );
    }

    private AdminUserInsightsResponse.ReservationItem toActivityReservationItem(ActivityReservation reservation) {
        String title = reservation.getActivity() != null && reservation.getActivity().getName() != null
                ? reservation.getActivity().getName()
                : "Activity";
        String status = reservation.getStatus() != null ? reservation.getStatus().name() : "UNKNOWN";
        return new AdminUserInsightsResponse.ReservationItem(
                reservation.getActivityReservationId(),
                title,
                status,
                reservation.getTotalPrice(),
                reservation.getReservationDate(),
                null
        );
    }

    private AdminUserInsightsResponse.ReservationItem toEventReservationItem(EventReservation reservation) {
        String title = reservation.getEvent() != null && reservation.getEvent().getTitle() != null
                ? reservation.getEvent().getTitle()
                : "Event";
        String status = reservation.getStatus() != null ? reservation.getStatus().name() : "UNKNOWN";
        Date reservationDate = reservation.getEvent() != null ? reservation.getEvent().getStartDate() : null;
        return new AdminUserInsightsResponse.ReservationItem(
                reservation.getEventReservationId(),
                title,
                status,
                reservation.getTotalAmount(),
                reservationDate,
                null
        );
    }

    private int safeInt(Integer value) {
        return value != null ? value : 0;
    }

    private AdminUserResponse toAdminUserResponse(User user) {
        Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        Ban activeBan = banRepository.findTopByUserAndIsActiveTrueOrderByCreatedAtDesc(user)
            .filter(ban -> ban.getExpiresAt() == null || ban.getExpiresAt().after(new java.util.Date()))
            .orElse(null);
        return new AdminUserResponse(
                user.getUserId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                user.getNationality(),
                user.getCity() != null ? user.getCity().getCityId() : null,
                user.getCity() != null ? user.getCity().getName() : null,
                user.getStatus(),
                Boolean.TRUE.equals(user.getArtisanRequestPending()),
                roles,
                user.getProfileImageUrl(),
                activeBan != null,
                activeBan != null ? activeBan.getReason() : null,
                activeBan != null ? activeBan.getExpiresAt() : null
        );
    }
}
