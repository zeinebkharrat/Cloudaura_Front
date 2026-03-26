import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Data, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EventService } from './event.service';
import { Event } from './models/event';

/** Rich content block for feature pages (front-only). */
export interface FeatureBlock {
  title: string;
  items: string[];
  icon?: string;
}

/** Accent theme for decorative styling. */
export type FeatureAccent =
  | 'coral'
  | 'blue'
  | 'gold'
  | 'violet'
  | 'sand'
  | 'emerald'
  | 'rose';

@Component({
  selector: 'app-feature-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './feature-page.component.html',
  styleUrl: './feature-page.component.css',
})
export class FeaturePageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);

  kicker = '';
  title = '';
  description = '';
  accent: FeatureAccent = 'coral';
  highlights: string[] = [];
  blocks: FeatureBlock[] = [];
  events: Event[] = [];
  isLoadingEvents = false;
  selectedEvent: Event | null = null;

  ngOnInit(): void {
    this.applyData(this.route.snapshot.data);
    this.route.data.subscribe((d) => this.applyData(d));
    this.loadEvents();
  }

  private applyData(d: Data): void {
    this.kicker = String(d['kicker'] ?? 'Module');
    this.title = String(d['title'] ?? '');
    this.description = String(d['description'] ?? '');
    const a = d['accent'];
    if (
      typeof a === 'string' &&
      ['coral', 'blue', 'gold', 'violet', 'sand', 'emerald', 'rose'].includes(a)
    ) {
      this.accent = a as FeatureAccent;
    } else {
      this.accent = 'coral';
    }
    const h = d['highlights'];
    this.highlights = Array.isArray(h) ? (h as string[]) : [];
    const b = d['blocks'];
    this.blocks = Array.isArray(b) ? (b as FeatureBlock[]) : [];
  }

  private loadEvents(): void {
    this.isLoadingEvents = true;
    this.eventService.getEvents().subscribe({
      next: (events) => {
        this.events = events;
        this.isLoadingEvents = false;
      },
      error: (err) => {
        console.error('Error loading events:', err);
        this.isLoadingEvents = false;
      }
    });
  }

  selectEvent(event: Event): void {
  this.selectedEvent = event;
  document.body.classList.add('modal-open');
}

closeEventDetails(): void {
  this.selectedEvent = null;
  document.body.classList.remove('modal-open');
}
}
