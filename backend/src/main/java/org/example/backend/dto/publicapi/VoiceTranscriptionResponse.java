package org.example.backend.dto.publicapi;

public record VoiceTranscriptionResponse(
    String text,
    String detectedLanguage,
    String provider
) {
}
