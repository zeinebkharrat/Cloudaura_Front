# Backend-first i18n — global API consistency audit (cleanup phase)

**Date:** 2026-04-11 (cleanup pass 2)  
**Authoritative mechanisms**

| Layer | Role |
|--------|------|
| `LangCaptureFilter` | Resolves `?lang=` on `/api/**`, stores normalized lang in **`ApiRequestLang`**. |
| Angular `langHttpInterceptor` | Appends `lang` to API calls (except `/api/translate`). |
| **`CatalogTranslationService.resolveForRequest(key, fallback)`** | **Only** approved path for business copy in request scope. |
| **`ReservationTranslationHelper`** | Thin helpers for `reservation.*`, `city.*`, `accommodation.*`, `activity.*` keys used by booking flows. |

**Rule:** User-visible business text in JSON must come from the catalog (with French / DB as fallback). **Machine codes** (`PENDING`, `STRIPE`, `SINGLE`, numeric ids) may remain for client logic. **Display** must use `*Label` fields where defined.

---

## Task 1 — Classification (controllers / DTO areas)

### FULLY CONSISTENT

| Area | Notes |
|------|--------|
| **Transport reservations** | `TransportReservationResponse`: `status` + `statusLabel`, payment codes + labels, `type` / `typeLabel`, `transportType` / `transportTypeLabel`, `departureCityLabel` / `arrivalCityLabel` (+ legacy `*CityName` mirrors). Mapped in **`TransportReservationMapper`** via **`ReservationTranslationHelper`**. |
| **Transport booking errors** | **`TransportReservationService`** — messages use `reservation.error.*` / `reservationLabels.tr`. |
| **Accommodation reservations** | **`AccommodationReservationResponse`**: codes + `statusLabel`, `nameLabel`, `cityLabel`, `roomType` + `roomTypeLabel` (+ legacy `accommodationName` / `cityName`). **`AccommodationReservationService`**. |
| **Activity reservations + checkout** | **`ActivityReservationService`**, **`ActivityPaymentController`**, DTOs: `statusLabel`, `nameLabel`, list `cityLabel` / `nameLabel`; detail **`ActivityReservationResponse`** includes `cityId` + `cityLabel` + localized `activityName` / `nameLabel`. |
| **Stripe transport / stay + shop checkout** | **`PaymentService`** — transport/stay as before; **shop** Stripe lines use `product.{id}.name`, `payment.line.delivery`, `payment.line.promo_discount`, `payment.line.order_total`; `payment.error.order_not_found` for missing orders. |
| **Global HTTP errors** | **`GlobalExceptionHandler`** — **`MethodArgumentNotValidException`** / **`ConstraintViolationException`** → **`api.error.validation.*`** (no Bean `defaultMessage` in API). **5xx `ResponseStatusException`**, **`IllegalArgument`**, **`IllegalState`**, **`Exception`**, **`InvalidTransportException`**, **`AviationStackUpstreamException`**: client-facing text from **`api.error.*`** only (details logged). **4xx `ResponseStatusException`**: `reason` pass-through (must be catalog-resolved at throw site). **`ApiResponse`**: JSON **`code`** + optional **`status`**. |
| **Tickets / PDF** | **`TicketController`**, **`TicketPdfService`** — prefer API labels on DTO when present. |
| **Catalog seed** | **`CatalogTranslationBootstrap.seedReservationCatalog()`** — `reservation.*`, `payment.error.order_not_found`, confirmation copy. |

### PARTIALLY CONSISTENT

| Area | Gap |
|------|-----|
| **`ResponseStatusException` (4xx)** | **Reason** text is still whatever controllers/services attach — must remain **catalog-backed** at throw sites for non-English UX. |
| **`TranslationController`** | **MyMemory** proxy for ad-hoc UI text — **not** catalog; keep isolated; do not use for domain DTOs. |
| **`PublicExploreController`** | Some sub-paths (reviews, voice, etc.) may still return raw third-party or user text — policy decision per field. |
| **Admin CRUD** | **`AdminTransportController`**, **`AdminAccommodationController`**, etc. — often echo **admin editing** state; align read-only public DTOs with catalog where the same entity is shown to end users. |
| **Emails / WhatsApp** | Templates and **`TransportWhatsAppMessageBuilder`** may still mix French copy — out of REST JSON but affects “multilingual product”. |

### LEGACY / NOT MIGRATED (by design or backlog)

| Area | Reason |
|------|--------|
| **Auth, profile PII** | User-chosen names; do not auto-translate without consent. |
| **Posts, chat messages** | UGC — catalog only for system templates / moderation messages if needed. |
| **WebSocket payloads** | Binary / live events; not part of this catalog pass. |
| **PayPal raw callbacks** | Gateway payloads; minimal JSON to app. |
| **CRUD scaffolds** | `controller/crud/**` — internal / generic; migrate only if exposed to end users. |

---

## Task 2 — Uniform DTO contract (implemented for reservations)

| Concept | Transport | Accommodation | Activity |
|---------|-----------|-----------------|----------|
| Status code | `status` | `status` | `status` (enum) |
| Status display | `statusLabel` | `statusLabel` | `statusLabel` |
| Payment codes | `paymentMethod`, `paymentStatus` | (when present) | — |
| Payment display | `paymentMethodLabel`, `paymentStatusLabel` | `paymentMethodLabel` | — |
| Type code | `transportType`, **`type`** | `roomType` | — |
| Type display | `transportTypeLabel`, **`typeLabel`** | `roomTypeLabel` | — |
| City display | **`departureCityLabel`**, **`arrivalCityLabel`** | **`cityLabel`** | **`cityLabel`** (list) |
| Name display | — | **`nameLabel`** | **`nameLabel`** (detail + list duplicate of localized title) |

Legacy field names (`departureCityName`, `accommodationName`, …) remain populated with the **same localized values** for backward compatibility during client rollout.

---

## Task 3–4 — Error / message keys

| Family | Usage |
|--------|--------|
| `reservation.status.*` | Status labels. |
| `reservation.payment.*` | Checkout strings, Stripe messages. |
| `reservation.error.*` | Booking / validation errors. |
| `reservation.confirmation.*` | Receipt HTML (activity). |
| `payment.error.*` | Cross-cutting payment errors (e.g. `payment.error.order_not_found`). |
| `payment.line.*` | Shop Stripe Checkout line labels (delivery, promo, combined order line). |
| `api.error.*` | Generic **`GlobalExceptionHandler`** copy (access denied, data integrity, payload, internal, transport/external). |
| `api.error.validation.*` | **Bean Validation** mapping (`required`, `invalid_format`, `too_short`, `too_long`, `unknown_field`) + summary `api.error.validation_failed`. |
| `ticket.message.*` | Reserved for ticket-specific user messages (extend when centralizing ticket errors). |

Prefer **no raw literals** in `ResponseStatusException` / `ApiResponse.error` for flows listed as FULLY CONSISTENT.

---

## Task 5 — Legacy paths

- **Do not** use **`TranslationController`** for domain entities — UI-only.
- **Remove** ngx-translate pipes for **business** fields on pages that already receive labels (`statusLabel`, etc.). **ngx-translate** remains for **chrome** (buttons, headings).

---

## Task 6 — Frontend alignment (done / target)

| Location | Behaviour |
|----------|------------|
| **`mes-reservations`** | Shows `statusLabel`, `paymentMethodLabel`, `typeLabel` / API labels, `departureCityLabel` / `arrivalCityLabel`, `nameLabel`, `cityLabel`, `roomTypeLabel`. Keeps **codes** only for `[class]`, `*ngIf`, and disabled logic. |
| **Transport booking** | Uses API labels in summary; ngx-translate for UI chrome only. |
| **Activity payment success** | `nameLabel \|\| activityName`. |
| **Admin activity reservations** | `nameLabel \|\| activityName`, `cityLabel \|\| cityName`. |
| **Flights** | `flight.models.ts` **`ApiResponse`** mirrors backend JSON **`code`** + **`status`** (legacy **`errorCode`** optional). |

---

## Remaining backlog (true “100%”)

1. **Ticket** user errors — consolidate under `ticket.message.*` / `ticket.error.*`.  
2. **Email / WhatsApp** — external templates through same key families or template locale files.  
3. **Admin CRUD “echo” DTOs** — where the same entity is shown to operators, align read payloads with catalog labels where end-user-visible.

---

## Files reference (reservation cleanup wave)

- `ReservationTranslationHelper`, `TransportReservationMapper`, `TransportReservationResponse`
- `AccommodationReservationResponse`, `AccommodationReservationService`
- `ActivityReservationResponse`, `ActivityReservationListItemResponse`, `ActivityReservationService`, `ActivityPaymentController`
- `PaymentService`, `CatalogTranslationBootstrap`
- Angular: `travel.models.ts`, `flight.models.ts`, `rest-api-data-source.service.ts`, `mes-reservations.component.ts`, `activity-payment-success`, admin activity reservations template
- `GlobalExceptionHandler`, `ApiResponse`, `CatalogTranslationBootstrap`
