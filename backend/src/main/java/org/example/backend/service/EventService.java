package org.example.backend.service;

import java.util.List;
import java.util.Optional;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private CityRepository cityRepository;

    @Autowired
    private CatalogTranslationService catalogTranslationService;

    public List<Event> getAllEvents() {
        return eventRepository.findAll();
    }

    /**
     * Same as {@link #getAllEvents()} with titles resolved from the {@code translations} table for the request language.
     */
    @Transactional(readOnly = true)
    public List<Event> getAllEventsLocalized() {
        return getAllEvents().stream().map(this::withTranslatedCopy).toList();
    }

    public Optional<Event> getEventById(Integer id) {
        return eventRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Event> getEventByIdLocalized(Integer id) {
        return getEventById(id).map(this::withTranslatedCopy);
    }

    @Transactional
    public Event createOrUpdateEvent(Event event) {
        // Si une ville est fournie avec un ID
        if (event.getCity() != null && event.getCity().getCityId() != null) {
            City city = cityRepository.findById(event.getCity().getCityId())
                    .orElse(null); // Si pas trouvé, on met null au lieu de faire planter
            event.setCity(city);
        } else {
            event.setCity(null); // Autorise l'ajout sans ville si besoin
        }

        return eventRepository.save(event);
    }

    public void deleteEvent(Integer id) {
        eventRepository.deleteById(id);
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