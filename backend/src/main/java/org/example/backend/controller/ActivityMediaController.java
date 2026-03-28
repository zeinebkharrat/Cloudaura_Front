package org.example.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.ActivityMediaRequest;
import org.example.backend.dto.ActivityMediaResponse;
import org.example.backend.dto.PageResponse;
import org.example.backend.model.MediaType;
import org.example.backend.service.ActivityMediaService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/activity-media")
@RequiredArgsConstructor
public class ActivityMediaController {

    private final ActivityMediaService activityMediaService;

    @GetMapping
    public PageResponse<ActivityMediaResponse> list(
        @RequestParam(required = false) Integer activityId,
        @RequestParam(required = false) String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "mediaId,desc") String sort
    ) {
        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(activityMediaService.list(activityId, q, pageable));
    }

    @GetMapping("/{id}")
    public ActivityMediaResponse get(@PathVariable Integer id) {
        return activityMediaService.getById(id);
    }

    @PostMapping
    public ResponseEntity<ActivityMediaResponse> create(@Valid @RequestBody ActivityMediaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(activityMediaService.create(request));
    }

    @PostMapping(value = "/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ActivityMediaResponse> upload(
        @RequestParam Integer activityId,
        @RequestParam(defaultValue = "IMAGE") MediaType mediaType,
        @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(activityMediaService.upload(activityId, mediaType, file));
    }

    @PutMapping("/{id}")
    public ActivityMediaResponse update(@PathVariable Integer id, @Valid @RequestBody ActivityMediaRequest request) {
        return activityMediaService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        activityMediaService.delete(id);
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
