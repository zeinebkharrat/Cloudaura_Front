package org.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.Optional;
import org.example.backend.model.TranslationCache;
import org.example.backend.repository.TranslationCacheRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
class TranslationServiceTest {

    @Mock
    private TranslationCacheRepository translationCacheRepository;

    @Mock
    private RestTemplate restTemplate;

    private TranslationService translationService;

    @BeforeEach
    void setUp() {
        translationService = new TranslationService(new ObjectMapper(), translationCacheRepository);
        ReflectionTestUtils.setField(translationService, "myMemoryClient", restTemplate);
        ReflectionTestUtils.setField(translationService, "mymemoryUrl", "https://api.mymemory.translated.net/get");
        ReflectionTestUtils.setField(translationService, "contactEmail", "");
        ReflectionTestUtils.setField(translationService, "dailyWordLimit", 4500);
    }

    @Test
    void translate_doesNotCallProviderForCatalogKey() throws Exception {
        String key = "activity.6.description";
        assertEquals(key, translationService.translate(key, "fr", "en"));
        verifyNoInteractions(restTemplate);
        verify(translationCacheRepository, never()).findByCacheKey(anyString());
        verify(translationCacheRepository, never()).save(any(TranslationCache.class));
    }

    @Test
    void translate_usesMyMemoryForPlainText() throws Exception {
        when(translationCacheRepository.findByCacheKey(anyString())).thenReturn(Optional.empty());
        when(restTemplate.getForObject(any(URI.class), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn(
                        "{\"responseStatus\":200,\"responseData\":{\"translatedText\":\"parc saut\"}}");

        String out = translationService.translate("jump park", "fr", "en");
        assertEquals("parc saut", out);
        verify(translationCacheRepository).save(any(TranslationCache.class));
    }

    @Test
    void safeTranslate_mapsAutoSourceToDefaultAndCallsProvider() {
        ReflectionTestUtils.setField(translationService, "defaultSourceLang", "fr");
        when(translationCacheRepository.findByCacheKey(org.mockito.ArgumentMatchers.eq("fr|en|Randonnée")))
                .thenReturn(Optional.empty());
        when(restTemplate.getForObject(any(URI.class), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn("{\"responseStatus\":200,\"responseData\":{\"translatedText\":\"Hike\"}}");

        String out = translationService.safeTranslate("Randonnée", "en");
        assertEquals("Hike", out);
        verify(translationCacheRepository).save(any(TranslationCache.class));
    }

    @Test
    void translate_parsesStringResponseStatus() throws Exception {
        when(translationCacheRepository.findByCacheKey(anyString())).thenReturn(Optional.empty());
        when(restTemplate.getForObject(any(URI.class), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn(
                        "{\"responseData\":{\"translatedText\":\"x\"},\"responseStatus\":\"403\",\"responseDetails\":\"quota\"}");

        org.junit.jupiter.api.Assertions.assertThrows(
                IllegalStateException.class, () -> translationService.translate("a", "fr", "en"));
    }
}
