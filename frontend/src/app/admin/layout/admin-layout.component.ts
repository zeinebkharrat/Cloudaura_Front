import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Sidebar entry: PNG from /public/icones or PrimeIcons class (global stylesheet). */
export interface AdminNavItem {
  label: string;
  route: string;
  section?: 'core' | 'content' | 'commerce' | 'security';
  iconClass?: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit {
  open = signal(true);
  sidebarVisible = signal(true);
  isDarkMode = signal(true);
  user = computed(() => this.auth.currentUser());
  readonly logoPath = 'assets/logo/yallatn-logo.png';

  isEventsMenuOpen = false;

  nav: AdminNavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', iconClass: 'pi pi-home', section: 'core' },
    { label: 'Games', route: '/admin/games', iconClass: 'pi pi-play-circle', section: 'core' },
    { label: 'Gamification', route: '/admin/gamification', iconClass: 'pi pi-star-fill', section: 'core' },
    { label: 'Users', route: '/admin/users', iconClass: 'pi pi-users', section: 'core' },
    { label: 'Cities', route: '/admin/cities', iconClass: 'pi pi-map-marker', section: 'content' },
    { label: 'Restaurants', route: '/admin/restaurants', iconClass: 'pi pi-shop', section: 'content' },
    { label: 'Activities', route: '/admin/activities', iconClass: 'pi pi-compass', section: 'content' },
    { label: 'Posts', route: '/admin/posts', iconClass: 'pi pi-comments', section: 'content' },
    { label: 'Events', route: '/admin/events', iconClass: 'pi pi-calendar', section: 'content' },
    { label: 'Accommodations', route: '/admin/accommodations', iconClass: 'pi pi-building', section: 'commerce' },
    { label: 'Transport', route: '/admin/transports', iconClass: 'pi pi-send', section: 'commerce' },
    { label: 'Crafts & products', route: '/admin/products', iconClass: 'pi pi-box', section: 'commerce' },
    { label: 'Orders', route: '/admin/orders', iconClass: 'pi pi-shopping-bag', section: 'commerce' },
    { label: 'Activity bookings', route: '/admin/activity-reservations', iconClass: 'pi pi-ticket', section: 'commerce' },
    { label: 'Audit logs', route: '/admin/audit-logs', iconClass: 'pi pi-history', section: 'security' },
    { label: 'Settings', route: '/admin/settings', iconClass: 'pi pi-cog', section: 'security' },
  ];

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const currentTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    this.setTheme(currentTheme === 'light' ? 'light' : 'dark');
  }

  navDomId(item: AdminNavItem): string {
    return 'nav-' + item.route.replace(/\//g, '-').replace(/^-/, '');
  }

  toggle() {
    this.open.set(!this.open());
    if (!this.open()) this.isEventsMenuOpen = false;
  }

  hideSidebar() {
    this.sidebarVisible.set(false);
    this.open.set(true);
    this.isEventsMenuOpen = false;
  }

  showSidebar() {
    this.sidebarVisible.set(true);
  }

  toggleTheme(): void {
    const nextTheme = this.isDarkMode() ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  private setTheme(theme: 'dark' | 'light'): void {
    this.isDarkMode.set(theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  toggleEventsMenu() {
    this.isEventsMenuOpen = !this.isEventsMenuOpen;
  }

  openProfile() {
    this.router.navigateByUrl('/admin/profile');
  }

  goHome() {
    this.router.navigateByUrl('/');
  }

  sectionLabel(section: AdminNavItem['section']): string {
    if (section === 'content') return 'Content';
    if (section === 'commerce') return 'Commerce';
    if (section === 'security') return 'Security';
    return 'Core';
  }

  isFirstInSection(index: number): boolean {
    if (index === 0) return true;
    return this.nav[index - 1]?.section !== this.nav[index]?.section;
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/signin');
  }
}
