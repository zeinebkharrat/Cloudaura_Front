package org.example.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origins:http://localhost:4200}")
    private String allowedOrigins;

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler,
                                                   OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .exceptionHandling(ex -> ex
                    .defaultAuthenticationEntryPointFor(restAuthenticationEntryPoint(),
                        new OrRequestMatcher(
                            new AntPathRequestMatcher("/api/**"),
                            new AntPathRequestMatcher("/post/**"),
                            new AntPathRequestMatcher("/comment/**"),
                            new AntPathRequestMatcher("/like/**"),
                            new AntPathRequestMatcher("/media/**"),
                            new AntPathRequestMatcher("/follow/**"),
                            new AntPathRequestMatcher("/saved-post/**"),
                            new AntPathRequestMatcher("/chatroom/**")
                        ))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/auth/**").permitAll()
                    .requestMatchers("/login", "/login/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/public/activities/*/reservations").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/public/activities/*/reservations/checkout").authenticated()
                        .requestMatchers("/api/public/activity-reservations/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/public/restaurants/*/reviews").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/public/activities/*/reviews").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/public/restaurants/*/reviews/mine").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/public/activities/*/reviews/mine").authenticated()
                        .requestMatchers("/api/public/my/**").authenticated()
                        .requestMatchers("/api/public/**").permitAll()
                        .requestMatchers("/public/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cities/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/transports/**").permitAll()
                        .requestMatchers("/api/engine/**").permitAll()
                        .requestMatchers("/api/transport-recommendations/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/accommodations/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/geo/**").permitAll()
                        .requestMatchers("/api/routing/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/routes/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/events", "/api/events/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/products", "/api/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/levels", "/api/levels/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/ludification/roadmap/nodes/*/complete").authenticated()
                        .requestMatchers("/api/ludification/roadmap/progress").authenticated()
                        .requestMatchers("/api/ludification/roadmap/nodes/*/can-play").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/ludification/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/ludification/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/ludification/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/ludification/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.GET, "/post/**", "/comment/**", "/like/**", "/media/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/story/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/post/**", "/comment/**", "/like/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/story/**").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/post/**", "/comment/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/post/**", "/comment/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/story/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(
                                "/api/carts/**",
                                "/api/cart-items/**",
                                "/api/orders/**",
                                "/api/order-items/**",
                                "/api/crud/carts/**",
                                "/api/crud/cart-items/**"
                        ).hasAuthority("ROLE_ADMIN")
                        // Mutations only — GET catalogue stays permitAll above (avoid ROLE_ADMIN catching tourists)
                        .requestMatchers(HttpMethod.POST, "/api/products", "/api/products/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_ARTISAN")
                        .requestMatchers(HttpMethod.PUT, "/api/products/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_ARTISAN")
                        .requestMatchers(HttpMethod.DELETE, "/api/products/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_ARTISAN")
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/ws/**", "/ws-native/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/transport/tracking/stream/**")
                        .authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/transport/tracking/*/position")
                        .authenticated()
                        .requestMatchers("/api/transport/payments/paypal/**").authenticated()
                        .requestMatchers("/api/transport/payments/**").authenticated()
                        .requestMatchers("/api/accommodation/payments/**").authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2
                        .successHandler(oAuth2AuthenticationSuccessHandler)
                        .failureHandler(oAuth2AuthenticationFailureHandler)
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public AuthenticationEntryPoint restAuthenticationEntryPoint() {
        return (request, response, authException) ->
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized");
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
            throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
