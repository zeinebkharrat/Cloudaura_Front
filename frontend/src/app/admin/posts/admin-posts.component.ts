import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AdminPost } from '../admin-api.models';
import { PostAdminService } from '../services/post-admin.service';
import { PostMediaService } from '../../Community/post-media.service';
import { PostMedia } from '../../Community/community.types';

@Component({
  selector: 'app-admin-posts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-posts.component.html',
  styleUrl: './admin-posts.component.css',
})
export class AdminPostsComponent implements OnInit, OnDestroy {
  posts: AdminPost[] = [];
  q = '';
  tag = '';
  sort = 'createdAt,desc';
  page = 0;
  size = 10;
  totalPages = 0;
  totalElements = 0;
  error = '';
  detailsPost: AdminPost | null = null;
  detailsMedia: PostMedia[] = [];
  detailsMediaLoading = false;
  detailsMediaError = '';
  showDetailsModal = false;

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly postService: PostAdminService,
    private readonly postMediaService: PostMediaService
  ) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  loadPosts(): void {
    this.postService.list(this.q, null, this.tag, this.page, this.size, this.sort).subscribe({
      next: (res) => {
        this.posts = res.content;
        this.totalPages = res.totalPages;
        this.totalElements = res.totalElements;
        this.error = '';
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Error loading posts';
      },
    });
  }

  onSearchInputChange(): void {
    this.page = 0;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => this.loadPosts(), 300);
  }

  changePage(next: boolean): void {
    if (next && this.page + 1 < this.totalPages) {
      this.page++;
      this.loadPosts();
    } else if (!next && this.page > 0) {
      this.page--;
      this.loadPosts();
    }
  }

  openDetails(post: AdminPost): void {
    this.detailsPost = post;
    this.showDetailsModal = true;
    this.loadDetailsMedia(post.postId);
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsPost = null;
    this.detailsMedia = [];
    this.detailsMediaError = '';
    this.detailsMediaLoading = false;
  }

  async deletePost(post: AdminPost): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this post?',
      text: 'This will also delete all reposts of this post.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
    });

    if (!confirmation.isConfirmed || post.postId == null) {
      return;
    }

    this.postService.delete(post.postId).subscribe({
      next: async () => {
        await Swal.fire({
          icon: 'success',
          title: 'Post deleted',
          timer: 1200,
          showConfirmButton: false,
        });

        if (this.posts.length === 1 && this.page > 0) {
          this.page--;
        }
        this.loadPosts();
      },
      error: async (err) => {
        await Swal.fire({
          icon: 'error',
          title: 'Could not delete',
          text: err?.error?.message ?? 'Please try again.',
        });
      },
    });
  }

  formatDate(date?: string | null): string {
    if (!date) {
      return '—';
    }
    const n = Date.parse(date);
    if (!Number.isFinite(n)) {
      return '—';
    }
    return new Date(n).toLocaleString();
  }

  getTagList(value?: string | null): string[] {
    if (!value) {
      return [];
    }
    const matched = value.match(/#[A-Za-z0-9_-]+/g) ?? [];
    if (matched.length > 0) {
      return Array.from(new Set(matched.map((item) => item.trim()).filter(Boolean)));
    }

    return value
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (item.startsWith('#') ? item : `#${item}`));
  }

  isVideo(media: PostMedia): boolean {
    return String(media.mediaType ?? '').toUpperCase() === 'VIDEO';
  }

  trackByMedia(index: number, media: PostMedia): number | string {
    return media.mediaId ?? `${media.fileUrl ?? 'media'}-${index}`;
  }

  private loadDetailsMedia(postId?: number): void {
    if (postId == null) {
      this.detailsMedia = [];
      return;
    }

    this.detailsMediaLoading = true;
    this.detailsMediaError = '';
    this.detailsMedia = [];

    this.postMediaService.getAllMedias().subscribe({
      next: (items) => {
        this.detailsMedia = items
          .filter((media) => media.post?.postId === postId && !!media.fileUrl)
          .sort((a, b) => {
            const orderA = a.orderIndex ?? 0;
            const orderB = b.orderIndex ?? 0;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return (a.mediaId ?? 0) - (b.mediaId ?? 0);
          });
        this.detailsMediaLoading = false;
      },
      error: () => {
        this.detailsMediaError = 'Could not load post media.';
        this.detailsMediaLoading = false;
      },
    });
  }
}
