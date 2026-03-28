package org.example.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EmailService(JavaMailSender mailSender,
                        @Value("${app.mail.from:${spring.mail.username:no-reply@yallatn.com}}") String fromAddress) {
        this.mailSender = mailSender;
        if (fromAddress != null && !fromAddress.isBlank() && !"no-reply@yallatn.com".equalsIgnoreCase(fromAddress.trim())) {
            this.fromAddress = fromAddress.trim();
            return;
        }

        if (mailSender instanceof JavaMailSenderImpl senderImpl
                && senderImpl.getUsername() != null
                && !senderImpl.getUsername().isBlank()) {
            this.fromAddress = senderImpl.getUsername().trim();
            return;
        }

        this.fromAddress = "no-reply@yallatn.com";
    }

    public void sendVerificationEmail(String toEmail, String firstName, String verificationLink) {
        String displayName = (firstName == null || firstName.isBlank()) ? "voyageur" : firstName;
        String subject = "YallaTN+ - Verification de votre compte";
        String title = "Bienvenue sur YallaTN+";
        String preheader = "Confirmez votre email pour activer votre compte et commencer a voyager en Tunisie.";
        String plainText = "Salut " + displayName + ",\n\n"
                                + "Bienvenue sur YallaTN+ !\n"
                                + "Cliquez sur ce lien pour verifier votre compte :\n"
                                + verificationLink + "\n\n"
                                + "Ce lien expire dans 24 heures.\n\n"
                                + "Equipe YallaTN+";
        String html = buildTravelEmailHtml(
                                title,
                                "Votre passeport digital pour explorer la Tunisie.",
                                "Confirmez votre email pour activer votre compte, sauvegarder vos itineraire et acceder a nos recommandations locales.",
                                "Verifier mon compte",
                                verificationLink,
                                "Lien valide pendant 24 heures.",
                                displayName,
                                preheader
        );
        sendEmail(toEmail, subject, plainText, html);
    }

    public void sendPasswordResetEmail(String toEmail, String firstName, String resetLink) {
        String displayName = (firstName == null || firstName.isBlank()) ? "voyageur" : firstName;
        String subject = "YallaTN+ - Reinitialisation du mot de passe";
                String title = "Reinitialisation du mot de passe";
                String preheader = "Reprenez l acces a votre compte YallaTN+ de maniere securisee.";
                String plainText = "Salut " + displayName + ",\n\n"
                                + "Vous avez demande la reinitialisation de votre mot de passe.\n"
                                + "Cliquez ici pour definir un nouveau mot de passe :\n"
                                + resetLink + "\n\n"
                                + "Ce lien expire dans 30 minutes.\n"
                                + "Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.\n\n"
                                + "Equipe YallaTN+";
                String html = buildTravelEmailHtml(
                                title,
                                "Un clic pour securiser votre compte voyageur.",
                                "Nous avons recu une demande de reinitialisation. Si vous etes bien a l origine de cette action, utilisez le bouton ci dessous.",
                                "Reinitialiser mon mot de passe",
                                resetLink,
                                "Lien valide pendant 30 minutes.",
                                displayName,
                                preheader
                );
                sendEmail(toEmail, subject, plainText, html);
    }

        private void sendEmail(String toEmail, String subject, String plainText, String htmlText) {
                MimeMessage message = mailSender.createMimeMessage();
                try {
                    MimeMessageHelper helper = new MimeMessageHelper(
                            message,
                            MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                            "UTF-8"
                    );
                        helper.setFrom(fromAddress);
                        helper.setTo(toEmail);
                        helper.setSubject(subject);
                        helper.setText(plainText, htmlText);
                        mailSender.send(message);
                } catch (MessagingException ex) {
                        throw new IllegalStateException("Failed to build email message", ex);
        }
        }

        private String buildTravelEmailHtml(String title,
                                                                                String heroLine,
                                                                                String bodyText,
                                                                                String ctaLabel,
                                                                                String ctaLink,
                                                                                String timeHint,
                                                                                String firstName,
                                                                                String preheader) {
                String safeTitle = escapeHtml(title);
                String safeHeroLine = escapeHtml(heroLine);
                String safeBody = escapeHtml(bodyText);
                String safeCtaLabel = escapeHtml(ctaLabel);
                String safeLink = escapeHtml(ctaLink);
                String safeHint = escapeHtml(timeHint);
                String safeName = escapeHtml(firstName);
                String safePreheader = escapeHtml(preheader);

                return """
                                <!doctype html>
                                <html lang=\"fr\">
                                <head>
                                    <meta charset=\"UTF-8\" />
                                    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
                                    <title>%s</title>
                                </head>
                                <body style=\"margin:0;padding:0;background:#f2f6fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#102030;\">
                                    <div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">%s</div>
                                    <table role=\"presentation\" width=\"100%%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f2f6fb;padding:24px 0;\">
                                        <tr>
                                            <td align=\"center\">
                                                <table role=\"presentation\" width=\"640\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:640px;width:100%%;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 16px 34px rgba(15,42,74,0.12);\">
                                                    <tr>
                                                        <td style=\"padding:0;background:linear-gradient(135deg,#e8002d 0%%,#f54f43 48%%,#0077b6 100%%);\">
                                                            <table role=\"presentation\" width=\"100%%\" cellpadding=\"0\" cellspacing=\"0\">
                                                                <tr>
                                                                    <td style=\"padding:26px 30px 18px;color:#ffffff;\">
                                                                        <div style=\"font-size:26px;font-weight:800;letter-spacing:0.2px;\">YallaTN<span style=\"font-weight:900;\">+</span></div>
                                                                        <div style=\"margin-top:6px;font-size:13px;opacity:0.9;\">Tunisia Tourism & Travel Platform</div>
                                                                        <div style=\"margin-top:24px;font-size:28px;font-weight:800;line-height:1.2;\">%s</div>
                                                                        <div style=\"margin-top:12px;font-size:15px;line-height:1.7;max-width:520px;opacity:0.98;\">%s</div>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>

                                                    <tr>
                                                        <td style=\"padding:28px 30px 10px;\">
                                                            <div style=\"font-size:16px;color:#22334a;line-height:1.7;\">Salut %s,</div>
                                                            <div style=\"margin-top:10px;font-size:15px;color:#3a4d67;line-height:1.75;\">%s</div>

                                                            <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0 18px;\">
                                                                <tr>
                                                                    <td align=\"center\" style=\"border-radius:999px;background:linear-gradient(135deg,#e8002d,#ff5a45);\">
                                                                        <a href=\"%s\" style=\"display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;\">%s</a>
                                                                    </td>
                                                                </tr>
                                                            </table>

                                                            <div style=\"font-size:13px;color:#5b6c83;line-height:1.65;\">%s</div>
                                                            <div style=\"margin-top:10px;font-size:13px;color:#5b6c83;word-break:break-all;line-height:1.6;\">Si le bouton ne fonctionne pas, copiez ce lien:<br /><a href=\"%s\" style=\"color:#0077b6;\">%s</a></div>
                                                        </td>
                                                    </tr>

                                                    <tr>
                                                        <td style=\"padding:22px 30px 26px;background:#f8fbff;border-top:1px solid #e6eef7;\">
                                                            <div style=\"font-size:12px;color:#6a7f98;line-height:1.8;\">Vous recevez cet email car vous utilisez YallaTN+ pour preparer vos voyages en Tunisie.<br />Pour votre securite, ne partagez jamais ce lien avec une autre personne.</div>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </body>
                                </html>
                                """.formatted(safeTitle, safePreheader, safeTitle, safeHeroLine, safeName, safeBody, safeLink, safeCtaLabel, safeHint, safeLink, safeLink);
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
