package org.example.backend.service;
import org.springframework.http.HttpStatus;
import org.example.backend.dto.AuthMessageResponse;
import org.example.backend.dto.AuthResponse;
import org.example.backend.dto.ChangePasswordRequest;
import org.example.backend.dto.ForgotPasswordRequest;
import org.example.backend.dto.LoginRequest;
import org.example.backend.dto.ProfileUpdateRequest;
import org.example.backend.dto.ResendVerificationRequest;
import org.example.backend.dto.ResetPasswordRequest;
import org.example.backend.dto.SignupRequest;
import org.example.backend.dto.UserSummaryResponse;
import org.example.backend.model.City;
import org.example.backend.model.Role;
import org.example.backend.model.User;
import org.example.backend.model.VerificationToken;
import org.example.backend.repository.BanRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.RoleRepository;
import org.example.backend.repository.UserRepository;
import org.example.backend.repository.VerificationTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.mail.MailException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AuthService {

    private static final String DEFAULT_ROLE = "ROLE_USER";
    private static final int MAX_FAILED_ATTEMPTS = 3;
    private static final long LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000L;
    private static final long EMAIL_VERIFICATION_EXPIRATION_MS = 24 * 60 * 60 * 1000L;
    private static final long RESET_PASSWORD_EXPIRATION_MS = 30 * 60 * 1000L;
    private static final String TOKEN_TYPE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION";
    private static final String TOKEN_TYPE_RESET_PASSWORD = "RESET_PASSWORD";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final BanRepository banRepository;
    private final CityRepository cityRepository;
    private final VerificationTokenRepository verificationTokenRepository;
    private final EmailService emailService;
    private final AuditService auditService;
    private final RecaptchaService recaptchaService;

    @Value("${app.frontend.base-url:http://localhost:4200}")
    private String frontendBaseUrl;

    /** Si {@code false}, connexion possible sans lien de vérification e-mail (pratique en local ; garder {@code true} en prod). */
    @Value("${app.auth.require-email-verified-for-signin:true}")
    private boolean requireEmailVerifiedForSignin;

    public AuthService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder,
                       @Lazy AuthenticationManager authenticationManager,
                       JwtService jwtService,
                       BanRepository banRepository,
                       CityRepository cityRepository,
                       VerificationTokenRepository verificationTokenRepository,
                       EmailService emailService,
                       AuditService auditService,
                       RecaptchaService recaptchaService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.banRepository = banRepository;
        this.cityRepository = cityRepository;
        this.verificationTokenRepository = verificationTokenRepository;
        this.emailService = emailService;
        this.auditService = auditService;
        this.recaptchaService = recaptchaService;
    }

    @Transactional
    public AuthMessageResponse signup(SignupRequest request) {
        if (recaptchaService.isEnabled()) {
            String captchaToken = request.captchaToken();
            if (captchaToken == null || captchaToken.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.recaptcha.required");
            }
            if (!recaptchaService.verifyResponse(captchaToken)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.recaptcha.rejected");
            }
        }

        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "api.error.duplicate_email");
        }

        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "api.error.duplicate_username");
        }

        Role userRole = roleRepository.findByName(DEFAULT_ROLE)
                .orElseGet(() -> {
                    Role role = new Role();
                    role.setName(DEFAULT_ROLE);
                    return roleRepository.save(role);
                });

        User user = new User();
        user.setUsername(request.username().trim());
        user.setEmail(request.email().trim().toLowerCase());
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setStatus("ACTIVE");
        user.setCreatedAt(new Date());
        user.setPoints(0);
        boolean becomeArtisant = Boolean.TRUE.equals(request.becomeArtisan());
        user.setArtisanRequestPending(becomeArtisant);
        user.setArtisanRequestedAt(becomeArtisant ? new Date() : null);
        user.setAuthProvider("LOCAL");
        user.setProfileImageUrl(request.profileImageUrl() != null ? request.profileImageUrl().trim() : null);
        user.setNationality(request.nationality() != null ? request.nationality().trim() : null);
        user.setCity(resolveCityForNationality(user.getNationality(), request.cityId()));
        user.setEmailVerified(false);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setRoles(Set.of(userRole));

        User savedUser = userRepository.save(user);
        String token = createToken(savedUser, TOKEN_TYPE_EMAIL_VERIFICATION, EMAIL_VERIFICATION_EXPIRATION_MS);
        String verificationLink = buildFrontendLink("/verify-email", token);
        try {
            emailService.sendVerificationEmail(
                    savedUser.getEmail(),
                    savedUser.getFirstName(),
                    savedUser.getLastName(),
                    savedUser.getUsername(),
                    savedUser.getPhone(),
                    savedUser.getNationality(),
                    verificationLink);
        } catch (MailException ex) {
            return new AuthMessageResponse(
                    "Account created. Verification email could not be sent (SMTP). "
                            + "Use “Resend verification link” on the sign-in page once mail is configured."
            );
        }

        return new AuthMessageResponse(
                "Account created. Open the email we just sent and click the link to activate your account before signing in."
        );
    }

    /**
     * Read-only transaction keeps the persistence context open so {@link #toUserSummary(User)}
     * can initialize lazy associations ({@code city}, {@code level}) safely.
     */
    @Transactional(readOnly = true)
    public AuthResponse signin(LoginRequest request) {
        Optional<User> candidate = findByIdentifier(request.identifier());
        candidate.ifPresent(this::ensureAccountNotLocked);

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.identifier(), request.password())
            );
        } catch (BadCredentialsException ex) {
            if (candidate.isPresent()) {
                handleFailedSignin(candidate.get());
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.auth.invalid_credentials");
        }

        UserDetails principal = (UserDetails) authentication.getPrincipal();
        User user = userRepository.findFirstByUsernameIgnoreCaseOrderByUserIdAsc(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.auth.invalid_credentials"));

        resetFailedSigninState(user);
        ensureNotBanned(user);
        ensureEmailVerified(user);

        String token = jwtService.generateToken(principal);
        return new AuthResponse(token, jwtService.getExpirationMs(), toUserSummary(user));
    }

    @Transactional(readOnly = true)
    public UserSummaryResponse me() {
        return toUserSummary(currentUser());
    }

    @Transactional
    public AuthResponse processSocialLogin(OAuth2User oauth2User, String provider) {
        String normalizedEmail = resolveSocialEmail(oauth2User, provider);
        String firstName = extractFirstName(oauth2User);
        String lastName = extractLastName(oauth2User);
        String usernameSeed = extractUsernameSeed(oauth2User, provider, normalizedEmail);

        User user = userRepository.findFirstByEmailIgnoreCaseOrderByUserIdAsc(normalizedEmail)
                .orElseGet(() -> createSocialUser(normalizedEmail, firstName, lastName, provider, usernameSeed));

        ensureNotBanned(user);

        if (user.getFirstName() == null || user.getFirstName().isBlank()) {
            user.setFirstName(firstName);
        }
        if (user.getLastName() == null || user.getLastName().isBlank()) {
            user.setLastName(lastName);
        }
        if (user.getAuthProvider() == null || user.getAuthProvider().isBlank()) {
            user.setAuthProvider(provider.toUpperCase(Locale.ROOT));
        }
        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            user.setEmailVerified(true);
        }
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        UserDetails principal = toUserDetails(user);
        String token = jwtService.generateToken(principal);
        return new AuthResponse(token, jwtService.getExpirationMs(), toUserSummary(user));
    }

    @Transactional
    public UserSummaryResponse updateProfile(ProfileUpdateRequest request) {
        User user = currentUser();
        String previousEmail = user.getEmail();

        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        String currentNormalizedEmail = previousEmail == null ? "" : previousEmail.trim().toLowerCase(Locale.ROOT);
        if (!normalizedEmail.equals(currentNormalizedEmail)
            && userRepository.existsByEmailIgnoreCaseAndUserIdNot(normalizedEmail, user.getUserId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "api.error.duplicate_email");
        }

        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setEmail(normalizedEmail);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setNationality(request.nationality() != null ? request.nationality().trim() : null);
        user.setCity(resolveCityForNationality(user.getNationality(), request.cityId()));
        user.setProfileImageUrl(request.profileImageUrl() != null ? request.profileImageUrl().trim() : null);

        User saved = userRepository.save(user);
        if (!normalizedEmail.equalsIgnoreCase(previousEmail)) {
            Map<String, Object> details = new HashMap<>();
            details.put("oldEmail", previousEmail);
            details.put("newEmail", normalizedEmail);
            details.put("source", "self-profile");
            auditService.log(AuditService.ACTION_EMAIL_CHANGE_SELF, saved, details);
        }

        return toUserSummary(saved);
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        User user = currentUser();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.auth.invalid_current_password");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.password_unchanged");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        Map<String, Object> details = new HashMap<>();
        details.put("source", "authenticated-user");
        auditService.log(AuditService.ACTION_PASSWORD_CHANGE, user, details);
    }

    @Transactional
    public AuthMessageResponse verifyEmail(String token) {
        VerificationToken verificationToken = verificationTokenRepository
                .findByTokenAndTokenType(token, TOKEN_TYPE_EMAIL_VERIFICATION)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.invalid_verification_token"));

        validateUsableToken(verificationToken);

        User user = verificationToken.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);

        verificationToken.setUsedAt(new Date());
        verificationTokenRepository.save(verificationToken);

        return new AuthMessageResponse("Email verified successfully. You can sign in.");
    }

    @Transactional
    public AuthMessageResponse resendVerification(ResendVerificationRequest request) {
        String normalizedIdentifier = request.identifier().trim().toLowerCase(Locale.ROOT);
        userRepository.findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(normalizedIdentifier, normalizedIdentifier)
                .ifPresent(user -> {
                    if (Boolean.TRUE.equals(user.getEmailVerified())) {
                        return;
                    }
                    String token = createToken(user, TOKEN_TYPE_EMAIL_VERIFICATION, EMAIL_VERIFICATION_EXPIRATION_MS);
                    String verificationLink = buildFrontendLink("/verify-email", token);
                    try {
                        emailService.sendVerificationEmail(
                                user.getEmail(),
                                user.getFirstName(),
                                user.getLastName(),
                                user.getUsername(),
                                user.getPhone(),
                                user.getNationality(),
                                verificationLink);
                    } catch (MailException ex) {
                        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "api.error.auth.email_send_failed");
                    }
                });

        return new AuthMessageResponse("If that email exists, a verification link has been sent.");
    }

    @Transactional
    public AuthMessageResponse forgotPassword(ForgotPasswordRequest request) {
        if (recaptchaService.isEnabled()) {
            String captchaToken = request.captchaToken();
            if (captchaToken == null || captchaToken.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.recaptcha.required");
            }
            if (!recaptchaService.verifyResponse(captchaToken)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.recaptcha.rejected");
            }
        }

        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        userRepository.findFirstByEmailIgnoreCaseOrderByUserIdAsc(normalizedEmail)
                .ifPresent(user -> {
                    if (!"LOCAL".equalsIgnoreCase(user.getAuthProvider())) {
                        return;
                    }
                    String token = createToken(user, TOKEN_TYPE_RESET_PASSWORD, RESET_PASSWORD_EXPIRATION_MS);
                    String resetLink = buildFrontendLink("/reset-password", token);
                    try {
                        emailService.sendPasswordResetEmail(user.getEmail(), user.getFirstName(), resetLink);
                    } catch (MailException ex) {
                        log.warn("Password reset email failed", ex);
                        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "api.error.auth.email_send_failed");
                    }
                });

        return new AuthMessageResponse("If that email matches a local account, a reset link has just been sent.");
    }

    @Transactional
    public AuthMessageResponse resetPassword(ResetPasswordRequest request) {
        VerificationToken verificationToken = verificationTokenRepository
                .findByTokenAndTokenType(request.token(), TOKEN_TYPE_RESET_PASSWORD)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.invalid_reset_token"));

        validateUsableToken(verificationToken);

        User user = verificationToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        Map<String, Object> details = new HashMap<>();
        details.put("source", "reset-token");
        auditService.log(AuditService.ACTION_PASSWORD_RESET, user, details);

        verificationToken.setUsedAt(new Date());
        verificationTokenRepository.save(verificationToken);

        return new AuthMessageResponse("Password reset successfully.");
    }

    private User createSocialUser(String email, String firstName, String lastName, String provider, String usernameSeed) {
        Role userRole = roleRepository.findByName(DEFAULT_ROLE)
                .orElseGet(() -> {
                    Role role = new Role();
                    role.setName(DEFAULT_ROLE);
                    return roleRepository.save(role);
                });

        User user = new User();
        user.setUsername(generateUniqueUsername(usernameSeed));
        user.setEmail(email);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setStatus("ACTIVE");
        user.setCreatedAt(new Date());
        user.setPoints(0);
        user.setArtisanRequestPending(false);
        user.setArtisanRequestedAt(null);
        user.setAuthProvider(provider.toUpperCase(Locale.ROOT));
        user.setEmailVerified(true);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setRoles(Set.of(userRole));
        return userRepository.save(user);
    }

    private String generateUniqueUsername(String seed) {
        String cleanedSeed = seed == null ? "" : seed.trim();
        String localPart = cleanedSeed.split("@")[0].replaceAll("[^a-zA-Z0-9._-]", "");
        String base = localPart.isBlank() ? "user" : localPart;
        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + suffix;
            suffix++;
        }
        return candidate;
    }

    private String resolveSocialEmail(OAuth2User oauth2User, String provider) {
        String email = oauth2User.getAttribute("email");
        if (email != null && !email.isBlank()) {
            return email.trim().toLowerCase(Locale.ROOT);
        }

        String providerUserId = extractProviderUserId(oauth2User);
        if (providerUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.social_account_unresolved");
        }

        String providerKey = sanitizeIdentifierPart(provider);
        String userKey = sanitizeIdentifierPart(providerUserId);
        return "social-" + providerKey + "-" + userKey + "@oauth.local";
    }

    private String extractProviderUserId(OAuth2User oauth2User) {
        String id = oauth2User.getAttribute("sub");
        if (id != null && !id.isBlank()) {
            return id;
        }

        id = oauth2User.getAttribute("id");
        if (id != null && !id.isBlank()) {
            return id;
        }

        id = oauth2User.getAttribute("user_id");
        if (id != null && !id.isBlank()) {
            return id;
        }

        return "";
    }

    private String extractUsernameSeed(OAuth2User oauth2User, String provider, String email) {
        String login = oauth2User.getAttribute("login");
        if (login != null && !login.isBlank()) {
            return login;
        }

        String preferredUsername = oauth2User.getAttribute("preferred_username");
        if (preferredUsername != null && !preferredUsername.isBlank()) {
            return preferredUsername;
        }

        String username = oauth2User.getAttribute("username");
        if (username != null && !username.isBlank()) {
            return username;
        }

        if (email != null && !email.isBlank()) {
            return email;
        }

        return sanitizeIdentifierPart(provider) + "-user";
    }

    private String sanitizeIdentifierPart(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        String sanitized = normalized.replaceAll("[^a-z0-9._-]", "-").replaceAll("-+", "-");
        if (sanitized.startsWith("-")) {
            sanitized = sanitized.substring(1);
        }
        if (sanitized.endsWith("-")) {
            sanitized = sanitized.substring(0, sanitized.length() - 1);
        }
        return sanitized.isBlank() ? "social" : sanitized;
    }

    private String extractFirstName(OAuth2User oauth2User) {
        String givenName = oauth2User.getAttribute("given_name");
        if (givenName != null && !givenName.isBlank()) {
            return givenName;
        }
        String name = oauth2User.getAttribute("name");
        if (name == null || name.isBlank()) {
            return "Voyageur";
        }
        String[] parts = name.trim().split("\\s+");
        return parts[0];
    }

    private String extractLastName(OAuth2User oauth2User) {
        String familyName = oauth2User.getAttribute("family_name");
        if (familyName != null && !familyName.isBlank()) {
            return familyName;
        }
        String name = oauth2User.getAttribute("name");
        if (name == null || name.isBlank()) {
            return "Utilisateur";
        }
        String[] parts = name.trim().split("\\s+");
        return parts.length > 1 ? String.join(" ", java.util.Arrays.copyOfRange(parts, 1, parts.length)) : "Utilisateur";
    }

    private UserDetails toUserDetails(User user) {
        return new org.example.backend.service.CustomUserDetailsService.CustomUserDetails(user);
    }

    private Optional<User> findByIdentifier(String identifier) {
        String normalized = identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findFirstByUsernameIgnoreCaseOrEmailIgnoreCaseOrderByUserIdAsc(normalized, normalized);
    }

    private void handleFailedSignin(User user) {
        if (!"LOCAL".equalsIgnoreCase(user.getAuthProvider())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.auth.invalid_credentials");
        }

        int attempts = user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts();
        attempts++;

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(new Date(System.currentTimeMillis() + LOGIN_LOCK_DURATION_MS));
            userRepository.save(user);
            throw new ResponseStatusException(HttpStatus.LOCKED, "api.error.auth.account_locked_brute_force");
        }

        user.setFailedLoginAttempts(attempts);
        userRepository.save(user);
        log.warn("Failed sign-in for user id={}, attempts={}", user.getUserId(), attempts);
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.auth.invalid_password");
    }

    private void ensureAccountNotLocked(User user) {
        Date lockedUntil = user.getLockedUntil();
        if (lockedUntil == null) {
            return;
        }

        Date now = new Date();
        if (lockedUntil.after(now)) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "api.error.auth.account_locked_temp");
        }

        user.setLockedUntil(null);
        user.setFailedLoginAttempts(0);
        userRepository.save(user);
    }

    private void resetFailedSigninState(User user) {
        if ((user.getFailedLoginAttempts() != null && user.getFailedLoginAttempts() > 0) || user.getLockedUntil() != null) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
            userRepository.save(user);
        }
    }

    private void ensureEmailVerified(User user) {
        if (!requireEmailVerifiedForSignin) {
            return;
        }
        if (!Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "api.error.auth.email_unverified");
        }
    }

    private String createToken(User user, String tokenType, long expirationMs) {
        Date now = new Date();
        List<VerificationToken> previousTokens = verificationTokenRepository.findByUserAndTokenTypeAndUsedAtIsNull(user, tokenType);
        for (VerificationToken existing : previousTokens) {
            existing.setUsedAt(now);
        }
        verificationTokenRepository.saveAll(previousTokens);

        VerificationToken token = new VerificationToken();
        token.setToken(UUID.randomUUID().toString());
        token.setTokenType(tokenType);
        token.setUser(user);
        token.setCreatedAt(now);
        token.setExpiresAt(new Date(now.getTime() + expirationMs));
        token.setUsedAt(null);
        return verificationTokenRepository.save(token).getToken();
    }

    private void validateUsableToken(VerificationToken token) {
        if (token.getUsedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.token_reused");
        }
        if (token.getExpiresAt() == null || !token.getExpiresAt().after(new Date())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.token_expired");
        }
    }

    private String buildFrontendLink(String path, String token) {
        String safeToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
        return frontendBaseUrl + path + "?token=" + safeToken;
    }

    private City resolveCityForNationality(String nationality, Integer cityId) {
        // If no nationality specified, don't require city
        if (nationality == null || nationality.trim().isEmpty()) {
            return null;
        }
        
        boolean tunisian = isTunisiaNationality(nationality);
        if (!tunisian) {
            return null;
        }
        
        // For Tunisian users, cityId is required
        if (cityId == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "api.error.auth.city_id_required");
        }
        // Plus besoin de Long.valueOf() si cityRepository accepte les Integer
        return cityRepository.findById(cityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "api.error.auth.invalid_city_id"));
    }

    private boolean isTunisiaNationality(String nationality) {
        if (nationality == null) {
            return false;
        }
        String normalized = nationality.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("tunisia")
                || normalized.equals("tunisian")
                || normalized.equals("tunisie")
                || normalized.equals("tunisien")
                || normalized.equals("tunisienne");
    }

    private User currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "api.error.unauthorized");
        }

        String username = authentication.getName();
        return userRepository.findFirstByUsernameIgnoreCaseOrderByUserIdAsc(username)
                .or(() -> userRepository.findFirstByEmailIgnoreCaseOrderByUserIdAsc(username))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "api.error.user_not_found"));
    }

    private void ensureNotBanned(User user) {
        banRepository.findTopByUserAndIsActiveTrueOrderByCreatedAtDesc(user)
                .ifPresent(ban -> {
                    if (!Boolean.TRUE.equals(ban.getIsActive())) {
                        return;
                    }
                    Date now = new Date();
                    if (ban.getExpiresAt() != null && !ban.getExpiresAt().after(now)) {
                        ban.setIsActive(false);
                        banRepository.save(ban);
                        return;
                    }
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "api.error.auth.account_banned");
                });
    }

    private UserSummaryResponse toUserSummary(User user) {
        Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        return new UserSummaryResponse(
                user.getUserId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                user.getNationality(),
                user.getCity() != null ? user.getCity().getCityId().intValue() : null,
                user.getCity() != null ? user.getCity().getName() : null,
                roles,
                user.getStatus(),
                Boolean.TRUE.equals(user.getArtisanRequestPending()),
                user.getProfileImageUrl(),
                user.getPoints()
        );
    }
}
