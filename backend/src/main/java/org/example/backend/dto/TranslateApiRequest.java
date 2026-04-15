package org.example.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class TranslateApiRequest {
    @NotNull
    @Size(max = 500)
    private String text;

    /** ISO-ish code, e.g. en, fr, ar, or "auto" */
    @Size(max = 10)
    private String sourceLang = "auto";

    @Size(max = 10)
    private String targetLang = "en";

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getSourceLang() {
        return sourceLang;
    }

    public void setSourceLang(String sourceLang) {
        this.sourceLang = sourceLang;
    }

    public String getTargetLang() {
        return targetLang;
    }

    public void setTargetLang(String targetLang) {
        this.targetLang = targetLang;
    }
}
