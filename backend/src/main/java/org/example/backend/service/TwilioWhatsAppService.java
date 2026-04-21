package org.example.backend.service;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/*
 * TWILIO WHATSAPP SANDBOX SETUP:
 * 1. Go to twilio.com → sign up free
 * 2. Console → Messaging → Try it out → Send a WhatsApp message
 * 3. Scan QR code with your WhatsApp app
 * 4. Send "join [sandbox-code]" to whatsapp:+14155238886
 * 5. Copy from twilio.com/console:
 *    Account SID → twilio.account-sid
 *    Auth Token  → twilio.auth-token
 * 6. Set twilio.enabled=true in application-local.properties
 * 7. Sandbox buyer phone must have joined the sandbox first
 */
@Service
@Slf4j
public class TwilioWhatsAppService {

    @Value("${twilio.enabled:false}")
    private boolean enabled;

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${twilio.whatsapp-from:whatsapp:+14155238886}")
    private String whatsappFrom;

    private volatile boolean initialized = false;

    @PostConstruct
    public void init() {
        if (!enabled) {
            log.info("Twilio disabled");
            return;
        }
        if (accountSid == null || accountSid.isBlank() || "YOUR_ACCOUNT_SID".equals(accountSid)) {
            log.warn("Twilio enabled but account-sid is missing or placeholder; Twilio.init skipped");
            return;
        }
        if (authToken == null || authToken.isBlank() || "YOUR_AUTH_TOKEN".equals(authToken)) {
            log.warn("Twilio enabled but auth-token is missing or placeholder; Twilio.init skipped");
            return;
        }
        if (whatsappFrom == null || whatsappFrom.isBlank()) {
            log.warn("Twilio enabled but whatsapp-from is blank; Twilio.init skipped");
            return;
        }
        Twilio.init(accountSid.trim(), authToken.trim());
        initialized = true;
        log.info("Twilio initialized");
    }

    public void sendWhatsApp(String toPhone, String message) {
        if (!enabled) {
            log.debug("Twilio disabled; skip WhatsApp send");
            return;
        }
        if (!initialized) {
            log.warn("Twilio skipped: service not initialized");
            return;
        }
        if (toPhone == null || toPhone.isBlank()) {
            log.warn("WhatsApp skipped: recipient phone is blank");
            return;
        }
        if (message == null || message.isBlank()) {
            log.debug("WhatsApp skipped: message is blank");
            return;
        }
        try {
            String formatted = formatTunisianPhone(toPhone);
            if (formatted == null || formatted.isBlank()) {
                log.warn("WhatsApp skipped: could not format phone");
                return;
            }
            String toAddress = formatted.startsWith("whatsapp:") ? formatted : "whatsapp:" + formatted;
            String sender = whatsappFrom == null ? "" : whatsappFrom.trim();
            if (sender.isBlank()) {
                log.warn("WhatsApp skipped: sender is blank");
                return;
            }
            String fromAddress = sender.startsWith("whatsapp:")
                    ? sender
                    : "whatsapp:" + sender.replace("whatsapp:", "");

            Message.creator(new PhoneNumber(toAddress), new PhoneNumber(fromAddress), message).create();
            log.info("WhatsApp sent to {}", maskPhone(formatted));
        } catch (Exception e) {
            log.error("WhatsApp send failed for toPhone={}: {}", maskPhone(toPhone), e.getMessage());
        }
    }

    static String formatTunisianPhone(String phone) {
        if (phone == null) {
            return "";
        }
        StringBuilder keep = new StringBuilder();
        for (int i = 0; i < phone.length(); i++) {
            char c = phone.charAt(i);
            if (c == '+' || Character.isDigit(c)) {
                keep.append(c);
            }
        }
        String s = keep.toString();
        if (s.startsWith("+")) {
            return s;
        }
        String digits = s.replace("+", "");
        if (digits.startsWith("216")) {
            return "+" + digits;
        }
        if (digits.length() == 8) {
            return "+216" + digits;
        }
        if (digits.length() >= 8 && digits.length() <= 15) {
            return "+" + digits;
        }
        return "";
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return "***";
        }
        return phone.substring(0, 2) + "…" + phone.substring(phone.length() - 2);
    }
}
