package org.example.backend.service.flight;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.backend.config.DuffelProperties;
import org.example.backend.dto.flight.FlightOfferDto;
import org.example.backend.model.City;
import org.example.backend.model.Transport;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.TransportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DuffelFlightServiceTest {

    private static final String OFFER_RESPONSE = """
            {
              "data": {
                "offers": [
                  {
                    "id": "off_123",
                    "total_amount": "123.45",
                    "total_currency": "EUR",
                    "owner": { "name": "TestAir" },
                    "slices": [
                      {
                        "segments": [
                          {
                            "origin": { "iata_code": "TUN", "name": "Tunis-Carthage" },
                            "destination": { "iata_code": "DJE", "name": "Djerba-Zarzis" },
                            "departing_at": "2026-06-01T10:00:00Z",
                            "arriving_at": "2026-06-01T12:00:00Z",
                            "marketing_carrier_flight_number": "123",
                            "marketing_carrier_iata_code": "TA"
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
            """;

    @Mock
    private TransportRepository transportRepository;

    @Mock
    private CityRepository cityRepository;

    private DuffelFlightService service;
    private final AtomicInteger cityIdSeq = new AtomicInteger(1);
    private final Map<String, City> cityByName = new HashMap<>();

    @BeforeEach
    void setUp() {
        WebClient webClient = WebClient.builder()
                .exchangeFunction(req -> Mono.just(
                        ClientResponse.create(HttpStatus.OK)
                                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                                .body(OFFER_RESPONSE)
                                .build()))
                .build();

        DuffelProperties properties = new DuffelProperties();
        properties.setApiKey("test-key");
        properties.setDefaultLimit(20);

        service = new DuffelFlightService(
                webClient,
                properties,
                new ObjectMapper(),
                new DestinationAirportResolver(),
                transportRepository,
                cityRepository
        );

        when(cityRepository.findFirstByNameIgnoreCase(anyString())).thenAnswer(inv -> {
            String name = inv.getArgument(0, String.class);
            return Optional.of(cityByName.computeIfAbsent(name.toLowerCase(), key -> {
                City city = new City();
                city.setCityId(cityIdSeq.getAndIncrement());
                city.setName(name);
                city.setRegion("Airport");
                city.setHasAirport(true);
                city.setHasBusStation(false);
                city.setHasTrainStation(false);
                city.setHasPort(false);
                return city;
            }));
        });

        when(transportRepository.findFirstByTypeAndFlightCodeAndDepartureTimeAndArrivalTime(
                any(Transport.TransportType.class), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

        when(transportRepository.findFirstByTypeAndOperatorNameAndDepartureTimeAndArrivalTimeAndDepartureCity_CityIdAndArrivalCity_CityId(
                any(Transport.TransportType.class), anyString(), any(LocalDateTime.class), any(LocalDateTime.class), anyInt(), anyInt()))
                .thenReturn(Optional.empty());

        when(transportRepository.save(any(Transport.class))).thenAnswer(inv -> {
            Transport t = inv.getArgument(0, Transport.class);
            if (t.getTransportId() == null) {
                t.setTransportId(101);
            }
            return t;
        });
    }

    @Test
    void internalTunToDje_shouldSucceed() {
        List<FlightOfferDto> offers = service.searchFlights("TUN", "DJE", LocalDate.now().plusDays(14), 1, "economy", 10, "internal");
        assertFalse(offers.isEmpty());
    }

    @Test
    void internalTunToCdg_shouldFail() {
        assertThrows(IllegalArgumentException.class,
                () -> service.searchFlights("TUN", "CDG", LocalDate.now().plusDays(14), 1, "economy", 10, "internal"));
    }

    @Test
    void externalCdgToTun_shouldSucceed() {
        List<FlightOfferDto> offers = service.searchFlights("CDG", "TUN", LocalDate.now().plusDays(14), 1, "economy", 10, "external");
        assertFalse(offers.isEmpty());
    }

    @Test
    void externalCdgToDxb_shouldFail() {
        assertThrows(IllegalArgumentException.class,
                () -> service.searchFlights("CDG", "DXB", LocalDate.now().plusDays(14), 1, "economy", 10, "external"));
    }

    @Test
    void externalWithNoArr_shouldDefaultToTunAndSucceed() {
        assertDoesNotThrow(() -> service.searchFlights("CDG", null, LocalDate.now().plusDays(14), 1, "economy", 10, "external"));
    }

    @Test
    void invalidIata_shouldFail() {
        assertThrows(IllegalArgumentException.class,
                () -> service.searchFlights("T1N", "DJE", LocalDate.now().plusDays(14), 1, "economy", 10, "internal"));
    }

    @Test
    void lowercaseIata_shouldBeAcceptedAndNormalized() {
        List<FlightOfferDto> offers = service.searchFlights("tun", "dje", LocalDate.now().plusDays(14), 1, "economy", 10, "internal");
        assertFalse(offers.isEmpty());
    }

    @Test
    void sameRequestTwice_shouldNotCreateDuplicateTransportRows() {
        AtomicReference<Transport> stored = new AtomicReference<>();

        when(transportRepository.findFirstByTypeAndFlightCodeAndDepartureTimeAndArrivalTime(
                any(Transport.TransportType.class), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenAnswer(inv -> Optional.ofNullable(stored.get()));

        AtomicInteger saveCount = new AtomicInteger();

        when(transportRepository.save(any(Transport.class))).thenAnswer(inv -> {
            Transport t = inv.getArgument(0, Transport.class);
            if (saveCount.incrementAndGet() == 1) {
                if (t.getTransportId() == null) {
                    t.setTransportId(777);
                }
                stored.compareAndSet(null, t);
                return t;
            }
            throw new DataIntegrityViolationException("duplicate key");
        });

        List<FlightOfferDto> first = service.searchFlights("TUN", "DJE", LocalDate.now().plusDays(14), 1, "economy", 10, "internal");
        List<FlightOfferDto> second = service.searchFlights("TUN", "DJE", LocalDate.now().plusDays(14), 1, "economy", 10, "internal");

        assertEquals(first.get(0).getTransportId(), second.get(0).getTransportId());
        verify(transportRepository, times(2)).save(any(Transport.class));
    }
}
