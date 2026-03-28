package org.example.backend.config;

import org.springframework.context.annotation.Configuration;

@Configuration
public class CorsConfig {
	// This class is kept for backward compatibility but CORS is now handled
	// centrally in SecurityConfig.corsConfigurationSource() to avoid conflicts
}

