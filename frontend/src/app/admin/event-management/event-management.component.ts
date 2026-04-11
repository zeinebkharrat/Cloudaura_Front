import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../event.service';
import { Event, City } from '../../models/event';
import { ActivatedRoute } from '@angular/router';
import { AppAlertsService } from '../../core/services/app-alerts.service';

@Component({
  selector: 'app-event-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-management.component.html',
  styleUrl: './event-management.component.css'
})
export class EventManagementComponent implements OnInit {
  private alerts = inject(AppAlertsService);

  isDarkMode = true;
  events: Event[] = [];
  showModal = false;
  isEditMode = false;
  uploading = false;
  aiExtracting = false;
  generatingPoster = false;
  aiPosterDescription = '';
  selectedImageFileName = '';
  imageOriginLabel = '';

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
  }
  tunisiaCities: City[] = [
    { cityId: 1, name: 'Tunis' }, { cityId: 2, name: 'Ariana' }, { cityId: 3, name: 'Ben Arous' },
    { cityId: 4, name: 'Manouba' }, { cityId: 5, name: 'Nabeul' }, { cityId: 6, name: 'Zaghouan' },
    { cityId: 7, name: 'Bizerte' }, { cityId: 8, name: 'Béja' }, { cityId: 9, name: 'Jendouba' },
    { cityId: 10, name: 'Le Kef' }, { cityId: 11, name: 'Siliana' }, { cityId: 12, name: 'Kairouan' },
    { cityId: 13, name: 'Sidi Bouzid' }, { cityId: 14, name: 'Kassérine' }, { cityId: 15, name: 'Sousse' },
    { cityId: 16, name: 'Monastir' }, { cityId: 17, name: 'Mahdia' }, { cityId: 18, name: 'Sfax' },
    { cityId: 19, name: 'Gafsa' }, { cityId: 20, name: 'Tozeur' }, { cityId: 21, name: 'Kebili' },
    { cityId: 22, name: 'Gabès' }, { cityId: 23, name: 'Médenine' }, { cityId: 24, name: 'Tataouine' }
  ];

  currentEvent: Event = this.initEmptyEvent();

  constructor(private route: ActivatedRoute,private eventService: EventService, private http: HttpClient) {}
  searchQuery: string = '';
  filterType: string = '';
  filterStatus: string = '';
  filterCity: string = '';
  filteredEvents: Event[] = [];
  currentPage = 1;
  readonly pageSize = 10;

  private pendingEditId: number | null = null;


  ngOnInit(): void {
    this.loadEvents();
    this.route.queryParams.subscribe(params => {
      if (params['editId']) {
        const editId = Number(params['editId']);
        if (!Number.isNaN(editId)) {
          const eventToEdit = this.events.find(e => e.eventId === editId);
          if (eventToEdit) {
            this.openEditModal(eventToEdit);
          } else {
            this.pendingEditId = editId;
          }
        }
        return;
      }

      if (params['action'] === 'new') {
        this.openAddModal();
        const startDate = params['startDate'] ?? params['date'] ?? '';
        const endDate = params['endDate'] ?? startDate;
        if (startDate) {
          this.currentEvent.startDate = startDate;
          this.currentEvent.endDate = endDate;
        }
      }
    });
  }

  get totalItems(): number {
    return this.filteredEvents.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get paginatedEvents(): Event[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredEvents.slice(start, start + this.pageSize);
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  private clampCurrentPage(): void {
    if (this.currentPage < 1) {
      this.currentPage = 1;
      return;
    }
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

 loadEvents() {
  this.eventService.getEvents().subscribe({
    next: (data) => {
      this.events = data;
      this.filteredEvents = data; // <--- TRÈS IMPORTANT
      this.currentPage = 1;
      this.applyFilters(); // Force un premier tri si des filtres sont déjà remplis
      if (this.pendingEditId != null) {
        const eventToEdit = this.events.find(e => e.eventId === this.pendingEditId);
        if (eventToEdit) {
          this.openEditModal(eventToEdit);
          this.pendingEditId = null;
        }
      }
    },
    error: (err) => console.error("Erreur chargement:", err)
  });
}

applyFilters() {
  console.log('Filtrage en cours...', this.searchQuery); // Regarde dans la console (F12) si ça s'affiche !

  const query = this.searchQuery.toLowerCase().trim();

  this.filteredEvents = this.events.filter(ev => {
    // Sécurité : on transforme tout en string pour éviter les erreurs sur NULL
    const title = (ev.title || '').toLowerCase();
    const venue = (ev.venue || '').toLowerCase();
    const type = ev.eventType || '';
    const status = ev.status || '';
    const cityName = ev.city?.name || '';

    const matchesSearch = title.includes(query) || venue.includes(query);
    const matchesType = !this.filterType || type === this.filterType;
    const matchesStatus = !this.filterStatus || status === this.filterStatus;
    const matchesCity = !this.filterCity || cityName === this.filterCity;

    return matchesSearch && matchesType && matchesStatus && matchesCity;
  });
  this.currentPage = 1;
  this.clampCurrentPage();
}

resetFilters() {
  this.searchQuery = '';
  this.filterType = '';
  this.filterStatus = '';
  this.filterCity = '';
  this.filteredEvents = this.events;
  this.currentPage = 1;
}

  initEmptyEvent(): Event {
    return {
      eventId: 0,
      title: '', eventType: 'CULTURAL', venue: '',
      startDate: '', endDate: '', status: 'UPCOMING',
      imageUrl: '', price: 0, city: { cityId: 1, name: '' }
    };
  }

  openAddModal() {
    this.isEditMode = false;
    this.currentEvent = this.initEmptyEvent();
    this.aiPosterDescription = '';
    this.selectedImageFileName = '';
    this.imageOriginLabel = '';
    this.showModal = true;
  }

  onCreateFromImageSelected(event: any) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.openAddModal();
    this.selectedImageFileName = file.name;
    this.imageOriginLabel = 'Imported from Create from image';
    this.extractEventDataFromPoster(file);
    this.uploadPosterForEvent(file);
    input.value = '';
  }

  openEditModal(event: Event) {
    this.isEditMode = true;
    this.currentEvent = JSON.parse(JSON.stringify(event)); // Deep copy
    this.aiPosterDescription = '';
    this.selectedImageFileName = '';
    this.imageOriginLabel = this.currentEvent.imageUrl ? 'Saved event image' : '';
    this.showModal = true;
  }

  generatePosterFromAi(): void {
    const title = String(this.currentEvent.title ?? '').trim();
    const category = String(this.currentEvent.eventType ?? '').trim();
    const city = this.resolveSelectedCityName();

    if (!title || !category || !city) {
      void this.alerts.warning(
        'Missing fields',
        'Please fill Event Name, City and Category before generating a poster.'
      );
      return;
    }

    this.generatingPoster = true;
    this.eventService.generateEventPoster({
      title,
      city,
      category,
      description: this.aiPosterDescription.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.currentEvent.imageUrl = res?.imageUrl ?? '';
        this.selectedImageFileName = 'ai-generated-poster.png';
        this.imageOriginLabel = 'Generated with AI';
        this.generatingPoster = false;
        void this.alerts.success('Poster generated', 'AI poster generated and attached to the event.');
      },
      error: (err) => {
        this.generatingPoster = false;
        const msg = this.extractAiErrorMessage(err)
          || (typeof err?.error === 'string' ? err.error : '')
          || 'Could not generate poster now. Please try again.';
        void this.alerts.error('Poster generation failed', msg);
      }
    });
  }

  private resolveSelectedCityName(): string {
    const selectedId = Number(this.currentEvent.city?.cityId);
    const city = this.tunisiaCities.find((c) => Number(c.cityId) === selectedId);
    return (city?.name ?? this.currentEvent.city?.name ?? '').trim();
  }


  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedImageFileName = file.name;
      this.imageOriginLabel = 'Uploaded manually';
      this.uploading = true;
      const formData = new FormData();
      formData.append('image', file);
      this.http.post('https://api.imgbb.com/1/upload?key=7360a2c39349f4d87d8c057a177810e7', formData)
        .subscribe({
          next: (res: any) => {
            this.currentEvent.imageUrl = res.data.url;
            this.uploading = false;
          },
          error: () => this.uploading = false
        });
    }
  }

  private uploadPosterForEvent(file: File) {
    this.selectedImageFileName = file.name;
    this.uploading = true;
    const formData = new FormData();
    formData.append('image', file);

    this.http.post('https://api.imgbb.com/1/upload?key=7360a2c39349f4d87d8c057a177810e7', formData)
      .subscribe({
        next: (res: any) => {
          this.currentEvent.imageUrl = res?.data?.url ?? '';
          this.uploading = false;
        },
        error: () => {
          this.uploading = false;
          void this.alerts.error('Image upload failed', 'Poster text was extracted, but image upload failed. You can retry in the form.');
        }
      });
  }

  private extractEventDataFromPoster(file: File) {
    this.aiExtracting = true;

    this.eventService.extractEventFromImage(file)
      .subscribe({
        next: (res) => {
          const text = (res?.text ?? '').trim();
          if (!text.trim()) {
            void this.alerts.error('Extraction failed', 'No readable text detected in this image.');
            this.aiExtracting = false;
            return;
          }

          this.applyExtractedDataToCurrentEvent(text, file.name);
          this.aiExtracting = false;
          void this.alerts.success('Form pre-filled', 'Event fields were auto-filled from the uploaded image.');
        },
        error: (err) => {
          const backendMessage = this.extractAiErrorMessage(err);
          this.tryOcrFallback(file, backendMessage);
        }
      });
  }

  private tryOcrFallback(file: File, backendMessage: string) {
    const formData = new FormData();
    formData.append('apikey', 'helloworld');
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('file', file);

    this.http.post('https://api.ocr.space/parse/image', formData)
      .subscribe({
        next: (res: any) => {
          const text = this.extractTextFromOcrResponse(res);
          if (!text) {
            this.aiExtracting = false;
            void this.alerts.error('AI extraction failed', backendMessage || 'Could not read text from this image. Please complete the form manually.');
            return;
          }

          this.applyExtractedDataToCurrentEvent(text, file.name);
          this.aiExtracting = false;
          console.warn('Primary AI extraction failed, fallback OCR used:', backendMessage || 'Unknown primary error');
          void this.alerts.success('Form pre-filled', 'Event fields were auto-filled from the uploaded image. Please review before saving.');
        },
        error: () => {
          this.aiExtracting = false;
          void this.alerts.error('AI extraction failed', backendMessage || 'Could not read text from this image. Please complete the form manually.');
        }
      });
  }

  private extractTextFromOcrResponse(response: any): string {
    const parsedResults = response?.ParsedResults;
    if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
      return '';
    }

    return parsedResults
      .map((item: any) => item?.ParsedText ?? '')
      .join('\n')
      .trim();
  }

  private extractAiErrorMessage(err: any): string {
    const direct = err?.error?.message;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const alt = err?.error?.error;
    if (typeof alt === 'string' && alt.trim()) {
      return alt.trim();
    }

    const nested = err?.error?.error?.message;
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }

    return '';
  }

  private applyExtractedDataToCurrentEvent(ocrText: string, fileName: string) {
    const normalizedText = ocrText.replace(/\r/g, '\n');
    const lines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length >= 3);

    const detectedTitle = this.detectEventTitle(lines, fileName);
    const detectedCity = this.detectCity(normalizedText);
    const detectedVenue = this.detectVenue(lines, normalizedText);
    const detectedDates = this.detectDates(normalizedText);
    const detectedType = this.detectType(normalizedText, detectedTitle, detectedVenue);
    const detectedPrice = this.detectPrice(normalizedText);

    if (detectedTitle) {
      this.currentEvent.title = detectedTitle;
    }

    if (detectedCity) {
      this.currentEvent.city.cityId = detectedCity.cityId;
      this.currentEvent.city.name = detectedCity.name;
    } else {
      const inferredCity = this.inferCityFromVenue(detectedVenue);
      if (inferredCity) {
        this.currentEvent.city.cityId = inferredCity.cityId;
        this.currentEvent.city.name = inferredCity.name;
      }
    }

    if (detectedVenue) {
      this.currentEvent.venue = detectedVenue;
    }

    if (detectedDates.startDate) {
      this.currentEvent.startDate = detectedDates.startDate;
      this.currentEvent.endDate = detectedDates.endDate ?? detectedDates.startDate;
    }

    if (detectedType) {
      this.currentEvent.eventType = detectedType;
    }

    if (detectedPrice != null) {
      this.currentEvent.price = detectedPrice;
    }

    this.currentEvent.status = 'UPCOMING';
  }

  private detectEventTitle(lines: string[], fileName: string): string {
    const blockedWords = ['DATE', 'CITY', 'TUNIS', 'MARS', 'APRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPT', 'OCT', 'NOV', 'DEC'];
    const score = (line: string): number => {
      const clean = line.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
      if (clean.length < 4 || clean.length > 60) {
        return -100;
      }

      if (blockedWords.some((word) => clean.toUpperCase().includes(word))) {
        return -10;
      }

      const upperRatio = clean.replace(/[^A-Z]/g, '').length / clean.length;
      const digitPenalty = clean.replace(/[^0-9]/g, '').length > 3 ? -3 : 0;
      return Math.round(upperRatio * 10) + (clean.length >= 8 && clean.length <= 28 ? 6 : 2) + digitPenalty;
    };

    const headerLines = lines
      .filter((line) => /^[A-Z0-9\s&'\-]{4,40}$/.test(line))
      .slice(0, 2);

    if (headerLines.length >= 2) {
      const combined = `${headerLines[0]} ${headerLines[1]}`.trim();
      if (combined.length <= 60) {
        return this.titleCase(combined);
      }
    }

    const bestLine = [...lines].sort((a, b) => score(b) - score(a))[0];

    if (bestLine && score(bestLine) > 0) {
      return this.titleCase(bestLine);
    }

    const fromFileName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    return this.titleCase(fromFileName || 'New Event');
  }

  private detectCity(text: string): City | null {
    const lower = text.toLowerCase();
    const city = this.tunisiaCities.find((c) => lower.includes((c.name ?? '').toLowerCase()));
    return city ?? null;
  }

  private detectVenue(lines: string[], fullText: string): string {
    const venueKeywords = [
      'theatre', 'théâtre', 'municipal', 'stadium', 'stade', 'arena', 'hotel', 'hôtel',
      'centre', 'center', 'hall', 'club', 'cafe', 'café', 'avenue', 'rue', 'boulevard', 'rio'
    ];

    const candidate = lines.find((line) => {
      const lowered = line.toLowerCase();
      return venueKeywords.some((keyword) => lowered.includes(keyword));
    });

    if (candidate) {
      return this.titleCase(candidate);
    }

    const normalizedText = fullText.toLowerCase();
    const directVenueMatch = normalizedText.match(/\b(le\s+rio|rio|theatre\s+municipal|th[eé]atre\s+municipal)\b/i);
    if (directVenueMatch?.[0]) {
      return this.titleCase(directVenueMatch[0]);
    }

    return '';
  }

  private detectType(text: string, title: string, venue: string): Event['eventType'] | null {
    const source = `${text} ${title} ${venue}`.toLowerCase();

    if (/hackathon|startup|ai|tech|developer|digital|coding/.test(source)) {
      return 'TECH';
    }
    if (/marathon|football|match|tournament|sport|run|fitness|basket/.test(source)) {
      return 'SPORT';
    }
    if (/festival|fest|live|concert|music|dj|jazz|quartet|quintet/.test(source)) {
      return 'FESTIVAL';
    }
    return 'CULTURAL';
  }

  private detectPrice(text: string): number | null {
    const lowered = text.toLowerCase();
    if (/gratuit|free entry|free access|entrée libre/.test(lowered)) {
      return 0;
    }

    const priceMatch = lowered.match(/(\d{1,4}(?:[\.,]\d{1,2})?)\s*(dt|tnd|tn|dinars?)/i);
    if (!priceMatch) {
      return null;
    }

    const parsed = Number(priceMatch[1].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private detectDates(text: string): { startDate: string | null; endDate: string | null } {
    const monthMap: Record<string, number> = {
      jan: 1, january: 1, janvier: 1,
      feb: 2, february: 2, fevrier: 2, février: 2,
      mar: 3, march: 3, mars: 3,
      apr: 4, april: 4, avril: 4, avr: 4,
      may: 5, mai: 5,
      jun: 6, june: 6, juin: 6,
      jul: 7, july: 7, juillet: 7,
      aug: 8, august: 8, aout: 8, août: 8,
      sep: 9, sept: 9, september: 9, septembre: 9,
      oct: 10, october: 10, octobre: 10,
      nov: 11, november: 11, novembre: 11,
      dec: 12, december: 12, decembre: 12, décembre: 12
    };

    const now = new Date();
    const fallbackYear = now.getFullYear();
    const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const slashDateRegex = /(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/g;
    const slashMatches = [...normalized.matchAll(slashDateRegex)];
    if (slashMatches.length > 0) {
      const first = slashMatches[0];
      const day = Number(first[1]);
      const month = Number(first[2]);
      let year = Number(first[3] ?? fallbackYear);
      if (year < 100) {
        year += 2000;
      }
      const startDate = this.toIsoDate(year, month, day);
      return { startDate, endDate: startDate };
    }

    const monthNames = Object.keys(monthMap).join('|');
    const textDateRegex = new RegExp(`(\\d{1,2})\\s*(${monthNames})(?:\\s*(\\d{4}))?`, 'g');
    const textMatches = [...normalized.matchAll(textDateRegex)];
    if (textMatches.length > 0) {
      const first = textMatches[0];
      const day = Number(first[1]);
      const month = monthMap[first[2]];
      const year = Number(first[3] ?? fallbackYear);
      const startDate = this.toIsoDate(year, month, day);
      return { startDate, endDate: startDate };
    }

    return { startDate: null, endDate: null };
  }

  private inferCityFromVenue(venue: string): City | null {
    if (!venue) {
      return null;
    }

    const normalized = venue.toLowerCase();
    if (normalized.includes('rio')) {
      return this.tunisiaCities.find((city) => (city.name ?? '').toLowerCase() === 'tunis') ?? null;
    }

    return null;
  }

  private toIsoDate(year: number, month: number, day: number): string | null {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private titleCase(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }


  saveEvent() {
  if (!this.validateDates()) return;

  // 1. Créer une copie de l'événement pour ne pas modifier l'affichage pendant l'envoi
  const eventToSave = JSON.parse(JSON.stringify(this.currentEvent));

  // 2. Nettoyer l'objet City : Le backend veut juste l'ID pour le mapping Hibernate
  if (eventToSave.city && eventToSave.city.cityId) {
    eventToSave.city = { 
      cityId: Number(eventToSave.city.cityId) 
    };
  }

  // 3. Gérer l'ID pour la création (certains backends n'aiment pas recevoir eventId: 0)
  if (!this.isEditMode) {
    delete eventToSave.eventId; 
  }

  if (this.isEditMode && this.currentEvent.eventId) {
    this.eventService.updateEvent(this.currentEvent.eventId, eventToSave).subscribe({
      next: () => this.handleResponse('Updated'),
      error: (err) => {
        console.error("Update Error:", err);
        void this.alerts.error('Error', 'Update failed');
      }
    });
  } else {
    this.eventService.createEvent(eventToSave).subscribe({
      next: () => this.handleResponse('Created'),
      error: (err) => {
        console.error("Full Creation Error Detail:", err); // Regarde ceci dans ta console F12
        void this.alerts.error('Error', 'Creation failed. Check console for details.');
      }
    });
  }
}

  validateDates(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(this.currentEvent.startDate);
    const end = new Date(this.currentEvent.endDate);

    if (start < today) {
      void this.alerts.error('Date error', 'Start date cannot be in the past.');
      return false;
    }
    if (end < start) {
      void this.alerts.error('Date error', 'End date must be after the start date.');
      return false;
    }
    return true;
  }
  
  handleResponse(msg: string) {
    this.loadEvents();
    this.showModal = false;
    void this.alerts.success('Success', `Event ${msg} successfully`);
  }

  deleteEvent(id: any) {
    void this.alerts
      .confirm({
        title: 'Delete this event?',
        text: 'This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
      .then((res) => {
        if (res.isConfirmed) {
          this.eventService.deleteEvent(id).subscribe(() => this.loadEvents());
        }
      });
  }
}