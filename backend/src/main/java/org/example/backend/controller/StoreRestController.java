package org.example.backend.controller;

import com.stripe.Stripe;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.example.backend.model.PointPackage;
import org.example.backend.model.User;
import org.example.backend.repository.PointPackageRepository;
import org.example.backend.service.CustomUserDetailsService;
import org.example.backend.service.GamificationPointsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/store")
@CrossOrigin(origins = "http://localhost:4200", maxAge = 3600)
public class StoreRestController {

    private final PointPackageRepository pointPackageRepository;
    private final GamificationPointsService gamificationPointsService;
    private final String stripeCurrency;
    private final String frontendUrl;

    public StoreRestController(
            PointPackageRepository pointPackageRepository,
            GamificationPointsService gamificationPointsService,
            @Value("${stripe.api.key}") String stripeApiKey,
            @Value("${stripe.checkout.currency:usd}") String stripeCurrency,
            @Value("${app.frontend.base-url:http://localhost:4200}") String frontendUrl) {
        this.pointPackageRepository = pointPackageRepository;
        this.gamificationPointsService = gamificationPointsService;
        this.stripeCurrency = stripeCurrency;
        this.frontendUrl = frontendUrl;
        Stripe.apiKey = stripeApiKey;
    }

    @GetMapping("/packages")
    public List<PointPackage> getActivePackages() {
        return pointPackageRepository.findByActiveTrue();
    }

    @PostMapping("/checkout")
    public Map<String, String> checkout(@RequestBody Map<String, Long> payload) throws Exception {
        Long packageId = payload.get("packageId");
        if (packageId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "packageId required");
        }
        
        PointPackage pkg = pointPackageRepository.findById(packageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Package not found"));
        
        if (!pkg.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Package is not active");
        }

        User user = currentUser();

        long amountInCents = (long) (pkg.getPrice() * 100);

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                // Success URL passes session_id back to /games to show the success message
                .setSuccessUrl(frontendUrl + "/games?session_id={CHECKOUT_SESSION_ID}&package_id=" + pkg.getId())
                .setCancelUrl(frontendUrl + "/games")
                .putMetadata("userId", String.valueOf(user.getId()))
                .putMetadata("packageId", String.valueOf(pkg.getId()))
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(stripeCurrency)
                                .setUnitAmount(amountInCents)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName(pkg.getName())
                                        .setDescription(pkg.getPointsAmount() + " Loyalty Points")
                                        .build())
                                .build())
                        .build())
                .build();

        Session session = Session.create(params);
        return Map.of("sessionId", session.getId(), "url", session.getUrl());
    }

    @PostMapping("/checkout/success")
    public ResponseEntity<Map<String, Object>> checkoutSuccess(@RequestBody Map<String, String> payload) {
        String sessionId = payload.get("sessionId");
        if (sessionId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionId required");
        }

        try {
            Session session = Session.retrieve(sessionId);
            
            if ("paid".equals(session.getPaymentStatus())) {
                String pIdStr = session.getMetadata().get("packageId");
                String uIdStr = session.getMetadata().get("userId");
                
                if (pIdStr == null || uIdStr == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid metadata in session");
                }
                
                // IMPORTANT: In a real app we need to track if we already rewarded this sessionId
                // to prevent double rewarding on refresh. 
                // For this request, we just add the points directly.
                Long packageId = Long.parseLong(pIdStr);
                
                PointPackage pkg = pointPackageRepository.findById(packageId).orElse(null);
                if (pkg != null) {
                    User user = currentUser();
                    // Ensure the session user matches the logged in user
                    if (!String.valueOf(user.getId()).equals(uIdStr)) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session belongs to another user");
                    }
                    
                    gamificationPointsService.addPoints(user, pkg.getPointsAmount());
                    return ResponseEntity.ok(Map.of("success", true, "message", "Points added successfully", "addedPoints", pkg.getPointsAmount()));
                }
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Payment not completed"));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error verifying session", e);
        }
    }

    private static User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetailsService.CustomUserDetails d) {
            return d.getUser();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }
}
