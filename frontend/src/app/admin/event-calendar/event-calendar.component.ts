import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventService } from '../../event.service';
import { Router } from '@angular/router'; // Pour la redirection vers l'édition
import Swal from 'sweetalert2';

@Component({
  selector: 'app-event-calendar',
  standalone: true,
  imports: [CommonModule, FullCalendarModule],
  templateUrl: './event-calendar.component.html',
  styleUrl: './event-calendar.component.css'
})
export class EventCalendarComponent implements OnInit {

  private readonly todayIso = this.toIsoDate(new Date());

  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, interactionPlugin],
    locale: 'en-gb',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek'
    },
    selectable: true, // PERMET DE CLIQUER SUR UNE CASE VIDE
    selectAllow: this.allowFutureSelection.bind(this),
    select: this.handleDateSelect.bind(this), // FONCTION POUR CRÉATION
    eventClick: this.handleEventClick.bind(this), // FONCTION POUR ÉDITION
    events: [],
    height: 'auto'
  };

  constructor(private eventService: EventService, private router: Router) {}

  ngOnInit(): void {
    this.fetchEvents();
  }

  fetchEvents() {
    this.eventService.getEvents().subscribe(data => {
      this.calendarOptions.events = data.map(ev => ({
        id: ev.eventId?.toString(),
        title: ev.title,
        // In month grid, force all events to render as colored day blocks (not plain time text).
        start: this.toEventDateOnly(ev.startDate),
        end: this.toExclusiveEndDateOnly(ev.startDate, ev.endDate),
        allDay: true,
        display: 'block',
        backgroundColor: this.getEventColor(ev.eventType),
        borderColor: this.getEventColor(ev.eventType),
        textColor: '#ffffff',
        extendedProps: { ...ev }
      }));
    });
  }

  private toEventDateOnly(value: any): string {
    if (!value) {
      return this.todayIso;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return this.todayIso;
    }
    return this.toIsoDate(d);
  }

  /** FullCalendar uses exclusive `end` for all-day events, so add 1 day to include the last day. */
  private toExclusiveEndDateOnly(startValue: any, endValue: any): string {
    const start = new Date(startValue ?? endValue ?? new Date());
    const end = new Date(endValue ?? startValue ?? new Date());
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 1);
      return this.toIsoDate(fallback);
    }
    const max = end.getTime() >= start.getTime() ? end : start;
    max.setDate(max.getDate() + 1);
    return this.toIsoDate(max);
  }

  private toIsoDate(value: Date): string {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isFutureOrToday(isoDate: string): boolean {
    return isoDate >= this.todayIso;
  }

  private allowFutureSelection(selectInfo: any): boolean {
    const startIso = (selectInfo?.startStr ?? '').slice(0, 10);
    return this.isFutureOrToday(startIso);
  }

  private toInclusiveEndIso(selectInfo: any): string {
    const end = new Date(selectInfo.end);
    end.setDate(end.getDate() - 1);
    return this.toIsoDate(end);
  }

  private toDateTimeLocal(isoDate: string, hour: number, minute: number): string {
    return `${isoDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // --- 1. CLIC SUR UNE CASE VIDE (CRÉATION) ---
  handleDateSelect(selectInfo: any) {
    const startIso = (selectInfo.startStr ?? '').slice(0, 10);
    if (!this.isFutureOrToday(startIso)) {
      void Swal.fire({
        title: 'Past date not allowed',
        text: 'You can only create events for today or future dates.',
        icon: 'warning',
        confirmButtonColor: '#f59e0b',
        background: '#1e293b',
        color: '#fff'
      });
      return;
    }

    const endIso = this.toInclusiveEndIso(selectInfo);
    const startDateTime = this.toDateTimeLocal(startIso, 9, 0);
    const endDateTime = this.toDateTimeLocal(endIso, 18, 0);
    const rangeText = startIso === endIso ? startIso : `${startIso} → ${endIso}`;

    Swal.fire({
      title: 'Create New Event?',
      text: `Do you want to add an event for ${rangeText}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, go to Dashboard',
      confirmButtonColor: '#10b981',
      background: '#1e293b',
      color: '#fff'
    }).then((result) => {
      if (result.isConfirmed) {
        // On redirige vers le dashboard en passant la date en paramètre
        this.router.navigate(['/admin/events/dashboard'], { 
          queryParams: { action: 'new', startDate: startDateTime, endDate: endDateTime } 
        });
      }
    });
  }

  // --- 2. CLIC SUR UN ÉVÉNEMENT EXISTANT (DÉTAILS + ÉDITION) ---
  handleEventClick(info: any) {
    const ev = info.event.extendedProps;

    Swal.fire({
      title: `<span style="color: #f8fafc">${info.event.title}</span>`,
      html: `
        <div style="text-align: left; color: #94a3b8;">
          <p>📍 <b>Venue:</b> ${ev.venue}</p>
          <p>💰 <b>Price:</b> ${ev.price} TND</p>
        </div>
      `,
      background: '#1e293b',
      showCancelButton: true,
      confirmButtonText: '📝 Edit Event',
      confirmButtonColor: '#3b82f6',
      cancelButtonText: 'Close',
    }).then((result) => {
      if (result.isConfirmed) {
        // Redirection vers le dashboard avec l'ID de l'event pour l'ouvrir direct
        this.router.navigate(['/admin/events/dashboard'], { 
          queryParams: { editId: ev.eventId } 
        });
      }
    });
  }

  getEventColor(type: string): string {
    const t = (type ?? '').toUpperCase();
    const colors: Record<string, string> = {
      CULTURAL: '#6366f1',
      SPORT: '#f59e0b',
      FESTIVAL: '#ec4899',
      TECH: '#10b981'
    };
    return colors[t] || '#3b82f6';
  }
}