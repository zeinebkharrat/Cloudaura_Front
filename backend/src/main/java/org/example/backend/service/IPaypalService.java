package org.example.backend.service;

import java.util.Map;

/**
 * PayPal REST v2 via WebClient (no PayPal SDK). {@code returnUrl} must include any query params
 * required after approval (e.g. {@code method=paypal&reservationId=…}).
 */
public interface IPaypalService {

    Map<String, Object> createOrder(String amountUsd, String returnUrl, String cancelUrl);

    Map<String, Object> captureOrder(String orderId);
}
