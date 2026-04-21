package org.example.backend.dto.flight;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FlightBookingRequest {

    @NotBlank
    private String offerId;

    @NotBlank
    private String givenName;

    @NotBlank
    private String familyName;

    @Email
    @NotBlank
    private String email;

    private String phoneNumber;
    private String bornOn;
}
