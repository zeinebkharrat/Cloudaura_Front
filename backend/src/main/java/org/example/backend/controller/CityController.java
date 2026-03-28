package org.example.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityRequest;
import org.example.backend.repository.CityRepository;
import org.example.backend.dto.CityResponse;
import org.example.backend.dto.PageResponse;
import org.example.backend.service.CityService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CityController {

    private final CityRepository cityRepository;
    private final CityService cityService;

    @GetMapping("/api/cities")
    public List<CityResponse> listPublicCities() {
        return cityRepository.findAll().stream()
                .map(city -> new CityResponse(
                        city.getCityId(),
                        city.getName(),
                        city.getRegion(),
                        city.getDescription(),
                        city.getLatitude(),
                        city.getLongitude()
                ))
                .toList();
    }

    @GetMapping("/api/admin/cities")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public PageResponse<CityResponse> list(@RequestParam(required = false) String q,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "10") int size,
                                           @RequestParam(defaultValue = "cityId,desc") String sort) {
        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(cityService.list(q, pageable));
    }

    @GetMapping("/api/admin/cities/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public CityResponse get(@PathVariable Integer id) {
        return cityService.getById(id);
    }

    @PostMapping("/api/admin/cities")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<CityResponse> create(@Valid @RequestBody CityRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cityService.create(request));
    }

    @PutMapping("/api/admin/cities/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public CityResponse update(@PathVariable Integer id, @Valid @RequestBody CityRequest request) {
        return cityService.update(id, request);
    }

    @DeleteMapping("/api/admin/cities/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        cityService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Pageable buildPageable(int page, int size, String sort) {
        String[] sortParts = sort.split(",");
        String sortBy = sortParts[0].trim();
        Sort.Direction direction = (sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1]))
                ? Sort.Direction.DESC
                : Sort.Direction.ASC;
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(direction, sortBy));
    }
}
