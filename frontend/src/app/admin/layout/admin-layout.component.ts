import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../auth.service';

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
    { label: 'Tableau de bord', icon: '📊', route: '/admin/dashboard' },
    { label: 'Villes',         icon: '🏙️', route: '/admin/cities' },
    { label: 'Restaurants',    icon: '🍽️', route: '/admin/restaurants' },
    { label: 'Activités',      icon: '📍', route: '/admin/activities' },
    { label: 'Hébergements',    icon: '🏨', route: '/admin/accommodations' },
    { label: 'Transports',      icon: '🚌', route: '/admin/transports' },
    { label: 'Activités',       icon: '📍', route: '/admin/activities' },
    { label: 'Événements',      icon: '📅', route: '/admin/events' },
    { label: 'Artisanat',       icon: '🏺', route: '/admin/crafts' },
    { label: 'Logs d\'audit',   icon: '📋', route: '/admin/audit-logs' },
    { label: 'Utilisateurs',    icon: '👥', route: '/admin/users' },
    { label: 'Paramètres',      icon: '⚙️',  route: '/admin/settings' }
  ];

  constructor(public auth: AuthService, private router: Router) {}
  toggle() { this.open.set(!this.open()); }
  logout() { this.auth.logout(); }
}