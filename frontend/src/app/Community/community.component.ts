import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Comment,
  CommentWithChildren,
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

const USER_ID_STORAGE_KEY = 'currentUserId';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css',
})
export class CommunityComponent {
  private readonly postService = inject(PostService);
  private readonly commentService = inject(CommentService);
  private readonly likeService = inject(LikeService);
  private readonly postMediaService = inject(PostMediaService);

  // Feed state
  readonly posts = signal<Post[]>([]);
  readonly likes = signal<LikeEntity[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly medias = signal<PostMedia[]>([]);

  readonly loadError = signal<string | null>(null);
  readonly feedLoaded = signal(false);

  // Demo "current user" (for like/unlike + author fields)
  readonly currentUserId = signal<number>(this.readCurrentUserId());

  // Create post form
  readonly newPostContent = signal<string>('');
  readonly newPostLocation = signal<string>('');
  readonly newPostVisibility = signal<string>('public');
  readonly isPosting = signal<boolean>(false);
  readonly showCreatePostForm = signal<boolean>(false);

  // Like toggle
  readonly togglingLikePostId = signal<number | null>(null);

  // Comments drafts
  readonly postCommentDrafts = signal<Record<number, string>>({});
  readonly replyDrafts = signal<Record<number, string>>({});
  readonly activeReplyCommentId = signal<number | null>(null);

  // Media uploads
  readonly uploadingPostId = signal<number | null>(null);

  constructor() {
    // Ensure we have a stable default user id for like/unlike
    if (this.readCurrentUserId() === 0) {
      this.persistUserId(1);
      this.currentUserId.set(1);
    }
  }

  ngOnInit(): void {
    this.loadFeed();
  }

  private readCurrentUserId(): number {
    try {
      const raw = localStorage.getItem(USER_ID_STORAGE_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  private persistUserId(id: number): void {
    try {
      localStorage.setItem(USER_ID_STORAGE_KEY, String(id));
    } catch {
      // ignore
    }
  }

  private loadFeed(): void {
    this.loadError.set(null);
    this.feedLoaded.set(false);

    const safePosts$ = this.postService.getAllPosts().pipe(
      catchError((err) => {
        this.loadError.set(
          err?.message ??
            'Impossible de charger les posts (API indisponible).'
        );
        return of([] as Post[]);
      })
    );

    const safeLikes$ = this.likeService.getAllLikes().pipe(
      catchError(() => of([] as LikeEntity[]))
    );

    const safeComments$ = this.commentService.getAllComments().pipe(
      catchError(() => of([] as Comment[]))
    );

    const safeMedias$ = this.postMediaService.getAllMedias().pipe(
      catchError(() => of([] as PostMedia[]))
    );

    forkJoin({
      posts: safePosts$,
      likes: safeLikes$,
      comments: safeComments$,
      medias: safeMedias$,
    }).subscribe({
      next: ({ posts, likes, comments, medias }) => {
        this.posts.set(posts ?? []);
        this.likes.set(likes ?? []);
        this.comments.set(comments ?? []);
        this.medias.set(medias ?? []);
        this.feedLoaded.set(true);
      },
    });
  }

  setUserId(value: string): void {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    this.persistUserId(n);
    this.currentUserId.set(n);
    // Like buttons depend on current user, so recomputation is immediate via template calls.
  }

  // ---------- Display helpers ----------
  displayName(user?: UserRef): string {
    return (
      user?.username ??
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ??
      'Utilisateur'
    );
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
    const uid = this.currentUserId();
    return this.likes().some(
      (l) => l.post?.postId === postId && l.user?.userId === uid
    );
  }

  private getLikeForCurrentUser(postId: number): LikeEntity | undefined {
    const uid = this.currentUserId();
    return this.likes().find(
      (l) => l.post?.postId === postId && l.user?.userId === uid
    );
  }

  getMediaForPost(postId: number): PostMedia[] {
    return this.medias()
      .filter((m) => m.post?.postId === postId)
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }

  private sortComments(a: Comment, b: Comment): number {
    const da = this.parseDate(a.createdAt ?? null);
    const db = this.parseDate(b.createdAt ?? null);
    if (da !== db) return db - da; // newest first
    return (b.commentId ?? 0) - (a.commentId ?? 0);
  }

  commentTreeForPost(postId: number): CommentWithChildren[] {
    const postComments = this.comments().filter(
      (c) => c.post?.postId === postId && c.commentId != null
    );

    // Clone into nodes so we can add `children` without mutating backend response objects.
    const nodes = new Map<number, CommentWithChildren>();
    for (const c of postComments) {
      const id = c.commentId!;
      const node: CommentWithChildren = {
        ...c,
        commentId: id,
        children: [],
      };
      nodes.set(id, node);
    }

    const roots: CommentWithChildren[] = [];
    for (const node of nodes.values()) {
      const parentId = node.parent?.commentId ?? null;
      const parent = parentId != null ? nodes.get(parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortNodeRecursively = (n: CommentWithChildren): void => {
      n.children.sort((x, y) => this.sortComments(x, y));
      for (const child of n.children) sortNodeRecursively(child);
    };

    roots.sort((x, y) => this.sortComments(x, y));
    for (const root of roots) sortNodeRecursively(root);
    return roots;
  }

  getPostDraft(postId: number): string {
    return this.postCommentDrafts()[postId] ?? '';
  }

  setPostDraft(postId: number, value: string): void {
    this.postCommentDrafts.update((d) => ({ ...d, [postId]: value }));
  }

  getReplyDraft(commentId: number): string {
    return this.replyDrafts()[commentId] ?? '';
  }

  setReplyDraft(commentId: number, value: string): void {
    this.replyDrafts.update((d) => ({ ...d, [commentId]: value }));
  }

  // ---------- Actions ----------
  async createPost(): Promise<void> {
    const content = this.newPostContent().trim();
    if (!content) return;

    this.isPosting.set(true);
    try {
      const payload = {
        author: { userId: this.currentUserId() },
        content,
        location: this.newPostLocation().trim() || null,
        visibility: this.newPostVisibility() || null,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies Partial<Post>;

      const created = await firstValueFrom(
        this.postService.addPost(payload as Post)
      );

      this.posts.update((arr) => [created, ...arr]);
      this.newPostContent.set('');
      this.newPostLocation.set('');
      this.newPostVisibility.set('public');
      this.showCreatePostForm.set(false);
    } finally {
      this.isPosting.set(false);
    }
  }

  async toggleLike(postId: number): Promise<void> {
    if (this.togglingLikePostId() != null) return;
    this.togglingLikePostId.set(postId);

    const liked = this.getLikeForCurrentUser(postId);
    try {
      if (liked?.likeId != null) {
        await firstValueFrom(this.likeService.deleteLike(liked.likeId));
        this.likes.update((arr) =>
          arr.filter((l) => l.likeId !== liked.likeId)
        );
      } else {
        const payload = {
          user: { userId: this.currentUserId() },
          post: { postId },
          createdAt: new Date().toISOString(),
        } satisfies Partial<LikeEntity>;

        const created = await firstValueFrom(
          this.likeService.addLike(payload as LikeEntity)
        );
        this.likes.update((arr) => [created, ...arr]);
      }
    } finally {
      this.togglingLikePostId.set(null);
    }
  }

  async addComment(postId: number, parentCommentId?: number | null): Promise<void> {
    const isReply = parentCommentId != null;
    const draft = isReply
      ? this.getReplyDraft(parentCommentId!)
      : this.getPostDraft(postId);
    const content = draft.trim();
    if (!content) return;

    try {
      const payload = {
        post: { postId },
        author: { userId: this.currentUserId() },
        parent: isReply ? { commentId: parentCommentId } : null,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies Partial<Comment>;

      const created = await firstValueFrom(
        this.commentService.addComment(payload as Comment)
      );

      this.comments.update((arr) => [created, ...arr]);
      if (isReply) {
        this.setReplyDraft(parentCommentId!, '');
        this.activeReplyCommentId.set(null);
      } else {
        this.setPostDraft(postId, '');
      }
    } catch {
      // ignore errors for now
    }
  }

  openReply(commentId: number): void {
    this.activeReplyCommentId.set(commentId);
  }

  closeReply(): void {
    this.activeReplyCommentId.set(null);
  }

  private getMaxMediaOrderIndex(postId: number): number {
    const list = this.getMediaForPost(postId);
    if (list.length === 0) return 0;
    return Math.max(...list.map((m) => m.orderIndex ?? 0));
  }

  async onAddMediaFiles(postId: number, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    this.uploadingPostId.set(postId);

    try {
      let orderIndex = this.getMaxMediaOrderIndex(postId) + 1;
      for (const file of fileArray) {
        const mediaType: MediaType = file.type.startsWith('video/')
          ? 'VIDEO'
          : file.type.startsWith('image/')
            ? 'IMAGE'
            : 'IMAGE';

        const created = await firstValueFrom(
          this.postMediaService.uploadMedia(
            file,
            postId,
            mediaType,
            orderIndex
          )
        );
        this.medias.update((arr) => [...arr, created]);
        orderIndex++;
      }
    } finally {
      this.uploadingPostId.set(null);
      // allow selecting the same file again
      input.value = '';
    }
  }
}

