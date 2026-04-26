package org.example.backend.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * Registers {@link AmadeusProperties} and a dedicated {@link WebClient} pointing at the Amadeus host.
 */
@Configuration
@EnableConfigurationProperties(AmadeusProperties.class)
public class AmadeusClientConfig {

    /**
     * WebClient used for OAuth token and transfer-offers calls (same base URL, different paths).
     */
    @Bean
    public WebClient amadeusWebClient(AmadeusProperties properties, WebClient.Builder builder) {
        HttpClient reactorClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(30));
        return builder
                .baseUrl(properties.getBaseUrl().replaceAll("/$", ""))
                .clientConnector(new ReactorClientHttpConnector(reactorClient))
                .build();
    }
}
