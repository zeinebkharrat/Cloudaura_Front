package org.example.backend.service;

import org.example.backend.i18n.LanguageUtil;
import org.example.backend.model.Accommodation;
import org.example.backend.model.Activity;
import org.example.backend.model.CatalogTranslation;
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
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds {@code translations} rows from existing domain data (idempotent).
 */
@Component
@ConditionalOnProperty(name = "app.i18n.catalog-bootstrap.enabled", havingValue = "true", matchIfMissing = true)
@Order(50)
@RequiredArgsConstructor
public class CatalogTranslationBootstrap implements ApplicationRunner {

    private final CatalogTranslationRepository catalogTranslationRepository;
    private final CityRepository cityRepository;
    private final AccommodationRepository accommodationRepository;
    private final EventRepository eventRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final ActivityRepository activityRepository;
    private final RestaurantRepository restaurantRepository;
    private final ProductRepository productRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedScanMessages();
        for (City c : cityRepository.findAll()) {
            int id = c.getCityId();
            String name = nz(c.getName());
            String region = nz(c.getRegion());
            String desc = nz(c.getDescription());
            ensure("city." + id + ".name", "fr", name);
            ensure("city." + id + ".name", "en", name);
            ensure("city." + id + ".name", "ar", name);
            ensure("city." + id + ".region", "fr", region);
            ensure("city." + id + ".region", "en", region);
            ensure("city." + id + ".region", "ar", region);
            ensure("city." + id + ".description", "fr", desc);
            ensure("city." + id + ".description", "en", desc);
            ensure("city." + id + ".description", "ar", desc);
        }
        for (Accommodation a : accommodationRepository.findAll()) {
            int id = a.getAccommodationId();
            String name = nz(a.getName());
            ensure("accommodation." + id + ".name", "fr", name);
            ensure("accommodation." + id + ".name", "en", name);
            ensure("accommodation." + id + ".name", "ar", name);
        }
        for (Event e : eventRepository.findAll()) {
            if (e.getEventId() == null) {
                continue;
            }
            int id = e.getEventId();
            String title = nz(e.getTitle());
            ensure("event." + id + ".name", "fr", title);
            ensure("event." + id + ".name", "en", title);
            ensure("event." + id + ".name", "ar", title);
            String venue = nz(e.getVenue());
            if (!venue.isEmpty()) {
                ensure("event." + id + ".venue", "fr", venue);
                ensure("event." + id + ".venue", "en", venue);
                ensure("event." + id + ".venue", "ar", venue);
            }
        }
        for (Activity act : activityRepository.findAll()) {
            if (act.getActivityId() == null) {
                continue;
            }
            int id = act.getActivityId();
            ensure("activity." + id + ".name", "fr", nz(act.getName()));
            ensure("activity." + id + ".name", "en", nz(act.getName()));
            ensure("activity." + id + ".name", "ar", nz(act.getName()));
            ensure("activity." + id + ".description", "fr", nz(act.getDescription()));
            ensure("activity." + id + ".description", "en", nz(act.getDescription()));
            ensure("activity." + id + ".description", "ar", nz(act.getDescription()));
            ensure("activity." + id + ".type", "fr", nz(act.getType()));
            ensure("activity." + id + ".type", "en", nz(act.getType()));
            ensure("activity." + id + ".type", "ar", nz(act.getType()));
            ensure("activity." + id + ".address", "fr", nz(act.getAddress()));
            ensure("activity." + id + ".address", "en", nz(act.getAddress()));
            ensure("activity." + id + ".address", "ar", nz(act.getAddress()));
        }
        for (Restaurant r : restaurantRepository.findAll()) {
            if (r.getRestaurantId() == null) {
                continue;
            }
            int id = r.getRestaurantId();
            ensure("restaurant." + id + ".name", "fr", nz(r.getName()));
            ensure("restaurant." + id + ".name", "en", nz(r.getName()));
            ensure("restaurant." + id + ".name", "ar", nz(r.getName()));
            ensure("restaurant." + id + ".description", "fr", nz(r.getDescription()));
            ensure("restaurant." + id + ".description", "en", nz(r.getDescription()));
            ensure("restaurant." + id + ".description", "ar", nz(r.getDescription()));
        }
        for (Product p : productRepository.findAll()) {
            if (p.getProductId() == null) {
                continue;
            }
            int id = p.getProductId();
            ensure("product." + id + ".name", "fr", nz(p.getName()));
            ensure("product." + id + ".name", "en", nz(p.getName()));
            ensure("product." + id + ".name", "ar", nz(p.getName()));
            ensure("product." + id + ".description", "fr", nz(p.getDescription()));
            ensure("product." + id + ".description", "en", nz(p.getDescription()));
            ensure("product." + id + ".description", "ar", nz(p.getDescription()));
        }
        for (TicketType tt : ticketTypeRepository.findAll()) {
            if (tt.getTicketTypeId() == null) {
                continue;
            }
            int id = tt.getTicketTypeId();
            String fallback = nz(tt.getTicketNomevent());
            Event ev = tt.getEvent();
            String title = ev != null ? nz(ev.getTitle()) : "";
            String humanFr = !title.isBlank() ? title + " — billet" : fallback;
            String humanEn = !title.isBlank() ? title + " — ticket" : fallback;
            String humanAr = !title.isBlank() ? title + " — تذكرة" : fallback;
            ensure("ticket_type." + id, "fr", humanFr);
            ensure("ticket_type." + id, "en", humanEn);
            ensure("ticket_type." + id, "ar", humanAr);
        }
        seedReservationCatalog();
        seedApiAndPaymentLineCatalog();
    }

    private void seedReservationCatalog() {
        ensureTriple("reservation.status.pending", "En attente", "Pending", "قيد الانتظار");
        ensureTriple("reservation.status.confirmed", "Confirmée", "Confirmed", "مؤكدة");
        ensureTriple("reservation.status.cancelled", "Annulée", "Cancelled", "ملغاة");
        ensureTriple("reservation.status.unknown", "Inconnu", "Unknown", "غير معروف");

        ensureTriple("reservation.payment.status.pending", "Paiement en attente", "Payment pending", "الدفع معلق");
        ensureTriple("reservation.payment.status.paid", "Payé", "Paid", "مدفوع");
        ensureTriple("reservation.payment.status.refunded", "Remboursé", "Refunded", "مسترد");
        ensureTriple("reservation.payment.status.unknown", "—", "—", "—");

        ensureTriple("reservation.payment.method.cash", "Espèces", "Cash", "نقداً");
        ensureTriple("reservation.payment.method.konnect", "Konnect", "Konnect", "Konnect");
        ensureTriple("reservation.payment.method.stripe", "Carte bancaire (Stripe)", "Card (Stripe)", "بطاقة (Stripe)");
        ensureTriple("reservation.payment.method.paypal", "PayPal", "PayPal", "PayPal");
        ensureTriple("reservation.payment.method.unknown", "—", "—", "—");

        ensureTriple("reservation.transport_type.bus", "Bus", "Bus", "حافلة");
        ensureTriple("reservation.transport_type.taxi", "Taxi", "Taxi", "سيارة أجرة");
        ensureTriple("reservation.transport_type.van", "Louage / Van VIP", "Van / louage", "لواج / فان");
        ensureTriple("reservation.transport_type.car", "Voiture (privée)", "Private car", "سيارة خاصة");
        ensureTriple("reservation.transport_type.plane", "Avion", "Plane", "طائرة");
        ensureTriple("reservation.transport_type.train", "Train", "Train", "قطار");
        ensureTriple("reservation.transport_type.ferry", "Ferry", "Ferry", "عبّارة");

        ensureTriple("reservation.room_type.single", "Chambre simple", "Single room", "غرفة فردية");
        ensureTriple("reservation.room_type.double", "Chambre double", "Double room", "غرفة مزدوجة");
        ensureTriple("reservation.room_type.suite", "Suite", "Suite", "جناح");
        ensureTriple("reservation.room_type.family", "Chambre familiale", "Family room", "غرفة عائلية");
        ensureTriple("reservation.room_type.studio", "Studio", "Studio", "استوديو");

        ensureTriple("reservation.payment.transport_prefix", "Transport", "Transport", "نقل");
        ensureTriple("reservation.payment.accommodation_prefix", "Hébergement", "Accommodation", "إقامة");
        ensureTriple("reservation.payment.reservation_word", "réservation", "reservation", "حجز");
        ensureTriple(
                "reservation.payment.stripe_tnd_ref_suffix",
                " (réf. %.2f TND)",
                " (ref. %.2f TND)",
                " (مرجع %.2f د.ت)");

        ensureTriple(
                "reservation.error.reservation_not_found",
                "Réservation introuvable.",
                "Reservation not found.",
                "الحجز غير موجود.");
        ensureTriple(
                "reservation.error.transport_not_found",
                "Transport non trouvé.",
                "Transport not found.",
                "وسيلة النقل غير موجودة.");
        ensureTriple(
                "reservation.error.user_not_found",
                "Utilisateur introuvable.",
                "User not found.",
                "المستخدم غير موجود.");
        ensureTriple(
                "reservation.error.transport_missing_for_reservation",
                "Réservation incomplète : transport manquant.",
                "Incomplete reservation: missing transport.",
                "حجز غير مكتمل: وسيلة النقل مفقودة.");
        ensureTriple(
                "reservation.error.use_checkout_for_stripe",
                "Utilisez le paiement par carte via l’endpoint checkout-session.",
                "Use the checkout-session endpoint to pay by card.",
                "استخدم مسار checkout-session للدفع بالبطاقة.");
        ensureTriple(
                "reservation.error.use_paypal_endpoint",
                "Utilisez l’endpoint PayPal dédié pour ce paiement.",
                "Use the dedicated PayPal endpoint for this payment.",
                "استخدم مسار PayPal المخصص لهذا الدفع.");
        ensureTriple(
                "reservation.error.idempotency_corrupt",
                "Erreur d’idempotence : clé existante mais réservation introuvable.",
                "Idempotency error: key exists but reservation is missing.",
                "خطأ في المفتاح: المفتاح موجود لكن الحجز مفقود.");
        ensureTriple(
                "reservation.error.already_confirmed_checkout",
                "Cette réservation est déjà confirmée.",
                "This reservation is already confirmed.",
                "هذا الحجز مؤكد مسبقاً.");
        ensureTriple(
                "reservation.error.paypal_amount_mismatch",
                "Montant incohérent avec le tarif affiché.",
                "Amount does not match the quoted fare.",
                "المبلغ لا يطابق السعر المعروض.");
        ensureTriple(
                "reservation.error.email_required_paypal",
                "Un e-mail est requis pour payer avec PayPal.",
                "An email is required to pay with PayPal.",
                "البريد الإلكتروني مطلوب للدفع عبر PayPal.");
        ensureTriple(
                "reservation.error.not_paypal_reservation",
                "Cette réservation n’est pas un paiement PayPal.",
                "This reservation is not a PayPal payment.",
                "هذا الحجز ليس دفع PayPal.");
        ensureTriple(
                "reservation.error.paypal_finalize_failed",
                "Impossible de finaliser le paiement PayPal.",
                "Could not finalize the PayPal payment.",
                "تعذر إتمام دفع PayPal.");
        ensureTriple(
                "reservation.error.paypal_capture_incomplete",
                "Le paiement PayPal n’est pas finalisé.",
                "PayPal payment was not completed.",
                "لم يكتمل دفع PayPal.");
        ensureTriple(
                "reservation.error.stripe_disabled",
                "Stripe n’est pas activé.",
                "Stripe is not enabled.",
                "Stripe غير مفعّل.");
        ensureTriple(
                "reservation.error.stripe_payment_incomplete",
                "Paiement Stripe non complété.",
                "Stripe payment was not completed.",
                "لم يكتمل دفع Stripe.");
        ensureTriple(
                "reservation.error.stripe_session_invalid",
                "Session Stripe invalide.",
                "Invalid Stripe session.",
                "جلسة Stripe غير صالحة.");
        ensureTriple(
                "reservation.error.not_stripe_reservation",
                "Cette réservation n’est pas un paiement Stripe.",
                "This reservation is not a Stripe payment.",
                "هذا الحجز ليس دفع Stripe.");
        ensureTriple(
                "reservation.error.stripe_metadata_invalid",
                "Métadonnées Stripe invalides.",
                "Invalid Stripe metadata.",
                "بيانات Stripe الوصفية غير صالحة.");
        ensureTriple(
                "reservation.error.stripe_verify_failed",
                "Impossible de valider la session Stripe.",
                "Could not validate the Stripe session.",
                "تعذر التحقق من جلسة Stripe.");
        ensureTriple(
                "reservation.error.already_cancelled",
                "Déjà annulée.",
                "Already cancelled.",
                "ملغاة مسبقاً.");
        ensureTriple(
                "reservation.error.cannot_modify_cancelled",
                "Réservation annulée — impossible de modifier.",
                "Cancelled reservation — cannot modify.",
                "حجز ملغى — لا يمكن التعديل.");
        ensureTriple(
                "reservation.error.transport_incomplete",
                "Données transport incomplètes pour cette réservation.",
                "Incomplete transport data for this reservation.",
                "بيانات النقل غير كاملة لهذا الحجز.");
        ensureTriple(
                "reservation.error.invalid_seat_count",
                "Nombre de places invalide.",
                "Invalid seat count.",
                "عدد المقاعد غير صالح.");
        ensureTriple(
                "reservation.error.no_seats_for_trip",
                "Pas assez de places pour ce voyage.",
                "Not enough seats for this trip.",
                "لا توجد مقاعد كافية لهذه الرحلة.");
        ensureTriple(
                "reservation.error.transport_invalid",
                "Transport invalide.",
                "Invalid transport.",
                "وسيلة نقل غير صالحة.");
        ensureTriple(
                "reservation.error.transport_inactive",
                "Transport inactif.",
                "Transport is inactive.",
                "وسيلة النقل غير نشطة.");
        ensureTriple(
                "reservation.error.transport_capacity_missing",
                "Capacité du transport non configurée. Impossible de réserver.",
                "Transport capacity is not configured. Cannot book.",
                "سعة النقل غير مهيأة. لا يمكن الحجز.");
        ensureTriple(
                "reservation.error.taxi_km_required",
                "Le kilométrage estimé est obligatoire pour un taxi.",
                "Estimated distance (km) is required for a taxi.",
                "المسافة التقديرية بالكيلومترات مطلوبة للأجرة.");
        ensureTriple(
                "reservation.error.invalid_travel_date",
                "Format de date de voyage invalide.",
                "Invalid travel date format.",
                "تنسيق تاريخ السفر غير صالح.");
        ensureTriple(
                "reservation.error.access_not_owner",
                "Cette réservation ne vous appartient pas.",
                "This reservation does not belong to you.",
                "هذا الحجز لا يخصك.");

        ensureTriple(
                "reservation.error.room_not_found",
                "Chambre introuvable.",
                "Room not found.",
                "الغرفة غير موجودة.");
        ensureTriple(
                "reservation.error.offer_not_found",
                "Offre introuvable.",
                "Offer not found.",
                "العرض غير موجود.");
        ensureTriple(
                "reservation.error.checkin_before_checkout",
                "La date d’arrivée doit être avant la date de départ.",
                "Check-in must be before check-out.",
                "تاريخ الوصول يجب أن يكون قبل المغادرة.");
        ensureTriple(
                "reservation.error.room_unavailable_dates",
                "La chambre n’est plus disponible pour ces dates.",
                "The room is no longer available for these dates.",
                "الغرفة لم تعد متاحة لهذه التواريخ.");
        ensureTriple(
                "reservation.error.already_cancelled_stay",
                "Déjà annulée.",
                "Already cancelled.",
                "ملغاة مسبقاً.");
        ensureTriple(
                "reservation.error.cancellation_window",
                "Annulation impossible moins de 24h avant l’arrivée.",
                "Cancellation is not allowed less than 24 hours before check-in.",
                "لا يمكن الإلغاء قبل أقل من 24 ساعة من الوصول.");
        ensureTriple(
                "reservation.error.cancellation_window_transport",
                "Annulation impossible moins de 24h avant le départ.",
                "Cancellation is not allowed less than 24 hours before departure.",
                "لا يمكن الإلغاء قبل أقل من 24 ساعة من موعد الانطلاق.");
        ensureTriple(
                "reservation.error.stay_cancelled",
                "Réservation annulée.",
                "Reservation cancelled.",
                "الحجز ملغى.");
        ensureTriple(
                "reservation.error.stay_no_room",
                "Réservation sans chambre.",
                "Reservation has no room.",
                "حجز بدون غرفة.");
        ensureTriple(
                "reservation.error.checkin_checkout_required",
                "checkIn et checkOut sont requis.",
                "checkIn and checkOut are required.",
                "checkIn و checkOut مطلوبان.");
        ensureTriple(
                "reservation.error.date_overlap_room",
                "Ces dates chevauchent une autre réservation pour cette chambre.",
                "These dates overlap another reservation for this room.",
                "هذه التواريخ تتداخل مع حجز آخر لهذه الغرفة.");
        ensureTriple(
                "reservation.error.stripe_not_enabled_accommodation",
                "Stripe n’est pas activé.",
                "Stripe is not enabled.",
                "Stripe غير مفعّل.");
        ensureTriple(
                "reservation.error.stripe_invalid_accommodation_session",
                "Session Stripe invalide.",
                "Invalid Stripe session.",
                "جلسة Stripe غير صالحة.");

        ensureTriple(
                "reservation.error.activity_not_found",
                "Activité introuvable.",
                "Activity not found.",
                "النشاط غير موجود.");
        ensureTriple(
                "reservation.error.reservation_date_iso",
                "reservationDate doit être au format ISO yyyy-MM-dd",
                "reservationDate must be ISO yyyy-MM-dd",
                "reservationDate يجب أن يكون بصيغة ISO yyyy-MM-dd");
        ensureTriple(
                "reservation.error.reservation_date_future",
                "La date de réservation doit être aujourd’hui ou plus tard",
                "Reservation date must be today or later",
                "تاريخ الحجز يجب أن يكون اليوم أو لاحقاً");
        ensureTriple(
                "reservation.error.number_of_people",
                "numberOfPeople doit être >= 1",
                "numberOfPeople must be >= 1",
                "numberOfPeople يجب أن يكون >= 1");
        ensureTriple(
                "reservation.error.quota_exceeded",
                "Plus de places disponibles pour cette date.",
                "No more spots available for this date.",
                "لا مزيد من الأماكن المتاحة في هذا التاريخ.");
        ensureTriple(
                "reservation.error.days_range",
                "days doit être entre 1 et 120",
                "days must be between 1 and 120",
                "days يجب أن يكون بين 1 و 120");
        ensureTriple(
                "reservation.error.participants_min",
                "participants doit être >= 1",
                "participants must be >= 1",
                "participants يجب أن يكون >= 1");
        ensureTriple(
                "reservation.error.auth_required",
                "Authentification requise",
                "Authentication required",
                "مطلوب تسجيل الدخول");
        ensureTriple(
                "reservation.error.user_auth_missing",
                "Utilisateur authentifié introuvable",
                "Authenticated user not found",
                "المستخدم المصادق عليه غير موجود");

        ensureTriple(
                "reservation.payment.stripe_not_configured",
                "Stripe n’est pas configuré.",
                "Stripe is not configured.",
                "Stripe غير مهيأ.");
        ensureTriple(
                "reservation.payment.amount_positive",
                "Le montant total doit être supérieur à 0 pour un paiement Stripe.",
                "Total amount must be greater than 0 for Stripe payment.",
                "يجب أن يكون المجموع أكبر من 0 لدفع Stripe.");
        ensureTriple(
                "reservation.payment.stripe_no_checkout_url",
                "Stripe n’a pas renvoyé d’URL de paiement.",
                "Stripe did not return a checkout URL.",
                "لم يُرجع Stripe رابط الدفع.");
        ensureTriple(
                "reservation.payment.stripe_generic_error",
                "Erreur Stripe",
                "Stripe error",
                "خطأ Stripe");
        ensureTriple(
                "reservation.payment.checkout_error",
                "Erreur",
                "Error",
                "خطأ");
        ensureTriple(
                "reservation.payment.not_completed",
                "Paiement non complété",
                "Payment not completed yet",
                "لم يكتمل الدفع بعد");
        ensureTriple(
                "reservation.payment.missing_client_reference",
                "Référence de réservation manquante sur la session",
                "Missing reservation reference on session",
                "مرجع الحجز مفقود في الجلسة");
        ensureTriple(
                "reservation.payment.invalid_client_reference",
                "Référence de réservation invalide",
                "Invalid reservation reference",
                "مرجع حجز غير صالح");
        ensureTriple(
                "reservation.payment.activity_booking_line",
                "Réservation d’activité : %s",
                "Activity booking: %s",
                "حجز نشاط: %s");
        ensureTriple(
                "reservation.payment.finalize_failed",
                "Impossible de finaliser le paiement : %s",
                "Could not finalize payment: %s",
                "تعذر إتمام الدفع: %s");
        ensureTriple(
                "reservation.error.activity_reservation_not_found",
                "Réservation d’activité introuvable",
                "Activity reservation not found",
                "حجز النشاط غير موجود");
        ensureTriple(
                "reservation.error.receipt_signature_invalid",
                "Signature du reçu invalide",
                "Invalid receipt link signature",
                "توقيع رابط الإيصال غير صالح");
        ensureTriple(
                "reservation.error.receipt_not_confirmed",
                "Reçu disponible uniquement pour les réservations confirmées",
                "Receipt is available only for confirmed reservations",
                "الإيصال متاح فقط للحجوزات المؤكدة");
        ensureTriple(
                "reservation.error.receipt_wrong_account",
                "Cette réservation appartient à un autre compte",
                "This reservation belongs to another account",
                "هذا الحجز يخص حساباً آخر");

        ensureTriple(
                "reservation.confirmation.receipt_title",
                "YallaTN+ — Reçu de paiement",
                "YallaTN+ — Payment receipt",
                "YallaTN+ — إيصال الدفع");
        ensureTriple(
                "reservation.confirmation.receipt_sub",
                "Scan réussi. Téléchargez votre confirmation PDF.",
                "Scan successful. Download your PDF confirmation.",
                "تم المسح بنجاح. نزّل تأكيدك بصيغة PDF.");
        ensureTriple(
                "reservation.confirmation.activity_label",
                "Activité",
                "Activity",
                "النشاط");
        ensureTriple(
                "reservation.confirmation.city_label",
                "Ville",
                "City",
                "المدينة");
        ensureTriple(
                "reservation.confirmation.address_label",
                "Adresse",
                "Address",
                "العنوان");
        ensureTriple(
                "reservation.confirmation.download_pdf",
                "Télécharger le PDF",
                "Download PDF",
                "تنزيل PDF");
        ensureTriple(
                "reservation.confirmation.html_title_short",
                "YallaTN+ — Reçu",
                "YallaTN+ — Receipt",
                "YallaTN+ — إيصال");
        ensureTriple(
                "reservation.confirmation.hero_image_alt",
                "Image de l’activité",
                "Activity image",
                "صورة النشاط");
        ensureTriple(
                "reservation.confirmation.fallback_city",
                "Tunisie",
                "Tunisia",
                "تونس");
        ensureTriple(
                "reservation.confirmation.fallback_address",
                "N/D",
                "N/A",
                "غير متوفر");
        ensureTriple(
                "reservation.error.activity_reservation_state",
                "État de réservation d’activité invalide.",
                "Invalid activity reservation state.",
                "حالة حجز النشاط غير صالحة.");

        ensureTriple(
                "reservation.payment.amount_invalid_stripe",
                "Montant total invalide pour le paiement.",
                "Invalid total amount for payment.",
                "مبلغ إجمالي غير صالح للدفع.");
        ensureTriple(
                "reservation.payment.amount_too_low_stripe",
                "Montant trop faible pour Stripe dans cette devise (minimum ~0,50). Augmentez places, distance ou durée.",
                "Amount is too low for Stripe in this currency (minimum ~0.50). Increase seats, distance, or duration.",
                "المبلغ منخفض جداً لـ Stripe بهذه العملة (الحد الأدنى ~0.50).");
        ensureTriple(
                "reservation.payment.stripe_unavailable",
                "Paiement Stripe indisponible : %s",
                "Stripe payment unavailable: %s",
                "دفع Stripe غير متاح: %s");
        ensureTriple(
                "reservation.payment.invalid_accommodation_reservation",
                "Réservation invalide pour Stripe.",
                "Invalid reservation for Stripe.",
                "حجز غير صالح لـ Stripe.");
        ensureTriple(
                "reservation.payment.stripe_not_configured_accommodation",
                "Stripe n’est pas configuré pour l’hébergement.",
                "Stripe is not configured for accommodation.",
                "Stripe غير مهيأ للإقامة.");

        ensureTriple(
                "payment.error.order_not_found",
                "Commande introuvable.",
                "Order not found.",
                "الطلب غير موجود.");
        ensureTriple(
                "payment.error.event_checkout_stripe_failed",
                "Le paiement par carte pour cet événement est temporairement indisponible.",
                "Card checkout for this event is temporarily unavailable.",
                "الدفع بالبطاقة لهذا الحدث غير متاح مؤقتاً.");
        ensureTriple(
                "payment.error.paypal_not_configured",
                "PayPal n’est pas configuré sur ce serveur.",
                "PayPal is not configured on this server.",
                "لم يُهيأ PayPal على هذا الخادم.");
    }

    private void seedApiAndPaymentLineCatalog() {
        ensureTriple(
                "payment.line.delivery",
                "Frais de livraison",
                "Delivery fee",
                "رسوم التوصيل");
        ensureTriple(
                "payment.line.promo_discount",
                "Réduction (code promo)",
                "Promo discount",
                "خصم ترويجي");
        ensureTriple(
                "payment.line.order_total",
                "Commande n°%s",
                "Order #%s",
                "طلب رقم %s");

        ensureTriple("api.error.access_denied", "Accès refusé", "Access denied", "تم رفض الوصول");
        ensureTriple("api.error.not_found", "Ressource introuvable.", "Resource not found.", "المورد غير موجود.");
        ensureTriple("api.error.unauthorized", "Authentification requise.", "Authentication required.", "مطلوب تسجيل الدخول.");
        ensureTriple("api.error.forbidden", "Action non autorisée.", "Forbidden.", "ممنوع.");
        ensureTriple("api.error.bad_request", "Requête invalide.", "Invalid request.", "طلب غير صالح.");
        ensureTriple(
                "api.error.invalid_id",
                "Identifiant invalide.",
                "Invalid identifier.",
                "معرّف غير صالح.");
        ensureTriple("api.error.conflict", "Conflit avec l’état actuel.", "Conflict with current state.", "تعارض مع الحالة الحالية.");
        ensureTriple(
                "api.error.stripe_checkout_failed",
                "Impossible de créer la session de paiement.",
                "Could not create checkout session.",
                "تعذر إنشاء جلسة الدفع.");
        ensureTriple(
                "api.error.giphy_not_configured",
                "Recherche GIF indisponible (clé API manquante).",
                "GIF search unavailable (API key missing).",
                "بحث GIF غير متاح (مفتاح API مفقود).");
        seedShopApiErrors();
        seedVoiceStreamApiErrors();
        seedImageApiErrors();
        seedMiscApiErrors();
        ensureTriple("api.error.request_failed", "La requête a échoué", "Request failed", "فشل الطلب");
        ensureTriple(
                "api.error.validation_failed",
                "Échec de validation",
                "Validation failed",
                "فشل التحقق من الصحة");
        ensureTriple(
                "api.error.validation.required",
                "Ce champ est obligatoire.",
                "This field is required.",
                "هذا الحقل مطلوب.");
        ensureTriple(
                "api.error.validation.invalid_format",
                "Format ou valeur non valide.",
                "Invalid format or value.",
                "تنسيق أو قيمة غير صالحة.");
        ensureTriple(
                "api.error.validation.too_short",
                "Valeur trop courte ou trop petite.",
                "Value is too short or too small.",
                "القيمة قصيرة جداً أو صغيرة جداً.");
        ensureTriple(
                "api.error.validation.too_long",
                "Valeur trop longue ou trop grande.",
                "Value is too long or too large.",
                "القيمة طويلة جداً أو كبيرة جداً.");
        ensureTriple(
                "api.error.validation.unknown_field",
                "Contrainte de validation non reconnue pour ce champ.",
                "Unrecognized validation constraint for this field.",
                "قيد تحقق غير معروف لهذا الحقل.");
        ensureTriple(
                "api.error.transport_validation",
                "Les informations de transport ne sont pas valides.",
                "The transport information is not valid.",
                "معلومات النقل غير صالحة.");
        ensureTriple(
                "api.error.external_service_unavailable",
                "Service externe momentanément indisponible.",
                "External service is temporarily unavailable.",
                "الخدمة الخارجية غير متاحة مؤقتاً.");
        ensureTriple(
                "api.error.upload_too_large",
                "Fichier trop volumineux",
                "Uploaded file is too large",
                "الملف كبير جداً");
        ensureTriple(
                "api.error.invalid_payload",
                "Corps de requête invalide",
                "Invalid request payload",
                "حمولة الطلب غير صالحة");
        ensureTriple(
                "api.error.internal",
                "Une erreur inattendue s’est produite. Veuillez réessayer plus tard.",
                "An unexpected error occurred. Please try again later.",
                "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.");
        ensureTriple(
                "api.error.data_integrity_fk",
                "Cet enregistrement ne peut pas être supprimé : d’autres données y font encore référence.",
                "This record cannot be removed because other data still references it.",
                "لا يمكن حذف هذا السجل لأن بيانات أخرى ما زالت تشير إليه.");
        ensureTriple(
                "api.error.duplicate_email",
                "Cet e-mail est déjà enregistré.",
                "This email is already registered.",
                "هذا البريد الإلكتروني مسجل مسبقاً.");
        ensureTriple(
                "api.error.duplicate_username",
                "Ce nom d’utilisateur est déjà pris.",
                "This username is already taken.",
                "اسم المستخدم هذا مستخدم مسبقاً.");
        ensureTriple(
                "api.error.duplicate_generic",
                "Cet e-mail ou ce nom d’utilisateur est déjà enregistré.",
                "This email or username is already registered.",
                "هذا البريد أو اسم المستخدم مسجل مسبقاً.");
        ensureTriple(
                "api.error.data_integrity_quiz",
                "Conflit de données quiz (doublon ou contrainte). Actualisez la page admin puis réessayez.",
                "Quiz data conflicts with existing records. Refresh the admin page and retry.",
                "تعارض في بيانات الاختبار. حدّث صفحة الإدارة وأعد المحاولة.");
        ensureTriple(
                "api.error.data_integrity_generic",
                "Cette opération entre en conflit avec des données existantes.",
                "This operation conflicts with existing data.",
                "هذه العملية تتعارض مع بيانات موجودة.");
    }

    private void seedShopApiErrors() {
        ensureTriple(
                "api.error.shop.product_quantity_required",
                "productId et quantity sont requis.",
                "productId and quantity are required.",
                "مطلوب productId و quantity.");
        ensureTriple(
                "api.error.shop.quantity_positive",
                "La quantité doit être supérieure à 0.",
                "Quantity must be greater than 0.",
                "يجب أن تكون الكمية أكبر من 0.");
        ensureTriple(
                "api.error.shop.line_quantity_required",
                "La quantité est requise pour cette ligne.",
                "Quantity is required for this line.",
                "الكمية مطلوبة لهذا السطر.");
        ensureTriple(
                "api.error.shop.product_not_found",
                "Produit introuvable.",
                "Product not found.",
                "المنتج غير موجود.");
        ensureTriple(
                "api.error.shop.variant_not_found",
                "Variante introuvable.",
                "Variant not found.",
                "المتغير غير موجود.");
        ensureTriple(
                "api.error.shop.variant_wrong_product",
                "Cette variante n’appartient pas à ce produit.",
                "This variant does not belong to this product.",
                "هذا المتغير لا ينتمي إلى هذا المنتج.");
        ensureTriple(
                "api.error.shop.insufficient_stock",
                "Stock insuffisant.",
                "Insufficient stock.",
                "المخزون غير كافٍ.");
        ensureTriple(
                "api.error.shop.insufficient_stock_cart",
                "Stock insuffisant pour ce panier.",
                "Insufficient stock for this cart.",
                "مخزون غير كافٍ لهذه السلة.");
        ensureTriple(
                "api.error.shop.line_not_found",
                "Ligne de panier introuvable.",
                "Cart line not found.",
                "سطر السلة غير موجود.");
        ensureTriple(
                "api.error.shop.line_forbidden",
                "Ligne de panier non autorisée.",
                "Cart line not allowed.",
                "سطر السلة غير مسموح.");
        ensureTriple(
                "api.error.shop.cart_empty",
                "Panier vide.",
                "Cart is empty.",
                "السلة فارغة.");
        ensureTriple(
                "api.error.shop.stock_unavailable_product",
                "Stock indisponible pour un article du panier.",
                "Stock no longer available for a cart item.",
                "المخزون لم يعد متاحاً لأحد عناصر السلة.");
        ensureTriple(
                "api.error.shop.order_access_denied",
                "Accès à la commande refusé.",
                "Order access denied.",
                "تم رفض الوصول إلى الطلب.");
        ensureTriple(
                "api.error.shop.order_line_not_found",
                "Ligne de commande introuvable.",
                "Order line not found.",
                "سطر الطلب غير موجود.");
        ensureTriple(
                "api.error.shop.order_line_modify_forbidden",
                "Modification de cette ligne non autorisée.",
                "Not allowed to modify this order line.",
                "غير مسموح بتعديل سطر الطلب هذا.");
        ensureTriple(
                "api.error.shop.user_required",
                "Utilisateur requis.",
                "User is required.",
                "المستخدم مطلوب.");
        ensureTriple(
                "api.error.shop.user_not_found",
                "Utilisateur introuvable.",
                "User not found.",
                "المستخدم غير موجود.");
    }

    private void seedImageApiErrors() {
        ensureTriple(
                "api.error.image.required",
                "Image requise.",
                "Image file is required.",
                "الصورة مطلوبة.");
        ensureTriple(
                "api.error.image.too_large",
                "Image trop volumineuse.",
                "Image exceeds allowed size.",
                "الصورة تتجاوز الحجم المسموح.");
        ensureTriple(
                "api.error.image.type_invalid",
                "Seules les images sont acceptées.",
                "Only image files are accepted.",
                "يُقبل ملفات الصور فقط.");
        ensureTriple(
                "api.error.image.provider_rejected",
                "Le fournisseur a refusé l’envoi.",
                "Image upload provider rejected the request.",
                "رفض مزود الرفع الطلب.");
        ensureTriple(
                "api.error.image.provider_no_url",
                "Le fournisseur n’a pas renvoyé d’URL.",
                "Image upload provider did not return a URL.",
                "لم يُرجع المزود رابطاً.");
        ensureTriple(
                "api.error.image.read_failed",
                "Impossible de lire le fichier téléversé.",
                "Could not read uploaded file.",
                "تعذر قراءة الملف المرفوع.");
        ensureTriple(
                "api.error.image.upload_interrupted",
                "Envoi d’image interrompu.",
                "Image upload interrupted.",
                "انقطع رفع الصورة.");
        ensureTriple(
                "api.error.image.save_failed",
                "Impossible d’enregistrer l’image sur le serveur.",
                "Could not save image on server.",
                "تعذر حفظ الصورة على الخادم.");
    }

    private void seedVoiceStreamApiErrors() {
        ensureTriple(
                "api.error.voice.audio_required",
                "Fichier audio requis.",
                "Audio file is required.",
                "ملف الصوت مطلوب.");
        ensureTriple(
                "api.error.voice.audio_too_large",
                "Fichier audio trop volumineux.",
                "Audio file is too large.",
                "ملف الصوت كبير جداً.");
        ensureTriple(
                "api.error.voice.provider_not_configured",
                "Service vocal non configuré.",
                "Voice provider is not configured.",
                "مزود الصوت غير مهيأ.");
        ensureTriple(
                "api.error.voice.provider_error",
                "Le fournisseur vocal a renvoyé une erreur.",
                "The voice provider returned an error.",
                "أعاد مزود الصوت خطأ.");
        ensureTriple(
                "api.error.voice.empty_transcription",
                "Transcription vide.",
                "Empty transcription.",
                "نسخ فارغ.");
        ensureTriple(
                "api.error.voice.audio_read_failed",
                "Impossible de lire l’audio téléversé.",
                "Unable to read uploaded audio.",
                "تعذر قراءة الصوت المرفوع.");
        ensureTriple(
                "api.error.voice.transcription_interrupted",
                "Transcription interrompue.",
                "Transcription interrupted.",
                "انقطع النسخ.");
        ensureTriple(
                "api.error.stream.audio_required",
                "Fichier audio requis.",
                "Audio file is required.",
                "ملف الصوت مطلوب.");
        ensureTriple(
                "api.error.stream.audio_type_invalid",
                "Seuls les fichiers audio sont acceptés.",
                "Only audio files are allowed.",
                "يُقبل ملفات الصوت فقط.");
        ensureTriple(
                "api.error.stream.audio_read_failed",
                "Impossible de lire l’audio téléversé.",
                "Could not read uploaded audio.",
                "تعذر قراءة الصوت المرفوع.");
        ensureTriple(
                "api.error.stream.upload_failed",
                "Échec de l’envoi vocal.",
                "Voice upload failed.",
                "فشل رفع الصوت.");
    }

    private void seedMiscApiErrors() {
        ensureTriple(
                "api.error.review_not_found",
                "Avis introuvable.",
                "Review not found.",
                "التقييم غير موجود.");
        ensureTriple(
                "api.error.review_auth_required",
                "Authentification requise pour cet avis.",
                "Authentication required for this review.",
                "مطلوب تسجيل الدخول لهذا التقييم.");
        ensureTriple(
                "api.error.review_user_missing",
                "Utilisateur authentifié introuvable.",
                "Authenticated user not found.",
                "المستخدم المصادق عليه غير موجود.");
        ensureTriple(
                "api.error.follow_invalid_user",
                "Identifiant utilisateur invalide.",
                "Invalid user id.",
                "معرف مستخدم غير صالح.");
        ensureTriple(
                "api.error.follow_self",
                "Vous ne pouvez pas vous suivre vous-même.",
                "You cannot follow yourself.",
                "لا يمكنك متابعة نفسك.");
        ensureTriple(
                "api.error.follow_follower_not_found",
                "Utilisateur source introuvable.",
                "Follower user not found.",
                "المستخدم المصدر غير موجود.");
        ensureTriple(
                "api.error.follow_target_not_found",
                "Utilisateur cible introuvable.",
                "Target user not found.",
                "المستخدم الهدف غير موجود.");
        ensureTriple(
                "api.error.event_not_found",
                "Événement introuvable.",
                "Event not found.",
                "الحدث غير موجود.");
        ensureTriple(
                "api.error.event_reservation_not_found",
                "Réservation introuvable.",
                "Reservation not found.",
                "الحجز غير موجود.");
        ensureTriple(
                "api.error.event_ticket_type_not_found",
                "Type de billet introuvable.",
                "Ticket type not found.",
                "نوع التذكرة غير موجود.");
        ensureTriple(
                "api.error.event_ticket_type_mismatch",
                "Ce type de billet n’appartient pas à cet événement.",
                "This ticket type does not belong to this event.",
                "نوع التذكرة لا ينتمي إلى هذا الحدث.");
        ensureTriple(
                "api.error.event_id_required",
                "L’identifiant d’événement est obligatoire.",
                "event_id is required.",
                "معرف الحدث مطلوب.");
        ensureTriple(
                "api.error.event_invalid_user",
                "Utilisateur invalide pour cette opération.",
                "Invalid user for this operation.",
                "مستخدم غير صالح لهذه العملية.");
        ensureTriple(
                "api.error.event_free_ticket_flow",
                "Cet événement ne propose pas de billet payant. Utilisez le flux de réservation gratuit.",
                "This event has no paid ticket. Use the free reservation flow.",
                "لا يوجد تذكرة مدفوعة لهذا الحدث.");
        ensureTriple(
                "api.error.event_stripe_amount_too_small",
                "Montant trop faible pour le paiement en ligne.",
                "Amount too small for online payment.",
                "المبلغ صغير جداً للدفع عبر الإنترنت.");
        ensureTriple(
                "api.error.event_payment_unavailable",
                "Le paiement en ligne est temporairement indisponible.",
                "Online payment is temporarily unavailable.",
                "الدفع عبر الإنترنت غير متاح مؤقتاً.");
        ensureTriple(
                "api.error.event_stripe_no_checkout_url",
                "Stripe n’a pas renvoyé d’URL de paiement.",
                "Stripe did not return a checkout URL.",
                "لم تُرجِع Stripe عنوان الدفع.");
        ensureTriple(
                "api.error.event_session_id_required",
                "sessionId est obligatoire.",
                "sessionId is required.",
                "sessionId مطلوب.");
        ensureTriple(
                "api.error.event_payment_pending",
                "Le paiement n’est pas encore terminé.",
                "Payment is not completed yet.",
                "لم يكتمل الدفع بعد.");
        ensureTriple(
                "api.error.event_session_reservation_ref_missing",
                "Référence de réservation manquante sur la session.",
                "Missing reservation reference on session.",
                "مرجع الحجز مفقود في الجلسة.");
        ensureTriple(
                "api.error.event_session_reservation_ref_invalid",
                "Référence de réservation invalide.",
                "Invalid reservation reference.",
                "مرجع حجز غير صالح.");
        ensureTriple(
                "api.error.event_ticket_metadata_missing",
                "Métadonnées du type de billet manquantes.",
                "Ticket type metadata is missing.",
                "بيانات نوع التذكرة مفقودة.");
        ensureTriple(
                "api.error.event_email_confirmation_failed",
                "La réservation a été créée, mais l’e-mail de confirmation n’a pas pu être envoyé.",
                "Registration was created, but the confirmation email could not be sent.",
                "تم إنشاء التسجيل، لكن تعذر إرسال رسالة التأكيد.");
        ensureTriple(
                "api.error.session_invalid",
                "Session invalide.",
                "Invalid session.",
                "جلسة غير صالحة.");
        ensureTriple(
                "api.error.admin_role_required",
                "Rôle administrateur requis.",
                "Admin role required.",
                "مطلوب دور المسؤول.");
        ensureTriple(
                "api.error.user_not_found",
                "Utilisateur introuvable.",
                "User not found.",
                "المستخدم غير موجود.");
        ensureTriple(
                "api.error.invalid_principal",
                "Principal d’authentification invalide.",
                "Invalid authentication principal.",
                "هوية المصادقة غير صالحة.");
        ensureTriple(
                "api.error.comment_not_found",
                "Commentaire introuvable.",
                "Comment not found.",
                "التعليق غير موجود.");
        ensureTriple(
                "api.error.comment_edit_forbidden",
                "Vous ne pouvez modifier que vos propres commentaires.",
                "You can only edit your own comments.",
                "يمكنك تعديل تعليقاتك فقط.");
        ensureTriple(
                "api.error.comment_delete_forbidden",
                "Vous ne pouvez supprimer que vos propres commentaires.",
                "You can only delete your own comments.",
                "يمكنك حذف تعليقاتك فقط.");
        ensureTriple(
                "api.error.post_not_found",
                "Publication introuvable.",
                "Post not found.",
                "المنشور غير موجود.");
        ensureTriple(
                "api.error.post_edit_forbidden",
                "Vous ne pouvez modifier que vos propres publications.",
                "You can only edit your own posts.",
                "يمكنك تعديل منشوراتك فقط.");
        ensureTriple(
                "api.error.post_delete_forbidden",
                "Vous ne pouvez supprimer que vos propres publications.",
                "You can only delete your own posts.",
                "يمكنك حذف منشوراتك فقط.");
        ensureTriple(
                "api.error.post_city_required",
                "La ville est obligatoire.",
                "City is required.",
                "المدينة مطلوبة.");
        ensureTriple(
                "api.error.post_media_empty",
                "Fichier média vide.",
                "Empty media file.",
                "ملف وسائط فارغ.");
        ensureTriple(
                "api.error.post_media_owner_only",
                "Seul le propriétaire peut téléverser des médias.",
                "Only the post owner can upload media.",
                "يمكن لمالك المنشور فقط رفع الوسائط.");
        ensureTriple(
                "api.error.chat_not_participant",
                "Vous n’êtes pas participant à cette conversation.",
                "You are not a participant in this chat room.",
                "أنت لست مشاركاً في غرفة الدردشة هذه.");
        ensureTriple(
                "api.error.chat_room_not_found",
                "Salle de discussion introuvable.",
                "Chat room not found.",
                "غرفة الدردشة غير موجودة.");
        ensureTriple(
                "api.error.chat.create_failed",
                "Impossible d’ouvrir la conversation.",
                "Could not open the conversation.",
                "تعذر فتح المحادثة.");
        ensureTriple(
                "api.error.chat.message_not_found",
                "Message introuvable.",
                "Message not found.",
                "الرسالة غير موجودة.");
        ensureTriple(
                "api.error.chat.message_delete_forbidden",
                "Suppression du message non autorisée.",
                "Message deletion not allowed.",
                "حذف الرسالة غير مسموح.");
        ensureTriple(
                "api.error.chat.cannot_dm_self",
                "Vous ne pouvez pas ouvrir une conversation avec vous-même.",
                "You cannot open a chat with yourself.",
                "لا يمكنك فتح محادثة مع نفسك.");
        ensureTriple(
                "api.error.transport.admin_has_active_bookings",
                "Impossible de désactiver : des réservations actives existent sur ce transport.",
                "Cannot deactivate: this transport has active reservations.",
                "تعطيل غير ممكن: توجد حجوزات نشطة على هذا النقل.");
        ensureTriple(
                "api.error.transport.admin_cannot_delete_has_bookings",
                "Impossible de supprimer : des réservations à venir existent. Annulez ou réaffectez-les d’abord.",
                "Cannot remove: upcoming bookings exist. Cancel or reassign them first.",
                "تعذر الحذف: توجد حجوزات قادمة.");
        ensureTriple(
                "api.error.like_toggle_failed",
                "Impossible de mettre à jour le j’aime.",
                "Could not update like.",
                "تعذر تحديث الإعجاب.");
        ensureTriple(
                "api.error.like_unlike_failed",
                "Impossible de retirer le j’aime.",
                "Could not remove like.",
                "تعذر إزالة الإعجاب.");
        ensureTriple(
                "api.error.gamification_params_required",
                "gameKind et gameId sont requis.",
                "gameKind and gameId are required.",
                "مطلوب gameKind و gameId.");
        ensureTriple(
                "api.error.gamification_name_required",
                "Le nom est requis.",
                "Name is required.",
                "الاسم مطلوب.");
        ensureTriple(
                "api.error.gamification_game_kind_required",
                "gameKind est requis.",
                "gameKind is required.",
                "gameKind مطلوب.");
        ensureTriple(
                "api.error.gamification_title_required",
                "Le titre est requis.",
                "Title is required.",
                "العنوان مطلوب.");
        ensureTriple(
                "api.error.public.date_param_invalid",
                "Paramètre date invalide (yyyy-MM-dd).",
                "Invalid date parameter (yyyy-MM-dd).",
                "معامل تاريخ غير صالح (yyyy-MM-dd).");
        ensureTriple(
                "api.error.public.from_param_invalid",
                "Paramètre from invalide (yyyy-MM-dd).",
                "Invalid from parameter (yyyy-MM-dd).",
                "معامل from غير صالح (yyyy-MM-dd).");
        ensureTriple(
                "api.error.city_not_found",
                "Ville introuvable.",
                "City not found.",
                "المدينة غير موجودة.");
        ensureTriple(
                "api.error.route_city_departure_not_found",
                "Ville de départ introuvable.",
                "Departure city not found.",
                "مدينة المغادرة غير موجودة.");
        ensureTriple(
                "api.error.route_city_arrival_not_found",
                "Ville d’arrivée introuvable.",
                "Arrival city not found.",
                "مدينة الوصول غير موجودة.");
        ensureTriple(
                "api.error.transport.admin_departure_city_not_found",
                "Ville de départ introuvable.",
                "Departure city not found.",
                "مدينة المغادرة غير موجودة.");
        ensureTriple(
                "api.error.transport.admin_arrival_city_not_found",
                "Ville d’arrivée introuvable.",
                "Arrival city not found.",
                "مدينة الوصول غير موجودة.");
        ensureTriple(
                "api.error.transport.admin_not_found",
                "Transport introuvable.",
                "Transport not found.",
                "وسيلة النقل غير موجودة.");
        ensureTriple(
                "api.error.transport.admin_conflict",
                "Conflit lors de l’enregistrement du transport.",
                "Conflict while saving transport.",
                "تعارض عند حفظ النقل.");
        ensureTriple(
                "api.error.accommodation_not_found",
                "Hébergement introuvable.",
                "Accommodation not found.",
                "الإقامة غير موجودة.");
        ensureTriple(
                "api.error.restaurant_not_found",
                "Restaurant introuvable.",
                "Restaurant not found.",
                "المطعم غير موجود.");
        ensureTriple(
                "api.error.activity_not_found",
                "Activité introuvable.",
                "Activity not found.",
                "النشاط غير موجود.");
        ensureTriple(
                "api.error.activity_media_not_found",
                "Média d’activité introuvable.",
                "Activity media not found.",
                "وسائط النشاط غير موجودة.");
        ensureTriple(
                "api.error.city_media_not_found",
                "Média de ville introuvable.",
                "City media not found.",
                "وسائط المدينة غير موجودة.");
        ensureTriple(
                "api.error.explore_no_cities",
                "Aucune ville configurée.",
                "No cities configured.",
                "لا توجد مدن مهيأة.");
        ensureTriple(
                "api.error.explore_city_map_not_found",
                "Aucune ville ne correspond à cette carte.",
                "No city matches this map.",
                "لا توجد مدينة تطابق هذه الخريطة.");
        ensureTriple(
                "api.error.reservation_date_invalid",
                "reservationDate invalide (yyyy-MM-dd).",
                "reservationDate invalid (yyyy-MM-dd).",
                "reservationDate غير صالح (yyyy-MM-dd).");
        ensureTriple(
                "api.error.paypal.no_approval_url",
                "PayPal n’a pas renvoyé de lien d’approbation.",
                "PayPal did not return an approval link.",
                "لم يُرجع PayPal رابط الموافقة.");
        ensureTriple(
                "api.error.paypal.token_required",
                "Jeton PayPal (order id) requis.",
                "PayPal token (order id) required.",
                "مطلوب رمز PayPal (معرف الطلب).");
        ensureTriple(
                "api.error.transport_payment.session_required",
                "session_id requis.",
                "session_id is required.",
                "مطلوب session_id.");
        ensureTriple(
                "api.error.transport_payment.checkout_url_missing",
                "URL de paiement indisponible.",
                "Checkout URL unavailable.",
                "رابط الدفع غير متاح.");
        ensureTriple(
                "api.error.reservation_not_found",
                "Réservation introuvable.",
                "Reservation not found.",
                "الحجز غير موجود.");
        ensureTriple(
                "api.error.auth.invalid_credentials",
                "Identifiants invalides.",
                "Invalid credentials.",
                "بيانات الدخول غير صالحة.");
        ensureTriple(
                "api.error.auth.invalid_current_password",
                "Mot de passe actuel invalide.",
                "Current password is invalid.",
                "كلمة المرور الحالية غير صالحة.");
        ensureTriple(
                "api.error.auth.password_unchanged",
                "Le nouveau mot de passe doit être différent de l’actuel.",
                "New password must differ from the current password.",
                "يجب أن تختلف كلمة المرور الجديدة عن الحالية.");
        ensureTriple(
                "api.error.auth.invalid_verification_token",
                "Jeton de vérification invalide.",
                "Verification token is invalid.",
                "رمز التحقق غير صالح.");
        ensureTriple(
                "api.error.auth.email_send_failed",
                "Envoi d’e-mail indisponible. Vérifiez la configuration SMTP.",
                "Email could not be sent. Check SMTP configuration.",
                "تعذر إرسال البريد. تحقق من إعدادات SMTP.");
        ensureTriple(
                "api.error.auth.invalid_reset_token",
                "Jeton de réinitialisation invalide.",
                "Reset token is invalid.",
                "رمز إعادة التعيين غير صالح.");
        ensureTriple(
                "api.error.auth.social_account_unresolved",
                "Impossible de résoudre le compte social.",
                "Unable to resolve social account identity.",
                "تعذر تحديد هوية الحساب الاجتماعي.");
        ensureTriple(
                "api.error.auth.account_locked_brute_force",
                "Trop de tentatives échouées. Compte verrouillé 15 minutes.",
                "Too many failed attempts. Account locked for 15 minutes.",
                "محاولات فاشلة كثيرة. تم قفل الحساب 15 دقيقة.");
        ensureTriple(
                "api.error.auth.invalid_password",
                "Mot de passe invalide.",
                "Invalid password.",
                "كلمة مرور غير صالحة.");
        ensureTriple(
                "api.error.auth.account_locked_temp",
                "Compte temporairement verrouillé. Réessayez plus tard.",
                "Account temporarily locked. Try again later.",
                "الحساب مقفل مؤقتاً. حاول لاحقاً.");
        ensureTriple(
                "api.error.auth.email_unverified",
                "E-mail non vérifié. Consultez votre boîte de réception.",
                "Email not verified. Check your inbox.",
                "البريد غير مؤكد. راجع صندوق الوارد.");
        ensureTriple(
                "api.error.auth.token_reused",
                "Ce jeton a déjà été utilisé.",
                "This token has already been used.",
                "تم استخدام هذا الرمز مسبقاً.");
        ensureTriple(
                "api.error.auth.city_id_required",
                "cityId est requis pour les utilisateurs tunisiens.",
                "cityId is required for Tunisian users.",
                "مطلوب cityId للمستخدمين التونسيين.");
        ensureTriple(
                "api.error.auth.invalid_city_id",
                "cityId invalide.",
                "Invalid cityId.",
                "معرف المدينة غير صالح.");
        ensureTriple(
                "api.error.auth.account_banned",
                "Votre compte est suspendu.",
                "Your account is banned.",
                "حسابك موقوف.");
        ensureTriple(
                "api.error.auth.token_expired",
                "Ce jeton a expiré.",
                "This token has expired.",
                "انتهت صلاحية هذا الرمز.");
        ensureTriple(
                "api.error.recaptcha.required",
                "Vérification anti-robot requise. Rechargez la page puis réessayez.",
                "Captcha verification required. Reload the page and try again.",
                "مطلوب التحقق من الكابتشا. أعد تحميل الصفحة وحاول مجدداً.");
        ensureTriple(
                "api.error.recaptcha.rejected",
                "Vérification anti-robot refusée. Vérifiez la configuration reCAPTCHA.",
                "Captcha verification was rejected. Check reCAPTCHA configuration.",
                "رفض التحقق من الكابتشا. تحقق من إعدادات reCAPTCHA.");
        ensureTriple(
                "api.error.admin.unknown_role",
                "Rôle inconnu.",
                "Unknown role.",
                "دور غير معروف.");
        ensureTriple(
                "api.error.admin.role_artisan_missing",
                "Le rôle ROLE_ARTISAN n’existe pas en base.",
                "ROLE_ARTISAN is not defined in the database.",
                "دور ROLE_ARTISAN غير معرّف في قاعدة البيانات.");
        ensureTriple(
                "api.error.admin.cannot_ban_admin",
                "Impossible de bannir un administrateur.",
                "Admin users cannot be banned.",
                "لا يمكن حظر مسؤول.");
        ensureTriple(
                "api.error.admin.ban_expires_required",
                "expiresAt est requis pour un bannissement temporaire.",
                "expiresAt is required for temporary bans.",
                "مطلوب expiresAt للحظر المؤقت.");
        ensureTriple(
                "api.error.admin.ban_expires_forbidden",
                "expiresAt ne doit pas être défini pour un bannissement permanent.",
                "expiresAt must be omitted for permanent bans.",
                "لا يجب إرسال expiresAt للحظر الدائم.");
        ensureTriple(
                "api.error.ticket.reservation_wrong_user",
                "Cette réservation ne vous appartient pas.",
                "This reservation is not yours.",
                "هذا الحجز ليس لك.");
        ensureTriple(
                "api.error.activity.max_participants_invalid",
                "Le nombre maximal de participants doit être ≥ 1.",
                "Max participants must be >= 1.",
                "يجب أن يكون الحد الأقصى للمشاركين ≥ 1.");
        ensureTriple(
                "api.error.quiz.title_exists",
                "Un quiz avec ce titre existe déjà.",
                "A quiz with this title already exists.",
                "يوجد اختبار بهذا العنوان مسبقاً.");
        ensureTriple(
                "api.error.quiz.header_conflict",
                "Conflit sur l’en-tête du quiz.",
                "Quiz header conflict.",
                "تعارض في رأس الاختبار.");
        ensureTriple(
                "api.error.quiz.questions_conflict",
                "Conflit sur les questions du quiz.",
                "Quiz questions conflict.",
                "تعارض في أسئلة الاختبار.");
        ensureTriple(
                "api.error.quiz.answer_index_invalid",
                "Index de réponse invalide.",
                "Invalid answer index.",
                "فهرس إجابة غير صالح.");
        ensureTriple(
                "api.error.quiz.answer_text_required",
                "Texte de réponse requis.",
                "Answer text is required.",
                "نص الإجابة مطلوب.");
        ensureTriple(
                "api.error.quiz.question_prompt_required",
                "Intitulé de question requis.",
                "Question prompt is required.",
                "نص السؤال مطلوب.");
        ensureTriple(
                "api.error.reservation.access_denied",
                "Accès à la réservation refusé.",
                "Reservation access denied.",
                "تم رفض الوصول إلى الحجز.");
    }

    private void ensureTriple(String key, String fr, String en, String ar) {
        ensure(key, "fr", fr);
        ensure(key, "en", en);
        ensure(key, "ar", ar);
    }

    private void seedScanMessages() {
        ensure("api.scan.qr_required", "fr", "Le jeton QR est obligatoire.");
        ensure("api.scan.qr_required", "en", "QR token is required.");
        ensure("api.scan.qr_required", "ar", "رمز QR مطلوب.");

        ensure("api.scan.no_ticket", "fr", "Aucun billet trouvé pour ce code QR.");
        ensure("api.scan.no_ticket", "en", "No ticket found for this QR code.");
        ensure("api.scan.no_ticket", "ar", "لم يتم العثور على تذكرة لهذا الرمز.");

        ensure("api.scan.already_validated", "fr", "Ce billet a déjà été validé.");
        ensure("api.scan.already_validated", "en", "This ticket was already validated.");
        ensure("api.scan.already_validated", "ar", "تم التحقق من هذه التذكرة مسبقاً.");

        ensure("api.scan.validated_ok", "fr", "Billet validé avec succès.");
        ensure("api.scan.validated_ok", "en", "Ticket validated successfully.");
        ensure("api.scan.validated_ok", "ar", "تم التحقق من التذكرة بنجاح.");
    }

    private void ensure(String key, String lang, String value) {
        String l = LanguageUtil.normalize(lang);
        if (catalogTranslationRepository.findByTranslationKeyAndLang(key, l).isEmpty()) {
            catalogTranslationRepository.save(CatalogTranslation.builder()
                    .translationKey(key)
                    .lang(l)
                    .value(value)
                    .build());
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
