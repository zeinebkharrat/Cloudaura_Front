import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './core/auth.service';
import { NotificationService } from './core/notification.service';
import { extractApiErrorMessage } from './api-error.util';
import { EventService, EventParticipantPayload } from './event.service';
import { Event as TravelEvent } from './models/event';

interface ParticipantFormRow {
  firstName: string;
  lastName: string;
}

@Component({
  standalone: true,
  selector: 'app-event-ticket-booking',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './event-ticket-booking.component.html',
  styleUrl: './event-ticket-booking.component.css',
})
export class EventTicketBookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly eventService = inject(EventService);
  private readonly notifier = inject(NotificationService);

  event: TravelEvent | null = null;
  loading = true;
  submitting = false;
  loadError = '';
  submitError = '';

  buyerFirstName = '';
  buyerLastName = '';
  buyerPhone = '';

  requestedTickets = 1;
  participants: ParticipantFormRow[] = [{ firstName: '', lastName: '' }];

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/signin'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const currentUser = this.auth.currentUser();
    this.buyerFirstName = String(currentUser?.firstName ?? '').trim();
    this.buyerLastName = String(currentUser?.lastName ?? '').trim();
    this.buyerPhone = String(currentUser?.phone ?? '').trim();

    const eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    if (!Number.isFinite(eventId) || eventId <= 0) {
      this.loading = false;
      this.loadError = 'Event ID is invalid.';
      return;
    }

    this.eventService.getEvents().subscribe({
      next: (events) => {
        const found = events.find((ev) => Number(ev.eventId) === eventId) ?? null;
        this.event = found;
        this.loading = false;
        if (!this.event) {
          this.loadError = 'Event not found.';
          return;
        }
        if (this.availableSpots() <= 0) {
          this.loadError = 'Sold Out';
          return;
        }
        this.requestedTickets = 1;
        this.syncParticipantsToRequestedCount();
      },
      error: () => {
        this.loading = false;
        this.loadError = 'Unable to load event details.';
      },
    });
  }

  availableSpots(): number {
    const total = Number(this.event?.totalCapacity ?? 0);
    const reserved = Number(this.event?.reservedCount ?? 0);
    return Math.max(0, total - reserved);
  }

  eventUnitPrice(): number {
    const amount = Number(this.event?.price ?? 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  totalAmount(): number {
    return this.eventUnitPrice() * this.requestedTickets;
  }

  isPaidEvent(): boolean {
    return this.eventUnitPrice() > 0;
  }

  onRequestedTicketsChanged(rawValue: number | string): void {
    const parsed = Number(rawValue);
    const maxAllowed = Math.max(1, this.availableSpots());
    if (!Number.isFinite(parsed)) {
      this.requestedTickets = 1;
    } else {
      this.requestedTickets = Math.min(maxAllowed, Math.max(1, Math.floor(parsed)));
    }
    this.syncParticipantsToRequestedCount();
  }

  participantLabel(index: number): string {
    return `${index + 1}`;
  }

  submitReservation(): void {
    this.submitError = '';

    if (!this.event || this.event.eventId == null) {
      this.submitError = 'This event is not available.';
      return;
    }
    if (!this.buyerFirstName.trim() || !this.buyerLastName.trim() || !this.buyerPhone.trim()) {
      this.submitError = 'Buyer first name, last name and phone are required.';
      return;
    }
    if (this.requestedTickets < 1) {
      this.submitError = 'At least one ticket is required.';
      return;
    }
    if (this.requestedTickets > this.availableSpots()) {
      this.submitError = 'Sold Out';
      return;
    }

    const participantsPayload = this.buildParticipantsPayload();
    if (!participantsPayload) {
      this.submitError = 'Each participant must have first name and last name.';
      return;
    }

    this.submitting = true;

    if (this.isPaidEvent()) {
      this.eventService.createCheckoutSession({
        event_id: this.event.eventId,
        amount: this.eventUnitPrice(),
        eventName: this.event.title,
        requestedTickets: this.requestedTickets,
        participants: participantsPayload,
      }).subscribe({
        next: (res) => {
          this.submitting = false;
          if (!res?.sessionId || !res?.sessionUrl) {
            this.submitError = 'Unable to open payment page. Please try again.';
            return;
          }
          sessionStorage.setItem(
            this.checkoutDraftKey(res.sessionId),
            JSON.stringify({ participants: participantsPayload })
          );
          window.location.href = res.sessionUrl;
        },
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          this.submitError = extractApiErrorMessage(err, 'Could not start payment.');
        },
      });
      return;
    }

    this.eventService.createReservation({
      event_id: this.event.eventId,
      total_amount: 0,
      status: 'CONFIRMED',
      requestedTickets: this.requestedTickets,
      participants: participantsPayload,
    }).subscribe({
      next: (res) => {
        this.submitting = false;
        const emailSent = res?.emailSent !== false;
        this.notifier.show(
          emailSent
            ? 'Reservation confirmed. Your tickets were sent by email.'
            : 'Reservation confirmed, but email sending failed.',
          emailSent ? 'success' : 'info'
        );
        this.router.navigate(['/evenements']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting = false;
        this.submitError = extractApiErrorMessage(err, 'Could not complete reservation.');
      },
    });
  }

  private syncParticipantsToRequestedCount(): void {
    const count = Math.max(1, this.requestedTickets);
    const nextRows: ParticipantFormRow[] = [];
    for (let i = 0; i < count; i++) {
      const existing = this.participants[i];
      if (existing) {
        nextRows.push({ ...existing });
        continue;
      }
      nextRows.push({
        firstName: i === 0 ? this.buyerFirstName : '',
        lastName: i === 0 ? this.buyerLastName : '',
      });
    }
    this.participants = nextRows;
  }

  private buildParticipantsPayload(): EventParticipantPayload[] | null {
    if (this.participants.length !== this.requestedTickets) {
      return null;
    }

    const payload = this.participants.map((row) => ({
      firstName: String(row.firstName ?? '').trim(),
      lastName: String(row.lastName ?? '').trim(),
    }));

    if (payload.some((p) => !p.firstName || !p.lastName)) {
      return null;
    }

    return payload;
  }

  private checkoutDraftKey(sessionId: string): string {
    return `eventCheckoutDraft:${sessionId}`;
  }
}
