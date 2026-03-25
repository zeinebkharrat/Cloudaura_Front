package org.example.backend.service;

import org.example.backend.dto.AdminUserResponse;
import org.example.backend.dto.AdminUserRoleUpdateRequest;
import org.example.backend.dto.AdminUserUpdateRequest;
import org.example.backend.dto.ArtisanDecisionRequest;
import org.example.backend.model.Role;
import org.example.backend.model.User;
import org.example.backend.repository.RoleRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    public AdminUserService(UserRepository userRepository, RoleRepository roleRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }

    public List<AdminUserResponse> listUsers(String query) {
        List<User> users;
        if (query == null || query.isBlank()) {
            users = userRepository.findAll();
        } else {
            users = userRepository.searchByTerm(query.trim());
        }
        return users.stream().map(this::toAdminUserResponse).toList();
    }

    public AdminUserResponse getUser(Integer userId) {
        User user = getExistingUser(userId);
        return toAdminUserResponse(user);
    }

    @Transactional
    public AdminUserResponse updateUser(Integer userId, AdminUserUpdateRequest request) {
        User user = getExistingUser(userId);
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCaseAndUserIdNot(normalizedEmail, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already in use");
        }

        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setEmail(normalizedEmail);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setStatus(request.status().trim().toUpperCase(Locale.ROOT));

        return toAdminUserResponse(userRepository.save(user));
    }

    @Transactional
    public AdminUserResponse updateRoles(Integer userId, AdminUserRoleUpdateRequest request) {
        User user = getExistingUser(userId);
        Set<Role> updatedRoles = request.roles().stream()
                .map(roleName -> roleRepository.findByName(roleName)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown role: " + roleName)))
                .collect(Collectors.toSet());

        user.setRoles(updatedRoles);
        return toAdminUserResponse(userRepository.save(user));
    }

    @Transactional
    public AdminUserResponse reviewArtisanRequest(Integer userId, ArtisanDecisionRequest request) {
        User user = getExistingUser(userId);
        boolean approved = Boolean.TRUE.equals(request.approved());

        if (approved) {
            Role artisanRole = roleRepository.findByName("ROLE_ARTISANT")
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "ROLE_ARTISANT does not exist"));
            Set<Role> roles = user.getRoles();
            roles.add(artisanRole);
            user.setRoles(roles);
        }

        user.setArtisanRequestPending(false);
        return toAdminUserResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Integer userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        userRepository.deleteById(userId);
    }

    private User getExistingUser(Integer userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private AdminUserResponse toAdminUserResponse(User user) {
        Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        return new AdminUserResponse(
                user.getUserId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                user.getStatus(),
                Boolean.TRUE.equals(user.getArtisanRequestPending()),
                roles
        );
    }
}
