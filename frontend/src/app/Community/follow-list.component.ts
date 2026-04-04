import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { FollowService, FollowUserSummary } from './follow.service';

@Component({
  selector: 'app-follow-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './follow-list.component.html',
  styleUrl: './follow-list.component.css',
})
export class FollowListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly followService = inject(FollowService);
  readonly authService = inject(AuthService);

  readonly userId = signal<number | null>(null);
  readonly activeTab = signal<'followers' | 'following'>('followers');
  readonly followers = signal<FollowUserSummary[]>([]);
  readonly following = signal<FollowUserSummary[]>([]);

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('userId'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Profil introuvable');
      this.loading.set(false);
      return;
    }

    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'following') {
      this.activeTab.set('following');
    }

    this.userId.set(id);
    this.loadFollowLists(id);
  }

  private async loadFollowLists(userId: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [followersResponse, followingResponse] = await Promise.all([
        firstValueFrom(this.followService.followersList(userId)),
        firstValueFrom(this.followService.followingList(userId)),
      ]);

      this.followers.set(followersResponse?.users || []);
      this.following.set(followingResponse?.users || []);
    } catch (err) {
      console.error('Failed to load follow lists', err);
      this.error.set('Impossible de charger les followers/following.');
    } finally {
      this.loading.set(false);
    }
  }

  openTab(tab: 'followers' | 'following'): void {
    this.activeTab.set(tab);
  }

  visibleUsers(): FollowUserSummary[] {
    return this.activeTab() === 'followers' ? this.followers() : this.following();
  }

  displayName(user: FollowUserSummary): string {
    return user.username || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
  }

  userInitial(user: FollowUserSummary): string {
    const name = this.displayName(user).trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  goToUserProfile(userId?: number): void {
    if (!userId) {
      return;
    }
    this.router.navigate(['/communaute/user', userId]);
  }

  backToProfile(): void {
    const targetUserId = this.userId();
    if (!targetUserId) {
      this.router.navigate(['/communaute']);
      return;
    }
    this.router.navigate(['/communaute/user', targetUserId]);
  }
}
