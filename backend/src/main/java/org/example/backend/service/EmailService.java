package org.example.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayInputStream;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamSource;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.core.io.ByteArrayResource;
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

        public void sendVerificationEmail(
            String toEmail,
            String firstName,
            String lastName,
            String username,
            String phone,
            String nationality,
            String verificationLink) {
        String displayName = (firstName == null || firstName.isBlank()) ? "Voyageur" : firstName;
        String fullName = formatFullName(firstName, lastName);
        String usernameValue = fallbackValue(username, "Non renseigne");
        String emailValue = fallbackValue(toEmail, "Non renseigne");
        String phoneValue = fallbackValue(phone, "Non renseigne");
        String nationalityValue = fallbackValue(nationality, "Non renseignee");
        String subject = "YallaTN+ — Confirmation d'inscription";
        String plainText = "Bienvenue " + displayName + ",\n\n"
            + "Votre compte YallaTN+ a ete cree avec succes.\n"
            + "Confirmez votre adresse email avec ce lien :\n"
            + verificationLink + "\n\n"
            + "Ce lien est valable 24 heures.\n"
            + "Nom complet : " + fullName + "\n"
            + "Nom d'utilisateur : " + usernameValue + "\n"
            + "Email : " + emailValue + "\n"
            + "Telephone : " + phoneValue + "\n"
            + "Nationalite : " + nationalityValue + "\n\n"
            + "L'equipe YallaTN+";
        String html = buildSignupVerificationHtml(
            displayName,
            fullName,
            usernameValue,
            emailValue,
            phoneValue,
            nationalityValue,
            verificationLink);
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

    public void sendTransportOneHourReminder(
            String toEmail,
            String firstName,
            String reservationRef,
            String routeLabel,
            String departureWhenLabel,
            byte[] qrPng) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = "YallaTN+ — Départ dans 1 heure (" + reservationRef + ")";
        String preheader = "Votre trajet " + routeLabel + " commence bientôt.";
        String safeRoute = escapeHtml(routeLabel);
        String safeWhen = escapeHtml(departureWhenLabel);
        String safeRef = escapeHtml(reservationRef);
        String bodyHtml = "Votre départ est prévu dans environ <strong>une heure</strong>.<br/><br/>"
                + "<strong>Référence</strong> : " + safeRef + "<br/>"
                + "<strong>Trajet</strong> : " + safeRoute + "<br/>"
                + "<strong>Départ</strong> : " + safeWhen + "<br/><br/>"
                + "Votre billet QR est joint à cet e-mail. Présentez-le à l'embarquement.";
        String plain = "Bonjour " + displayName + ",\n\n"
                + "Rappel : votre transport (" + reservationRef + ") part dans environ une heure.\n"
                + "Trajet : " + routeLabel + "\n"
                + "Départ : " + departureWhenLabel + "\n\n"
                + "Le QR code est en pièce jointe (ticket-qr.png).\n\n"
                + "— YallaTN+";
        String tripsUrl = frontendBaseUrl + "/mes-reservations?tab=transport";
        String html = buildTravelEmailHtml(
                "Départ bientôt",
                "Préparez-vous pour votre trajet en Tunisie.",
                bodyHtml,
                true,
                "Voir mes réservations",
                tripsUrl,
                "Bon voyage avec YallaTN+.",
                displayName,
                preheader);

        MimeMessage message = userMailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(
                    message, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, "UTF-8");
            helper.setFrom(userFromAddress);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plain, html);
            helper.addAttachment("ticket-qr.png", new ByteArrayResource(qrPng), "image/png");
            userMailSender.send(message);
        } catch (MessagingException ex) {
            throw new MailSendException("Failed to build or send transport reminder email", ex);
        } catch (MailException ex) {
            throw ex;
        }
    }

    /** Confirmation after transport booking is paid (e.g. PayPal capture); includes boarding QR PNG. */
    public void sendTransportBookingConfirmation(
            String toEmail,
            String firstName,
            String reservationRef,
            String routeLabel,
            String amountTndLabel,
            byte[] qrPng) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = "YallaTN+ — Transport confirmé (" + reservationRef + ")";
        String preheader = "Votre réservation transport est payée et confirmée.";
        String safeRoute = escapeHtml(routeLabel);
        String safeRef = escapeHtml(reservationRef);
        String safeAmount = escapeHtml(amountTndLabel);
        String bodyHtml = "Votre paiement a bien été enregistré.<br/><br/>"
                + "<strong>Référence</strong> : " + safeRef + "<br/>"
                + "<strong>Trajet</strong> : " + safeRoute + "<br/>"
                + "<strong>Total</strong> : " + safeAmount + " TND<br/><br/>"
                + "Votre billet QR est joint à cet e-mail. Présentez-le à l'embarquement.";
        String plain = "Bonjour " + displayName + ",\n\n"
                + "Votre réservation transport est confirmée.\n"
                + "Référence : " + reservationRef + "\n"
                + "Trajet : " + routeLabel + "\n"
                + "Total : " + amountTndLabel + " TND\n\n"
                + "Le QR code est en pièce jointe (ticket-qr.png).\n\n"
                + "— YallaTN+";
        String tripsUrl = frontendBaseUrl + "/mes-reservations?tab=transport";
        String html = buildTravelEmailHtml(
                "Réservation confirmée",
                "Merci d'avoir réservé avec YallaTN+.",
                bodyHtml,
                true,
                "Voir mes réservations",
                tripsUrl,
                "Conservez ce billet sur votre téléphone.",
                displayName,
                preheader);

        MimeMessage message = userMailSender.createMimeMessage();
        try {
            MimeMessageHelper helper =
                    new MimeMessageHelper(message, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, "UTF-8");
            helper.setFrom(userFromAddress);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plain, html);
            helper.addAttachment("ticket-qr.png", new ByteArrayResource(qrPng), "image/png");
            userMailSender.send(message);
        } catch (MessagingException ex) {
            throw new MailSendException("Failed to build or send transport booking confirmation email", ex);
        } catch (MailException ex) {
            throw ex;
        }
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

    public void sendArtisanRequestDecision(String toEmail, String firstName, boolean approved) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = approved
                ? "YallaTN+ - Artisan request approved"
                : "YallaTN+ - Artisan request update";
        String title = approved ? "Welcome to the artisan space" : "Artisan request update";
        String preheader = approved
                ? "Your artisan profile has been approved."
                : "Your artisan request was reviewed.";
        String ctaLabel = approved ? "Open artisan dashboard" : "Update my profile";
        String ctaPath = approved ? "/artisan" : "/profile";
        String bodyHtml = approved
                ? "Great news! Your artisan request has been <strong>approved</strong>.<br/>"
                    + "You can now publish products and manage your artisan orders from your dashboard."
                : "Your artisan request was reviewed and is currently <strong>not approved</strong>.<br/>"
                    + "Please update your profile information and contact support if you need help.";
        String plain = approved
                ? "Hi " + displayName + ", your artisan request is approved. You can now access the artisan dashboard."
                : "Hi " + displayName + ", your artisan request was reviewed and is not approved for now. Please update your profile and retry.";

        String targetUrl = frontendBaseUrl + ctaPath;
        String html = buildTravelEmailHtml(
                title,
                "Your YallaTN+ artisan management status has changed.",
                bodyHtml,
                true,
                ctaLabel,
                targetUrl,
                "If you need assistance, contact YallaTN+ support.",
                displayName,
                preheader);
        sendEmail(userMailSender, userFromAddress, toEmail, subject, plain, html);
    }

        public void sendEventJoinConfirmation(String toEmail, String firstName, String eventTitle, java.util.Date startDate, String venue) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = "YallaTN+ - Event registration confirmed";
        String dateLabel = startDate == null ? "TBA" : new SimpleDateFormat("dd/MM/yyyy").format(startDate);
        String safeEventTitle = eventTitle == null || eventTitle.isBlank() ? "Event" : eventTitle;
        String safeVenue = venue == null || venue.isBlank() ? "TBA" : venue;

        String plain = "Hi " + displayName + ",\n\n"
            + "Your event registration is confirmed.\n"
            + "Event: " + safeEventTitle + "\n"
            + "Date: " + dateLabel + "\n"
            + "Venue: " + safeVenue + "\n\n"
            + "Thank you for joining YallaTN+.";

        String html = buildTravelEmailHtml(
            "Event registration confirmed",
            "You are successfully registered.",
            "Your registration is confirmed for <strong>" + escapeHtml(safeEventTitle) + "</strong>.<br/>"
                + "Date: <strong>" + escapeHtml(dateLabel) + "</strong><br/>"
                + "Venue: <strong>" + escapeHtml(safeVenue) + "</strong>",
            true,
            "View events",
            frontendBaseUrl + "/evenements",
            "We look forward to seeing you there.",
            displayName,
            "Your event registration is confirmed.");

        sendEmail(userMailSender, userFromAddress, toEmail, subject, plain, html);
        }

        public void sendCommentModerationWarningEmail(
            String toEmail,
            String firstName,
            java.util.Date mutedUntil,
            String categories) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = "YallaTN+ - Comment warning";
        String untilLabel = mutedUntil == null ? "soon" : new SimpleDateFormat("dd/MM/yyyy HH:mm").format(mutedUntil);
        String safeCategories = (categories == null || categories.isBlank()) ? "abusive language" : categories;

        String plain = "Hi " + displayName + ",\n\n"
            + "Your latest community comment contained prohibited language.\n"
            + "Your commenting is temporarily locked until " + untilLabel + ".\n"
            + "Detected categories: " + safeCategories + "\n\n"
            + "Please respect community rules to avoid longer bans.\n"
            + "- YallaTN+";

        String html = buildTravelEmailHtml(
            "Community warning",
            "Please keep comments respectful.",
            "Your latest community comment triggered our moderation policy.<br/>"
                + "Commenting is temporarily locked until <strong>" + escapeHtml(untilLabel) + "</strong>.<br/>"
                + "Detected categories: <strong>" + escapeHtml(safeCategories) + "</strong>.<br/><br/>"
                + "Further violations can result in multi-day account bans.",
            true,
            "Open community",
            frontendBaseUrl + "/community",
            "Second offense: 15-minute lock applied.",
            displayName,
            "Your community commenting is temporarily locked.");

        sendEmail(userMailSender, userFromAddress, toEmail, subject, plain, html);
        }

        public void sendCommentBanEmail(
            String toEmail,
            String firstName,
            java.util.Date expiresAt,
            int banDays,
            String categories) {
        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String subject = "YallaTN+ - Community ban applied";
        String untilLabel = expiresAt == null ? "indefinite" : new SimpleDateFormat("dd/MM/yyyy HH:mm").format(expiresAt);
        String safeCategories = (categories == null || categories.isBlank()) ? "abusive language" : categories;

        String plain = "Hi " + displayName + ",\n\n"
            + "Because of repeated abusive community comments, your account is banned for " + banDays + " days.\n"
            + "Ban ends: " + untilLabel + "\n"
            + "Detected categories: " + safeCategories + "\n\n"
            + "Please follow community guidelines when access is restored.\n"
            + "- YallaTN+";

        String html = buildTravelEmailHtml(
            "Community ban",
            "Repeated abusive comments detected.",
            "Your account is now banned from community activity for <strong>" + banDays + " days</strong>.<br/>"
                + "Ban end date: <strong>" + escapeHtml(untilLabel) + "</strong>.<br/>"
                + "Detected categories: <strong>" + escapeHtml(safeCategories) + "</strong>.",
            true,
            "Review community rules",
            frontendBaseUrl + "/community",
            "Future violations will increase ban duration.",
            displayName,
            "A temporary community ban has been applied to your account.");

        sendEmail(userMailSender, userFromAddress, toEmail, subject, plain, html);
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

    private String buildSignupVerificationHtml(
            String firstName,
            String fullName,
            String username,
            String email,
            String phone,
            String nationality,
            String verificationLink) {
        String safeFirstName = escapeHtml(firstName);
        String safeFullName = escapeHtml(fullName);
        String safeUsername = escapeHtml(username);
        String safeEmail = escapeHtml(email);
        String safePhone = escapeHtml(phone);
        String safeNationality = escapeHtml(nationality);
        String safeLink = escapeHtml(verificationLink);
        String bannerUrl = escapeHtml(frontendBaseUrl + "/assets/banner.png");

        return """
                <!doctype html>
                <html lang="fr">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Confirmation d'inscription</title>
                </head>
                <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#0f172a;">
                    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Confirmez votre email pour activer votre compte YallaTN+.</div>

                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 10px;">
                        <tr>
                            <td align="center">
                                <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%%;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.12);">
                                    <tr>
                                        <td style="padding:18px 26px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:1.5;font-weight:800;letter-spacing:.08em;color:#1e293b;text-transform:uppercase;">
                                            Confirmation d'inscription
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:18px 26px 10px;">
                                            <div style="font-size:42px;line-height:1;letter-spacing:.02em;font-weight:900;color:#0f172a;text-align:center;">YALLATN+ <span style="font-size:30px;vertical-align:middle;">•</span> ACCES VOYAGEUR <span style="font-size:28px;vertical-align:middle;">🇹🇳</span></div>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:8px 26px 0;">
                                            <img src="%s" alt="Tunisie" width="628" style="width:100%%;max-width:628px;height:auto;display:block;border-radius:16px;border:1px solid #dbe4f0;" />
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:24px 30px 10px;">
                                            <div style="font-size:40px;line-height:1.08;font-weight:900;color:#0f172a;">Bienvenue, %s !</div>
                                            <div style="margin-top:12px;font-size:15px;color:#334155;line-height:1.75;">Votre compte est presque pret. Verifiez votre adresse email pour commencer a planifier vos aventures en Tunisie.</div>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:8px 30px 0;">
                                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
                                                <tr>
                                                    <td style="padding:14px 16px 4px;font-size:16px;line-height:1.4;font-weight:800;color:#0f172a;">Details de votre compte</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding:2px 16px 16px;font-size:15px;line-height:1.9;color:#1f2937;">
                                                        <strong>Nom complet :</strong> %s<br/>
                                                        <strong>Nom d'utilisateur :</strong> %s<br/>
                                                        <strong>Email :</strong> %s<br/>
                                                        <strong>Numero de telephone :</strong> %s<br/>
                                                        <strong>Nationalite :</strong> %s
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:24px 30px 0;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                                                <tr>
                                                    <td style="border-radius:999px;background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 12px 26px rgba(220,38,38,.28);">
                                                        <a href="%s" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;">Confirmer votre adresse email</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:20px 30px 0;font-size:14px;line-height:1.75;color:#475569;">
                                            Une fois votre email confirme, vous pourrez commencer a reserver des experiences, gerer votre profil et acceder a toutes les fonctionnalites YallaTN+.
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:18px 30px 0;">
                                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="border-left:4px solid #0ea5e9;background:#f8fbff;border-radius:10px;">
                                                <tr>
                                                    <td style="padding:12px 14px;font-size:14px;line-height:1.7;color:#334155;">
                                                        <strong>Conseil voyage:</strong> gardez vos informations a jour pour recevoir des recommandations adaptees a vos destinations favorites.
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:16px 30px 0;font-size:13px;line-height:1.7;color:#64748b;word-break:break-all;">
                                            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur:<br/>
                                            <a href="%s" style="color:#0284c7;text-decoration:underline;">%s</a>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:20px 30px 28px;font-size:13px;line-height:1.7;color:#64748b;">
                                            Ce lien expire dans 24 heures.<br/>
                                            L'equipe YallaTN+
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """.formatted(
                bannerUrl,
                safeFirstName,
                safeFullName,
                safeUsername,
                safeEmail,
                safePhone,
                safeNationality,
                safeLink,
                safeLink,
                safeLink);
    }

    private static String fallbackValue(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value.trim();
    }

    private static String formatFullName(String firstName, String lastName) {
        String first = firstName == null ? "" : firstName.trim();
        String last = lastName == null ? "" : lastName.trim();
        String combined = (first + " " + last).trim();
        return combined.isBlank() ? "Voyageur YallaTN+" : combined;
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

    public void sendEventTicketConfirmation(
            String toEmail,
            String firstName,
            String eventTitle,
            String venue,
            java.util.Date startDate,
            Integer reservationId,
            List<String> qrTokens,
            byte[] primaryQrPng) {

        String displayName = (firstName == null || firstName.isBlank()) ? "traveler" : firstName;
        String safeEventTitle = escapeHtml(eventTitle == null ? "Event" : eventTitle);
        String safeVenue = escapeHtml(venue == null ? "TBA" : venue);
        String safeReservation = escapeHtml(String.valueOf(reservationId));
        String eventDate = startDate == null ? "TBA" : new SimpleDateFormat("dd/MM/yyyy").format(startDate);

        String qrListHtml = "";
        if (qrTokens != null && !qrTokens.isEmpty()) {
            StringBuilder b = new StringBuilder();
            for (String token : qrTokens) {
                b.append("<li style=\"margin:4px 0;font-family:monospace;\">")
                        .append(escapeHtml(token))
                        .append("</li>");
            }
            qrListHtml = "<ul style=\"padding-left:18px;color:#3a4d67;\">" + b + "</ul>";
        }

        String html = """
                <!doctype html>
                <html lang="en">
                <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
                <body style="margin:0;padding:0;background:#f2f6fb;font-family:Arial,Helvetica,sans-serif;color:#102030;">
                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:24px 0;background:#f2f6fb;">
                        <tr><td align="center">
                            <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 16px 34px rgba(15,42,74,.12);">
                                <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#e8002d 0%%,#0077b6 100%%);color:#fff;">
                                    <div style="font-size:26px;font-weight:800;">YallaTN+</div>
                                    <div style="margin-top:8px;font-size:20px;font-weight:700;">Votre ticket est confirme</div>
                                </td></tr>
                                <tr><td style="padding:24px 28px;">
                                    <p style="margin:0 0 10px;">Hi %s,</p>
                                    <p style="margin:0 0 12px;color:#3a4d67;">Merci pour votre paiement. Votre reservation est confirmee.</p>
                                    <p style="margin:0;color:#3a4d67;"><strong>Event:</strong> %s</p>
                                    <p style="margin:6px 0;color:#3a4d67;"><strong>Venue:</strong> %s</p>
                                    <p style="margin:6px 0;color:#3a4d67;"><strong>Date:</strong> %s</p>
                                    <p style="margin:6px 0 16px;color:#3a4d67;"><strong>Reservation ID:</strong> %s</p>
                                    <div style="margin:16px 0;text-align:center;">
                                        <img src="cid:event-ticket-qr" alt="QR Code" style="width:210px;height:210px;border:1px solid #e6eef7;border-radius:10px;padding:8px;background:#fff;"/>
                                    </div>
                                    <p style="margin:0 0 8px;color:#3a4d67;"><strong>QR tokens:</strong></p>
                                    %s
                                </td></tr>
                            </table>
                        </td></tr>
                    </table>
                </body>
                </html>
                """.formatted(
                escapeHtml(displayName),
                safeEventTitle,
                safeVenue,
                escapeHtml(eventDate),
                safeReservation,
                qrListHtml
        );

        String plain = "Hi " + displayName + ",\n\n"
                + "Your event reservation is confirmed.\n"
                + "Event: " + (eventTitle == null ? "Event" : eventTitle) + "\n"
                + "Reservation ID: " + reservationId + "\n"
                + "Venue: " + (venue == null ? "TBA" : venue) + "\n"
                + "Date: " + eventDate + "\n";

        MimeMessage message = userMailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    "UTF-8");
            helper.setFrom(userFromAddress);
            helper.setTo(toEmail);
            helper.setSubject("YallaTN+ - Ticket confirmation");
            helper.setText(plain, html);

            if (primaryQrPng != null && primaryQrPng.length > 0) {
                InputStreamSource source = () -> new ByteArrayInputStream(primaryQrPng);
                helper.addInline("event-ticket-qr", source, "image/png");
            }

            userMailSender.send(message);
        } catch (MessagingException ex) {
            throw new MailSendException("Failed to build or send event ticket email", ex);
        } catch (MailException ex) {
            throw ex;
        }
    }
}
