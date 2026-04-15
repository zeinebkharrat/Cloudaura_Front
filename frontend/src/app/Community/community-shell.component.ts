import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-community-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './community-shell.component.html',
  styleUrl: './community-shell.component.css',
})
export class CommunityShellComponent {
  readonly authService = inject(AuthService);

  communityDisplayName(): string {
    const user = this.authService.currentUser();
    if (!user) {
      return 'Guest user';
    }

    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return fullName || user.username || 'Community member';
  }

  communityInitials(): string {
    const user = this.authService.currentUser();
    if (!user) {
      return 'U';
    }

    const first = (user.firstName ?? '').trim().charAt(0);
    const last = (user.lastName ?? '').trim().charAt(0);
    const fallback = (user.username ?? 'U').trim().charAt(0);
    return `${first}${last}`.trim().toUpperCase() || fallback.toUpperCase();
  }
}
