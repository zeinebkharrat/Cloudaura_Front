package org.example.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender userMailSender;
    private final JavaMailSender shopMailSender;
    private final InternetAddress userFromAddress;
    private final InternetAddress shopFromAddress;
    private final String frontendBaseUrl;

    public EmailService(
            JavaMailSender userMailSender,
            @Qualifier("shopMailSender") JavaMailSender shopMailSender,
            @Value("${app.mail.from.name:YallaTN+}") String userFromName,
            @Value("${app.mail.from.address:${spring.mail.username}}") String userFromEmail,
            @Value("${app.shop.mail.from.name:YallaTN}") String shopFromName,
            @Value("${app.shop.mail.from.address:${app.shop.mail.username}}") String shopFromEmail,
            @Value("${app.frontend.base-url:http://localhost:4200}") String frontendBaseUrl) {
        this.userMailSender = userMailSender;
        this.shopMailSender = shopMailSender;
        this.frontendBaseUrl = normalizeBaseUrl(frontendBaseUrl);
        this.userFromAddress = buildFrom(userFromEmail, userFromName, "YallaTN+");
        this.shopFromAddress = buildFrom(shopFromEmail, shopFromName, "YallaTN");
    }

    private static InternetAddress buildFrom(String email, String name, String fallbackName) {
        String e = (email != null && !email.isBlank()) ? email.trim() : "no-reply@localhost";
        String n = (name != null && !name.isBlank()) ? name.trim() : fallbackName;
        try {
            return new InternetAddress(e, n, StandardCharsets.UTF_8.name());
        } catch (UnsupportedEncodingException ex) {
            throw new IllegalStateException("Invalid mail from address: " + e, ex);
        }
    }

    private static String normalizeBaseUrl(String url) {
        if (url == null || url.isBlank()) {
            return "http://localhost:4200";
        }
        String t = url.trim();
        if (t.endsWith("/")) {
            return t.substring(0, t.length() - 1);
        }
        return t;
    }

    public void sendVerificationEmail(String toEmail, String firstName, String verificationLink) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = "YallaTN+ — Verify your account";
        String title = "Welcome to YallaTN+";
        String preheader = "Confirm your email to activate your account.";
        String plainText = "Hi " + displayName + ",\n\n"
                + "Welcome to YallaTN+!\n"
                + "Click this link to verify your account:\n"
                + verificationLink + "\n\n"
                + "This link expires in 24 hours.\n\n"
                + "The YallaTN+ team";
        String html = buildTravelEmailHtml(
                title,
                "Your digital passport to explore Tunisia.",
                "Confirm your email to activate your account, save itineraries, and access local recommendations.",
                false,
                "Verify my account",
                verificationLink,
                "Link valid for 24 hours.",
                displayName,
                preheader);
        sendEmail(userMailSender, userFromAddress, toEmail, subject, plainText, html);
    }

    public void sendPasswordResetEmail(String toEmail, String firstName, String resetLink) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = "YallaTN+ — Password reset";
        String title = "Reset your password";
        String preheader = "Securely regain access to your YallaTN+ account.";
        String plainText = "Hi " + displayName + ",\n\n"
                + "You asked to reset your password.\n"
                + "Click here to set a new password:\n"
                + resetLink + "\n\n"
                + "This link expires in 30 minutes.\n"
                + "If you did not request this, you can ignore this email.\n\n"
                + "The YallaTN+ team";
        String html = buildTravelEmailHtml(
                title,
                "One click to secure your traveler account.",
                "We received a password reset request. If it was you, use the button below.",
                false,
                "Reset my password",
                resetLink,
                "Link valid for 30 minutes.",
                displayName,
                preheader);
        sendEmail(userMailSender, userFromAddress, toEmail, subject, plainText, html);
    }

    public void sendOrderConfirmation(String toEmail, String orderId, Double totalAmount) {
        String subject = "Order confirmation — Cloudaura #" + orderId;
        String title = "Thank you for your order!";
        String preheader = "Your order #" + orderId + " has been confirmed.";
        String bodyPlain = "Your handicraft order has been recorded successfully. "
                + "The total amount is " + String.format("%.2f", totalAmount) + " TND.";
        String ordersUrl = frontendBaseUrl + "/mes-commandes";
        String html = buildTravelEmailHtml(
                title,
                "Tunisian craftsmanship, delivered to you.",
                bodyPlain,
                false,
                "View my orders",
                ordersUrl,
                "Estimated delivery within 3–5 business days.",
                "there",
                preheader);
        String plain = "Thank you for order #" + orderId + ".\nTotal: " + totalAmount + " TND.\n— Cloudaura";
        sendEmail(shopMailSender, shopFromAddress, toEmail, subject, plain, html);
    }

    public void sendDeliveryUpdate(String toEmail, String productName, String status) {
        String subject = "Delivery update: " + productName;
        String title = "Your shipment is on the move";
        String statusEnglish = status.equals("SHIPPED")
                ? "is on its way"
                : (status.equals("DELIVERED") ? "has been delivered" : "is being prepared");
        String preheader = "The status of " + productName + " has changed.";
        String safeName = escapeHtml(productName);
        String bodyHtml = "Good news! Your product <strong>" + safeName + "</strong> " + statusEnglish + ".";
        String trackUrl = frontendBaseUrl + "/mes-commandes";
        String html = buildTravelEmailHtml(
                title,
                "Track your Cloudaura order.",
                bodyHtml,
                true,
                "Track my order",
                trackUrl,
                "Thank you for your trust.",
                "there",
                preheader);
        String plain = "Your product " + productName + " " + statusEnglish + ".\n— Cloudaura";
        sendEmail(shopMailSender, shopFromAddress, toEmail, subject, plain, html);
    }

    public void sendPromoCode(String toEmail, String firstName, String code) {
        String displayName = (firstName == null || firstName.isBlank()) ? "customer" : firstName;
        String subject = "A gift for you: 5% off!";
        String title = "Congratulations!";
        String preheader = "Your Cloudaura promo code is inside.";
        String safeCode = escapeHtml(code);
        String bodyHtml = "Because you support our artisans, here is a <strong>5%</strong> promo code for your next order:<br/><br/>"
                + "<center><strong style=\"font-size:24px;color:#e8002d;\">" + safeCode + "</strong></center>";
        String shopUrl = frontendBaseUrl + "/artisanat";
        String html = buildTravelEmailHtml(
                title,
                "Thank you for shopping on Cloudaura.",
                bodyHtml,
                true,
                "Shop artisanat",
                shopUrl,
                "Code valid for 30 days.",
                displayName,
                preheader);
        String plain = "Hi " + displayName + "! Your 5% promo code: " + code + "\n— Cloudaura";
        sendEmail(shopMailSender, shopFromAddress, toEmail, subject, plain, html);
    }

    private void sendEmail(
            JavaMailSender sender,
            InternetAddress from,
            String toEmail,
            String subject,
            String plainText,
            String htmlText) {
        MimeMessage message = sender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    "UTF-8");
            helper.setFrom(from);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plainText, htmlText);
            sender.send(message);
        } catch (MessagingException ex) {
            throw new MailSendException("Failed to build or send email message", ex);
        } catch (MailException ex) {
            throw ex;
        }
    }

    /**
     * @param bodyContent plain text (escaped) or trusted HTML when bodyIsHtml is true
     */
    private String buildTravelEmailHtml(
            String title,
            String heroLine,
            String bodyContent,
            boolean bodyIsHtml,
            String ctaLabel,
            String ctaLink,
            String timeHint,
            String firstName,
            String preheader) {
        String safeTitle = escapeHtml(title);
        String safeHeroLine = escapeHtml(heroLine);
        String safeBody = bodyIsHtml ? bodyContent : escapeHtml(bodyContent);
        String safeCtaLabel = escapeHtml(ctaLabel);
        String safeLink = escapeHtml(ctaLink);
        String safeHint = escapeHtml(timeHint);
        String safeName = escapeHtml(firstName);
        String safePreheader = escapeHtml(preheader);

        return """
                <!doctype html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>%s</title>
                </head>
                <body style="margin:0;padding:0;background:#f2f6fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#102030;">
                    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">%s</div>
                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f2f6fb;padding:24px 0;">
                        <tr>
                            <td align="center">
                                <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%%;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 16px 34px rgba(15,42,74,0.12);">
                                    <tr>
                                        <td style="padding:0;background:linear-gradient(135deg,#e8002d 0%%,#f54f43 48%%,#0077b6 100%%);">
                                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="padding:26px 30px 18px;color:#ffffff;">
                                                        <div style="font-size:26px;font-weight:800;letter-spacing:0.2px;">YallaTN<span style="font-weight:900;">+</span></div>
                                                        <div style="margin-top:6px;font-size:13px;opacity:0.9;">Tunisia Tourism & Travel Platform</div>
                                                        <div style="margin-top:24px;font-size:28px;font-weight:800;line-height:1.2;">%s</div>
                                                        <div style="margin-top:12px;font-size:15px;line-height:1.7;max-width:520px;opacity:0.98;">%s</div>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:28px 30px 10px;">
                                            <div style="font-size:16px;color:#22334a;line-height:1.7;">Hi %s,</div>
                                            <div style="margin-top:10px;font-size:15px;color:#3a4d67;line-height:1.75;">%s</div>

                                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 18px;">
                                                <tr>
                                                    <td align="center" style="border-radius:999px;background:linear-gradient(135deg,#e8002d,#ff5a45);">
                                                        <a href="%s" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">%s</a>
                                                    </td>
                                                </tr>
                                            </table>

                                            <div style="font-size:13px;color:#5b6c83;line-height:1.65;">%s</div>
                                            <div style="margin-top:10px;font-size:13px;color:#5b6c83;word-break:break-all;line-height:1.6;">If the button does not work, copy this link:<br /><a href="%s" style="color:#0077b6;">%s</a></div>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:22px 30px 26px;background:#f8fbff;border-top:1px solid #e6eef7;">
                                            <div style="font-size:12px;color:#6a7f98;line-height:1.8;">You receive this email because you use YallaTN+.<br />For your security, never share these links with anyone else.</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """
                .formatted(
                        safeTitle,
                        safePreheader,
                        safeTitle,
                        safeHeroLine,
                        safeName,
                        safeBody,
                        safeLink,
                        safeCtaLabel,
                        safeHint,
                        safeLink,
                        safeLink);
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
