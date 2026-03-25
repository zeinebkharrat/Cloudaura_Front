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

  nav = [
    { label: 'Tableau de bord', icon: '📊', route: '/admin' },
    { label: 'Ludification', icon: '🎮', route: '/admin/games' },
  ];

  constructor(public auth: AuthService, private router: Router) {}
  toggle() { this.open.set(!this.open()); }
  logout() { this.auth.logout(); }
}
