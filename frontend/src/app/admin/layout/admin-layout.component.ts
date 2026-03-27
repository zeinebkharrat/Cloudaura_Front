import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl:    './admin-layout.component.css',
})
export class AdminLayoutComponent {
  open = signal(true);
  user = computed(() => this.auth.currentUser());
  
  // 1. AJOUT : État pour le menu déroulant des événements
  isEventsMenuOpen = false;

  nav = [
    { label: 'Tableau de bord', icon: '📊', route: '/admin' },
    { label: 'Hébergements',    icon: '🏨', route: '/admin/accommodations' },
    { label: 'Transports',      icon: '🚌', route: '/admin/transports' },
    { label: 'Activités',       icon: '📍', route: '/admin/activities' },
    { label: 'Événements',      icon: '📅', route: '/admin/events' }, // Ce label doit matcher ton @if
    { label: 'Artisanat',       icon: '🏺', route: '/admin/crafts' },
    { label: 'Utilisateurs',    icon: '👥', route: '/admin/users' },
    { label: 'Paramètres',      icon: '⚙️',  route: '/admin/settings' }
  ];

  constructor(public auth: AuthService, private router: Router) {}

  toggle() { 
    this.open.set(!this.open()); 
    // Optionnel : fermer le sous-menu si on réduit la sidebar
    if (!this.open()) this.isEventsMenuOpen = false;
  }

  // 2. AJOUT : Fonction pour ouvrir/fermer le menu événements
  toggleEventsMenu() {
    this.isEventsMenuOpen = !this.isEventsMenuOpen;
  }

  logout() { this.auth.logout(); }
}