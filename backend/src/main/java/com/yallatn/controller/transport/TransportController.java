package com.yallatn.controller.transport;

import com.yallatn.dto.ApiResponse;
import com.yallatn.dto.transport.TransportSearchRequest;
import com.yallatn.dto.transport.TransportSearchResponse;
import com.yallatn.model.transport.Transport;
import com.yallatn.service.transport.TransportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/transports")
@RequiredArgsConstructor
public class TransportController {
    private final TransportService transportService;

    @GetMapping("/search")
    public ApiResponse<List<TransportSearchResponse>> search(
            @RequestParam int departureCityId,
            @RequestParam int arrivalCityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate travelDate,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") int numberOfPassengers) {
        
        TransportSearchRequest request = TransportSearchRequest.builder()
                .departureCityId(departureCityId)
                .arrivalCityId(arrivalCityId)
                .travelDate(travelDate)
                .type(type)
                .numberOfPassengers(numberOfPassengers)
                .build();
        
        return ApiResponse.success(transportService.searchTransports(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<TransportSearchResponse> getById(@PathVariable int id) {
        return ApiResponse.success(transportService.getTransportById(id));
    }

    @GetMapping("/types")
    public ApiResponse<List<String>> getTypes() {
        return ApiResponse.success(Arrays.stream(Transport.TransportType.values())
                .map(Enum::name)
                .collect(Collectors.toList()));
    }
}
