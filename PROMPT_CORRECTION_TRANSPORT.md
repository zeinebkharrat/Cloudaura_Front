# ═══════════════════════════════════════════════════════════════════
# PROMPT CORRECTION COMPLÈTE — MODULE TRANSPORT YALLATN
# Correction de TOUTES les erreurs identifiées dans le dashboard admin
# Stack : Angular 18 (standalone=false) · Spring Boot 3 · MySQL
# UI : PrimeNG · Thème dark admin cohérent · Logique métier stricte
# ═══════════════════════════════════════════════════════════════════

Tu es un ingénieur senior full-stack.
Tu vas corriger TOUTES les erreurs de logique, de données et de design
du module Transport YallaTN identifiées dans l'audit.
Lis TOUT ce prompt avant d'écrire une seule ligne de code.

---

## ══════════════════════════════════════════
## CONTEXTE TECHNIQUE COMPLET
## ══════════════════════════════════════════

```
Backend  : Spring Boot 3.x · Java 17 · JPA/Hibernate · MySQL
Frontend : Angular 18 · standalone=false · PrimeNG · SCSS
Auth     : JWT · Rôles : ROLE_USER, ROLE_ADMIN
API      : { success, data, message, timestamp } sur tous les endpoints

TABLES EXISTANTES (schéma actuel) :
  cities          : city_id, name, region, has_airport, has_bus_station,
                    has_port, has_train_station
  drivers         : driver_id, first_name, last_name, email, phone,
                    license_number, rating, total_trips, is_active, photo_url
  vehicles        : vehicle_id, brand, model, year, color, plate_number,
                    type ENUM(BUS,CAR,PLANE,TAXI,VAN), capacity,
                    price_per_trip, is_active, photo_url
  transports      : transport_id, departure_city_id FK, arrival_city_id FK,
                    vehicle_id FK, driver_id FK (NULLABLE),
                    type ENUM(BUS,CAR,PLANE,TAXI,VAN),
                    departure_time, arrival_time, price, capacity,
                    is_active, created_at, description
  transport_reservations : transport_reservation_id, transport_id FK,
                    user_id FK, passenger_*, number_of_seats,
                    total_price, travel_date, status, payment_*,
                    reservation_ref UNIQUE, idempotency_key UNIQUE

UTILISATEURS TEST :
  user_id=1  admin@yallatn.com  ROLE_ADMIN
  user_id=2  slouma@gmail.com   ROLE_USER
```

---

## ══════════════════════════════════════════
## CORRECTION 1 — BASE DE DONNÉES & ENTITÉS JPA
## ══════════════════════════════════════════

```
PROBLÈME IDENTIFIÉ :
  - transport.capacity est saisi manuellement → incohérent avec vehicle.capacity
  - driver_id nullable mais pas validé : un PLANE ne doit JAMAIS avoir driver_id
  - vehicle.color et vehicle.year sont null en base → champs non obligatoires
  - driver.email null → champ non obligatoire dans le formulaire
  - driver.total_trips et driver.rating ne se mettent jamais à jour

CORRECTIONS SQL À APPLIQUER :

1. Ajouter colonne operator_name dans transports (pour PLANE) :
   ALTER TABLE transports
     ADD COLUMN operator_name VARCHAR(100) NULL
     COMMENT 'Nom compagnie aérienne si type=PLANE';

2. Rendre color et year NOT NULL dans vehicles (avec valeur par défaut) :
   UPDATE vehicles SET color = 'Non renseigné' WHERE color IS NULL OR color = '';
   UPDATE vehicles SET year = 2020 WHERE year IS NULL OR year = 0;

3. Rendre email NOT NULL dans drivers :
   UPDATE drivers SET email = CONCAT(license_number, '@yallatn.com')
   WHERE email IS NULL OR email = '';
   ALTER TABLE drivers MODIFY email VARCHAR(255) NOT NULL;

ENTITÉ TRANSPORT — corrections JPA :
  Génère Transport.java avec :
  - @ManyToOne @JoinColumn(name="driver_id", nullable=true) Driver driver
    → nullable=true OBLIGATOIRE (PLANE n'a pas de driver)
  - String operatorName → affiché si type=PLANE à la place du driver
  - @Column capacity → sera forcé = vehicle.capacity dans le service
  - @PrePersist @PreUpdate validateBusinessRules() :
      if (type == PLANE && driver != null)
        throw new IllegalStateException("Un avion ne peut pas avoir de conducteur")
      if (type == PLANE && operatorName == null)
        throw new IllegalStateException("La compagnie aérienne est obligatoire pour un avion")
      if (departureCity.equals(arrivalCity))
        throw new IllegalStateException("La ville de départ et d'arrivée doivent être différentes")
      if (arrivalTime.isBefore(departureTime))
        throw new IllegalStateException("L'heure d'arrivée doit être après le départ")

  - Ajouter méthode isComplete() :
      return capacity - getConfirmedReservationsCount() <= 0

ENTITÉ DRIVER :
  - email : @Column(nullable=false) @Email
  - total_trips : @Formula("(SELECT COUNT(t.transport_id) FROM transports t
                            WHERE t.driver_id = driver_id AND t.is_active = 1)")
    → calculé dynamiquement, jamais mis à jour manuellement
  - rating : reste stocké en base, mis à jour par GamificationService

Génère : Transport.java, Driver.java, Vehicle.java avec toutes les corrections.
```

---

## ══════════════════════════════════════════
## CORRECTION 2 — TRANSPORTSERVICE (logique métier stricte)
## ══════════════════════════════════════════

```
Génère TransportService.java avec ces méthodes et validations COMPLÈTES.

━━━ 2A. createTransport(CreateTransportRequest req) → TransportDTO ━━━

VALIDATIONS DANS L'ORDRE :

  1. VILLE DÉPART ≠ VILLE ARRIVÉE :
     if (req.departureCityId.equals(req.arrivalCityId))
       throw new InvalidTransportException("SAME_CITY", "Départ et arrivée identiques")

  2. COHÉRENCE TYPE / INFRASTRUCTURE GÉOGRAPHIQUE :
     City departure = cityRepo.findById(req.departureCityId)
     City arrival   = cityRepo.findById(req.arrivalCityId)
     switch(req.type) {
       case PLANE:
         if (!departure.hasAirport || !arrival.hasAirport)
           throw new InvalidTransportException("NO_AIRPORT",
             "Vol impossible : " + (!departure.hasAirport ? departure.name : arrival.name)
             + " n'a pas d'aéroport")
       case BUS:
         if (!departure.hasBusStation || !arrival.hasBusStation)
           throw new InvalidTransportException("NO_BUS_STATION", "...")
     }

  3. COHÉRENCE TYPE / CONDUCTEUR :
     if (req.type == PLANE && req.driverId != null)
       throw new InvalidTransportException("PLANE_NO_DRIVER",
         "Un avion ne peut pas avoir de conducteur. Renseignez la compagnie aérienne.")
     if (req.type == PLANE && (req.operatorName == null || req.operatorName.isBlank()))
       throw new InvalidTransportException("PLANE_NEEDS_OPERATOR",
         "La compagnie aérienne est obligatoire pour un avion")
     if (req.type != PLANE && req.driverId == null)
       throw new InvalidTransportException("DRIVER_REQUIRED",
         "Un conducteur est requis pour ce type de transport")

  4. COHÉRENCE TYPE / VÉHICULE :
     Vehicle vehicle = vehicleRepo.findById(req.vehicleId)
     Map<TransportType, List<VehicleType>> ALLOWED = {
       PLANE → [], // pas de véhicule fleet pour avion
       BUS   → [BUS],
       VAN   → [VAN],
       TAXI  → [CAR, TAXI],
       CAR   → [CAR]
     }
     if (req.type != PLANE) {
       if (!ALLOWED.get(req.type).contains(vehicle.type))
         throw new InvalidTransportException("VEHICLE_TYPE_MISMATCH",
           "Un véhicule " + vehicle.type + " ne peut pas être utilisé pour un " + req.type)
     }

  5. CAPACITÉ HÉRITÉE DU VÉHICULE (jamais saisie manuellement) :
     if (req.type != PLANE) {
       transport.capacity = vehicle.capacity  // FORÇAGE
     } else {
       transport.capacity = req.capacity  // Pour avion : saisi manuellement
     }

  6. DISPONIBILITÉ VÉHICULE (conflit horaire) :
     if (req.type != PLANE) {
       boolean vehicleConflict = transportRepo.existsByVehicleIdAndTimeOverlap(
         req.vehicleId, req.departureTime, req.arrivalTime)
       if (vehicleConflict)
         throw new InvalidTransportException("VEHICLE_OCCUPIED",
           "Ce véhicule est déjà assigné à un trajet sur ce créneau horaire")
     }

  7. DISPONIBILITÉ CONDUCTEUR (conflit horaire) :
     if (req.driverId != null) {
       boolean driverConflict = transportRepo.existsByDriverIdAndTimeOverlap(
         req.driverId, req.departureTime, req.arrivalTime)
       if (driverConflict)
         throw new InvalidTransportException("DRIVER_OCCUPIED",
           "Ce conducteur est déjà assigné à un trajet sur ce créneau horaire")
     }

  8. VALIDATION TEMPORELLE :
     if (req.arrivalTime.isBefore(req.departureTime) || req.arrivalTime.isEqual(req.departureTime))
       throw new InvalidTransportException("INVALID_TIME", "L'heure d'arrivée doit être après le départ")

     Duration duration = Duration.between(req.departureTime, req.arrivalTime)
     Map<TransportType, Long> MAX_HOURS = { TAXI:8, CAR:12, VAN:8, BUS:12, PLANE:3 }
     if (duration.toHours() > MAX_HOURS.get(req.type))
       throw new InvalidTransportException("DURATION_TOO_LONG",
         "Durée anormalement longue pour ce type de transport (" + duration.toHours() + "h)")

  9. VALIDATION PRIX :
     Map<TransportType, Double> MAX_PRICE = { TAXI:300.0, CAR:500.0, VAN:400.0, BUS:80.0, PLANE:400.0 }
     if (req.price > MAX_PRICE.get(req.type))
       // warning seulement, pas d'erreur bloquante — consigner dans les logs
       log.warn("Prix anormalement élevé pour {} : {} TND", req.type, req.price)

━━━ 2B. getAvailableTypes(departureCityId, arrivalCityId) ━━━
  → List<TransportTypeAvailabilityDTO> { type, label, isAvailable, reason, minPrice }

━━━ 2C. getTransportStats() → TransportStatsDTO ━━━
  {
    totalTransports : COUNT(*) FROM transports
    activeTransports : COUNT(*) FROM transports WHERE is_active=1
    totalAvailableSeats : SUM(t.capacity - COALESCE(reserved.cnt,0))
                          FROM transports t
                          LEFT JOIN (SELECT transport_id, COUNT(*) cnt
                                     FROM transport_reservations
                                     WHERE status='CONFIRMED'
                                     GROUP BY transport_id) reserved
                          ON t.transport_id = reserved.transport_id
                          WHERE t.is_active = 1
    totalVehicles : COUNT(*) FROM vehicles WHERE is_active=1
  }
  → Ce calcul remplace le KPI incorrect "4193 places" actuellement en prod

━━━ 2D. Requêtes JPQL dans TransportRepository ━━━

  @Query("SELECT COUNT(t) > 0 FROM Transport t WHERE t.vehicle.id = :vehicleId
          AND t.isActive = true AND t.departureTime < :arrivalTime
          AND t.arrivalTime > :departureTime")
  boolean existsByVehicleIdAndTimeOverlap(vehicleId, departureTime, arrivalTime)

  @Query("SELECT COUNT(t) > 0 FROM Transport t WHERE t.driver.id = :driverId
          AND t.isActive = true AND t.departureTime < :arrivalTime
          AND t.arrivalTime > :departureTime")
  boolean existsByDriverIdAndTimeOverlap(driverId, departureTime, arrivalTime)

Génère : TransportService.java, TransportRepository.java,
         InvalidTransportException.java, TransportStatsDTO.java,
         TransportTypeAvailabilityDTO.java, CreateTransportRequest.java
```

---

## ══════════════════════════════════════════
## CORRECTION 3 — VEHICLESERVICE + DRIVERSERVICE
## ══════════════════════════════════════════

```
━━━ VehicleService corrections ━━━

  createVehicle(CreateVehicleRequest req) :
    - color : @NotBlank validation
    - year  : @Min(2000) @Max(2030) validation
    - plate_number : @Pattern(regexp="[0-9]{1,3} TUN [0-9]{1,3}")
                    → format tunisien standard
    - price_per_trip : @Positive @DecimalMax("1000.00")

  getVehiclesFilteredByTransportType(TransportType type) → List<VehicleDTO>
    → Filtre les véhicules compatibles avec un type de transport
    Map<TransportType, List<VehicleType>> COMPATIBLE = {
      BUS   → [BUS],
      VAN   → [VAN],
      TAXI  → [CAR, TAXI],
      CAR   → [CAR],
      PLANE → []  // liste vide, pas de véhicule fleet
    }
    → Utilisé par le formulaire Angular pour peupler le select Véhicule

  getAvailableVehicles(TransportType type, LocalDateTime dep, LocalDateTime arr)
    → List<VehicleDTO> compatibles ET non occupés sur ce créneau

━━━ DriverService corrections ━━━

  createDriver(CreateDriverRequest req) :
    - email : @NotBlank @Email (maintenant obligatoire)
    - phone : @Pattern(regexp="\\+216[0-9]{8}")

  getAvailableDrivers(LocalDateTime departure, LocalDateTime arrival)
    → Drivers non assignés à un transport actif sur ce créneau
    @Query("SELECT d FROM Driver d WHERE d.isActive = true
            AND d.id NOT IN (SELECT t.driver.id FROM Transport t
                             WHERE t.isActive = true
                             AND t.departureTime < :arrival
                             AND t.arrivalTime > :departure
                             AND t.driver IS NOT NULL)")
    → Utilisé par le formulaire pour peupler le select Conducteur en temps réel

  updateDriverStats(Long driverId) :
    → Recalcule total_trips depuis la DB (ne pas utiliser le champ calculé)
    → Recalcule rating = AVG des notes des transport_reservations CONFIRMED
      pour ce driver (si table reviews existe) sinon laisser à 0

Génère : VehicleService.java, DriverService.java, VehicleRepository.java,
         DriverRepository.java, CreateVehicleRequest.java, CreateDriverRequest.java
```

---

## ══════════════════════════════════════════
## CORRECTION 4 — CONTROLLERS REST
## ══════════════════════════════════════════

```
TransportAdminController (/api/v1/admin/transports) :
  GET  /stats
       → TransportStatsDTO (KPIs dashboard corrigés)
  GET  /
       → Page<TransportDTO> avec filtre type, cityFrom, cityTo, statut
  POST /
       → Crée transport avec TOUTES les validations du service
       → @Valid CreateTransportRequest
  PUT  /{id}
       → Modifie transport (mêmes validations)
  PUT  /{id}/activate
       → Active si is_active=false
  PUT  /{id}/deactivate
       → Désactive APRÈS vérification : si des réservations CONFIRMED ou PENDING
         existent pour des dates futures → retourner 409 CONFLICT avec message
         "Impossible de désactiver : X réservation(s) active(s) sur ce transport"
  DELETE /{id}
       → Supprime UNIQUEMENT si aucune réservation CONFIRMED future
       → Si réservations → 409 CONFLICT "Annuler les réservations avant de supprimer"

  GET  /available-types?departureCityId=X&arrivalCityId=Y
       → List<TransportTypeAvailabilityDTO>
  GET  /available-vehicles?type=BUS&departure=ISO&arrival=ISO
       → List<VehicleDTO> compatibles ET disponibles sur ce créneau
  GET  /available-drivers?departure=ISO&arrival=ISO
       → List<DriverDTO> disponibles sur ce créneau

VehicleAdminController (/api/v1/admin/vehicles) :
  GET  /        → Page<VehicleDTO>
  POST /        → @Valid CreateVehicleRequest
  PUT  /{id}    → modifie
  DELETE /{id}  → vérifie qu'aucun transport actif n'utilise ce véhicule
  POST /{id}/photo → upload photo (MultipartFile)

DriverAdminController (/api/v1/admin/drivers) :
  GET  /        → Page<DriverDTO>
  POST /        → @Valid CreateDriverRequest (email maintenant obligatoire)
  PUT  /{id}    → modifie
  DELETE /{id}  → vérifie qu'aucun transport actif n'utilise ce driver

GlobalExceptionHandler — ajouter :
  InvalidTransportException → 422 UNPROCESSABLE_ENTITY avec errorCode
  VehicleConflictException  → 409 CONFLICT
  DriverConflictException   → 409 CONFLICT

Génère : TransportAdminController, VehicleAdminController,
         DriverAdminController, GlobalExceptionHandler mis à jour
```

---

## ══════════════════════════════════════════
## CORRECTION 5 — ANGULAR : FORMULAIRE NOUVEAU TRANSPORT
## ══════════════════════════════════════════

```
Fichiers à corriger/régénérer :
  transport-form/transport-form.component.ts
  transport-form/transport-form.component.html
  transport-form/transport-form.component.scss

━━━ Comportement dynamique du formulaire ━━━

  A. SELECT TYPE — onChange déclenche :
     1. Si type = PLANE :
        → Cacher le champ "Véhicule" (les avions n'ont pas de véhicule fleet)
        → Cacher le champ "Conducteur"
        → Afficher le champ "Compagnie aérienne" (texte obligatoire, ex: Tunisair)
        → Afficher "Code vol" (optionnel, ex: TU-202)
        → Filtrer les villes d'arrivée pour n'afficher que celles
          avec has_airport = true
        → Le champ "Capacité" devient ÉDITABLE (pas de véhicule pour l'hériter)

     2. Si type = BUS, VAN, TAXI, CAR :
        → Afficher "Véhicule" (select)
        → Appeler getAvailableVehicles(type, dep, arr) pour peupler la liste
        → Appeler getAvailableDrivers(dep, arr) pour peupler le select conducteur
        → Cacher "Compagnie aérienne" et "Code vol"
        → Cacher le champ "Capacité" (sera hérité du véhicule)

  B. SELECT VÉHICULE — onChange :
     → Appeler GET /api/v1/admin/vehicles/{id}
     → Afficher en readonly : "Capacité héritée : X places"
     → Le champ capacity est forcé à vehicle.capacity dans le form
       (control patched, disabled, non soumis manuellement)

  C. SELECT VILLE DÉPART — onChange :
     → Retirer cette ville de la liste des villes d'arrivée
     → Appeler getAvailableTypes(depId, arrId) dès que les deux villes sont choisies
     → Griser les types non disponibles avec un tooltip explicatif

  D. SELECT VILLE ARRIVÉE — onChange :
     → Même logique symétrique

  E. DATE DÉPART + DATE ARRIVÉE — onChange des deux :
     → Calculer et afficher la durée : "Durée : Xh Ymin"
     → Si durée > MAX pour le type → warning orange en dessous
     → Mettre à jour les listes véhicules/drivers disponibles

  F. VALIDATION RÉACTIVE DU FORMULAIRE :
     Validators à ajouter :
     - departureCityId !== arrivalCityId
       → message : "La ville d'arrivée doit être différente du départ"
     - arrivalTime > departureTime
       → message : "L'heure d'arrivée doit être après le départ"
     - Si type != PLANE && vehicleId null → required
     - Si type != PLANE && driverId null → required
     - Si type == PLANE && operatorName vide → required

━━━ HTML du formulaire (PrimeNG) ━━━

  Structure 2 colonnes en grid :
  <form [formGroup]="transportForm">

    <div class="form-grid">

      <!-- TYPE — toujours visible -->
      <div class="form-field">
        <label>Type *</label>
        <p-select formControlName="type" [options]="transportTypes"
                  optionLabel="label" optionValue="value"
                  placeholder="Sélectionner le type"
                  (onChange)="onTypeChange($event)">
          <ng-template pTemplate="selectedItem">
            <!-- Badge coloré selon le type -->
          </ng-template>
        </p-select>
        <small class="error" *ngIf="typeAvailability?.reason">
          ⚠ {{typeAvailability.reason}}
        </small>
      </div>

      <!-- VILLE DÉPART -->
      <div class="form-field">
        <label>Ville de départ *</label>
        <p-select formControlName="departureCityId"
                  [options]="cities" optionLabel="name" optionValue="cityId"
                  (onChange)="onDepartureCityChange($event)" filter>
        </p-select>
      </div>

      <!-- VILLE ARRIVÉE — liste filtrée dynamiquement -->
      <div class="form-field">
        <label>Ville d'arrivée *</label>
        <p-select formControlName="arrivalCityId"
                  [options]="filteredArrivalCities" optionLabel="name"
                  optionValue="cityId"
                  (onChange)="onArrivalCityChange($event)" filter>
          <!-- Option désactivée si ville sans aéroport pour PLANE -->
        </p-select>
        <small class="error" *ngIf="form.errors?.['sameCityError']">
          La ville d'arrivée doit être différente du départ
        </small>
      </div>

      <!-- HEURE DÉPART -->
      <div class="form-field">
        <label>Heure de départ *</label>
        <p-datepicker formControlName="departureTime"
                      showTime="true" showSeconds="false"
                      dateFormat="dd/mm/yy"
                      placeholder="jj/mm/aaaa hh:mm"
                      (onSelect)="onTimeChange()">
        </p-datepicker>
      </div>

      <!-- HEURE ARRIVÉE -->
      <div class="form-field">
        <label>Heure d'arrivée *</label>
        <p-datepicker formControlName="arrivalTime"
                      showTime="true" showSeconds="false"
                      dateFormat="dd/mm/yy"
                      (onSelect)="onTimeChange()">
        </p-datepicker>
        <!-- Durée calculée dynamiquement -->
        <small class="duration-hint" *ngIf="calculatedDuration">
          Durée : {{calculatedDuration}}
        </small>
        <small class="error" *ngIf="form.errors?.['arrivalBeforeDeparture']">
          L'heure d'arrivée doit être après le départ
        </small>
        <small class="warning" *ngIf="durationWarning">
          ⚠ {{durationWarning}}
        </small>
      </div>

      <!-- PRIX -->
      <div class="form-field">
        <label>Prix par personne (TND) *</label>
        <p-inputnumber formControlName="price" mode="decimal"
                       [minFractionDigits]="2" [min]="0"
                       placeholder="Ex: 22.50">
        </p-inputnumber>
        <small class="warning" *ngIf="priceWarning">⚠ {{priceWarning}}</small>
      </div>

      <!-- VÉHICULE — caché si PLANE -->
      <div class="form-field" *ngIf="showVehicleField">
        <label>Véhicule *</label>
        <p-select formControlName="vehicleId"
                  [options]="availableVehicles"
                  optionLabel="displayLabel" optionValue="vehicleId"
                  placeholder="Sélectionner un véhicule"
                  (onChange)="onVehicleChange($event)"
                  emptyMessage="Aucun véhicule compatible disponible">
          <ng-template pTemplate="item" let-v>
            <span>{{v.brand}} {{v.model}} — {{v.capacity}} places</span>
            <span *ngIf="v.occupied" class="badge-occupied">Occupé</span>
          </ng-template>
        </p-select>
        <!-- Capacité héritée en readonly -->
        <div class="capacity-inherited" *ngIf="selectedVehicleCapacity">
          Capacité héritée : <strong>{{selectedVehicleCapacity}} places</strong>
        </div>
      </div>

      <!-- CONDUCTEUR — caché si PLANE -->
      <div class="form-field" *ngIf="showDriverField">
        <label>Conducteur *</label>
        <p-select formControlName="driverId"
                  [options]="availableDrivers"
                  optionLabel="fullName" optionValue="driverId"
                  placeholder="Sélectionner un conducteur"
                  emptyMessage="Aucun conducteur disponible sur ce créneau">
          <ng-template pTemplate="item" let-d>
            <div class="driver-option">
              <span>{{d.fullName}}</span>
              <span class="driver-license">{{d.licenseNumber}}</span>
              <span class="driver-rating">★ {{d.rating | number:'1.1-1'}}</span>
            </div>
          </ng-template>
        </p-select>
      </div>

      <!-- COMPAGNIE AÉRIENNE — affiché uniquement si PLANE -->
      <div class="form-field" *ngIf="showAirlineField">
        <label>Compagnie aérienne *</label>
        <p-select formControlName="operatorName"
                  [options]="airlines"
                  placeholder="Ex: Tunisair, Nouvelair, Tunisair Express">
        </p-select>
      </div>

      <!-- CODE VOL — optionnel si PLANE -->
      <div class="form-field" *ngIf="showAirlineField">
        <label>Code vol (optionnel)</label>
        <p-inputtext formControlName="flightCode"
                     placeholder="Ex: TU-202">
        </p-inputtext>
      </div>

      <!-- CAPACITÉ — éditable si PLANE, readonly sinon -->
      <div class="form-field" *ngIf="showCapacityField">
        <label>Capacité (places) *</label>
        <p-inputnumber formControlName="capacity"
                       [min]="1" [max]="500"
                       placeholder="Nombre de places">
        </p-inputnumber>
      </div>

      <!-- DESCRIPTION -->
      <div class="form-field full-width">
        <label>Description (optionnel)</label>
        <textarea pTextarea formControlName="description"
                  rows="3" placeholder="Informations supplémentaires...">
        </textarea>
      </div>

    </div>

    <!-- FOOTER ACTIONS -->
    <div class="form-actions">
      <p-button label="Annuler" icon="pi pi-times" severity="secondary"
                (onClick)="cancel()">
      </p-button>
      <p-button [label]="isEdit ? 'Modifier le transport' : 'Créer le transport'"
                icon="pi pi-check" severity="success"
                [loading]="submitting" [disabled]="transportForm.invalid"
                (onClick)="submit()">
      </p-button>
    </div>

  </form>

━━━ TS du composant — méthodes clés ━━━

  airlines = ['Tunisair', 'Nouvelair', 'Tunisair Express', 'Transavia', 'Air Arabia']

  onTypeChange(event) {
    const type = event.value
    this.showVehicleField  = type !== 'PLANE'
    this.showDriverField   = type !== 'PLANE'
    this.showAirlineField  = type === 'PLANE'
    this.showCapacityField = type === 'PLANE'

    // Reset les champs cachés
    if (type === 'PLANE') {
      this.form.get('vehicleId').reset()
      this.form.get('driverId').reset()
      this.form.get('vehicleId').clearValidators()
      this.form.get('driverId').clearValidators()
      this.form.get('operatorName').setValidators([Validators.required])
      this.form.get('capacity').setValidators([Validators.required, Validators.min(1)])
    } else {
      this.form.get('operatorName').reset()
      this.form.get('vehicleId').setValidators([Validators.required])
      this.form.get('driverId').setValidators([Validators.required])
      this.form.get('operatorName').clearValidators()
    }
    this.refreshValidators()
    this.loadAvailableVehicles()
    this.updateArrivalCitiesFilter()
  }

  onVehicleChange(event) {
    const vehicle = this.availableVehicles.find(v => v.vehicleId === event.value)
    if (vehicle) {
      this.selectedVehicleCapacity = vehicle.capacity
      // capacité non soumise — backend la force
    }
  }

  onTimeChange() {
    const dep = this.form.get('departureTime').value
    const arr = this.form.get('arrivalTime').value
    if (dep && arr) {
      const diffMs  = new Date(arr).getTime() - new Date(dep).getTime()
      const diffH   = Math.floor(diffMs / 3600000)
      const diffMin = Math.floor((diffMs % 3600000) / 60000)
      this.calculatedDuration = diffH > 0 ? `${diffH}h${diffMin > 0 ? diffMin+'min':''}` : `${diffMin} min`
      this.checkDurationWarning(diffH)
      this.loadAvailableVehicles()  // reload avec nouveaux créneaux
      this.loadAvailableDrivers()
    }
  }

  checkDurationWarning(hours: number) {
    const MAX = { PLANE:3, TAXI:8, CAR:12, VAN:8, BUS:12 }
    const type = this.form.get('type').value
    if (type && hours > MAX[type])
      this.durationWarning = `Durée anormalement longue pour un ${type} (max ${MAX[type]}h recommandé)`
    else this.durationWarning = null
  }

  onPriceChange(value: number) {
    const MAX = { PLANE:400, TAXI:300, CAR:500, VAN:400, BUS:80 }
    const type = this.form.get('type').value
    if (type && value > MAX[type])
      this.priceWarning = `Prix élevé pour un ${type} (maximum recommandé : ${MAX[type]} TND)`
    else this.priceWarning = null
  }

  loadAvailableVehicles() {
    const {type, departureTime, arrivalTime} = this.form.value
    if (type && type !== 'PLANE' && departureTime && arrivalTime) {
      this.transportService.getAvailableVehicles(type, departureTime, arrivalTime)
        .subscribe(v => this.availableVehicles = v)
    }
  }

  loadAvailableDrivers() {
    const {departureTime, arrivalTime} = this.form.value
    const type = this.form.get('type').value
    if (type && type !== 'PLANE' && departureTime && arrivalTime) {
      this.transportService.getAvailableDrivers(departureTime, arrivalTime)
        .subscribe(d => this.availableDrivers = d)
    }
  }

  updateArrivalCitiesFilter() {
    const type = this.form.get('type').value
    const depId = this.form.get('departureCityId').value
    this.filteredArrivalCities = this.cities.filter(c => {
      if (c.cityId === depId) return false  // exclure ville départ
      if (type === 'PLANE' && !c.hasAirport) return false  // exclure sans aéroport
      return true
    })
  }

Génère les 3 fichiers complets du composant transport-form.
```

---

## ══════════════════════════════════════════
## CORRECTION 6 — TABLEAU TRANSPORT (affichage + actions)
## ══════════════════════════════════════════

```
Fichiers :
  transport-list/transport-list.component.ts
  transport-list/transport-list.component.html
  transport-list/transport-list.component.scss

━━━ Corrections d'affichage ━━━

COLONNE "VÉHICULE / CONDUCTEUR" :
  Logique d'affichage selon le type :
  - Si type = PLANE : afficher "Compagnie : [operatorName]"
                      + "[flightCode]" si renseigné
  - Si type != PLANE : afficher "[vehicleBrand] [vehicleModel]"
                        + "[driverFirstName] [driverLastName]"

COLONNE "PLACES" :
  Afficher avec code couleur DYNAMIQUE :
  - Calculer : available = capacity - confirmedReservationsCount
  - Si available == 0   → afficher badge rouge  "COMPLET" au lieu de "X/X"
  - Si available <= 20% → afficher en orange    "X places (presque plein)"
  - Si available > 20%  → afficher en vert      "X / Y"
  Format exact : "[available] dispo / [capacity] total"

COLONNE "ACTIONS" :
  AVANT (4 boutons par ligne — trop chargé) :
    [Modifier] [Réservations] [Désactiver] [Supprimer]

  APRÈS (menu kebab + 1 bouton primaire) :
    [Modifier] [⋮ Menu]
                  └── Voir réservations
                  └── Désactiver / Activer (toggle)
                  └── ─────────────────
                  └── Supprimer (rouge)

  PrimeNG TieredMenu ou Menu popup sur bouton ⋮

COLONNE "STATUT" :
  Afficher 2 badges empilés si nécessaire :
  - Badge 1 : is_active → "Actif" vert / "Inactif" gris
  - Badge 2 : si is_active ET places == 0 → "Complet" rouge
  - Si departure_time est passé → "Terminé" bleu slate

━━━ Confirmations avant actions destructives ━━━

  Désactiver :
    Si des réservations futures existent sur ce transport :
      p-confirmDialog avec message :
      "Ce transport a [X] réservation(s) active(s). La désactivation empêchera
       de nouvelles réservations mais n'annulera pas les existantes. Continuer ?"
    Si aucune réservation : désactiver directement

  Supprimer :
    Toujours un p-confirmDialog :
    "Supprimer ce transport ? Cette action est irréversible."
    → Si réservations CONFIRMED futures → bloquer avec message d'erreur
      (pas de confirmation, juste une erreur toast)

━━━ KPIs corrigés ━━━

  Remplacer les 4 cards actuelles par des valeurs correctes :
  Card 1 : Total transports     → COUNT(*) FROM transports
  Card 2 : Actifs               → COUNT(*) WHERE is_active=1
  Card 3 : Places disponibles   → SUM(capacity - reserved) dynamique
  Card 4 : Véhicules actifs     → COUNT(*) FROM vehicles WHERE is_active=1

  Ajouter 2 cards supplémentaires :
  Card 5 : Conducteurs actifs   → COUNT(*) FROM drivers WHERE is_active=1
  Card 6 : Réservations ce jour → COUNT(*) FROM transport_reservations
                                   WHERE DATE(travel_date) = CURDATE()
                                   AND status = 'CONFIRMED'

━━━ SCSS (corrections couleurs) ━━━

  AVANT : boutons primaires en rouge #e53935 → inapproprié pour "Créer"
  APRÈS :
    .btn-primary   : background #1D9E75 (vert YallaTN)
    .btn-danger    : background #DC2626 (rouge — Supprimer seulement)
    .btn-warning   : background #F59E0B (orange — Désactiver)
    .btn-secondary : background transparent, border #4B5563

  Badge types de transport (cohérence avec front-office) :
    .badge-bus    : background #1e3a5f, color #60a5fa
    .badge-taxi   : background #3b1f00, color #fb923c
    .badge-van    : background #1a2e1a, color #4ade80
    .badge-car    : background #2d1b69, color #a78bfa
    .badge-plane  : background #1e2e4a, color #38bdf8

Génère les 3 fichiers du composant transport-list.
```

---

## ══════════════════════════════════════════
## CORRECTION 7 — FORMULAIRE VÉHICULE
## ══════════════════════════════════════════

```
Fichiers :
  vehicle-form/vehicle-form.component.ts
  vehicle-form/vehicle-form.component.html

CORRECTIONS :
  - color   : @NotBlank, placeholder "Ex: Blanc, Gris métallisé"
  - year    : @Min(2000) @Max(2030), placeholder "Ex: 2023"
  - Ajouter une prévisualisation du badge type en temps réel
    selon le type sélectionné

Ajouter le champ photo_url avec upload :
  - Zone drag & drop (PrimeNG FileUpload)
  - Preview après upload
  - Si pas de photo : placeholder selon le type (icône SVG)

Champ capacité :
  - Selon le type sélectionné, adapter le max :
    VAN  → max 9
    BUS  → max 60
    TAXI → max 4
    CAR  → max 5
  - Mettre à jour le validator dynamiquement à chaque changement de type

Génère vehicle-form.component.ts + .html + .scss
```

---

## ══════════════════════════════════════════
## CORRECTION 8 — FORMULAIRE CONDUCTEUR
## ══════════════════════════════════════════

```
Fichiers :
  driver-form/driver-form.component.ts
  driver-form/driver-form.component.html

CORRECTIONS :
  - email   : maintenant REQUIS avec asterisque * + Validators.email
  - phone   : pattern tunisien +216XXXXXXXX, placeholder "+216 XX XXX XXX"
  - license : pattern TN-XXXX-XXXXX ou LIC00X

AFFICHAGE CONDUCTEUR DANS LA LISTE (driver-list) :
  - total_trips : afficher comme "X trajets" (calculé dynamiquement)
  - rating      : afficher ★ X.X (si 0.0 → afficher "Pas encore noté")
  - email       : afficher avec lien mailto (plus de "—")
  - Ajouter photo de profil (avatar initiales si pas de photo)

Génère driver-form.component.ts + .html + .scss
```

---

## ══════════════════════════════════════════
## CORRECTION 9 — SERVICE ANGULAR + INTERCEPTORS
## ══════════════════════════════════════════

```
transport-admin.service.ts — méthodes complètes :

  // KPIs
  getStats(): Observable<TransportStatsDTO>
    → GET /api/v1/admin/transports/stats

  // Transport CRUD
  getTransports(filters, page, size): Observable<PagedResponse<TransportDTO>>
  createTransport(dto: CreateTransportDTO): Observable<TransportDTO>
  updateTransport(id, dto): Observable<TransportDTO>
  activateTransport(id): Observable<void>
  deactivateTransport(id): Observable<DeactivateResult>
    → retourne { canDeactivate, activeReservationsCount } si conflit
  deleteTransport(id): Observable<void>

  // Disponibilité temps réel
  getAvailableTypes(fromId, toId): Observable<TransportTypeAvailabilityDTO[]>
  getAvailableVehicles(type, dep, arr): Observable<VehicleDTO[]>
  getAvailableDrivers(dep, arr): Observable<DriverDTO[]>

  // Vehicle CRUD
  getVehicles(filters, page, size): Observable<PagedResponse<VehicleDTO>>
  createVehicle(dto): Observable<VehicleDTO>
  updateVehicle(id, dto): Observable<VehicleDTO>
  deleteVehicle(id): Observable<void>
  uploadVehiclePhoto(id, file): Observable<{photoUrl: string}>

  // Driver CRUD
  getDrivers(filters, page, size): Observable<PagedResponse<DriverDTO>>
  createDriver(dto): Observable<DriverDTO>
  updateDriver(id, dto): Observable<DriverDTO>
  deleteDriver(id): Observable<void>

error-interceptor.ts :
  Gère les réponses d'erreur Spring Boot :
  - 422 UNPROCESSABLE_ENTITY → PrimeNG Toast severity="warn"
    avec le message du champ "message" de la réponse
  - 409 CONFLICT → PrimeNG Toast severity="error"
  - 500 → Toast "Erreur serveur inattendue"
  - 401 → Redirect vers /auth/login

Génère transport-admin.service.ts et error.interceptor.ts
```

---

## ══════════════════════════════════════════
## CORRECTION 10 — SCSS GLOBAL ADMIN
## ══════════════════════════════════════════

```
styles/admin-theme.scss — variables et corrections globales :

PALETTE CORRIGÉE :
  $primary     : #1D9E75;  /* vert YallaTN — boutons créer/confirmer */
  $danger      : #DC2626;  /* rouge — supprimer UNIQUEMENT */
  $warning     : #F59E0B;  /* orange — désactiver */
  $info        : #3B82F6;  /* bleu — voir détails, réservations */
  $secondary   : #6B7280;  /* gris — annuler */

  $bg-page     : #0f1117;
  $bg-card     : #1a1d2e;
  $bg-input    : #252840;
  $border      : #2e3149;
  $text-primary: #f1f5f9;
  $text-muted  : #94a3b8;

BOUTONS (override PrimeNG) :
  .p-button.p-button-success  → background $primary !important
  .p-button.p-button-danger   → background $danger !important
  .p-button.p-button-warning  → background $warning !important

  /* NE JAMAIS utiliser rouge pour "Créer" ou "Confirmer" */
  .p-button-primary           → background $primary !important

FORMULAIRES :
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .form-field.full-width { grid-column: 1 / -1; }

  small.error   { color: #f87171; font-size: 11px; margin-top: 4px; display: block; }
  small.warning { color: #fbbf24; font-size: 11px; margin-top: 4px; display: block; }
  small.duration-hint { color: $primary; font-size: 11px; margin-top: 4px; display: block; }

  .capacity-inherited {
    background: rgba($primary, 0.1);
    border: 1px solid rgba($primary, 0.3);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: $primary;
    margin-top: 6px;
  }

TABLE :
  tr:hover td { background: rgba(255,255,255,0.03); }

  /* Badge type transport */
  .transport-type-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  /* Places dispo avec couleurs sémantiques */
  .seats-full      { color: #f87171; font-weight: 600; }
  .seats-low       { color: #fbbf24; }
  .seats-available { color: #4ade80; }

Génère admin-theme.scss complet.
```

---

## ══════════════════════════════════════════
## ORDRE D'EXÉCUTION
## ══════════════════════════════════════════

```
SESSION 1  → CORRECTION 1 (SQL + Entités JPA)
             Valider : mvn compile sans erreur

SESSION 2  → CORRECTION 2 + 3 (Services + validations métier)
             Tester avec Postman :
             - POST transport PLANE avec driver → doit retourner 422
             - POST transport avec même ville départ/arrivée → 422
             - POST transport avec driver occupé → 409

SESSION 3  → CORRECTION 4 (Controllers REST)
             Tester GET /stats → valeurs cohérentes avec la DB

SESSION 4  → CORRECTION 5 (Formulaire Angular transport)
             Vérifier :
             - Choisir type PLANE → conducteur caché, compagnie visible
             - Choisir véhicule → capacité affichée en readonly
             - Même ville départ/arrivée → erreur affichée
             - Dates incohérentes → durée négative bloquée

SESSION 5  → CORRECTION 6 (Tableau + affichage)
             Vérifier :
             - Transport PLANE → "Compagnie: Tunisair" affiché
             - Places dispo rouges si 0

SESSION 6  → CORRECTIONS 7 + 8 (Formulaires véhicule + conducteur)
SESSION 7  → CORRECTIONS 9 + 10 (Service Angular + SCSS)

TESTS FINAUX :
  ✓ Créer transport PLANE sans conducteur → succès
  ✓ Créer transport BUS avec conducteur déjà occupé → 409
  ✓ Créer transport Tunis → Tunis → 422 bloqué
  ✓ Capacité héritée du véhicule automatiquement
  ✓ KPI "Places dispo" = somme correcte depuis la DB
  ✓ Boutons créer/modifier en vert, supprimer en rouge
  ✓ Conducteur email obligatoire dans le formulaire
  ✓ Couleur et année obligatoires dans le formulaire véhicule
```
