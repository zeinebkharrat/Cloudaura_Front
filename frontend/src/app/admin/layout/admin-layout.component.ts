import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  open = signal(true);
  user = computed(() => this.auth.currentUser());
  
  // État pour le menu déroulant des événements
  isEventsMenuOpen = false;

  nav = [
    { label: 'Tableau de bord', icon: '📊', route: '/admin/dashboard' },
    { label: 'Villes',          icon: '🏙️', route: '/admin/cities' },
    { label: 'Restaurants',     icon: '🍽️', route: '/admin/restaurants' },
    { label: 'Activités',       icon: '📍', route: '/admin/activities' }, // Gardé une seule fois
    { label: 'Hébergements',    icon: '🏨', route: '/admin/accommodations' },
    { label: 'Transports',      icon: '🚌', route: '/admin/transports' },
    { label: 'Événements',      icon: '📅', route: '/admin/events' },
    { label: 'Artisanat',       icon: '🏺', route: '/admin/crafts' },
    { label: 'Logs d\'audit',   icon: '📋', route: '/admin/audit-logs' },
    { label: 'Utilisateurs',    icon: '👥', route: '/admin/users' },
    { label: 'Paramètres',      icon: '⚙️',  route: '/admin/settings' }
  ];

  constructor(public auth: AuthService, private router: Router) {}

  toggle() { 
    this.open.set(!this.open()); 
    // Optionnel : fermer le sous-menu si on réduit la sidebar
    if (!this.open()) this.isEventsMenuOpen = false;
  }

  logout() { 
    this.auth.logout(); 
    this.router.navigate(['/login']);
  }

  // CORRECTION : Ajout de la logique de bascule
  toggleEventsMenu() {
    this.isEventsMenuOpen = !this.isEventsMenuOpen;
    console.log('Menu événements ouvert :', this.isEventsMenuOpen);
  }

  openProfile() {
    this.router.navigate(['/admin/profile']);
  }
}