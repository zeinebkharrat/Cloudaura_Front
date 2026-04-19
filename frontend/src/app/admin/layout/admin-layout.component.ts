import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/notification.service';

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
export class AdminLayoutComponent {
  open = signal(true);
  sidebarVisible = signal(true);
  user = computed(() => this.auth.currentUser());
  adminNotifOpen = signal(false);
  adminThemeDark = signal(true);
  readonly logoPath = 'assets/logo/yallatn-logo.png';
  readonly adminQuickNotifications = computed(() => {
    const liveMessage = this.notificationService.message();
    const items = [
      { id: 'review', title: '3 listings pending moderation', subtitle: 'Review new submissions from partners', urgent: true },
      { id: 'bookings', title: 'Bookings are up today', subtitle: 'Current trend is +14% compared to yesterday', urgent: false },
      { id: 'ops', title: 'System health is stable', subtitle: 'No active incidents detected', urgent: false },
    ];

    if (liveMessage) {
      return [{ id: 'live', title: liveMessage, subtitle: 'Live platform update', urgent: false }, ...items];
    }

    return items;
  });
  readonly adminUnreadCount = computed(() => this.adminQuickNotifications().filter((item) => item.urgent).length);
  readonly currentNavItem = computed(() => {
    const exact = this.nav.find((item) => this.router.url === item.route);
    if (exact) return exact;
    return this.nav.find((item) => this.router.url.startsWith(item.route));
  });

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

  private readonly notificationService = inject(NotificationService);

  constructor(public auth: AuthService, private router: Router) {
    this.adminThemeDark.set(document.documentElement.getAttribute('data-theme') !== 'light');
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

  currentRouteLabel(): string {
    return this.currentNavItem()?.label ?? 'Dashboard';
  }

  currentRouteSectionLabel(): string {
    return this.sectionLabel(this.currentNavItem()?.section);
  }

  revealCurrentInSidebar() {
    const item = this.currentNavItem();
    if (!item) return;

    if (!this.sidebarVisible()) {
      this.showSidebar();
    }
    if (!this.open()) {
      this.open.set(true);
    }

    const id = this.navDomId(item);
    const target = document.getElementById(id);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('sb-item-highlight');
    setTimeout(() => target.classList.remove('sb-item-highlight'), 900);
  }

  toggleAdminNotifications() {
    this.adminNotifOpen.update((value) => !value);
  }

  toggleAdminTheme() {
    const nextDark = !this.adminThemeDark();
    document.documentElement.setAttribute('data-theme', nextDark ? 'dark' : 'light');
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    this.adminThemeDark.set(nextDark);
  }

  goToFrontOffice() {
    this.router.navigateByUrl('/home');
  }

  toggleEventsMenu() {
    this.isEventsMenuOpen = !this.isEventsMenuOpen;
  }

  openProfile() {
    this.router.navigateByUrl('/admin/profile');
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
