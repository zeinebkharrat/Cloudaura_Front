package org.example.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.CityMediaRequest;
import org.example.backend.dto.CityMediaResponse;
import org.example.backend.dto.PageResponse;
import org.example.backend.model.MediaType;
import org.example.backend.service.CityMediaService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/city-media")
@RequiredArgsConstructor
public class CityMediaController {

    private final CityMediaService cityMediaService;

    @GetMapping
    public PageResponse<CityMediaResponse> list(
        @RequestParam(required = false) Integer cityId,
        @RequestParam(required = false) String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "mediaId,desc") String sort
    ) {
        Pageable pageable = buildPageable(page, size, sort);
        return PageResponse.from(cityMediaService.list(cityId, q, pageable));
    }

    @GetMapping("/{id}")
    public CityMediaResponse get(@PathVariable Integer id) {
        return cityMediaService.getById(id);
    }

    @PostMapping
    public ResponseEntity<CityMediaResponse> create(@Valid @RequestBody CityMediaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cityMediaService.create(request));
    }

    @PostMapping(value = "/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CityMediaResponse> upload(
        @RequestParam Integer cityId,
        @RequestParam(defaultValue = "IMAGE") MediaType mediaType,
        @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cityMediaService.upload(cityId, mediaType, file));
    }

    @PutMapping("/{id}")
    public CityMediaResponse update(@PathVariable Integer id, @Valid @RequestBody CityMediaRequest request) {
        return cityMediaService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        cityMediaService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Pageable buildPageable(int page, int size, String sort) {
        String[] sortParts = sort.split(",");
        String sortBy = sortParts[0].trim();
        Sort.Direction direction = (sortParts.length > 1 && "desc".equalsIgnoreCase(sortParts[1]))
            ? Sort.Direction.DESC
            : Sort.Direction.ASC;
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 250), Sort.by(direction, sortBy));
    }
}
