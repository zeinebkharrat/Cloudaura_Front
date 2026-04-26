package org.example.backend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Short TTL caches to respect Aviationstack free-tier quotas and reduce latency.
 */
@Configuration
public class AviationStackCacheConfig {

    public static final String CACHE_ALL_FLIGHTS = "aviationAllFlights";
    public static final String CACHE_ROUTE_FLIGHTS = "aviationRouteFlights";
    public static final String CACHE_SUGGEST = "aviationSuggest";
    public static final String CACHE_BY_FLIGHT = "aviationByFlight";

    @Bean
    public CacheManager aviationCacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
                CACHE_ALL_FLIGHTS,
                CACHE_ROUTE_FLIGHTS,
                CACHE_SUGGEST,
                CACHE_BY_FLIGHT
        );
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(200)
                .expireAfterWrite(Duration.ofMinutes(5)));
        return manager;
    }
}
