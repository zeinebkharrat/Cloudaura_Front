package org.example.backend.service;

import org.example.backend.dto.AuthResponse;
import org.example.backend.dto.LoginRequest;
import org.example.backend.dto.SignupRequest;
import org.example.backend.dto.UserSummaryResponse;
import org.example.backend.model.Role;
import org.example.backend.model.User;
import org.example.backend.repository.RoleRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final String DEFAULT_ROLE = "ROLE_USER";
    private static final String ROLE_ARTISANT = "ROLE_ARTISANT";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder,
                       @Lazy AuthenticationManager authenticationManager,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already in use");
        }

        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already in use");
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
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setStatus("ACTIVE");
        user.setCreatedAt(new Date());
        user.setPoints(0);
        boolean becomeArtisant = Boolean.TRUE.equals(request.becomeArtisant());
        user.setArtisanRequestPending(becomeArtisant);
        user.setArtisanRequestedAt(becomeArtisant ? new Date() : null);
        user.setAuthProvider("LOCAL");
        user.setRoles(Set.of(userRole));

        User savedUser = userRepository.save(user);
        UserDetails principal = toUserDetails(savedUser);
        String token = jwtService.generateToken(principal);

        return new AuthResponse(token, jwtService.getExpirationMs(), toUserSummary(savedUser));
    }

    public AuthResponse signin(LoginRequest request) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.identifier(), request.password())
            );
        } catch (BadCredentialsException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        UserDetails principal = (UserDetails) authentication.getPrincipal();
        User user = userRepository.findByUsernameIgnoreCase(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        String token = jwtService.generateToken(principal);
        return new AuthResponse(token, jwtService.getExpirationMs(), toUserSummary(user));
    }

    public UserSummaryResponse me() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toUserSummary(user);
    }

    @Transactional
    public AuthResponse processSocialLogin(OAuth2User oauth2User, String provider) {
        String email = oauth2User.getAttribute("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required from social provider");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        String firstName = extractFirstName(oauth2User);
        String lastName = extractLastName(oauth2User);

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseGet(() -> createSocialUser(normalizedEmail, firstName, lastName, provider));

        if (user.getFirstName() == null || user.getFirstName().isBlank()) {
            user.setFirstName(firstName);
        }
        if (user.getLastName() == null || user.getLastName().isBlank()) {
            user.setLastName(lastName);
        }
        if (user.getAuthProvider() == null || user.getAuthProvider().isBlank()) {
            user.setAuthProvider(provider.toUpperCase(Locale.ROOT));
        }
        userRepository.save(user);

        UserDetails principal = toUserDetails(user);
        String token = jwtService.generateToken(principal);
        return new AuthResponse(token, jwtService.getExpirationMs(), toUserSummary(user));
    }

    private User createSocialUser(String email, String firstName, String lastName, String provider) {
        Role userRole = roleRepository.findByName(DEFAULT_ROLE)
                .orElseGet(() -> {
                    Role role = new Role();
                    role.setName(DEFAULT_ROLE);
                    return roleRepository.save(role);
                });

        User user = new User();
        user.setUsername(generateUniqueUsername(email));
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
        user.setRoles(Set.of(userRole));
        return userRepository.save(user);
    }

    private String generateUniqueUsername(String email) {
        String localPart = email.split("@")[0].replaceAll("[^a-zA-Z0-9._-]", "");
        String base = localPart.isBlank() ? "user" : localPart;
        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + suffix;
            suffix++;
        }
        return candidate;
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
        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .authorities(user.getRoles().stream().map(Role::getName).toArray(String[]::new))
                .build();
    }

    private UserSummaryResponse toUserSummary(User user) {
        Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        return new UserSummaryResponse(
                user.getUserId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                roles,
                user.getStatus(),
                Boolean.TRUE.equals(user.getArtisanRequestPending())
        );
    }
}
