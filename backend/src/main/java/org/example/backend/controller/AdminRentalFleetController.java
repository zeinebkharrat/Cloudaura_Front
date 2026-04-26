package org.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ApiResponse;
import org.example.backend.dto.admin.AdminRentalFleetCarDto;
import org.example.backend.dto.admin.AdminRentalFleetCarUpsertRequest;
import org.example.backend.dto.admin.AdminRentalFleetStatsDto;
import org.example.backend.service.car.AdminRentalFleetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Admin CRUD for internal Tunisia rental catalogue ({@code rental_fleet_cars}).
 * Secured by {@code /api/admin/**} → ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/admin/rental-fleet")
@RequiredArgsConstructor
public class AdminRentalFleetController {

    private final AdminRentalFleetService adminRentalFleetService;

    public record RentalFleetStatusBody(Boolean isActive) {}

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ApiResponse<AdminRentalFleetStatsDto> stats() {
        return ApiResponse.success(adminRentalFleetService.stats());
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<List<AdminRentalFleetCarDto>> list() {
        return ApiResponse.success(adminRentalFleetService.listAll());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ApiResponse<AdminRentalFleetCarDto> get(@PathVariable int id) {
        return ApiResponse.success(adminRentalFleetService.get(id));
    }

    @PostMapping
    @Transactional
    public ApiResponse<AdminRentalFleetCarDto> create(@RequestBody AdminRentalFleetCarUpsertRequest body) {
        return ApiResponse.success(adminRentalFleetService.create(body));
    }

    @PutMapping("/{id}")
    @Transactional
    public ApiResponse<AdminRentalFleetCarDto> update(
            @PathVariable int id, @RequestBody AdminRentalFleetCarUpsertRequest body) {
        return ApiResponse.success(adminRentalFleetService.update(id, body));
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ApiResponse<AdminRentalFleetCarDto> setStatus(
            @PathVariable int id, @RequestBody RentalFleetStatusBody body) {
        if (body == null || body.isActive() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "admin.rental_fleet.status_required");
        }
        return ApiResponse.success(adminRentalFleetService.setActive(id, body.isActive()));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable int id) {
        boolean hardDeleted = adminRentalFleetService.deleteOrDeactivate(id);
        if (hardDeleted) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(ApiResponse.success(
                null,
                "This vehicle still has booking history. It was deactivated instead of being permanently removed."));
    }
}
