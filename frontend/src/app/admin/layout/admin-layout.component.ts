import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Sidebar entry: PNG from /public/icones or PrimeIcons class (global stylesheet). */
export interface AdminNavItem {
  label: string;
  route: string;
  iconImg?: string;
  iconClass?: string;
}

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
<<<<<<< HEAD
  
<<<<<<< HEAD
  // 1. AJOUT : État pour le menu déroulant des événements
=======
  // État pour le menu déroulant des événements
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
  isEventsMenuOpen = false;

  nav = [
    { label: 'Tableau de bord', icon: '📊', route: '/admin/dashboard' },
<<<<<<< HEAD
    { label: 'Ludification',    icon: '🎮', route: '/admin/games' },
    { label: 'Villes',         icon: '🏙️', route: '/admin/cities' },
    { label: 'Restaurants',    icon: '🍽️', route: '/admin/restaurants' },
    { label: 'Activités',      icon: '📍', route: '/admin/activities' },
    { label: 'Réservations activités', icon: '🗓️', route: '/admin/activity-reservations' },
=======
    { label: 'Villes',          icon: '🏙️', route: '/admin/cities' },
    { label: 'Restaurants',     icon: '🍽️', route: '/admin/restaurants' },
    { label: 'Activités',       icon: '📍', route: '/admin/activities' }, // Gardé une seule fois
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
    { label: 'Hébergements',    icon: '🏨', route: '/admin/accommodations' },
    { label: 'Transports',      icon: '🚌', route: '/admin/transports' },
    { label: 'Événements',      icon: '📅', route: '/admin/events' },
    { label: 'Artisanat',       icon: '🏺', route: '/admin/crafts' },
    { label: 'Logs d\'audit',   icon: '📋', route: '/admin/audit-logs' },
    { label: 'Utilisateurs',    icon: '👥', route: '/admin/users' },
    { label: 'Paramètres',      icon: '⚙️',  route: '/admin/settings' },
    { label: 'Produits',        icon: '🏺', route: '/admin/products' },
    { label: 'Commandes',       icon: '🧾', route: '/admin/orders' }
=======

  isEventsMenuOpen = false;

  nav: AdminNavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', iconImg: 'icones/dashboard.png' },
    { label: 'Games', route: '/admin/games', iconImg: 'icones/game.png' },
    { label: 'Cities', route: '/admin/cities', iconImg: 'icones/city.png' },
    { label: 'Restaurants', route: '/admin/restaurants', iconImg: 'icones/restaurant.png' },
    { label: 'Activities', route: '/admin/activities', iconImg: 'icones/actitvity.png' },
    { label: 'Posts', route: '/admin/posts', iconClass: 'pi pi-comments' },
    { label: 'Activity bookings', route: '/admin/activity-reservations', iconClass: 'pi pi-calendar' },
    { label: 'Accommodations', route: '/admin/accommodations', iconImg: 'icones/hotel.png' },
    { label: 'Transport', route: '/admin/transports', iconImg: 'icones/bus.png' },
    { label: 'Events', route: '/admin/events', iconClass: 'pi pi-calendar' },
    { label: 'Crafts & products', route: '/admin/products', iconImg: 'icones/artisanat.png' },
    { label: 'Audit logs', route: '/admin/audit-logs', iconClass: 'pi pi-history' },
    { label: 'Users', route: '/admin/users', iconClass: 'pi pi-users' },
    { label: 'Settings', route: '/admin/settings', iconClass: 'pi pi-cog' },
    { label: 'Orders', route: '/admin/orders', iconImg: 'icones/money-bag.png' },
>>>>>>> 6ec99da41cece2cadc8b9432970cbb8c9f8872a4
  ];

  constructor(public auth: AuthService, private router: Router) {}

<<<<<<< HEAD
<<<<<<< HEAD
=======
  navDomId(item: AdminNavItem): string {
    return 'nav-' + item.route.replace(/\//g, '-').replace(/^-/, '');
  }

>>>>>>> 6ec99da41cece2cadc8b9432970cbb8c9f8872a4
  toggle() {
    this.open.set(!this.open());
    if (!this.open()) this.isEventsMenuOpen = false;
  }

  toggleEventsMenu() {
    this.isEventsMenuOpen = !this.isEventsMenuOpen;
=======
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
>>>>>>> 399e854c3d54ec9df0c8c53ac355004220cf1236
  }

  openProfile() {
    this.router.navigate(['/admin/profile']);
  }
}