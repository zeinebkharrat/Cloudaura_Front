package org.example.backend.dto;

public class TranslateApiResponse {
    private String translatedText;
    private String sourceLang;
    private String targetLang;

    public TranslateApiResponse() {
    }

    public TranslateApiResponse(String translatedText, String sourceLang, String targetLang) {
        this.translatedText = translatedText;
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
    }

    public String getTranslatedText() {
        return translatedText;
    }

    public void setTranslatedText(String translatedText) {
        this.translatedText = translatedText;
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
