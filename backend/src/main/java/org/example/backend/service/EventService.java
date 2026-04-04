package org.example.backend.service;

import jakarta.transaction.Transactional;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class EventService {

    @Autowired
    private EventRepository eventRepository;

    // --- ajoute ceci ---
    @Autowired
    private CityRepository cityRepository;

    public List<Event> getAllEvents() {
        return eventRepository.findAll();
    }

    public Optional<Event> getEventById(Integer id) {
        return eventRepository.findById(id);
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
}