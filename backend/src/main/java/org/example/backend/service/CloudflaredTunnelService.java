package org.example.backend.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CloudflaredTunnelService {

    private static final Logger log = LoggerFactory.getLogger(CloudflaredTunnelService.class);
    private static final Pattern TUNNEL_URL_PATTERN = Pattern.compile("https://[a-z0-9-]+\\.trycloudflare\\.com");

    @Value("${app.cloudflared.auto-start:true}")
    private boolean autoStart;

    @Value("${app.cloudflared.executable:../tools/cloudflared/cloudflared.exe}")
    private String cloudflaredExecutable;

    @Value("${app.cloudflared.backend-url:http://localhost:${server.port:9091}}")
    private String backendUrl;

    @Value("${app.cloudflared.url-timeout-seconds:20}")
    private int urlTimeoutSeconds;

    @Value("${app.public.base-url:${APP_PUBLIC_BASE_URL:}}")
    private String explicitPublicBaseUrl;

    private final AtomicReference<String> publicUrlRef = new AtomicReference<>();
    private Process cloudflaredProcess;

    @PostConstruct
    public void maybeStartTunnel() {
        if (!autoStart) {
            log.info("Cloudflared auto-start disabled (app.cloudflared.auto-start=false)");
            return;
        }

        if (!isBlank(explicitPublicBaseUrl) && !isLocalAddress(explicitPublicBaseUrl)) {
            log.info("Cloudflared auto-start skipped: app.public.base-url is already set to a public URL");
            return;
        }

        Path executable = resolveExecutablePath();
        if (executable == null) {
            log.warn("Cloudflared executable not found, skipping tunnel auto-start");
            return;
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(
                executable.toString(),
                "tunnel",
                "--url", normalizeBackendUrl(backendUrl),
                "--no-autoupdate"
            );
            pb.redirectErrorStream(true);

            CountDownLatch urlDetected = new CountDownLatch(1);
            cloudflaredProcess = pb.start();

            Thread outputReader = new Thread(() -> readCloudflaredOutput(cloudflaredProcess, urlDetected), "cloudflared-output-reader");
            outputReader.setDaemon(true);
            outputReader.start();

            boolean gotUrl = urlDetected.await(Math.max(1, urlTimeoutSeconds), TimeUnit.SECONDS);
            if (gotUrl && publicUrlRef.get() != null) {
                log.info("Cloudflared tunnel active: {}", publicUrlRef.get());
            } else {
                log.warn("Cloudflared started but tunnel URL was not detected within {}s", urlTimeoutSeconds);
            }
        } catch (Exception ex) {
            log.warn("Unable to auto-start Cloudflared tunnel: {}", ex.getMessage());
        }
    }

    @PreDestroy
    public void stopTunnel() {
        if (cloudflaredProcess != null && cloudflaredProcess.isAlive()) {
            cloudflaredProcess.destroy();
            log.info("Cloudflared tunnel process stopped");
        }
    }

    public Optional<String> getPublicBaseUrl() {
        String value = publicUrlRef.get();
        if (isBlank(value)) {
            return Optional.empty();
        }
        return Optional.of(value);
    }

    private void readCloudflaredOutput(Process process, CountDownLatch urlDetected) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                Matcher m = TUNNEL_URL_PATTERN.matcher(line);
                if (m.find()) {
                    String url = trimTrailingSlash(m.group());
                    publicUrlRef.compareAndSet(null, url);
                    urlDetected.countDown();
                }
            }
        } catch (Exception ex) {
            log.debug("Cloudflared output reader stopped: {}", ex.getMessage());
        } finally {
            urlDetected.countDown();
        }
    }

    private Path resolveExecutablePath() {
        Path configured = Paths.get(cloudflaredExecutable);
        if (Files.isRegularFile(configured)) {
            return configured;
        }

        Path candidate1 = Paths.get("..", "tools", "cloudflared", "cloudflared.exe");
        if (Files.isRegularFile(candidate1)) {
            return candidate1;
        }

        Path candidate2 = Paths.get("tools", "cloudflared", "cloudflared.exe");
        if (Files.isRegularFile(candidate2)) {
            return candidate2;
        }

        return null;
    }

    private String normalizeBackendUrl(String value) {
        String normalized = isBlank(value) ? "http://localhost:9091" : value.trim();
        return trimTrailingSlash(normalized);
    }

    private String trimTrailingSlash(String value) {
        if (value == null) {
            return null;
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean isLocalAddress(String baseUrl) {
        if (isBlank(baseUrl)) {
            return true;
        }
        String lower = baseUrl.toLowerCase();
        return lower.contains("localhost")
            || lower.contains("127.0.0.1")
            || lower.contains("0.0.0.0");
    }
}
