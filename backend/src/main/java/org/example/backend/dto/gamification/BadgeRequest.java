package org.example.backend.dto.gamification;

import org.example.backend.model.LudificationGameKind;
public record BadgeRequest(String name, String description, String iconUrl, String targetGameId, LudificationGameKind targetGameKind) {}
