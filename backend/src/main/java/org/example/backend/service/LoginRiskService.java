package org.example.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.example.backend.dto.LoginRiskResponse;
import org.example.backend.dto.LoginRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class LoginRiskService {

    private static final Duration ANALYZER_TIMEOUT = Duration.ofSeconds(25);
    private static final List<String> PYTHON_CANDIDATE_PATHS = List.of(
            "aiii/.venv/Scripts/python.exe",
            "aiii/venv/Scripts/python.exe",
            "../aiii/.venv/Scripts/python.exe",
            "../aiii/venv/Scripts/python.exe",
            "aiii/.venv/bin/python",
            "aiii/venv/bin/python",
            "../aiii/.venv/bin/python",
            "../aiii/venv/bin/python"
    );

    private final ObjectMapper objectMapper;

    @Value("${app.security.ai.python-command:}")
    private String pythonCommand;

    @Value("${app.security.ai.script-path:../aiii/security_analyzer.py}")
    private String scriptPath;

    public LoginRiskService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public LoginRiskResponse analyze(LoginRequest request) {
        return analyze(request.identifier(), request.password());
    }

    public LoginRiskResponse analyze(String username, String password) {
        try {
            Path analyzerScript = resolveAnalyzerScript();
            List<String> command = buildCommand(analyzerScript, username, password);

            ProcessBuilder builder = new ProcessBuilder(command);
            builder.directory(analyzerScript.getParent().toFile());
            builder.environment().put("PYTHONIOENCODING", "utf-8");
            builder.redirectErrorStream(true);

            Process process = builder.start();
            boolean finished = process.waitFor(ANALYZER_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.warn("Login risk analyzer timed out for user: {}", username);
                return blockedResponse("Login risk analyzer timed out.", List.of("AI unavailable"));
            }

            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            if (process.exitValue() != 0) {
                log.warn("Login risk analyzer failed with exit code {}. Output: {}", process.exitValue(), output);
                // Si l'IA échoue, on autorise par défaut pour ne pas bloquer les utilisateurs légitimes
                // sauf si on veut une sécurité stricte. Mais ici le user se plaint d'être bloqué.
                return new LoginRiskResponse("allowed", true, 0.0, List.of("AI offline - fallback to allow"), "AI offline");
            }

            try {
                return objectMapper.readValue(output, LoginRiskResponse.class);
            } catch (Exception e) {
                log.error("Failed to parse AI output: {}", output, e);
                return new LoginRiskResponse("allowed", true, 0.0, List.of("AI parse error"), "AI error");
            }
        } catch (Exception ex) {
            log.warn("Unable to run login risk analyzer: {}", ex.getMessage());
            return new LoginRiskResponse("allowed", true, 0.0, List.of("AI internal error"), "AI error");
        }
    }

    private LoginRiskResponse blockedResponse(String reason, List<String> details) {
        List<String> safeDetails = details == null || details.isEmpty()
                ? Collections.singletonList(reason)
                : new ArrayList<>(details);
        if (safeDetails.size() > 5) {
            safeDetails = safeDetails.subList(0, 5);
        }
        return new LoginRiskResponse(
                "blocked",
                false,
                1.0,
                safeDetails,
                "ACCES BLOQUE"
        );
    }

    private List<String> buildCommand(Path analyzerScript, String username, String password) {
        List<String> command = new ArrayList<>();

        for (String part : resolvePythonCommand()) {
            command.add(part);
        }
        command.add(analyzerScript.toString());
        command.add("--username");
        command.add(username == null ? "" : username);
        command.add("--password");
        command.add(password == null ? "" : password);
        command.add("--json");
        return command;
    }

    private List<String> resolvePythonCommand() {
        Path workingDir = Path.of("").toAbsolutePath().normalize();
        
        for (String candidate : PYTHON_CANDIDATE_PATHS) {
            Path normalized = workingDir.resolve(candidate).normalize();
            if (Files.exists(normalized)) {
                return List.of(normalized.toString());
            }
        }

        String configured = pythonCommand == null ? "" : pythonCommand.trim();
        if (!configured.isBlank()) {
            return List.of(configured.split("\\s+"));
        }

        return List.of("py", "-3.13");
    }

    private Path resolveAnalyzerScript() {
        Path configured = Path.of(scriptPath).toAbsolutePath().normalize();
        if (Files.exists(configured)) {
            return configured;
        }

        Path workingDir = Path.of("").toAbsolutePath().normalize();
        List<Path> candidates = List.of(
                workingDir.resolve("aiii").resolve("security_analyzer.py"),
                workingDir.resolve("..").resolve("aiii").resolve("security_analyzer.py").normalize(),
                workingDir.resolve("security_analyzer.py")
        );

        for (Path candidate : candidates) {
            Path normalized = candidate.toAbsolutePath().normalize();
            if (Files.exists(normalized)) {
                return normalized;
            }
        }

        throw new IllegalStateException("Cannot locate aiii/security_analyzer.py.");
    }
}