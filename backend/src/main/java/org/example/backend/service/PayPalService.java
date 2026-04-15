package org.example.backend.service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Service
@Slf4j
public class PayPalService implements IPaypalService {

    @Value("${paypal.client.id:}")
    private String clientId;

    @Value("${paypal.client.secret:}")
    private String secret;

    @Value("${paypal.base.url:https://api-m.sandbox.paypal.com}")
    private String baseUrl;

    private final WebClient webClient = WebClient.builder().build();

    private String getAccessToken() {
        String trimmedBase = baseUrl == null ? "" : baseUrl.trim();
        if (trimmedBase.endsWith("/")) {
            trimmedBase = trimmedBase.substring(0, trimmedBase.length() - 1);
        }
        String tokenUrl = trimmedBase + "/v1/oauth2/token";
        log.info("PayPal OAuth token request: POST {}", tokenUrl);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");

        try {
            Map<String, Object> response =
                    webClient
                            .post()
                            .uri(tokenUrl)
                            .headers(h -> {
                                h.setBasicAuth(
                                        clientId == null ? "" : clientId,
                                        secret == null ? "" : secret,
                                        StandardCharsets.UTF_8);
                                h.setAccept(List.of(MediaType.APPLICATION_JSON));
                                h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                            })
                            .body(BodyInserters.fromFormData(form))
                            .retrieve()
                            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                            .block();

            if (response == null || !response.containsKey("access_token")) {
                log.error("PayPal OAuth response missing access_token");
                throw new IllegalStateException("PayPal OAuth response invalid");
            }
            String token = String.valueOf(response.get("access_token"));
            log.info("PayPal OAuth token obtained (length={})", token.length());
            return token;
        } catch (WebClientResponseException e) {
            log.error(
                    "PayPal OAuth failed status={} body={}",
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
            throw new IllegalStateException("PayPal OAuth failed: " + e.getStatusCode(), e);
        }
    }

    @Override
    public Map<String, Object> createOrder(String amountUsd, String returnUrl, String cancelUrl) {
        String accessToken = getAccessToken();
        String trimmedBase = baseUrl == null ? "" : baseUrl.trim();
        if (trimmedBase.endsWith("/")) {
            trimmedBase = trimmedBase.substring(0, trimmedBase.length() - 1);
        }
        String ordersUrl = trimmedBase + "/v2/checkout/orders";

        Map<String, Object> amountMap = new LinkedHashMap<>();
        amountMap.put("currency_code", "USD");
        amountMap.put("value", amountUsd);

        Map<String, Object> unit = new LinkedHashMap<>();
        unit.put("amount", amountMap);
        unit.put("description", "YallaTN Transport Reservation");

        Map<String, Object> appCtx = new LinkedHashMap<>();
        appCtx.put("return_url", returnUrl);
        appCtx.put("cancel_url", cancelUrl);
        appCtx.put("user_action", "PAY_NOW");
        appCtx.put("brand_name", "YallaTN+");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("intent", "CAPTURE");
        body.put("purchase_units", List.of(unit));
        body.put("application_context", appCtx);

        log.info("PayPal create order: POST {} amountUsd={}", ordersUrl, amountUsd);

        try {
            Map<String, Object> response =
                    webClient
                            .post()
                            .uri(ordersUrl)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .accept(MediaType.APPLICATION_JSON)
                            .bodyValue(body)
                            .retrieve()
                            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                            .block();

            if (response == null) {
                log.error("PayPal create order returned null body");
                throw new IllegalStateException("PayPal create order returned empty response");
            }

            Object idObj = response.get("id");
            String orderId = idObj != null ? idObj.toString() : "";
            log.info("PayPal order created: {}", orderId);

            extractApprovalHref(response).ifPresent(href -> log.info("PayPal approve link present for order {}", orderId));

            return response;
        } catch (WebClientResponseException e) {
            log.error(
                    "PayPal create order failed status={} body={}",
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
            throw new IllegalStateException("PayPal create order failed: " + e.getStatusCode(), e);
        }
    }

    @Override
    public Map<String, Object> captureOrder(String orderId) {
        String accessToken = getAccessToken();
        String trimmedBase = baseUrl == null ? "" : baseUrl.trim();
        if (trimmedBase.endsWith("/")) {
            trimmedBase = trimmedBase.substring(0, trimmedBase.length() - 1);
        }
        String captureUrl = trimmedBase + "/v2/checkout/orders/" + orderId + "/capture";
        log.info("PayPal capture: POST {}", captureUrl);

        try {
            Map<String, Object> response =
                    webClient
                            .post()
                            .uri(captureUrl)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .accept(MediaType.APPLICATION_JSON)
                            .bodyValue(Map.of())
                            .retrieve()
                            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                            .block();

            if (response == null) {
                log.error("PayPal capture returned null body for orderId={}", orderId);
                throw new IllegalStateException("PayPal capture returned empty response");
            }

            Object st = response.get("status");
            String status = st != null ? st.toString() : "";
            log.info("PayPal order captured: {} status: {}", orderId, status);

            return response;
        } catch (WebClientResponseException e) {
            log.error(
                    "PayPal capture failed orderId={} status={} body={}",
                    orderId,
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
            throw new IllegalStateException("PayPal capture failed: " + e.getStatusCode(), e);
        }
    }

    /** Visible for PayPalController to resolve approval redirect. */
    public static String extractApprovalUrl(Map<String, Object> orderResponse) {
        return extractApprovalHref(orderResponse).orElse(null);
    }

    @SuppressWarnings("unchecked")
    private static java.util.Optional<String> extractApprovalHref(Map<String, Object> orderResponse) {
        Object links = orderResponse.get("links");
        if (!(links instanceof List<?> rawList)) {
            return java.util.Optional.empty();
        }
        for (Object o : rawList) {
            if (o instanceof Map<?, ?> m) {
                Object rel = m.get("rel");
                if ("approve".equals(rel != null ? rel.toString() : "")) {
                    Object href = m.get("href");
                    if (href != null && !href.toString().isBlank()) {
                        return java.util.Optional.of(href.toString());
                    }
                }
            }
        }
        return java.util.Optional.empty();
    }

    public static String formatUsdFromTnd(double amountTnd) {
        double usd = java.math.BigDecimal.valueOf(amountTnd)
                .multiply(java.math.BigDecimal.valueOf(0.32))
                .setScale(2, java.math.RoundingMode.HALF_UP)
                .doubleValue();
        return String.format(Locale.US, "%.2f", usd);
    }
}
