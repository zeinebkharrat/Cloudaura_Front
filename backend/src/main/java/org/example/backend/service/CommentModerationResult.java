package org.example.backend.service;

import java.util.Collections;
import java.util.List;

public record CommentModerationResult(
        String originalContent,
        String sanitizedContent,
        List<String> abuseCategories
) {
    public CommentModerationResult {
        abuseCategories = abuseCategories == null ? Collections.emptyList() : List.copyOf(abuseCategories);
    }
}
