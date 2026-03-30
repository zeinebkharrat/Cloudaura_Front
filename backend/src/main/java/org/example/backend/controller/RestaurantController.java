package org.example.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.PageResponse;
import org.example.backend.dto.RestaurantRequest;
import org.example.backend.dto.RestaurantResponse;
import org.example.backend.service.RestaurantService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/restaurants")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;

    @GetMapping
    public PageResponse<RestaurantResponse> list(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String cuisineType,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "restaurantId,desc") String sort
    ) {
        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(restaurantService.list(q, null, cuisineType, pageable));
    }

    @GetMapping("/{id}")
    public RestaurantResponse get(@PathVariable Integer id) {
        return restaurantService.getById(id);
    }

    @PostMapping
    public ResponseEntity<RestaurantResponse> create(@Valid @RequestBody RestaurantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(restaurantService.create(request));
    }

    @PutMapping("/{id}")
    public RestaurantResponse update(@PathVariable Integer id, @Valid @RequestBody RestaurantRequest request) {
        return restaurantService.update(id, request);
    }

    @PostMapping(value = "/{id}/upload-image", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RestaurantResponse> uploadImage(
        @PathVariable Integer id,
        @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(restaurantService.uploadImage(id, file));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        restaurantService.delete(id);
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