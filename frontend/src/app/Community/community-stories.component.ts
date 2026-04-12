import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../core/auth.service';
import { ChatService } from '../chat/chat.service';
import { StoryService } from './story.service';
import { Story, StoryInteractionUser } from './story.types';

interface StorySearchUser {
  userId: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

@Component({
  selector: 'app-community-stories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './community-stories.component.html',
  styleUrl: './community-stories.component.css',
})
export class CommunityStoriesComponent {
  private readonly storyService = inject(StoryService);
  private readonly chatService = inject(ChatService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly stories = signal<Story[]>([]);
  readonly loading = signal<boolean>(false);
  readonly uploading = signal<boolean>(false);
  readonly viewerOpen = signal<boolean>(false);
  readonly viewerIndex = signal<number>(0);
  readonly insightsOpen = signal<boolean>(false);
  readonly insightsLoading = signal<boolean>(false);
  readonly viewers = signal<StoryInteractionUser[]>([]);
  readonly likers = signal<StoryInteractionUser[]>([]);
  readonly storyReplyText = signal<string>('');
  readonly sendingReply = signal<boolean>(false);
  readonly userSearchTerm = signal<string>('');
  readonly userSearchLoading = signal<boolean>(false);
  readonly searchedUsers = signal<StorySearchUser[]>([]);

  private userSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private userSearchRequestSeq = 0;

  ngOnInit(): void {
    this.loadStories();
  }

  ngOnDestroy(): void {
    if (this.userSearchDebounceTimer) {
      clearTimeout(this.userSearchDebounceTimer);
      this.userSearchDebounceTimer = null;
    }
    this.document.body.style.overflow = '';
  }

  onUserSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = (input.value || '').trim();
    this.userSearchTerm.set(input.value || '');

    if (this.userSearchDebounceTimer) {
      clearTimeout(this.userSearchDebounceTimer);
      this.userSearchDebounceTimer = null;
    }

    if (query.length < 2) {
      this.userSearchLoading.set(false);
      this.searchedUsers.set([]);
      return;
    }

    const requestId = ++this.userSearchRequestSeq;
    this.userSearchDebounceTimer = setTimeout(() => {
      this.runUserSearch(query, requestId);
    }, 280);
  }

  openUserProfileFromSearch(userId: number): void {
    if (!Number.isInteger(userId) || userId <= 0) {
      return;
    }

    this.userSearchTerm.set('');
    this.userSearchLoading.set(false);
    this.searchedUsers.set([]);
    this.router.navigate(['/communaute/user', userId]);
  }

  searchUserDisplayName(user: StorySearchUser): string {
    const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return full || user.username || 'User';
  }

  searchUserAvatarUrl(user: StorySearchUser): string | null {
    const raw = (user.profileImageUrl || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    if (raw.startsWith('uploads/')) return `/${raw}`;
    return `/${raw.replace(/^\/+/, '')}`;
  }

  trackBySearchedUser(_: number, user: StorySearchUser): number {
    return user.userId;
  }

  async loadStories(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.storyService.getFeedStories());
      this.stories.set((data || []).filter((s) => !!s.mediaUrl));
    } catch (error) {
      console.error('Failed to load stories:', error);
    } finally {
      this.loading.set(false);
    }
  }

  trayStories(): Story[] {
    const byAuthor = new Map<number, Story>();
    for (const story of this.stories()) {
      if (!byAuthor.has(story.authorId)) {
        byAuthor.set(story.authorId, story);
      }
    }
    return Array.from(byAuthor.values());
  }

  async onStoryFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      await Swal.fire({ icon: 'warning', title: 'Sign in required', text: 'Please sign in to add a story.' });
      input.value = '';
      return;
    }

    this.uploading.set(true);
    try {
      await firstValueFrom(this.storyService.createStory(file));
      await this.loadStories();
      await Swal.fire({ icon: 'success', title: 'Story posted', timer: 1000, showConfirmButton: false });
    } catch (error) {
      console.error('Failed to create story:', error);
      await Swal.fire({ icon: 'error', title: 'Could not post story' });
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async openViewer(storyId: number): Promise<void> {
    const index = this.stories().findIndex((s) => s.storyId === storyId);
    if (index < 0) {
      return;
    }
    this.viewerIndex.set(index);
    this.viewerOpen.set(true);
    this.document.body.style.overflow = 'hidden';
    await this.markViewedCurrent();
  }

  closeViewer(): void {
    this.viewerOpen.set(false);
    this.closeInsights();
    this.storyReplyText.set('');
    this.sendingReply.set(false);
    this.document.body.style.overflow = '';
  }

  activeStory(): Story | null {
    const list = this.stories();
    return list[this.viewerIndex()] ?? null;
  }

  async nextStory(): Promise<void> {
    const list = this.stories();
    if (list.length === 0) return;
    this.viewerIndex.set((this.viewerIndex() + 1) % list.length);
    this.storyReplyText.set('');
    await this.markViewedCurrent();
  }

  async prevStory(): Promise<void> {
    const list = this.stories();
    if (list.length === 0) return;
    this.viewerIndex.set((this.viewerIndex() - 1 + list.length) % list.length);
    this.storyReplyText.set('');
    await this.markViewedCurrent();
  }

  onStoryReplyKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendStoryReply();
    }
  }

  canReplyToActiveStory(): boolean {
    const story = this.activeStory();
    const currentUserId = this.authService.currentUser()?.id;
    return !!story && !!currentUserId && story.authorId !== currentUserId;
  }

  async sendStoryReply(): Promise<void> {
    const story = this.activeStory();
    const senderId = this.authService.currentUser()?.id;
    const reply = this.storyReplyText().trim();

    if (!story || !senderId || !reply || this.sendingReply()) {
      return;
    }

    if (story.authorId === senderId) {
      return;
    }

    this.sendingReply.set(true);
    try {
      const room = await firstValueFrom(this.chatService.getOrCreateChatRoom(story.authorId));
      const payload = this.buildStoryReplyPayload(story, reply);
      await this.chatService.sendMessage(room.chatRoomId, story.authorId, payload);
      this.storyReplyText.set('');
      this.chatService.requestOpenBubbleForUser(story.authorId);
    } catch (error) {
      console.error('Failed to send story reply:', error);
      await Swal.fire({ icon: 'error', title: 'Reply failed', text: 'Could not send your story reply.' });
    } finally {
      this.sendingReply.set(false);
    }
  }

  async toggleLikeActive(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const story = this.activeStory();
    if (!story) {
      return;
    }

    try {
      const updated = story.likedByCurrentUser
        ? await firstValueFrom(this.storyService.unlikeStory(story.storyId))
        : await firstValueFrom(this.storyService.likeStory(story.storyId));
      this.patchStory(updated);
    } catch (error) {
      console.error('Failed to toggle story like:', error);
    }
  }

  async openInsights(): Promise<void> {
    const story = this.activeStory();
    const currentUserId = this.authService.currentUser()?.id;
    if (!story || !currentUserId || story.authorId !== currentUserId) {
      return;
    }

    this.insightsLoading.set(true);
    this.insightsOpen.set(true);
    try {
      const [viewers, likers] = await Promise.all([
        firstValueFrom(this.storyService.getStoryViewers(story.storyId)),
        firstValueFrom(this.storyService.getStoryLikers(story.storyId)),
      ]);
      this.viewers.set(viewers || []);
      this.likers.set(likers || []);
    } catch (error) {
      console.error('Failed to load story insights:', error);
      this.insightsOpen.set(false);
      await Swal.fire({ icon: 'error', title: 'Could not load story insights' });
    } finally {
      this.insightsLoading.set(false);
    }
  }

  closeInsights(): void {
    this.insightsOpen.set(false);
    this.insightsLoading.set(false);
    this.viewers.set([]);
    this.likers.set([]);
  }

  private async markViewedCurrent(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      return;
    }
    const story = this.activeStory();
    if (!story) {
      return;
    }

    try {
      const updated = await firstValueFrom(this.storyService.markViewed(story.storyId));
      this.patchStory(updated);
    } catch (error) {
      console.error('Failed to mark story viewed:', error);
    }
  }

  private patchStory(updated: Story): void {
    this.stories.set(this.stories().map((s) => (s.storyId === updated.storyId ? { ...s, ...updated } : s)));
  }

  displayName(firstName?: string | null, lastName?: string | null, username?: string | null): string {
    const full = `${firstName || ''} ${lastName || ''}`.trim();
    return full || username || 'User';
  }

  interactionAvatarUrl(user: StoryInteractionUser): string | null {
    const raw = (user.profileImageUrl || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    if (raw.startsWith('uploads/')) return `/${raw}`;
    return `/${raw.replace(/^\/+/, '')}`;
  }

  avatarUrl(story: Story): string | null {
    const raw = (story.authorProfileImageUrl || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    if (raw.startsWith('uploads/')) return `/${raw}`;
    return `/${raw.replace(/^\/+/, '')}`;
  }

  storyAgeLabel(story: Story): string {
    return this.relativeTimeLabel(story.createdAt);
  }

  adjacentStory(offset: number): Story | null {
    const list = this.stories();
    if (list.length === 0) {
      return null;
    }
    const current = this.viewerIndex();
    const index = (current + offset + list.length) % list.length;
    return list[index] ?? null;
  }

  previewBackground(story: Story): string {
    const mediaUrl = (story.mediaUrl || '').trim();
    if (!mediaUrl) {
      return 'none';
    }
    return `url("${mediaUrl}")`;
  }

  private buildStoryReplyPayload(story: Story, replyText: string): string {
    const payload = {
      kind: 'story-reply',
      storyId: story.storyId,
      authorId: story.authorId,
      authorUsername: story.authorUsername,
      mediaUrl: (story.mediaUrl || '').trim(),
      mediaType: (story.mediaType || 'IMAGE').toString(),
      caption: (story.caption || '').trim(),
      replyText,
      sentAt: new Date().toISOString(),
    };

    return `YALLA_STORY_REPLY::${JSON.stringify(payload)}`;
  }

  private async runUserSearch(query: string, requestId: number): Promise<void> {
    this.userSearchLoading.set(true);
    try {
      const users = await firstValueFrom(this.chatService.searchUsers(query));
      if (requestId !== this.userSearchRequestSeq) {
        return;
      }

      const currentUserId = this.authService.currentUser()?.id;
      this.searchedUsers.set(
        (users || []).filter((u) => u?.userId && u.userId !== currentUserId)
      );
    } catch (error) {
      if (requestId === this.userSearchRequestSeq) {
        this.searchedUsers.set([]);
      }
      console.error('Failed to search users from stories:', error);
    } finally {
      if (requestId === this.userSearchRequestSeq) {
        this.userSearchLoading.set(false);
      }
    }
  }

  interactionAgeLabel(actedAt?: string | null): string {
    return this.relativeTimeLabel(actedAt);
  }

  trackByInteractionUser(_: number, user: StoryInteractionUser): number {
    return user.userId;
  }

  private relativeTimeLabel(dateValue?: string | null): string {
    if (!dateValue) {
      return 'Now';
    }

    const timestamp = new Date(dateValue).getTime();
    if (Number.isNaN(timestamp)) {
      return 'Now';
    }

    const diffMs = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  trackByStoryId(_: number, story: Story): number {
    return story.storyId;
  }
}
