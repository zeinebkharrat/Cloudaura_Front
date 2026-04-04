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
  styleUrl:    './admin-layout.component.css',
})
export class AdminLayoutComponent {
  open = signal(true);
  user = computed(() => this.auth.currentUser());

  isEventsMenuOpen = false;

  nav: AdminNavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', iconImg: 'icones/dashboard.png' },
    { label: 'Games', route: '/admin/games', iconImg: 'icones/game.png' },
    { label: 'Cities', route: '/admin/cities', iconImg: 'icones/city.png' },
    { label: 'Restaurants', route: '/admin/restaurants', iconImg: 'icones/restaurant.png' },
    { label: 'Activities', route: '/admin/activities', iconImg: 'icones/actitvity.png' },
    { label: 'Activity bookings', route: '/admin/activity-reservations', iconClass: 'pi pi-calendar' },
    { label: 'Accommodations', route: '/admin/accommodations', iconImg: 'icones/hotel.png' },
    { label: 'Transport', route: '/admin/transports', iconImg: 'icones/bus.png' },
    { label: 'Events', route: '/admin/events', iconClass: 'pi pi-calendar' },
    { label: 'Crafts & products', route: '/admin/products', iconImg: 'icones/artisanat.png' },
    { label: 'Audit logs', route: '/admin/audit-logs', iconClass: 'pi pi-history' },
    { label: 'Users', route: '/admin/users', iconClass: 'pi pi-users' },
    { label: 'Settings', route: '/admin/settings', iconClass: 'pi pi-cog' },
    { label: 'Orders', route: '/admin/orders', iconImg: 'icones/money-bag.png' },
  ];

  constructor(public auth: AuthService, private router: Router) {}

  navDomId(item: AdminNavItem): string {
    return 'nav-' + item.route.replace(/\//g, '-').replace(/^-/, '');
  }

  toggle() {
    this.open.set(!this.open());
    if (!this.open()) this.isEventsMenuOpen = false;
  }

  toggleEventsMenu() {
    this.isEventsMenuOpen = !this.isEventsMenuOpen;
  }

  openProfile() {
    this.router.navigateByUrl('/profile');
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/signin');
  }
}
