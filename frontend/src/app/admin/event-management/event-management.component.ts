import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../event.service';
import { Event, City } from '../../models/event';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-event-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-management.component.html',
  styleUrl: './event-management.component.css'
})
export class EventManagementComponent implements OnInit {
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

  constructor(private eventService: EventService, private http: HttpClient) {}

  ngOnInit(): void { this.loadEvents(); }

  loadEvents() {
    this.eventService.getEvents().subscribe(data => this.events = data);
  }

  initEmptyEvent(): Event {
    return {
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

    this.currentEvent.city.cityId = Number(this.currentEvent.city.cityId);
    
    if (this.isEditMode && this.currentEvent.eventId) {
      this.eventService.updateEvent(this.currentEvent.eventId, this.currentEvent).subscribe({
        next: () => this.handleResponse('Updated'),
        error: (err) => Swal.fire('Error', 'Update failed', 'error')
      });
    } else {
      this.eventService.createEvent(this.currentEvent).subscribe({
        next: () => this.handleResponse('Created'),
        error: (err) => Swal.fire('Error', 'Creation failed', 'error')
      });
    }
  }

  validateDates(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(this.currentEvent.startDate);
    const end = new Date(this.currentEvent.endDate);

    if (start < today) {
      Swal.fire('Date Error', 'Start date cannot be in the past!', 'error');
      return false;
    }
    if (end < start) {
      Swal.fire('Date Error', 'End date must be after start date!', 'error');
      return false;
    }
    return true;
  }
  
  handleResponse(msg: string) {
    this.loadEvents();
    this.showModal = false;
    Swal.fire('Success', `Event ${msg} successfully`, 'success');
  }

  deleteEvent(id: any) {
    Swal.fire({
      title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes'
    }).then((res) => {
      if (res.isConfirmed) {
        this.eventService.deleteEvent(id).subscribe(() => this.loadEvents());
      }
    });
  }
}