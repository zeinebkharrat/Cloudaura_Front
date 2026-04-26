package org.example.backend.service.car;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.dto.car.AmadeusCarOfferDto;
import org.example.backend.dto.car.CarBookSimulationResponse;
import org.example.backend.model.City;
import org.example.backend.model.RentalCarReservation;
import org.example.backend.model.RentalFleetCar;
import org.example.backend.model.User;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.RentalCarReservationRepository;
import org.example.backend.repository.RentalFleetCarRepository;
import org.example.backend.service.CustomUserDetailsService;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tunisia-only internal car rental catalogue: city-based lookup (names + {@link TunisiaCarRentalLocationAliases}),
 * availability by non-overlapping reservations, TND per day.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LocalCarRentalService {

    public static final String OFFER_PREFIX = "LOCAL:";

    private static final List<RentalCarReservation.RentalStatus> ACTIVE_RENTAL_STATUSES = List.of(
            RentalCarReservation.RentalStatus.PENDING, RentalCarReservation.RentalStatus.CONFIRMED);

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final Pattern LOCAL_OFFER =
            Pattern.compile("^LOCAL:(\\d+):(\\d{4}-\\d{2}-\\d{2}):(\\d{4}-\\d{2}-\\d{2})$");

    private final RentalFleetCarRepository fleetRepo;
    private final RentalCarReservationRepository reservationRepo;
    private final CityRepository cityRepository;

    public Optional<City> resolveCityForSearch(String location) {
        if (location == null || location.isBlank()) {
            return Optional.empty();
        }
        String raw = location.trim();
        Optional<String> aliasCanonical = TunisiaCarRentalLocationAliases.canonicalCityNameForAlias(raw);
        if (aliasCanonical.isPresent()) {
            Optional<City> byAlias = cityRepository
                    .findFirstByNameIgnoreCase(aliasCanonical.get())
                    .filter(c -> !c.isExcludedFromPublicCityCatalog());
            if (byAlias.isPresent()) {
                return byAlias;
            }
        }
        Optional<City> exact = cityRepository
                .findFirstByNameIgnoreCase(raw)
                .filter(c -> !c.isExcludedFromPublicCityCatalog());
        if (exact.isPresent()) {
            return exact;
        }
        String foldInput = TunisiaCarRentalLocationAliases.foldKey(raw);
        if (foldInput.isEmpty()) {
            return Optional.empty();
        }
        List<City> folded = cityRepository.findAll().stream()
                .filter(c -> !c.isExcludedFromPublicCityCatalog())
                .filter(c -> c.getName() != null
                        && TunisiaCarRentalLocationAliases.foldKey(c.getName()).equals(foldInput))
                .toList();
        if (folded.size() == 1) {
            return Optional.of(folded.get(0));
        }
        return Optional.empty();
    }

    public List<AmadeusCarOfferDto> searchByCityId(int cityId, LocalDate startDate, LocalDate endDate) {
        City city = cityRepository.findById(cityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.city_not_found"));
        if (city.isExcludedFromPublicCityCatalog()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.city_not_allowed");
        }
        return searchByCity(city, startDate, endDate);
    }

    public List<AmadeusCarOfferDto> searchByCity(City city, LocalDate startDate, LocalDate endDate) {
        validateDateRange(startDate, endDate);
        RentalWindow window = rentalWindow(startDate, endDate);
        int rentalDays = rentalDays(startDate, endDate);
        List<RentalFleetCar> fleet = fleetRepo.findByCity_CityIdAndIsActiveTrueOrderByDailyRateTndAsc(city.getCityId());
        List<AmadeusCarOfferDto> out = new ArrayList<>();
        for (RentalFleetCar car : fleet) {
            if (reservationRepo.existsOverlappingActive(
                    car.getFleetCarId(), window.pickup(), window.returnDt(), ACTIVE_RENTAL_STATUSES)) {
                continue;
            }
            BigDecimal total = car.getDailyRateTnd().multiply(BigDecimal.valueOf(rentalDays)).setScale(2, RoundingMode.HALF_UP);
            out.add(AmadeusCarOfferDto.builder()
                    .offerId(buildOfferId(car.getFleetCarId(), startDate, endDate))
                    .provider("Yalla TN")
                    .model(car.getCategory() + " · " + car.getModelLabel())
                    .price(total.doubleValue())
                    .currency("TND")
                    .location(city.getName())
                    .transferType("SELF_DRIVE")
                    .pickupDateTime(window.pickup().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                    .build());
        }
        return out;
    }

    @Transactional
    public CarBookSimulationResponse bookSimulation(String offerId) {
        ParsedLocalOffer parsed = parseLocalOffer(offerId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.invalid_local_offer"));
        validateDateRange(parsed.start(), parsed.end());
        RentalFleetCar car = fleetRepo.findById(parsed.fleetCarId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.fleet_not_found"));
        if (!Boolean.TRUE.equals(car.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.fleet_inactive");
        }
        RentalWindow window = rentalWindow(parsed.start(), parsed.end());
        if (reservationRepo.existsOverlappingActive(
                car.getFleetCarId(), window.pickup(), window.returnDt(), ACTIVE_RENTAL_STATUSES)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "car.error.no_longer_available");
        }
        int rentalDays = rentalDays(parsed.start(), parsed.end());
        BigDecimal total = car.getDailyRateTnd().multiply(BigDecimal.valueOf(rentalDays)).setScale(2, RoundingMode.HALF_UP);
        String ref = "YTN-LOC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        User linkedUser = currentUser().orElse(null);
        RentalCarReservation row = RentalCarReservation.builder()
                .fleetCar(car)
                .user(linkedUser)
                .pickupDatetime(window.pickup())
                .returnDatetime(window.returnDt())
                .status(RentalCarReservation.RentalStatus.CONFIRMED)
                .totalPriceTnd(total)
                .confirmationRef(ref)
                .createdAt(LocalDateTime.now())
                .build();
        reservationRepo.save(row);
        log.info(
                "Local car simulation booking ref={} fleetCarId={} {} -> {} userId={}",
                ref,
                car.getFleetCarId(),
                parsed.start(),
                parsed.end(),
                linkedUser != null ? linkedUser.getUserId() : null);
        String msg = linkedUser != null
                ? "Simulation: internal fleet reservation stored and linked to your account."
                : "Simulation: internal fleet reservation stored.";
        return CarBookSimulationResponse.builder()
                .simulated(true)
                .confirmationRef(ref)
                .offerId(offerId.trim())
                .message(msg)
                .build();
    }

    public static String buildOfferId(int fleetCarId, LocalDate start, LocalDate end) {
        return OFFER_PREFIX + fleetCarId + ":" + start.format(ISO_DATE) + ":" + end.format(ISO_DATE);
    }

    public static boolean isLocalOfferId(String offerId) {
        return offerId != null && offerId.trim().startsWith(OFFER_PREFIX);
    }

    private Optional<ParsedLocalOffer> parseLocalOffer(String offerId) {
        Matcher m = LOCAL_OFFER.matcher(offerId);
        if (!m.matches()) {
            return Optional.empty();
        }
        try {
            int fleetId = Integer.parseInt(m.group(1));
            LocalDate start = LocalDate.parse(m.group(2), ISO_DATE);
            LocalDate end = LocalDate.parse(m.group(3), ISO_DATE);
            return Optional.of(new ParsedLocalOffer(fleetId, start, end));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private void validateDateRange(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.date_range");
        }
        if (end.isBefore(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "car.error.date_range");
        }
    }

    private int rentalDays(LocalDate start, LocalDate end) {
        long between = ChronoUnit.DAYS.between(start, end);
        return (int) Math.max(1, between);
    }

    private RentalWindow rentalWindow(LocalDate start, LocalDate end) {
        LocalDateTime pickup = LocalDateTime.of(start, LocalTime.of(10, 0));
        LocalDateTime returnDt = end.equals(start)
                ? LocalDateTime.of(start, LocalTime.of(18, 0))
                : LocalDateTime.of(end, LocalTime.of(10, 0));
        return new RentalWindow(pickup, returnDt);
    }

    private record RentalWindow(LocalDateTime pickup, LocalDateTime returnDt) {}

    private record ParsedLocalOffer(int fleetCarId, LocalDate start, LocalDate end) {}

    private Optional<User> currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null
                || !auth.isAuthenticated()
                || auth instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof CustomUserDetailsService.CustomUserDetails details) {
            return Optional.ofNullable(details.getUser());
        }
        return Optional.empty();
    }
}
