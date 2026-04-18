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
@EnableConfigurationProperties(DuffelProperties.class)
public class DuffelConfig {

    @Bean
    public WebClient duffelWebClient(DuffelProperties props) {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, props.getConnectTimeoutMs());

        return WebClient.builder()
                .baseUrl(props.getBaseUrl().replaceAll("/$", ""))
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Duffel-Version", props.getVersion())
                .defaultHeaders(headers -> {
                    if (props.hasApiKey()) {
                        headers.setBearerAuth(props.getApiKey().trim());
                    }
                })
                .exchangeStrategies(ExchangeStrategies.builder()
                        .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                        .build())
                .build();
    }
}
