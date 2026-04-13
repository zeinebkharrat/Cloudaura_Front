package org.example.backend.controller;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import org.example.backend.dto.currency.CurrencyConvertResponse;
import org.example.backend.dto.currency.CurrencyRatesResponse;
import org.example.backend.service.CurrencyService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * Currency conversion for display only — amounts in the database stay in TND.
 * Primary path: {@code GET /api/currency/convert} (proxied by the Angular dev server as {@code /api/...}).
 */
@RestController
@RequestMapping("/api/currency")
@Validated
public class CurrencyController {

    private final CurrencyService currencyService;

    public CurrencyController(CurrencyService currencyService) {
        this.currencyService = currencyService;
    }

    /**
     * Example: {@code /api/currency/convert?to=EUR&amount=100}
     */
    @GetMapping("/convert")
    public CurrencyConvertResponse convert(
            @RequestParam("to") @NotBlank String to,
            @RequestParam("amount") @DecimalMin(value = "0.0", inclusive = true) BigDecimal amount
    ) {
        return currencyService.convert(to, amount);
    }

    @GetMapping("/rates")
    public CurrencyRatesResponse rates() {
        return currencyService.getRatesSnapshot();
    }
}
