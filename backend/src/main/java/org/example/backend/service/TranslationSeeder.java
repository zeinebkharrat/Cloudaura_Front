package org.example.backend.service;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.backend.i18n.CatalogKeyUtil;
import org.example.backend.i18n.LanguageUtil;
import org.example.backend.model.Accommodation;
import org.example.backend.model.Activity;
import org.example.backend.model.City;
import org.example.backend.model.Event;
import org.example.backend.model.Product;
import org.example.backend.model.Restaurant;
import org.example.backend.model.TicketType;
import org.example.backend.repository.AccommodationRepository;
import org.example.backend.repository.ActivityRepository;
import org.example.backend.repository.CatalogTranslationRepository;
import org.example.backend.repository.CityRepository;
import org.example.backend.repository.EventRepository;
import org.example.backend.repository.ProductRepository;
import org.example.backend.repository.RestaurantRepository;
import org.example.backend.repository.TicketTypeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Fills the {@code translations} table from business entities (French source → EN/AR via
 * {@link TranslationService}). Enable with {@code app.seeder.translations.enabled=true}.
 *
 * <p>Validation query (run after seeding to find keys missing any language):
 *
 * <pre>{@code
 * -- Run after seeding to find missing translations:
 * SELECT translation_key,
 *   SUM(lang = 'fr') as has_fr,
 *   SUM(lang = 'en') as has_en,
 *   SUM(lang = 'ar') as has_ar
 * FROM translations
 * GROUP BY translation_key
 * HAVING has_fr = 0 OR has_en = 0 OR has_ar = 0;
 * }</pre>
 */
@Component
@ConditionalOnProperty(name = "app.seeder.translations.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class TranslationSeeder implements ApplicationRunner {

    private final ProductRepository productRepository;
    private final CityRepository cityRepository;
    private final ActivityRepository activityRepository;
    private final AccommodationRepository accommodationRepository;
    private final EventRepository eventRepository;
    private final RestaurantRepository restaurantRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final CatalogTranslationRepository translationRepository;
    private final TranslationService translationService;
    private final PlatformTransactionManager transactionManager;

    @Value("${app.seeder.translations.delay-ms:300}")
    private long delayBetweenCalls;

    @Value("${app.seeder.translations.max-entities:100}")
    private int maxEntities;

    private TransactionTemplate transactionTemplate;

    @Override
    public void run(ApplicationArguments args) {
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        seedProducts();
        seedCities();
        seedActivities();
        seedAccommodations();
        seedEvents();
        seedTicketTypes();
        seedRestaurants();
        seedShops();
        seedApiCatalogKeys();
        logSummary();
    }

    private void seedProducts() {
        List<Product> all = cap(productRepository.findAll(), "products");
        log.info("Seeding translations for {} products...", all.size());
        for (Product p : all) {
            try {
                int id = p.getProductId();
                seedField("product." + id + ".name", p.getName());
                seedField("product." + id + ".description", p.getDescription());
            } catch (Exception e) {
                log.error("Failed to seed product id={}: {}", p.getProductId(), e.getMessage());
            }
        }
    }

    private void seedCities() {
        List<City> all = cap(cityRepository.findAll(), "cities");
        log.info("Seeding translations for {} cities...", all.size());
        for (City c : all) {
            try {
                int id = c.getCityId();
                seedField("city." + id + ".name", c.getName());
                seedField("city." + id + ".region", c.getRegion());
                seedField("city." + id + ".description", c.getDescription());
            } catch (Exception e) {
                log.error("Failed to seed city id={}: {}", c.getCityId(), e.getMessage());
            }
        }
    }

    private void seedActivities() {
        List<Activity> all = cap(activityRepository.findAll(), "activities");
        log.info("Seeding translations for {} activities...", all.size());
        if (!all.isEmpty()) {
            Activity sample = all.get(0);
            log.info(
                    "[SEEDER] Activity sample — activityId={} name='{}' descPrefix='{}'",
                    sample.getActivityId(),
                    sample.getName() == null ? "NULL" : sample.getName(),
                    sample.getDescription() == null
                            ? "NULL"
                            : sample.getDescription().substring(0, Math.min(40, sample.getDescription().length())));
        }
        for (Activity a : all) {
            try {
                int id = a.getActivityId();
                seedField("activity." + id + ".name", a.getName());
                seedField("activity." + id + ".description", a.getDescription());
                seedField("activity." + id + ".type", a.getType());
                seedField("activity." + id + ".address", a.getAddress());
            } catch (Exception e) {
                log.error("Failed to seed activity id={}: {}", a.getActivityId(), e.getMessage());
            }
        }
    }

    /** PK {@code accommodation_id} → {@link Accommodation#getAccommodationId()}. Clés {@code accommodation.{id}.name}. */
    private void seedAccommodations() {
        List<Accommodation> all = accommodationRepository.findAll();
        log.info("[SEEDER] Accommodations : {} entrées à traiter", all.size());
        if (!all.isEmpty()) {
            Accommodation sample = all.get(0);
            log.info(
                    "[SEEDER] Accommodation sample — accommodationId={} name='{}' (pas de champ description JPA)",
                    sample.getAccommodationId(),
                    sample.getName() == null ? "NULL" : sample.getName());
        }
        int count = 0;
        for (Accommodation a : all) {
            if (count++ >= maxEntities) {
                log.warn("[SEEDER] Limite max-entities atteinte pour accommodations");
                break;
            }
            try {
                Integer aid = a.getAccommodationId();
                if (aid == null) {
                    log.warn("[SEEDER] Accommodation sans accommodationId — ignorée");
                    continue;
                }
                if (a.getName() == null || a.getName().isBlank()) {
                    log.warn("[SEEDER] Accommodation id={} sans nom — skip", aid);
                    continue;
                }
                seedField("accommodation." + aid + ".name", a.getName());
                // Pas de champ description sur l'entité Accommodation — rien d'autre à enregistrer.
            } catch (Exception e) {
                log.error("[SEEDER] Échec accommodation id={}: {}", a.getAccommodationId(), e.getMessage());
            }
        }
    }

    /** PK {@code event_id} → {@link Event#getEventId()}. Clés {@code event.{id}.name}, {@code event.{id}.venue}. */
    private void seedEvents() {
        List<Event> all = eventRepository.findAll();
        log.info("[SEEDER] Events : {} entrées à traiter", all.size());
        if (!all.isEmpty()) {
            Event sample = all.get(0);
            log.info(
                    "[SEEDER] Event sample — eventId={} title(name)='{}' (pas de champ description JPA)",
                    sample.getEventId(),
                    sample.getTitle() == null ? "NULL" : sample.getTitle());
        }
        int count = 0;
        for (Event ev : all) {
            if (count++ >= maxEntities) {
                log.warn("[SEEDER] Limite max-entities atteinte pour events");
                break;
            }
            try {
                Integer id = ev.getEventId();
                if (id == null) {
                    log.warn("[SEEDER] Event sans eventId — ignoré");
                    continue;
                }
                if (ev.getTitle() == null || ev.getTitle().isBlank()) {
                    log.warn("[SEEDER] Event id={} sans titre — skip", id);
                    continue;
                }
                seedField("event." + id + ".name", ev.getTitle());
                seedField("event." + id + ".venue", ev.getVenue());
                // Pas de champ description sur l'entité Event.
            } catch (Exception e2) {
                log.error("[SEEDER] Échec event id={}: {}", ev.getEventId(), e2.getMessage());
            }
        }
    }

    /**
     * Entité {@link Restaurant} : PK {@code restaurant_id} → {@link Restaurant#getRestaurantId()}. Seeder catalogue
     * : {@code name}, {@code description} uniquement. {@code cuisineType} et {@code address} restent en base tels
     * quels (pas de clés {@code restaurant.*.cuisineType|address}).
     */
    private void seedRestaurants() {
        List<Restaurant> all = restaurantRepository.findAll();
        log.info("[SEEDER] Restaurants : {} entrées à traiter", all.size());
        if (!all.isEmpty()) {
            Restaurant sample = all.get(0);
            String descPreview =
                    sample.getDescription() == null
                            ? "NULL"
                            : sample.getDescription()
                                    .substring(0, Math.min(40, sample.getDescription().length()));
            log.info(
                    "[SEEDER] Restaurant sample — restaurantId={} name='{}' descPrefix='{}'",
                    sample.getRestaurantId(),
                    sample.getName() == null ? "NULL" : sample.getName(),
                    descPreview);
        }
        int count = 0;
        for (Restaurant r : all) {
            if (count++ >= maxEntities) {
                log.warn("[SEEDER] Limite max-entities atteinte pour restaurants");
                break;
            }
            try {
                Integer rid = r.getRestaurantId();
                if (rid == null) {
                    log.warn("[SEEDER] Restaurant sans restaurantId — entrée ignorée");
                    continue;
                }
                int id = rid;
                if (r.getName() == null || r.getName().isBlank()) {
                    log.warn("[SEEDER] Restaurant id={} sans nom — skip seed name/description", id);
                    continue;
                }
                seedField("restaurant." + id + ".name", r.getName());
                seedField("restaurant." + id + ".description", r.getDescription());
            } catch (Exception e) {
                log.error("[SEEDER] Échec restaurant id={}: {}", r.getRestaurantId(), e.getMessage());
            }
        }
    }

    /**
     * Pas d'entité {@code Shop} : la boutique utilise {@link Product} (PK {@code product_id} →
     * {@link Product#getProductId()}, clés {@code product.{id}.*}) via {@link #seedProducts()}.
     */
    private void seedShops() {
        log.info("[SEEDER] Shops : 0 entrée (pas d'entité Shop — catalogue panier = product.*).");
    }

    private void seedTicketTypes() {
        try {
            List<TicketType> all = cap(ticketTypeRepository.findAll(), "ticket types");
            log.info("Seeding translations for {} ticket types...", all.size());
            for (TicketType t : all) {
                try {
                    // No stable "code" column: use numeric id as the ticket type code segment.
                    String code = String.valueOf(t.getTicketTypeId());
                    seedField("ticket.type." + code, t.getTicketNomevent());
                } catch (Exception e) {
                    log.error("Failed to seed ticket type id={}: {}", t.getTicketTypeId(), e.getMessage());
                }
            }
        } catch (DataAccessException e) {
            log.warn("Skipping ticket types seeding (table or mapping unavailable): {}", e.getMessage());
        }
    }

    private void seedApiCatalogKeys() {
        upsertTriple("api.scan.qr_required", "QR code requis", "QR code required", "رمز QR مطلوب");
        upsertTriple("api.scan.no_ticket", "Aucun billet trouvé", "No ticket found", "لم يتم العثور على تذكرة");
        upsertTriple("api.scan.validated_ok", "Billet validé", "Ticket validated", "تم التحقق من التذكرة");
        upsertTriple("api.scan.already_used", "Billet déjà utilisé", "Ticket already used", "التذكرة مستخدمة مسبقاً");

        upsertTriple("reservation.status.pending", "En attente", "Pending", "قيد الانتظار");
        upsertTriple("reservation.status.confirmed", "Confirmée", "Confirmed", "مؤكدة");
        upsertTriple("reservation.status.cancelled", "Annulée", "Cancelled", "ملغاة");
        upsertTriple("reservation.status.completed", "Terminée", "Completed", "مكتملة");

        upsertTriple("payment.status.success", "Paiement réussi", "Payment successful", "تم الدفع بنجاح");
        upsertTriple("payment.status.failed", "Paiement échoué", "Payment failed", "فشل الدفع");
        upsertTriple("payment.status.pending", "Paiement en cours", "Payment pending", "الدفع قيد المعالجة");
        upsertTriple("payment.status.refunded", "Remboursé", "Refunded", "تم الاسترداد");
    }

    private void upsertTriple(String key, String fr, String en, String ar) {
        upsert(key, "fr", fr);
        upsert(key, "en", en);
        upsert(key, "ar", ar);
    }

    private void seedField(String key, String frValue) {
        if (frValue == null || frValue.isBlank()) {
            return;
        }
        if (CatalogKeyUtil.looksLikeCatalogKey(frValue)) {
            log.warn("Skipping raw catalog key stored as data: key={} value={}", key, frValue);
            return;
        }

        upsert(key, "fr", frValue);

        if (!translationRepository.existsByTranslationKeyAndLang(key, "en")) {
            try {
                String en = translationService.translate(frValue, "fr", "en");
                if (en.equalsIgnoreCase(frValue.trim())) {
                    log.warn(
                            "[SEEDER] Traduction EN inchangée pour key={} "
                                    + "— nom propre probable ou échec API silencieux. Valeur sauvegardée = source FR.",
                            key);
                }
                sleepDelay();
                upsert(key, "en", en);
            } catch (Exception e) {
                log.warn("[SEEDER] Échec EN pour key={}: {}", key, e.getMessage());
                upsert(key, "en", frValue);
            }
        }

        if (!translationRepository.existsByTranslationKeyAndLang(key, "ar")) {
            try {
                String ar = translationService.translate(frValue, "fr", "ar");
                if (ar.equalsIgnoreCase(frValue.trim())) {
                    log.warn(
                            "[SEEDER] Traduction AR inchangée pour key={} "
                                    + "— nom propre probable ou échec API silencieux. Valeur sauvegardée = source FR.",
                            key);
                }
                sleepDelay();
                upsert(key, "ar", ar);
            } catch (Exception e) {
                log.warn("[SEEDER] Échec AR pour key={}: {}", key, e.getMessage());
                upsert(key, "ar", frValue);
            }
        }
    }

    private void upsert(String key, String lang, String value) {
        if (key == null || key.isBlank() || lang == null || lang.isBlank()) {
            return;
        }
        String v = value != null ? value : "";
        String l = LanguageUtil.normalize(lang);
        transactionTemplate.executeWithoutResult(
                status -> translationRepository.upsertTranslation(key.trim(), l, v));
    }

    private void sleepDelay() {
        if (delayBetweenCalls <= 0) {
            return;
        }
        try {
            Thread.sleep(delayBetweenCalls);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Seeder delay interrupted");
        }
    }

    private <T> List<T> cap(List<T> all, String label) {
        if (all == null || all.isEmpty()) {
            return List.of();
        }
        if (all.size() <= maxEntities) {
            return all;
        }
        log.warn(
                "Capping {} count from {} to {} (app.seeder.translations.max-entities); re-run later for the remainder.",
                label,
                all.size(),
                maxEntities);
        return all.subList(0, maxEntities);
    }

    private void logSummary() {
        long total = translationRepository.count();
        log.info("=== TranslationSeeder complete ===");
        log.info("Total rows in translations table: {}", total);
        List<String> langs = List.of("fr", "en", "ar");
        for (String lang : langs) {
            long count = translationRepository.countByLang(lang);
            log.info("  lang={} → {} rows", lang, count);
        }
        log.info("==================================");
    }
}
