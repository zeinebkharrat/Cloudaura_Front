import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../event.service';
import { Event } from '../../models/event';

@Component({
  selector: 'app-event-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-management.component.html',
  styleUrl: './event-management.component.css'
})
export class EventManagementComponent implements OnInit {
  events: Event[] = [];
  showModal = false;
  isEditMode = false;
  errorMessage = '';

  currentEvent: Event = this.getEmptyEvent();

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.eventService.getEvents().subscribe({
      next: (data) => this.events = data,
      error: (err) => console.error('API Error:', err)
    });
  }

  private getEmptyEvent(): Event {
    return { title: '', eventType: 'CULTURAL', venue: '', startDate: '', endDate: '', status: 'UPCOMING' };
  }

  openAddModal() {
    this.isEditMode = false;
    this.errorMessage = '';
    this.currentEvent = this.getEmptyEvent();
    this.showModal = true;
  }

  openEditModal(event: Event) {
    this.isEditMode = true;
    this.errorMessage = '';
    this.currentEvent = { ...event };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  validateDates(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(this.currentEvent.startDate);
    const end = new Date(this.currentEvent.endDate);

    if (start < today && !this.isEditMode) {
      this.errorMessage = "Start date cannot be in the past.";
      return false;
    }
    if (end < start) {
      this.errorMessage = "End date must be after start date.";
      return false;
    }
    this.errorMessage = '';
    return true;
  }

  saveEvent() {
    if (!this.validateDates()) return;

    const request = this.isEditMode && this.currentEvent.eventId
      ? this.eventService.updateEvent(this.currentEvent.eventId, this.currentEvent)
      : this.eventService.createEvent(this.currentEvent);

    request.subscribe({
      next: () => { this.loadEvents(); this.closeModal(); },
      error: () => this.errorMessage = "An error occurred while saving."
    });
  }

  deleteEvent(id: number | undefined): void {
    if (id && confirm('Are you sure you want to delete this event?')) {
      this.eventService.deleteEvent(id).subscribe(() => this.loadEvents());
    }
  }
}