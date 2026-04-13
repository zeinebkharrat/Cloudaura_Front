package org.example.backend.config;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.model.Activity;
import org.example.backend.model.Event;
import org.example.backend.model.Product;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.ProductRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Logs rows whose {@code name} / {@code title} / {@code description} look like catalog placeholder
 * keys so seed data can be fixed.
 */
@Component
@Order(50)
@ConditionalOnProperty(name = "app.translate.audit-catalog-placeholders", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class CatalogPlaceholderAuditRunner implements ApplicationRunner {

    private final ActivityRepository activityRepository;
    private final ProductRepository productRepository;
    private final EventRepository eventRepository;

    @Override
    public void run(ApplicationArguments args) {
        List<Activity> activities = activityRepository.findAll();
        for (Activity a : activities) {
            if (CatalogKeyUtil.looksLikeCatalogKey(a.getDescription())) {
                log.warn("Activity {} description looks like a catalog key: {}", a.getActivityId(), a.getDescription());
            }
            if (CatalogKeyUtil.looksLikeCatalogKey(a.getName())) {
                log.warn("Activity {} name looks like a catalog key: {}", a.getActivityId(), a.getName());
            }
        }
        List<Product> products = productRepository.findAll();
        for (Product p : products) {
            if (CatalogKeyUtil.looksLikeCatalogKey(p.getDescription())) {
                log.warn("Product {} description looks like a catalog key: {}", p.getProductId(), p.getDescription());
            }
            if (CatalogKeyUtil.looksLikeCatalogKey(p.getName())) {
                log.warn("Product {} name looks like a catalog key: {}", p.getProductId(), p.getName());
            }
        }
        List<Event> events = eventRepository.findAll();
        for (Event e : events) {
            if (CatalogKeyUtil.looksLikeCatalogKey(e.getTitle())) {
                log.warn("Event {} title looks like a catalog key: {}", e.getEventId(), e.getTitle());
            }
        }
    }
}
