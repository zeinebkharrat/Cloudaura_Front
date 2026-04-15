package org.example.backend.service;

import jakarta.transaction.Transactional;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class EventService {

    @Autowired
    private EventRepository eventRepository;

    // --- ajoute ceci ---
    @Autowired
    private CityRepository cityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostService postService;

    @Value("${app.community.event-announcement-user-id:5}")
    private Integer eventAnnouncementUserId;

    @Transactional
    public List<Event> getAllEvents() {
        syncStatusesByDateInDatabase();
        List<Event> events = eventRepository.findAll();
        List<Event> toUpdate = new ArrayList<>();

        for (Event event : events) {
            if (applyAutomaticStatusByDate(event)) {
                toUpdate.add(event);
            }
        }

        if (!toUpdate.isEmpty()) {
            eventRepository.saveAll(toUpdate);
        }

        return events;
    }

    @Transactional
    public Optional<Event> getEventById(Integer id) {
        syncStatusesByDateInDatabase();
        Optional<Event> eventOpt = eventRepository.findById(id);
        eventOpt.ifPresent(event -> {
            if (applyAutomaticStatusByDate(event)) {
                eventRepository.save(event);
            }
        });
        return eventOpt;
    }

    @Transactional
    public Event createOrUpdateEvent(Event event) {
        boolean isNewEvent = event.getEventId() == null;

        // Si une ville est fournie avec un ID
        if (event.getCity() != null && event.getCity().getCityId() != null) {
            City city = cityRepository.findById(event.getCity().getCityId())
                    .orElse(null); // Si pas trouvé, on met null au lieu de faire planter
            event.setCity(city);
        } else {
            event.setCity(null); // Autorise l'ajout sans ville si besoin
        }

        applyAutomaticStatusByDate(event);
        Event saved = eventRepository.save(event);

        if (isNewEvent) {
            createCommunityAnnouncementPost(saved);
        }

        return saved;
    }

    public void deleteEvent(Integer id) {
        eventRepository.deleteById(id);
    }

    private boolean applyAutomaticStatusByDate(Event event) {
        if (event == null) {
            return false;
        }

        LocalDate eventStartDate = toLocalDate(event.getStartDate());
        LocalDate eventEndDate = toLocalDate(event.getEndDate());

        if (eventStartDate == null && eventEndDate == null) {
            return false;
        }

        if (eventStartDate == null) {
            eventStartDate = eventEndDate;
        }
        if (eventEndDate == null) {
            eventEndDate = eventStartDate;
        }

        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        String desiredStatus;

        if (eventEndDate.isBefore(today)) {
            desiredStatus = "COMPLETED";
        } else if (!eventStartDate.isAfter(today)) {
            desiredStatus = "ONGOING";
        } else {
            desiredStatus = "UPCOMING";
        }

        if (!desiredStatus.equalsIgnoreCase(event.getStatus())) {
            event.setStatus(desiredStatus);
            return true;
        }

        return false;
    }

    private LocalDate toLocalDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return Instant.ofEpochMilli(date.getTime())
                .atZone(ZoneId.systemDefault())
                .toLocalDate();
    }

    private void syncStatusesByDateInDatabase() {
        eventRepository.markCompletedByDate();
        eventRepository.markOngoingByDate();
        eventRepository.markUpcomingByDate();
    }

    private void createCommunityAnnouncementPost(Event event) {
        if (event == null || event.getEventId() == null || eventAnnouncementUserId == null) {
            return;
        }

        Optional<User> authorOpt = userRepository.findById(eventAnnouncementUserId);
        if (authorOpt.isEmpty()) {
            return;
        }

        String title = safeText(event.getTitle());
        String eventType = safeText(event.getEventType());
        String venue = safeText(event.getVenue());
        String cityName = event.getCity() != null ? safeText(event.getCity().getName()) : "";
        String location = !cityName.isBlank() ? cityName : extractPrimaryLocationFromVenue(venue);

        Post post = new Post();
        post.setAuthor(authorOpt.get());
        post.setContent(buildAnnouncementContent(title, eventType, venue));
        post.setHashtags(buildAnnouncementHashtags(title, eventType, venue));
        post.setLocation(location.isBlank() ? "Tunisia" : location);
        post.setVisibility("public");
        post.setLikesCount(0);
        post.setCommentsCount(0);
        post.setTotalViews(0);
        post.setRepostCount(0);
        post.setPostScore(1.0);
        post.setPostType("EVENT_ANNOUNCEMENT");
        post.setLinkedEventId(event.getEventId());
        post.setCommentsEnabled(false);
        Date now = new Date();
        post.setCreatedAt(now);
        post.setUpdatedAt(now);

        postService.addPost(post);
    }

    private String buildAnnouncementContent(String title, String eventType, String venue) {
        return "New event just dropped: " + title
            + "\nType: " + eventType
            + "\nVenue: " + venue
            + "\nTap to open the event card and book your spot.";
    }

    private String buildAnnouncementHashtags(String title, String eventType, String venue) {
        return String.join(" ",
            toHashtag("event"),
            toHashtag(venue),
            toHashtag(eventType),
            toHashtag(title)
        ).trim();
    }

    private String toHashtag(String value) {
        String source = safeText(value);
        if (source.isBlank()) {
            return "";
        }

        String normalized = Normalizer.normalize(source, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "_")
            .replaceAll("^_+|_+$", "");

        if (normalized.isBlank()) {
            return "";
        }
        return "#" + normalized;
    }

    private String extractPrimaryLocationFromVenue(String venue) {
        if (venue == null || venue.isBlank()) {
            return "";
        }
        String[] parts = venue.split(",");
        String first = parts.length > 0 ? parts[0].trim() : venue.trim();
        return first;
    }

    private String safeText(String value) {
        return value == null ? "" : value.trim();
    }
}