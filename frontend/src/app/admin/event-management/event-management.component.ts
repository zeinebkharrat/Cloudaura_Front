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
    this.showModal = true;
  }

  openEditModal(event: Event) {
    this.isEditMode = true;
    this.currentEvent = JSON.parse(JSON.stringify(event)); // Deep copy
    this.showModal = true;
  }


  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
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