package org.example.backend.dto.publicapi;

import java.util.List;

public record ChatbotConversationResponse(
    List<String> conversation
) {
}
