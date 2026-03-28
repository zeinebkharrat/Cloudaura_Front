package org.example.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

@Configuration
public class MailSenderConfig {

    @Bean
    public JavaMailSender javaMailSender(
            @Value("${mailer.dsn:${MAILER_DSN:}}") String mailerDsn,
            @Value("${spring.mail.host:smtp.gmail.com}") String defaultHost,
            @Value("${spring.mail.port:587}") int defaultPort,
            @Value("${spring.mail.username:}") String defaultUsername,
            @Value("${spring.mail.password:}") String defaultPassword) {

        JavaMailSenderImpl sender = new JavaMailSenderImpl();

        if (mailerDsn != null && !mailerDsn.isBlank()) {
            MailDsnConfig parsed = parseMailerDsn(mailerDsn);
            sender.setHost(parsed.host());
            sender.setPort(parsed.port());
            sender.setUsername(parsed.username());
            sender.setPassword(parsed.password());
        } else {
            sender.setHost(defaultHost);
            sender.setPort(defaultPort);
            sender.setUsername(defaultUsername);
            sender.setPassword(defaultPassword);
        }

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.starttls.required", "true");
        props.put("mail.smtp.ssl.trust", sender.getHost());
        props.put("mail.smtp.connectiontimeout", "8000");
        props.put("mail.smtp.timeout", "8000");
        props.put("mail.smtp.writetimeout", "8000");
        return sender;
    }

    private MailDsnConfig parseMailerDsn(String dsn) {
        try {
            URI uri = URI.create(dsn.trim());
            String userInfo = uri.getUserInfo();
            if (userInfo == null || !userInfo.contains(":")) {
                throw new IllegalArgumentException("Invalid MAILER_DSN user info");
            }
            String[] credentials = userInfo.split(":", 2);
            String username = URLDecoder.decode(credentials[0], StandardCharsets.UTF_8);
            String password = URLDecoder.decode(credentials[1], StandardCharsets.UTF_8);
            int port = uri.getPort() > 0 ? uri.getPort() : 587;
            return new MailDsnConfig(uri.getHost(), port, username, password);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid MAILER_DSN format. Expected smtp://user:pass@host:port", ex);
        }
    }

    private record MailDsnConfig(String host, int port, String username, String password) {
    }
}
