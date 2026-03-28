import { Component, OnInit } from '@angular/core'; // Retrait de inject ici
import { ActivatedRoute, Data, RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EventService } from './event.service';
import { Event } from './models/event';
import { AuthService } from './auth.service'; 
import { PaymentService } from './payment.service'; 

export interface FeatureBlock {
  title: string;
  items: string[];
  icon?: string;
}

export type FeatureAccent = 'coral' | 'blue' | 'gold' | 'violet' | 'sand' | 'emerald' | 'rose';

@Component({
  selector: 'app-feature-page',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './feature-page.component.html',
  styleUrl: './feature-page.component.css',
})
export class FeaturePageComponent implements OnInit {
  // --- Propriétés ---
  kicker = '';
  title = '';
  description = '';
  accent: FeatureAccent = 'coral';
  highlights: string[] = [];
  blocks: FeatureBlock[] = [];
  events: any[] = [];
  isLoadingEvents = false;
  selectedEvent: any | null = null;

  // --- Toutes les injections dans le constructeur ---
  constructor(
    private route: ActivatedRoute,
    private eventService: EventService,
    public authService: AuthService, 
    private paymentService: PaymentService
  ) {}

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
    this.accent = ['coral', 'blue', 'gold', 'violet', 'sand', 'emerald', 'rose'].includes(a) 
                  ? (a as FeatureAccent) : 'coral';
    
    this.highlights = Array.isArray(d['highlights']) ? d['highlights'] : [];
    this.blocks = Array.isArray(d['blocks']) ? d['blocks'] : [];
  }

  private loadEvents(): void {
    this.isLoadingEvents = true;
    this.eventService.getEvents().subscribe({
      next: (events: any) => {
        this.events = events;
        this.isLoadingEvents = false;
      },
      error: (err: any) => {
        console.error('Error loading events:', err);
        this.isLoadingEvents = false;
      }
    });
  }

  selectEvent(event: any): void {
    this.selectedEvent = event;
    document.body.classList.add('modal-open');
  }

  closeEventDetails(): void {
    this.selectedEvent = null;
    document.body.classList.remove('modal-open');
  }

  onJoinEvent(event: any): void {
  console.log("1. Clic détecté sur l'événement :", event);

  const currentUser = this.authService.currentUser(); 
  
  if (!currentUser) {
    alert("Please log in to join this event.");
    return;
  }

  console.log("3. Envoi de la requête au Backend...");

  // CORRECTION : On envoie les 3 propriétés avec les bons noms
  this.paymentService.createSession({ 
    price: event.price, 
    productName: event.name || "event " + event.eventId, // On utilise productName pour le Back
    eventId: event.eventId   // On ajoute l'ID pour TypeScript
  }).subscribe({
    next: (res: any) => {
      if (res.url) {
        window.location.href = res.url;
      }
    },
    error: (err: any) => console.error("Stripe Error", err)
  });
}

}