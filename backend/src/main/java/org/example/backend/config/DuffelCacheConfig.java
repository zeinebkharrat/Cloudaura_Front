package org.example.backend.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.time.Duration;

@Configuration
@EnableCaching
public class DuffelCacheConfig {

    public static final String CACHE_FLIGHT_SEARCH = "duffelFlightSearch";
    public static final String CACHE_FLIGHT_SUGGEST = "duffelFlightSuggest";
    public static final String CACHE_FLIGHT_OFFER = "duffelFlightOffer";

    @Bean
    @Primary
    public CacheManager duffelCacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
                CACHE_FLIGHT_SEARCH,
                CACHE_FLIGHT_SUGGEST,
                CACHE_FLIGHT_OFFER
        );
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(300)
            .expireAfterWrite(Duration.ofMinutes(4)));
        return manager;
    }
}
