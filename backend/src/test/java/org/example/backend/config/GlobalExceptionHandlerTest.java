package org.example.backend.config;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.example.backend.dto.ApiResponse;
import org.example.backend.exception.InvalidInputException;
import org.example.backend.service.CatalogTranslationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @Mock
    private CatalogTranslationService catalogTranslationService;

    private GlobalExceptionHandler handler;
    private ListAppender<ILoggingEvent> logAppender;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler(catalogTranslationService);

        Logger logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        logAppender = new ListAppender<>();
        logAppender.start();
        logger.addAppender(logAppender);
    }

    @AfterEach
    void tearDown() {
        Logger logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        logger.detachAppender(logAppender);
        logAppender.stop();
    }

    @Test
    void handleIllegalArgument_exposableException_forwardsSafeMessage() {
        InvalidInputException ex = new InvalidInputException(
                "api.error.flight.validation.iata",
                "dep must be a valid IATA code (3 letters)");

        ResponseEntity<ApiResponse<Void>> response = handler.handleIllegalArgument(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("dep must be a valid IATA code (3 letters)", response.getBody().getMessage());
        assertEquals("api.error.flight.validation.iata", response.getBody().getErrorCode());
        verifyNoInteractions(catalogTranslationService);
    }

    @Test
    void handleIllegalArgument_rawException_returnsGenericMessageAndLogsFullDetails() {
        when(catalogTranslationService.resolveForRequest("api.error.invalid_payload", "Corps de requête invalide"))
                .thenReturn("Corps de requête invalide");

        IllegalArgumentException ex = new IllegalArgumentException("sensitive internal detail");
        ResponseEntity<ApiResponse<Void>> response = handler.handleIllegalArgument(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Corps de requête invalide", response.getBody().getMessage());
        assertEquals("api.error.invalid_payload", response.getBody().getErrorCode());

        List<ILoggingEvent> logs = logAppender.list;
        assertTrue(logs.stream().anyMatch(e ->
                e.getFormattedMessage().contains("sensitive internal detail") && e.getThrowableProxy() != null));
    }
}
