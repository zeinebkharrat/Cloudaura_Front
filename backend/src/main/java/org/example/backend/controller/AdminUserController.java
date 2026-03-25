package org.example.backend.controller;

import jakarta.validation.Valid;
import org.example.backend.dto.AdminUserResponse;
import org.example.backend.dto.AdminUserRoleUpdateRequest;
import org.example.backend.dto.AdminUserUpdateRequest;
import org.example.backend.dto.ArtisanDecisionRequest;
import org.example.backend.service.AdminUserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public List<AdminUserResponse> listUsers(@RequestParam(required = false) String q) {
        return adminUserService.listUsers(q);
    }

    @GetMapping("/{userId}")
    public AdminUserResponse getUser(@PathVariable Integer userId) {
        return adminUserService.getUser(userId);
    }

    @PutMapping("/{userId}")
    public AdminUserResponse updateUser(@PathVariable Integer userId,
                                        @Valid @RequestBody AdminUserUpdateRequest request) {
        return adminUserService.updateUser(userId, request);
    }

    @PatchMapping("/{userId}/roles")
    public AdminUserResponse updateRoles(@PathVariable Integer userId,
                                         @Valid @RequestBody AdminUserRoleUpdateRequest request) {
        return adminUserService.updateRoles(userId, request);
    }

    @PatchMapping("/{userId}/artisan-review")
    public AdminUserResponse reviewArtisanRequest(@PathVariable Integer userId,
                                                  @Valid @RequestBody ArtisanDecisionRequest request) {
        return adminUserService.reviewArtisanRequest(userId, request);
    }

    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable Integer userId) {
        adminUserService.deleteUser(userId);
    }
}
