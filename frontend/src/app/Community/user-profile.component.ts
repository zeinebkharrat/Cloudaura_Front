import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Post, PostMedia } from './community.types';
import { PostService } from './post.service';
import { SavedPostService } from './saved-post.service';
import { FollowService } from './follow.service';
import { PostMediaService } from './post-media.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css',
})
export class UserProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postService = inject(PostService);
  private readonly savedPostService = inject(SavedPostService);
  private readonly followService = inject(FollowService);
  private readonly postMediaService = inject(PostMediaService);
  readonly authService = inject(AuthService);

  readonly userId = signal<number | null>(null);
  readonly profileName = signal<string>('User');
  readonly profileUsername = signal<string>('');
  readonly profileImageUrl = signal<string | null>(null);

  readonly userPosts = signal<Post[]>([]);
  readonly userReposts = signal<Post[]>([]);
  readonly userSavedPosts = signal<Post[]>([]);
  readonly medias = signal<PostMedia[]>([]);

  readonly followersCount = signal<number>(0);
  readonly followingCount = signal<number>(0);
  readonly following = signal<boolean>(false);

  readonly activeTab = signal<'posts' | 'reposts' | 'saved'>('posts');
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('userId'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Profil introuvable');
      this.loading.set(false);
      return;
    }
    this.userId.set(id);
    this.loadProfileData(id);
  }

  private async loadProfileData(targetUserId: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [allPosts, allMedias] = await Promise.all([
        firstValueFrom(this.postService.getAllPosts()),
        firstValueFrom(this.postMediaService.getAllMedias()),
      ]);

      const postsByUser = (allPosts || []).filter((p) => p.author?.userId === targetUserId);
      this.userPosts.set(postsByUser.filter((p) => !p.repostOf));
      this.userReposts.set(postsByUser.filter((p) => !!p.repostOf));
      this.medias.set(allMedias || []);

      const first = postsByUser[0];
      if (first?.author) {
        this.profileName.set(this.displayName(first.author));
        this.profileUsername.set(first.author.username || '');
        this.profileImageUrl.set(this.normalizeProfileImageUrl(first.author.profileImageUrl || null));
      }

      try {
        const followers = await firstValueFrom(this.followService.followersCount(targetUserId));
        this.followersCount.set(followers.count || 0);
      } catch {
        this.followersCount.set(0);
      }

      try {
        const followingCount = await firstValueFrom(this.followService.followingCount(targetUserId));
        this.followingCount.set(followingCount.count || 0);
      } catch {
        this.followingCount.set(0);
      }

      if (this.authService.isAuthenticated()) {
        try {
          const isFollowing = await firstValueFrom(this.followService.isFollowing(targetUserId));
          this.following.set(!!isFollowing.following);
        } catch {
          this.following.set(false);
        }

        const currentId = this.authService.currentUser()?.id;
        if (currentId === targetUserId) {
          try {
            const saved = await firstValueFrom(this.savedPostService.mySavedPosts());
            this.userSavedPosts.set(saved || []);
          } catch {
            this.userSavedPosts.set([]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load user profile', err);
      this.error.set('Impossible de charger ce profil.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFollow(): Promise<void> {
    const targetUserId = this.userId();
    if (!targetUserId) {
      return;
    }
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }
    if (this.authService.currentUser()?.id === targetUserId) {
      return;
    }

    try {
      const response = await firstValueFrom(this.followService.toggleFollow(targetUserId));
      this.following.set(response.following);
      this.followersCount.set(response.followersCount ?? this.followersCount());
      if (this.isOwnProfile()) {
        this.followingCount.set(response.followingCount ?? this.followingCount());
      }
    } catch (err) {
      console.error('Failed to toggle follow', err);
    }
  }

  openTab(tab: 'posts' | 'reposts' | 'saved'): void {
    if (tab === 'saved' && !this.canSeeSaved()) {
      return;
    }
    this.activeTab.set(tab);
  }

  visiblePosts(): Post[] {
    if (this.activeTab() === 'reposts') {
      return this.userReposts();
    }
    if (this.activeTab() === 'saved') {
      return this.userSavedPosts();
    }
    return this.userPosts();
  }

  canSeeSaved(): boolean {
    const target = this.userId();
    const current = this.authService.currentUser()?.id;
    return !!target && !!current && target === current;
  }

  getMediaForPost(postId: number): PostMedia[] {
    return this.medias().filter((m) => m.post?.postId === postId);
  }

  displayName(user?: { username?: string; firstName?: string; lastName?: string }): string {
    return (
      user?.username || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User'
    );
  }

  userAvatarUrl(user?: { profileImageUrl?: string | null }): string | null {
    return this.normalizeProfileImageUrl(user?.profileImageUrl ?? null);
  }

  authorInitial(): string {
    const name = this.profileName().trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  formatDate(date?: string | null): string {
    if (!date) {
      return '';
    }
    const n = Date.parse(date);
    if (!Number.isFinite(n)) {
      return '';
    }
    return new Date(n).toLocaleString();
  }

  isOwnProfile(): boolean {
    return this.authService.currentUser()?.id === this.userId();
  }

  backToCommunity(): void {
    this.router.navigate(['/communaute']);
  }

  openFollowList(tab: 'followers' | 'following'): void {
    const targetUserId = this.userId();
    if (!targetUserId) {
      return;
    }
    this.router.navigate(['/communaute/user', targetUserId, 'follows'], {
      queryParams: { tab },
    });
  }

  goToAuthorProfile(post: Post): void {
    const id = post.author?.userId;
    if (!id) {
      return;
    }
    this.router.navigate(['/communaute/user', id]);
  }

  private normalizeProfileImageUrl(url?: string | null): string | null {
    const raw = (url ?? '').trim();
    if (!raw) {
      return null;
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    if (raw.startsWith('/')) {
      return raw;
    }
    if (raw.startsWith('uploads/')) {
      return `/${raw}`;
    }
    return `/${raw.replace(/^\/+/, '')}`;
  }
}
