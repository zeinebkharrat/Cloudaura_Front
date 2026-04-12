package org.example.backend.service;

import jakarta.transaction.Transactional;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class EventService {

    @Autowired
    private EventRepository eventRepository;

    // --- ajoute ceci ---
    @Autowired
    private CityRepository cityRepository;

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
        // Si une ville est fournie avec un ID
        if (event.getCity() != null && event.getCity().getCityId() != null) {
            City city = cityRepository.findById(event.getCity().getCityId())
                    .orElse(null); // Si pas trouvé, on met null au lieu de faire planter
            event.setCity(city);
        } else {
            event.setCity(null); // Autorise l'ajout sans ville si besoin
        }

        applyAutomaticStatusByDate(event);

        return eventRepository.save(event);
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
}