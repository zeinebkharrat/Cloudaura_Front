package org.example.backend.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.net.URI;
import org.example.backend.dto.AuthMessageResponse;
import org.example.backend.dto.AuthResponse;
import org.example.backend.dto.CaptchaConfigResponse;
import org.example.backend.dto.ForgotPasswordRequest;
import org.example.backend.dto.LoginRequest;
import org.example.backend.dto.LoginRiskResponse;
import org.example.backend.dto.ResendVerificationRequest;
import org.example.backend.dto.ResetPasswordRequest;
import org.example.backend.dto.SignupRequest;
import org.example.backend.dto.SocialProvidersResponse;
import org.example.backend.dto.UserSummaryResponse;
import org.example.backend.service.AuthService;
import org.example.backend.service.LoginRiskService;
import org.example.backend.service.RecaptchaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final RecaptchaService recaptchaService;
    private final LoginRiskService loginRiskService;

    @Value("${app.recaptcha.site-key:}")
    private String recaptchaSiteKey;

    /** {@code v2} = checkbox widget · {@code v3} = score-based (grecaptcha.execute). Must match your keys in Google Admin. */
    @Value("${app.recaptcha.version:v2}")
    private String recaptchaVersion;

    @Value("${app.oauth2.google-client-id}")
    private String googleClientId;

    @Value("${app.oauth2.google-client-secret}")
    private String googleClientSecret;

    @Value("${app.oauth2.github-client-id}")
    private String githubClientId;

    @Value("${app.oauth2.github-client-secret}")
    private String githubClientSecret;

    @Value("${app.oauth2.facebook-client-id}")
    private String facebookClientId;

    @Value("${app.oauth2.facebook-client-secret}")
    private String facebookClientSecret;

    @Value("${app.oauth2.instagram-client-id}")
    private String instagramClientId;

    @Value("${app.oauth2.instagram-client-secret}")
    private String instagramClientSecret;

    /** Browser hits on POST-only routes (e.g. opening /api/auth/signup in a tab) redirect here. */
    @Value("${app.public.url:http://localhost:4200}")
    private String publicAppBaseUrl;

    public AuthController(AuthService authService, RecaptchaService recaptchaService, LoginRiskService loginRiskService) {
        this.authService = authService;
        this.recaptchaService = recaptchaService;
        this.loginRiskService = loginRiskService;
    }

    @GetMapping("/captcha-config")
    public CaptchaConfigResponse captchaConfig() {
        boolean secretOn = recaptchaService.hasSecret();
        String key = recaptchaSiteKey == null ? "" : recaptchaSiteKey.trim();
        boolean missingSiteKey = secretOn && key.isEmpty();
        boolean widgetEnabled = recaptchaService.isEnabled();
        String ver = recaptchaVersion == null ? "" : recaptchaVersion.trim().toLowerCase();
        String version = "v3".equals(ver) ? "v3" : "v2";
        return new CaptchaConfigResponse(widgetEnabled, key, missingSiteKey, version);
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthMessageResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    /** GET /api/auth/signup → redirect to SPA (POST-only registration). */
    @GetMapping("/signup")
    public ResponseEntity<Void> signupGetRedirect(HttpServletRequest request) {
        return redirectToPublicPath(request, "/signup");
    }

    @PostMapping("/signin")
    public AuthResponse signin(@Valid @RequestBody LoginRequest request) {
        return authService.signin(request);
    }

    @PostMapping("/login-risk")
    public LoginRiskResponse loginRisk(@Valid @RequestBody LoginRequest request) {
        return loginRiskService.analyze(request);
    }

    /** GET /api/auth/signin → redirect to SPA sign-in page. */
    @GetMapping("/signin")
    public ResponseEntity<Void> signinGetRedirect(HttpServletRequest request) {
        return redirectToPublicPath(request, "/signin");
    }

    @GetMapping("/me")
    public UserSummaryResponse me() {
        return authService.me();
    }

    @GetMapping("/social/providers")
    public SocialProvidersResponse socialProviders() {
        try {
            boolean googleConfigured = isConfigured(googleClientId, googleClientSecret);
            boolean githubConfigured = isConfigured(githubClientId, githubClientSecret);
            boolean facebookConfigured = isConfigured(facebookClientId, facebookClientSecret);
            boolean instagramConfigured = isConfigured(instagramClientId, instagramClientSecret);
            return new SocialProvidersResponse(googleConfigured, githubConfigured, facebookConfigured, instagramConfigured);
        } catch (Exception ignored) {
            return new SocialProvidersResponse(false, false, false, false);
        }
    }

    private boolean isConfigured(String clientId, String clientSecret) {
        return clientId != null
            && clientSecret != null
            && !clientId.isBlank()
            && !clientSecret.isBlank()
            && !clientId.startsWith("disabled-")
            && !clientSecret.startsWith("disabled-");
    }

    @GetMapping("/verify-email")
    public AuthMessageResponse verifyEmail(@RequestParam("token") String token) {
        return authService.verifyEmail(token);
    }

    @PostMapping("/resend-verification")
    public AuthMessageResponse resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        return authService.resendVerification(request);
    }

    /** GET → SPA so users are not stuck on 405 when opening the API URL by mistake. */
    @GetMapping("/resend-verification")
    public ResponseEntity<Void> resendVerificationGetRedirect(HttpServletRequest request) {
        return redirectToPublicPath(request, "/signin");
    }

    @PostMapping("/forgot-password")
    public AuthMessageResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return authService.forgotPassword(request);
    }

    @GetMapping("/forgot-password")
    public ResponseEntity<Void> forgotPasswordGetRedirect(HttpServletRequest request) {
        return redirectToPublicPath(request, "/forgot-password");
    }

    @PostMapping("/reset-password")
    public AuthMessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }

    /**
     * GET /api/auth/reset-password → SPA reset form (POST stays JSON-only).
     * Query string (e.g. token from email) is preserved when present on the incoming request.
     */
    @GetMapping("/reset-password")
    public ResponseEntity<Void> resetPasswordGetRedirect(HttpServletRequest request) {
        return redirectToPublicPath(request, "/reset-password");
    }

    private ResponseEntity<Void> redirectToPublicPath(HttpServletRequest request, String path) {
        String base = publicAppBaseUrl == null ? "" : publicAppBaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String p = path.startsWith("/") ? path : "/" + path;
        String qs = request.getQueryString();
        if (qs != null && !qs.isBlank()) {
            p = p + "?" + qs;
        }
        URI location = URI.create(base + p);
        return ResponseEntity.status(HttpStatus.FOUND).location(location).build();
    }
}
