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
        start: ev.startDate,
        end: ev.endDate,
        backgroundColor: this.getEventColor(ev.eventType),
        borderColor: 'transparent',
        extendedProps: { ...ev }
      }));
    });
  }

  // --- 1. CLIC SUR UNE CASE VIDE (CRÉATION) ---
  handleDateSelect(selectInfo: any) {
    Swal.fire({
      title: 'Create New Event?',
      text: `Do you want to add an event on ${selectInfo.startStr}?`,
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
          queryParams: { date: selectInfo.startStr, action: 'new' } 
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
    const colors: any = { 'CULTURAL': '#6366f1', 'SPORT': '#f59e0b', 'FESTIVAL': '#ec4899', 'TECH': '#10b981' };
    return colors[type] || '#3b82f6';
  }
}