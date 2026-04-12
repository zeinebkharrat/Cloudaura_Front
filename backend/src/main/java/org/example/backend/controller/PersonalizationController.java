package org.example.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.backend.dto.personalization.PersonalizedRecommendationsResponse;
import org.example.backend.dto.personalization.PreferenceSurveyRequest;
import org.example.backend.service.PersonalizationService;
import org.example.backend.service.UserIdentityResolver;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/personalization")
@RequiredArgsConstructor
public class PersonalizationController {

    private final PersonalizationService personalizationService;
    private final UserIdentityResolver userIdentityResolver;

    @PutMapping("/preferences")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void savePreferences(@Valid @RequestBody PreferenceSurveyRequest request,
                                Authentication authentication) {
        Integer userId = requireUserId(authentication);
        personalizationService.savePreferences(userId, request);
    }

    @GetMapping("/recommendations")
    public PersonalizedRecommendationsResponse recommendations(Authentication authentication) {
        Integer userId = requireUserId(authentication);
        return personalizationService.getRecommendations(userId);
    }

    @GetMapping("/status")
    public Map<String, Boolean> status(Authentication authentication) {
        Integer userId = requireUserId(authentication);
        boolean completed = personalizationService.getRecommendations(userId).preferencesCompleted();
        return Map.of("preferencesCompleted", completed);
    }

    private Integer requireUserId(Authentication authentication) {
        Integer userId = userIdentityResolver.resolveUserId(authentication);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return userId;
    }
}
