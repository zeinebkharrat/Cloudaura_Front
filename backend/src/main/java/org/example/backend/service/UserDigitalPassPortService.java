package org.example.backend.service;

import org.example.backend.dto.PassportPhotoCreateRequest;
import org.example.backend.dto.PassportProfileUpdateRequest;
import org.example.backend.dto.PassportResponse;
import org.example.backend.dto.PassportStampUpsertRequest;
import org.example.backend.model.City;
import org.example.backend.model.PassportAchievement;
import org.example.backend.model.PassportCityStamp;
import org.example.backend.model.PassportPhoto;
import org.example.backend.model.User;
import org.example.backend.model.UserDigitalPassPort;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.PassportAchievementRepository;
import org.example.backend.repository.PassportCityStampRepository;
import org.example.backend.repository.PassportPhotoRepository;
import org.example.backend.repository.UserDigitalPassPortRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class UserDigitalPassPortService implements IUserDigitalPassPortService {

    private static final String ACH_FIRST_CITY = "FIRST_CITY_VISITED";
    private static final String ACH_FIVE_CITIES = "FIVE_CITIES_VISITED";
    private static final String ACH_NORTH = "NORTH_TUNISIA_EXPLORER";
    private static final String ACH_DESERT = "DESERT_EXPLORER";
    private static final String ACH_COASTAL = "COASTAL_EXPLORER";
    private static final String ACH_HIDDEN = "HIDDEN_GEM_FINDER";

    private final UserDigitalPassPortRepository passportRepository;
    private final PassportCityStampRepository stampRepository;
    private final PassportAchievementRepository achievementRepository;
    private final PassportPhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final CityRepository cityRepository;

    public UserDigitalPassPortService(
            UserDigitalPassPortRepository passportRepository,
            PassportCityStampRepository stampRepository,
            PassportAchievementRepository achievementRepository,
            PassportPhotoRepository photoRepository,
            UserRepository userRepository,
            CityRepository cityRepository
    ) {
        this.passportRepository = passportRepository;
        this.stampRepository = stampRepository;
        this.achievementRepository = achievementRepository;
        this.photoRepository = photoRepository;
        this.userRepository = userRepository;
        this.cityRepository = cityRepository;
    }

    @Override
    @Transactional
    public PassportResponse getMyPassport(Integer userId) {
        UserDigitalPassPort passport = getOrCreatePassport(userId);
        unlockAchievements(passport);
        return buildPassportResponse(passport.getUser().getUserId());
    }

    @Override
    @Transactional
    public PassportResponse getPassportByUserId(Integer userId) {
        UserDigitalPassPort passport = getOrCreatePassport(userId);
        unlockAchievements(passport);
        return buildPassportResponse(passport.getUser().getUserId());
    }

    @Override
    @Transactional
    public PassportResponse updateMyPassportProfile(Integer userId, PassportProfileUpdateRequest request) {
        UserDigitalPassPort passport = getOrCreatePassport(userId);
        passport.setTravelStyleBadge(trimToNull(request.travelStyleBadge()));
        passport.setBioNote(trimToNull(request.bioNote()));
        passport.setUpdatedAt(new Date());
        passportRepository.save(passport);
        return buildPassportResponse(userId);
    }

    @Override
    @Transactional
    public PassportResponse addOrUpdateStamp(Integer userId, PassportStampUpsertRequest request) {
        if (request == null || request.cityId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cityId is required");
        }

        UserDigitalPassPort passport = getOrCreatePassport(userId);
        City city = cityRepository.findById(request.cityId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "City not found"));

        Date now = new Date();
        Date visitDate = request.visitedAt() != null ? request.visitedAt() : now;

        PassportCityStamp stamp = stampRepository
                .findByPassportPassportIdAndCityCityId(passport.getPassportId(), city.getCityId())
                .orElseGet(PassportCityStamp::new);

        boolean isNew = stamp.getStampId() == null;
        if (isNew) {
            stamp.setPassport(passport);
            stamp.setCity(city);
            stamp.setVisitCount(1);
            stamp.setFirstVisitedAt(visitDate);
            stamp.setCreatedAt(now);
        } else {
            stamp.setVisitCount(Math.max(1, (stamp.getVisitCount() == null ? 0 : stamp.getVisitCount()) + 1));
        }

        stamp.setLastVisitedAt(visitDate);

        String emblemKey = trimToNull(request.emblemKey());
        if (emblemKey != null) {
            stamp.setEmblemKey(emblemKey);
        } else if (isNew) {
            stamp.setEmblemKey(defaultEmblemForCity(city));
        }

        String memoryNote = trimToNull(request.memoryNote());
        if (memoryNote != null || isNew) {
            stamp.setMemoryNote(memoryNote);
        }

        String photoUrl = trimToNull(request.photoUrl());
        if (photoUrl != null || isNew) {
            stamp.setPhotoUrl(photoUrl);
        }

        stamp.setUpdatedAt(now);
        stampRepository.save(stamp);

        if (photoUrl != null) {
            PassportPhoto photo = new PassportPhoto();
            photo.setPassport(passport);
            photo.setCity(city);
            photo.setPhotoUrl(photoUrl);
            photo.setCaption("Memory from " + city.getName());
            photo.setUploadedAt(now);
            photoRepository.save(photo);
        }

        passport.setUpdatedAt(now);
        passportRepository.save(passport);

        unlockAchievements(passport);
        return buildPassportResponse(userId);
    }

    @Override
    @Transactional
    public PassportResponse deleteStamp(Integer userId, Integer stampId) {
        UserDigitalPassPort passport = getOrCreatePassport(userId);
        PassportCityStamp stamp = stampRepository.findById(stampId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Stamp not found"));

        if (!Objects.equals(stamp.getPassport().getPassportId(), passport.getPassportId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own stamps");
        }

        stampRepository.delete(stamp);
        passport.setUpdatedAt(new Date());
        passportRepository.save(passport);

        return buildPassportResponse(userId);
    }

    @Override
    @Transactional
    public PassportResponse addPhoto(Integer userId, PassportPhotoCreateRequest request) {
        if (request == null || trimToNull(request.photoUrl()) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "photoUrl is required");
        }

        UserDigitalPassPort passport = getOrCreatePassport(userId);
        City city = null;
        if (request.cityId() != null) {
            city = cityRepository.findById(request.cityId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "City not found"));
        }

        PassportPhoto photo = new PassportPhoto();
        photo.setPassport(passport);
        photo.setCity(city);
        photo.setPhotoUrl(trimToNull(request.photoUrl()));
        photo.setCaption(trimToNull(request.caption()));
        photo.setUploadedAt(new Date());
        photoRepository.save(photo);

        passport.setUpdatedAt(new Date());
        passportRepository.save(passport);

        return buildPassportResponse(userId);
    }

    @Override
    @Transactional
    public PassportResponse deletePhoto(Integer userId, Integer photoId) {
        UserDigitalPassPort passport = getOrCreatePassport(userId);
        PassportPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));

        if (!Objects.equals(photo.getPassport().getPassportId(), passport.getPassportId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own photos");
        }

        photoRepository.delete(photo);
        passport.setUpdatedAt(new Date());
        passportRepository.save(passport);

        return buildPassportResponse(userId);
    }

    private UserDigitalPassPort getOrCreatePassport(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return passportRepository.findByUserUserId(userId).orElseGet(() -> {
            Date now = new Date();
            UserDigitalPassPort passport = new UserDigitalPassPort();
            passport.setUser(user);
            passport.setPassportNumber(generatePassportNumber(user));
            passport.setTravelStyleBadge("Curious Traveler");
            passport.setBioNote("My Tunisia travel story starts here.");
            passport.setJoinDate(user.getCreatedAt() != null ? user.getCreatedAt() : now);
            passport.setCreatedAt(now);
            passport.setUpdatedAt(now);
            return passportRepository.save(passport);
        });
    }

    private PassportResponse buildPassportResponse(Integer userId) {
        UserDigitalPassPort passport = passportRepository.findByUserUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Passport not found"));

        List<PassportCityStamp> stamps = stampRepository.findByPassportIdWithCity(passport.getPassportId());
        List<PassportAchievement> achievements = achievementRepository
                .findByPassportPassportIdOrderByUnlockedAtDesc(passport.getPassportId());
        List<PassportPhoto> photos = photoRepository.findByPassportIdWithCity(passport.getPassportId());
        List<City> allCities = cityRepository.findAll().stream()
                .filter(c -> !c.isVirtualFlightEndpointCity())
                .toList();

        int totalVisits = stamps.stream().mapToInt(s -> s.getVisitCount() == null ? 0 : s.getVisitCount()).sum();
        Set<Integer> visitedCityIds = new HashSet<>();
        for (PassportCityStamp stamp : stamps) {
            if (stamp.getCity() != null && stamp.getCity().getCityId() != null) {
                visitedCityIds.add(stamp.getCity().getCityId());
            }
        }

        List<PassportResponse.PassportStampView> stampViews = new ArrayList<>();
        for (PassportCityStamp stamp : stamps) {
            City city = stamp.getCity();
            stampViews.add(new PassportResponse.PassportStampView(
                    stamp.getStampId(),
                    city != null ? city.getCityId() : null,
                    city != null ? city.getName() : null,
                    city != null ? city.getRegion() : null,
                    stamp.getVisitCount(),
                    stamp.getFirstVisitedAt(),
                    stamp.getLastVisitedAt(),
                    stamp.getEmblemKey(),
                    stamp.getMemoryNote(),
                    stamp.getPhotoUrl()
            ));
        }

        List<PassportResponse.PassportAchievementView> achievementViews = new ArrayList<>();
        for (PassportAchievement achievement : achievements) {
            achievementViews.add(new PassportResponse.PassportAchievementView(
                    achievement.getAchievementId(),
                    achievement.getAchievementCode(),
                    achievement.getTitle(),
                    achievement.getDescription(),
                    achievement.getBadgeTone(),
                    achievement.getUnlockedAt()
            ));
        }

        List<PassportResponse.PassportPhotoView> photoViews = new ArrayList<>();
        for (PassportPhoto photo : photos) {
            City city = photo.getCity();
            photoViews.add(new PassportResponse.PassportPhotoView(
                    photo.getPhotoId(),
                    city != null ? city.getCityId() : null,
                    city != null ? city.getName() : null,
                    photo.getPhotoUrl(),
                    photo.getCaption(),
                    photo.getUploadedAt()
            ));
        }

        List<PassportResponse.PassportCityProgressView> cityProgressViews = new ArrayList<>();
        for (City city : allCities) {
            PassportCityStamp stamp = stamps.stream()
                    .filter(s -> s.getCity() != null && Objects.equals(s.getCity().getCityId(), city.getCityId()))
                    .findFirst()
                    .orElse(null);

            cityProgressViews.add(new PassportResponse.PassportCityProgressView(
                    city.getCityId(),
                    city.getName(),
                    city.getRegion(),
                    city.getLatitude(),
                    city.getLongitude(),
                    visitedCityIds.contains(city.getCityId()),
                    stamp != null && stamp.getVisitCount() != null ? stamp.getVisitCount() : 0
            ));
        }

        User user = passport.getUser();
        String displayName = ((user.getFirstName() == null ? "" : user.getFirstName().trim()) + " "
                + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        if (displayName.isBlank()) {
            displayName = user.getUsername();
        }

        return new PassportResponse(
                passport.getPassportId(),
                user.getUserId(),
                displayName,
                user.getUsername(),
                user.getNationality(),
                user.getProfileImageUrl(),
                passport.getPassportNumber(),
                passport.getTravelStyleBadge(),
                passport.getBioNote(),
                passport.getJoinDate(),
                passport.getCreatedAt(),
                visitedCityIds.size(),
                totalVisits,
                stampViews,
                achievementViews,
                photoViews,
                cityProgressViews
        );
    }

    private void unlockAchievements(UserDigitalPassPort passport) {
        Integer passportId = passport.getPassportId();
        List<PassportCityStamp> stamps = stampRepository.findByPassportIdWithCity(passportId);
        int uniqueCount = stamps.size();

        Set<String> existing = new HashSet<>();
        for (PassportAchievement achievement : achievementRepository.findByPassportPassportIdOrderByUnlockedAtDesc(passportId)) {
            existing.add(achievement.getAchievementCode());
        }

        if (uniqueCount >= 1) {
            unlock(passport, existing, ACH_FIRST_CITY, "First City Visited", "You collected your first Tunisian city stamp.", "red");
        }
        if (uniqueCount >= 5) {
            unlock(passport, existing, ACH_FIVE_CITIES, "5 Cities Visited", "You reached five city stamps in your passport.", "gold");
        }
        if (hasNorth(stamps)) {
            unlock(passport, existing, ACH_NORTH, "North Tunisia Explorer", "You explored the north of Tunisia.", "blue");
        }
        if (hasDesert(stamps)) {
            unlock(passport, existing, ACH_DESERT, "Desert Explorer", "You explored Tunisia's desert vibes.", "sand");
        }
        if (hasCoastal(stamps)) {
            unlock(passport, existing, ACH_COASTAL, "Coastal Explorer", "You visited Tunisia's coastal gems.", "teal");
        }
        if (hasHiddenGem(stamps)) {
            unlock(passport, existing, ACH_HIDDEN, "Hidden Gem Finder", "You discovered one of Tunisia's hidden gems.", "violet");
        }
    }

    private void unlock(UserDigitalPassPort passport, Set<String> existing, String code, String title, String description, String tone) {
        if (existing.contains(code)) {
            return;
        }

        PassportAchievement achievement = new PassportAchievement();
        achievement.setPassport(passport);
        achievement.setAchievementCode(code);
        achievement.setTitle(title);
        achievement.setDescription(description);
        achievement.setBadgeTone(tone);
        achievement.setUnlockedAt(new Date());
        achievementRepository.save(achievement);
        existing.add(code);
    }

    private String generatePassportNumber(User user) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return "TN-DP-" + user.getUserId() + "-" + suffix;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    private String defaultEmblemForCity(City city) {
        String normalized = normalize(city.getName());
        if (normalized.contains("sidibousaid")) {
            return "blue-door";
        }
        if (normalized.contains("carthage") || normalized.contains("kartaj")) {
            return "ruins";
        }
        if (normalized.contains("djerba")) {
            return "island-sun";
        }
        if (normalized.contains("tozeur")) {
            return "desert-palm";
        }
        if (normalized.contains("tunis")) {
            return "medina";
        }
        return "city-mark";
    }

    private boolean hasNorth(List<PassportCityStamp> stamps) {
        for (PassportCityStamp stamp : stamps) {
            if (stamp.getCity() == null) {
                continue;
            }
            String region = normalize(stamp.getCity().getRegion());
            String name = normalize(stamp.getCity().getName());
            if (region.contains("north") || region.contains("nord")) {
                return true;
            }
            if (Set.of("tunis", "bizerte", "beja", "jendouba", "kef", "siliana", "nabeul", "zaghouan", "ariana", "manouba", "benarous").contains(name)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasDesert(List<PassportCityStamp> stamps) {
        for (PassportCityStamp stamp : stamps) {
            if (stamp.getCity() == null) {
                continue;
            }
            String region = normalize(stamp.getCity().getRegion());
            String name = normalize(stamp.getCity().getName());
            if (region.contains("desert") || region.contains("south") || region.contains("sud") || region.contains("sahara")) {
                return true;
            }
            if (Set.of("tozeur", "kebili", "douz", "tataouine", "matmata", "gabes").contains(name)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasCoastal(List<PassportCityStamp> stamps) {
        for (PassportCityStamp stamp : stamps) {
            if (stamp.getCity() == null) {
                continue;
            }
            String region = normalize(stamp.getCity().getRegion());
            String name = normalize(stamp.getCity().getName());
            if (region.contains("coast") || region.contains("coastal") || region.contains("littoral")) {
                return true;
            }
            if (Set.of("tunis", "bizerte", "sousse", "monastir", "mahdia", "sfax", "nabeul", "hammamet", "djerba", "gabes").contains(name)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasHiddenGem(List<PassportCityStamp> stamps) {
        for (PassportCityStamp stamp : stamps) {
            if (stamp.getCity() == null) {
                continue;
            }
            String name = normalize(stamp.getCity().getName());
            if (Set.of("testour", "takrouna", "matmata", "douz", "chenini", "sejnane", "ain draham", "ain-draham", "nefta", "kesra").contains(name)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String input) {
        if (input == null) {
            return "";
        }
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
        return normalized;
    }
}
