package org.example.backend.dto.currency;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collections;
import java.util.Map;

/**
 * Subset of ExchangeRate-API v6 "Standard" latest response.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ExchangeRateApiLatestResponse {

    private String result;

    @JsonProperty("error-type")
    private String errorType;

    @JsonProperty("base_code")
    private String baseCode;

    @JsonProperty("conversion_rates")
    private Map<String, Double> conversionRates = Collections.emptyMap();

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public String getErrorType() {
        return errorType;
    }

    public void setErrorType(String errorType) {
        this.errorType = errorType;
    }

    public String getBaseCode() {
        return baseCode;
    }

    public void setBaseCode(String baseCode) {
        this.baseCode = baseCode;
    }

    public Map<String, Double> getConversionRates() {
        return conversionRates != null ? conversionRates : Collections.emptyMap();
    }

    public void setConversionRates(Map<String, Double> conversionRates) {
        this.conversionRates = conversionRates != null ? conversionRates : Collections.emptyMap();
    }
}
