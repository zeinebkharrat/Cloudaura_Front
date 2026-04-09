import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Comment,
  LikeEntity,
  MediaType,
  Post,
  PostMedia,
  UserRef,
} from './community.types';
import { CommentService } from './comment.service';
import { LikeService } from './like.service';
import { PostMediaService } from './post-media.service';
import { PostService } from './post.service';
import { AuthService } from '../core/auth.service';
import { OwnershipUtil } from './ownership.util';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-my-posts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-posts.component.html',
  styleUrl: './my-posts.component.css',
})
export class MyPostsComponent {
  private readonly postService = inject(PostService);
  private readonly commentService = inject(CommentService);
  private readonly likeService = inject(LikeService);
  private readonly postMediaService = inject(PostMediaService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Feed state
  readonly posts = signal<Post[]>([]);
  readonly likes = signal<LikeEntity[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly medias = signal<PostMedia[]>([]);
  readonly likeStatuses = signal<Map<number, boolean>>(new Map());
  readonly likeUserNicknames = signal<Map<number, string[]>>(new Map());

  readonly loadError = signal<string | null>(null);
  readonly feedLoaded = signal(false);

  // Edit post form
  readonly editingPostId = signal<number | null>(null);
  readonly editPostContent = signal<string>('');
  readonly editPostLocation = signal<string>('');
  readonly editPostVisibility = signal<string>('public');
  readonly isEditing = signal<boolean>(false);
  readonly mediaBusyPostId = signal<number | null>(null);
  readonly deletingMediaId = signal<number | null>(null);

  // Delete confirmation
  readonly deletingPostId = signal<number | null>(null);

  constructor() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/signin']);
      return;
    }
  }

  ngOnInit(): void {
    this.loadMyPosts();
  }

  private loadMyPosts(): void {
    this.loadError.set(null);
    this.feedLoaded.set(false);

    const safePosts$ = this.postService.getMyPosts().pipe(
      catchError((err) => {
        console.error('Failed to load my posts:', err);
        this.loadError.set('Failed to load your posts');
        return of([]);
      })
    );

    const safeLikes$ = this.likeService.getAllLikes().pipe(
      catchError((err) => {
        console.error('Failed to load likes:', err);
        return of([]);
      })
    );

    const safeComments$ = this.commentService.getAllComments().pipe(
      catchError((err) => {
        console.error('Failed to load comments:', err);
        return of([]);
      })
    );

    const safeMedias$ = this.postMediaService.getAllMedias().pipe(
      catchError((err) => {
        console.error('Failed to load media:', err);
        return of([]);
      })
    );

    forkJoin([safePosts$, safeLikes$, safeComments$, safeMedias$]).subscribe({
      next: ([posts, likes, comments, medias]) => {
        this.posts.set(posts || []);
        this.likes.set(likes || []);
        this.comments.set(comments || []);
        this.medias.set(medias || []);
        this.feedLoaded.set(true);
        
        // Load like statuses and nicknames for each post
        this.loadLikeStatusesAndNicknames();
      },
      error: (err) => {
        console.error('Error loading my posts:', err);
        this.loadError.set('Error loading your posts');
        this.feedLoaded.set(true);
      },
    });
  }

  private loadLikeStatusesAndNicknames(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const posts = this.posts();
    const likeStatusMap = new Map<number, boolean>();
    const nicknameMap = new Map<number, string[]>();

    const likeObservables = posts.map(post => 
      this.likeService.getLikesByPost(post.postId!).pipe(
        catchError(() => of({
          likes: [],
          count: 0,
          isLikedByCurrentUser: false,
          userNicknames: []
        }))
      )
    );

    forkJoin(likeObservables).subscribe({
      next: (responses) => {
        posts.forEach((post, index) => {
          const response = responses[index];
          likeStatusMap.set(post.postId!, response.isLikedByCurrentUser);
          nicknameMap.set(post.postId!, response.userNicknames);
        });
        this.likeStatuses.set(likeStatusMap);
        this.likeUserNicknames.set(nicknameMap);
      },
      error: (err) => {
        console.error('Error loading like statuses:', err);
      }
    });
  }

  // Edit functionality
  startEditPost(post: Post): void {
    this.editingPostId.set(post.postId!);
    this.editPostContent.set(post.content || '');
    this.editPostLocation.set(post.location || '');
    this.editPostVisibility.set(post.visibility || 'public');
  }

  cancelEdit(): void {
    this.editingPostId.set(null);
    this.editPostContent.set('');
    this.editPostLocation.set('');
    this.editPostVisibility.set('public');
    this.isEditing.set(false);
  }

  async saveEdit(): Promise<void> {
    const postId = this.editingPostId();
    if (!postId) return;

    this.isEditing.set(true);

    try {
      const updatedPost = {
        content: this.editPostContent().trim(),
        location: this.editPostLocation().trim() || null,
        visibility: this.editPostVisibility() || 'public',
      };

      await firstValueFrom(this.postService.updatePost(postId, updatedPost));
      
      this.cancelEdit();
      this.loadMyPosts();
      await Swal.fire({
        icon: 'success',
        title: 'Post updated',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });
    } catch (error) {
      console.error('Error updating post:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Could not update',
        text: 'The post could not be updated.',
        ...this.swalTheme(),
      });
    } finally {
      this.isEditing.set(false);
    }
  }

  // Delete functionality
  async startDeletePost(postId: number): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this post?',
      text: 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
      ...this.swalTheme(),
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.deletingPostId.set(postId);
    await this.confirmDelete();
  }

  cancelDelete(): void {
    this.deletingPostId.set(null);
  }

  async confirmDelete(): Promise<void> {
    const postId = this.deletingPostId();
    if (!postId) return;

    try {
      await firstValueFrom(this.postService.deletePost(postId));
      this.cancelDelete();
      this.loadMyPosts();
      await Swal.fire({
        icon: 'success',
        title: 'Post deleted',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Could not delete',
        text: 'The post could not be deleted.',
        ...this.swalTheme(),
      });
    }
  }

  // Like functionality
  async toggleLike(postId: number): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/signin']);
      return;
    }

    try {
      await firstValueFrom(this.likeService.toggleLike(postId));
      
      // Reload like statuses and nicknames
      this.loadLikeStatusesAndNicknames();
      
      // Reload feed to update like counts
      this.loadMyPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  // Navigation
  goToCommunity(): void {
    this.router.navigate(['/communaute']);
  }

  // TrackBy
  trackByPost(index: number, post: Post): number {
    return post.postId || index;
  }

  // Helper methods
  displayName(user?: UserRef): string {
    return (
      user?.username ??
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ??
      'Utilisateur'
    );
  }

  userAvatarUrl(user?: UserRef): string | null {
    const raw = (user?.profileImageUrl ?? '').trim();
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

  private parseDate(date?: string | null): number {
    if (!date) return 0;
    const n = Date.parse(date);
    return Number.isFinite(n) ? n : 0;
  }

  formatDate(date?: string | null): string {
    const n = this.parseDate(date);
    if (!n) return '';
    return new Date(n).toLocaleString();
  }

  getLikeCount(postId: number): number {
    return this.likes().filter((l) => l.post?.postId === postId).length;
  }

  getCommentCount(postId: number): number {
    return this.comments().filter((c) => c.post?.postId === postId).length;
  }

  isPostLiked(postId: number): boolean {
    return this.likeStatuses().get(postId) || false;
  }

  getLikeNicknames(postId: number): string[] {
    return this.likeUserNicknames().get(postId) || [];
  }

  formatLikeText(postId: number): string {
    const nicknames = this.getLikeNicknames(postId);
    const count = nicknames.length;
    
    if (count === 0) {
      return 'No likes yet';
    } else if (count === 1) {
      return `${nicknames[0]} likes this`;
    } else if (count <= 3) {
      return nicknames.join(', ') + ' like this';
    } else {
      return `${nicknames.slice(0, 2).join(', ')} and ${count - 2} others like this`;
    }
  }

  getMediaForPost(postId: number): PostMedia[] {
    return this.medias()
      .filter((m) => m.post?.postId === postId)
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }

  // Ownership helpers
  canEditPost(post: Post): boolean {
    return OwnershipUtil.canEditPost(post, this.authService);
  }

  canDeletePost(post: Post): boolean {
    return OwnershipUtil.canDeletePost(post, this.authService);
  }

  // Media upload
  async uploadMedia(event: Event, postId: number): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/signin']);
      return;
    }

    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    try {
      const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      await firstValueFrom(
        this.postMediaService.uploadMedia(file, postId, mediaType as MediaType)
      );
      
      // Reload feed to show new media
      this.loadMyPosts();
    } catch (error) {
      console.error('Error uploading media:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Upload failed',
        text: 'The media could not be added.',
        ...this.swalTheme(),
      });
    }
  }

  async uploadMediaFromEdit(event: Event, postId: number): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/signin']);
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.mediaBusyPostId.set(postId);

    try {
      const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      await firstValueFrom(
        this.postMediaService.uploadMedia(file, postId, mediaType as MediaType)
      );

      await Swal.fire({
        icon: 'success',
        title: 'Media added',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });

      this.loadMyPosts();
    } catch (error) {
      console.error('Error uploading media from edit form:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Upload failed',
        text: 'The media could not be added.',
        ...this.swalTheme(),
      });
    } finally {
      input.value = '';
      this.mediaBusyPostId.set(null);
    }
  }

  async deleteMedia(media: PostMedia, postId: number): Promise<void> {
    if (!media.mediaId) {
      return;
    }

    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete this media?',
      text: 'This file will be removed from your post.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
      ...this.swalTheme(),
    });

    if (!confirm.isConfirmed) {
      return;
    }

    this.mediaBusyPostId.set(postId);
    this.deletingMediaId.set(media.mediaId);

    try {
      await firstValueFrom(this.postMediaService.deleteMedia(media.mediaId));

      await Swal.fire({
        icon: 'success',
        title: 'Media deleted',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });

      this.loadMyPosts();
    } catch (error) {
      console.error('Error deleting media:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text: 'The media could not be deleted.',
        ...this.swalTheme(),
      });
    } finally {
      this.mediaBusyPostId.set(null);
      this.deletingMediaId.set(null);
    }
  }

  isMediaBusy(postId: number): boolean {
    return this.mediaBusyPostId() === postId;
  }

  private swalTheme(): { background: string; color: string } {
    const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      background: darkMode ? '#181d24' : '#ffffff',
      color: darkMode ? '#e2e8f0' : '#1d2433',
    };
  }
}
