package org.example.backend.config;

import io.netty.channel.ChannelOption;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
@EnableConfigurationProperties(OpenSkyProperties.class)
public class OpenSkyClientConfig {

    @Bean
    public WebClient openSkyWebClient(OpenSkyProperties props) {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, props.getConnectTimeoutMs());

        int maxInMemory = 4 * 1024 * 1024;
        String base = props.getBaseUrl() == null ? "https://opensky-network.org/api" : props.getBaseUrl().replaceAll("/$", "");

        WebClient.Builder b = WebClient.builder()
                .baseUrl(base)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .exchangeStrategies(ExchangeStrategies.builder()
                        .codecs(c -> c.defaultCodecs().maxInMemorySize(maxInMemory))
                        .build());

        if (props.hasBearerToken()) {
            b.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + props.getBearerToken().trim());
        }
        return b.build();
    }
}
