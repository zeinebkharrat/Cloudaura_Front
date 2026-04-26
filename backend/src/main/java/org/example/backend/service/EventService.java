package org.example.backend.service;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.model.Post;
import org.example.backend.model.User;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.EventReservationItemRepository;
import org.example.backend.repository.EventReservationRepository;
import org.example.backend.repository.TicketTypeRepository;
import org.example.backend.repository.UserRepository;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private EventReservationRepository eventReservationRepository;

    @Autowired
    private EventReservationItemRepository eventReservationItemRepository;

    @Autowired
    private TicketTypeRepository ticketTypeRepository;

    @Autowired
    private CityRepository cityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostService postService;

    @Value("${app.community.event-announcement-user-id:5}")
    private Integer eventAnnouncementUserId;

    @Autowired
    private CatalogTranslationService catalogTranslationService;

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
    public List<Event> getAllEventsLocalized() {
        return getAllEvents().stream().map(this::withTranslatedCopy).toList();
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
    public Optional<Event> getEventByIdLocalized(Integer id) {
        return getEventById(id).map(this::withTranslatedCopy);
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

        normalizeCapacity(event);

        applyAutomaticStatusByDate(event);
        Event saved = eventRepository.save(event);

        if (isNewEvent) {
            createCommunityAnnouncementPost(saved);
        }

        return saved;
    }

    @Transactional
    public boolean reserveSeats(Integer eventId, int quantity) {
        if (eventId == null || quantity <= 0) {
            return false;
        }
        return eventRepository.reserveSpotsIfAvailable(eventId, quantity) > 0;
    }

    @Transactional
    public void reserveSeatsOrThrow(Integer eventId, int requestedTickets) {
        if (eventId == null || requestedTickets <= 0) {
            throw new IllegalArgumentException("requestedTickets must be positive");
        }
        boolean reserved = eventRepository.reserveSpotsIfAvailable(eventId, requestedTickets) > 0;
        if (!reserved) {
            throw new IllegalStateException("Sold Out");
        }
    }

    @Transactional
    public boolean hasAvailableSeats(Integer eventId, int requestedQuantity) {
        if (eventId == null || requestedQuantity <= 0) {
            return false;
        }
        return eventRepository.findById(eventId)
                .map(event -> {
                    int total = Math.max(0, event.getTotalCapacity() == null ? 0 : event.getTotalCapacity());
                    int reserved = Math.max(0, event.getReservedCount() == null ? 0 : event.getReservedCount());
                    return reserved + requestedQuantity <= total;
                })
                .orElse(false);
    }

    /**
     * Removes dependent rows first so FK constraints do not surface as HTTP 409
     * ({@link org.springframework.dao.DataIntegrityViolationException}).
     */
    @Transactional
    public void deleteEvent(Integer id) {
        if (id == null) {
            return;
        }
        eventReservationItemRepository.deleteByEventReservation_Event_EventId(id);
        eventReservationRepository.deleteByEvent_EventId(id);
        ticketTypeRepository.deleteByEvent_EventId(id);
        eventRepository.deleteById(id);
    }

    private boolean applyAutomaticStatusByDate(Event event) {
        if (event == null) {
            return false;
        }

        LocalDateTime eventStartDateTime = toLocalDateTime(event.getStartDate());
        LocalDateTime eventEndDateTime = toLocalDateTime(event.getEndDate());

        if (eventStartDateTime == null && eventEndDateTime == null) {
            return false;
        }

        if (eventStartDateTime == null) {
            eventStartDateTime = eventEndDateTime;
        }
        if (eventEndDateTime == null) {
            eventEndDateTime = eventStartDateTime;
        }

        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        String desiredStatus;

        if (eventEndDateTime.isBefore(now)) {
            desiredStatus = "COMPLETED";
        } else if (!eventStartDateTime.isAfter(now)) {
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

    private LocalDateTime toLocalDateTime(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return Instant.ofEpochMilli(date.getTime())
                .atZone(ZoneId.systemDefault())
                .toLocalDateTime();
    }

    private void syncStatusesByDateInDatabase() {
        eventRepository.markCompletedByDate();
        eventRepository.markOngoingByDate();
        eventRepository.markUpcomingByDate();
    }

    private void normalizeCapacity(Event event) {
        int totalCapacity = Math.max(0, event.getTotalCapacity() == null ? 0 : event.getTotalCapacity());
        int reservedCount = Math.max(0, event.getReservedCount() == null ? 0 : event.getReservedCount());

        if (reservedCount > totalCapacity) {
            throw new IllegalArgumentException("totalCapacity must be >= reservedCount");
        }

        event.setTotalCapacity(totalCapacity);
        event.setReservedCount(reservedCount);
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
        List<String> tags = new ArrayList<>();
        addIfNotBlank(tags, toHashtag("event"));
        addIfNotBlank(tags, toHashtag(venue));
        addIfNotBlank(tags, toHashtag(eventType));
        addIfNotBlank(tags, toHashtag(title));
        return String.join(" ", tags);
    }

    private void addIfNotBlank(List<String> tags, String hashtag) {
        if (hashtag != null && !hashtag.isBlank()) {
            tags.add(hashtag);
        }
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

    private Event withTranslatedCopy(Event e) {
        if (e == null) {
            return null;
        }
        Event out = new Event();
        BeanUtils.copyProperties(e, out, "city", "title", "venue");
        out.setCity(e.getCity());
        int eventId = e.getEventId() != null ? e.getEventId() : 0;
        String rawTitle = e.getTitle();
        if (CatalogKeyUtil.looksLikeCatalogKey(rawTitle)) {
            out.setTitle(null);
        } else {
            out.setTitle(catalogTranslationService.resolveEntityField(eventId, "event", "name", rawTitle));
        }
        String rawVenue = e.getVenue();
        if (rawVenue == null || CatalogKeyUtil.looksLikeCatalogKey(rawVenue)) {
            out.setVenue(rawVenue);
        } else {
            out.setVenue(catalogTranslationService.resolveEntityField(eventId, "event", "venue", rawVenue));
        }
        return out;
    }
}