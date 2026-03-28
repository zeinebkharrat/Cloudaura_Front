import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import { LikeService, LikesByPostResponse } from './like.service';
import { PostMediaService } from './post-media.service';
import { PostService } from './post.service';
import { AuthService } from '../auth.service';
import { OwnershipUtil } from './ownership.util';

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
  public readonly authService = inject(AuthService);
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

  // Create post form
  readonly newPostContent = signal<string>('');
  readonly newPostLocation = signal<string>('');
  readonly newPostVisibility = signal<string>('public');
  readonly isPosting = signal<boolean>(false);
  readonly showCreatePostForm = signal<boolean>(false);
  readonly newPostMediaFiles = signal<File[]>([]);
  readonly newPostMediaPreviews = signal<{ file: File; url: string; type: string }[]>([]);

  // Edit post form
  readonly editingPostId = signal<number | null>(null);
  readonly editPostContent = signal<string>('');
  readonly editPostLocation = signal<string>('');
  readonly editPostVisibility = signal<string>('public');
  readonly isSavingEdit = signal<boolean>(false);

  // Like toggle
  readonly togglingLikePostId = signal<number | null>(null);

  // Comments drafts
  readonly postCommentDrafts = signal<Record<number, string>>({});
  readonly replyDrafts = signal<Record<number, string>>({});
  readonly activeReplyCommentId = signal<number | null>(null);

  // Media uploads
  readonly uploadingPostId = signal<number | null>(null);

  // UI State Modals & Toggles
  readonly activeLikersPostId = signal<number | null>(null);
  readonly activeCommentsPostId = signal<number | null>(null);
  readonly expandedCommentsPostIds = signal<Set<number>>(new Set());

  constructor() {
    // No more manual userId selection - use JWT authentication
  }

  ngOnInit(): void {
    this.loadFeed();
  }

  private loadFeed(): void {
    this.loadError.set(null);
    this.feedLoaded.set(false);

    const safePosts$ = this.postService.getAllPosts().pipe(
      catchError((err) => {
        console.error('Failed to load posts:', err);
        this.loadError.set('Failed to load posts');
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
        console.error('Error loading feed:', err);
        this.loadError.set('Error loading feed');
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
        } as LikesByPostResponse))
      )
    );

    forkJoin(likeObservables).subscribe({
      next: (responses: LikesByPostResponse[]) => {
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

  // Post creation
  toggleCreatePostForm(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }
    this.showCreatePostForm.set(!this.showCreatePostForm());
  }

  async createPost(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }

    const content = this.newPostContent().trim();
    if (!content) {
      return;
    }

    this.isPosting.set(true);

    try {
      const newPost: Omit<Post, 'postId' | 'author' | 'createdAt' | 'updatedAt'> = {
        content,
        location: this.newPostLocation() || null,
        visibility: this.newPostVisibility() || 'public',
        likesCount: 0,
        commentsCount: 0,
      };

      const createdPost = await firstValueFrom(this.postService.addPost(newPost));
      
      // Upload media files if any
      const mediaFiles = this.newPostMediaFiles();
      if (createdPost?.postId && mediaFiles.length > 0) {
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
          try {
            await firstValueFrom(
              this.postMediaService.uploadMedia(file, createdPost.postId, mediaType as MediaType, i)
            );
          } catch (mediaErr) {
            console.error('Error uploading media file:', mediaErr);
          }
        }
      }
      
      // Reset form
      this.newPostContent.set('');
      this.newPostLocation.set('');
      this.newPostVisibility.set('public');
      this.clearNewPostMedia();
      this.showCreatePostForm.set(false);
      
      // Reload feed to show new post
      this.loadFeed();
    } catch (error) {
      console.error('Error creating post:', error);
      this.loadError.set('Failed to create post');
    } finally {
      this.isPosting.set(false);
    }
  }

  // Media selection for new post
  onNewPostMediaSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const currentFiles = [...this.newPostMediaFiles()];
    const currentPreviews = [...this.newPostMediaPreviews()];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      currentFiles.push(file);
      currentPreviews.push({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
      });
    }

    this.newPostMediaFiles.set(currentFiles);
    this.newPostMediaPreviews.set(currentPreviews);
    input.value = ''; // reset so same file can be re-selected
  }

  removeNewPostMedia(index: number): void {
    const files = [...this.newPostMediaFiles()];
    const previews = [...this.newPostMediaPreviews()];
    URL.revokeObjectURL(previews[index].url);
    files.splice(index, 1);
    previews.splice(index, 1);
    this.newPostMediaFiles.set(files);
    this.newPostMediaPreviews.set(previews);
  }

  private clearNewPostMedia(): void {
    const previews = this.newPostMediaPreviews();
    previews.forEach(p => URL.revokeObjectURL(p.url));
    this.newPostMediaFiles.set([]);
    this.newPostMediaPreviews.set([]);
  }

  // Like functionality
  async toggleLike(postId: number): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/signin']);
      return;
    }

    this.togglingLikePostId.set(postId);

    try {
      const response = await firstValueFrom(this.likeService.toggleLike(postId));
      
      // Update like status locally without reloading
      const currentStatuses = this.likeStatuses();
      currentStatuses.set(postId, response.liked);
      this.likeStatuses.set(new Map(currentStatuses));

      const updatedPosts = this.posts().map((post) =>
        post.postId === postId ? { ...post, likesCount: response.count } : post
      );
      this.posts.set(updatedPosts);
      
      // Reload like nicknames for this post
      this.loadLikeStatusesAndNicknames();
      
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      this.togglingLikePostId.set(null);
    }
  }

  // Navigation
  goToMyPosts(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/signin']);
      return;
    }
    this.router.navigate(['/communaute/my-posts']);
  }

  // Ownership helpers
  canEditPost(post: Post): boolean {
    return OwnershipUtil.canEditPost(post, this.authService);
  }

  canDeletePost(post: Post): boolean {
    return OwnershipUtil.canDeletePost(post, this.authService);
  }

  canEditComment(comment: Comment): boolean {
    return OwnershipUtil.canEditComment(comment, this.authService);
  }

  canDeleteComment(comment: Comment): boolean {
    return OwnershipUtil.canDeleteComment(comment, this.authService);
  }

  canInteract(): boolean {
    return OwnershipUtil.canInteract(this.authService);
  }

  // Get like nicknames for display
  getLikeNicknames(postId: number): string[] {
    return this.likeUserNicknames().get(postId) || [];
  }

  // Format like display text
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

  // Comment functionality
  setCommentDraft(postId: number, content: string): void {
    const drafts = this.postCommentDrafts();
    drafts[postId] = content;
    this.postCommentDrafts.set({ ...drafts });
  }

  getCommentDraft(postId: number): string {
    return this.postCommentDrafts()[postId] || '';
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

    // Check if user is post owner
    const post = this.posts().find(p => p.postId === postId);
    if (!post || !OwnershipUtil.canEditPost(post, this.authService)) {
      alert('Only the post owner can upload media');
      return;
    }

    this.uploadingPostId.set(postId);

    try {
      const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      await firstValueFrom(
        this.postMediaService.uploadMedia(file, postId, mediaType as MediaType)
      );
      
      // Reload feed to show new media
      this.loadFeed();
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Failed to upload media');
    } finally {
      this.uploadingPostId.set(null);
    }
  }

  // Delete post
  async deletePost(postId: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      await firstValueFrom(this.postService.deletePost(postId));
      this.loadFeed();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  }

  // Delete comment
  async deleteComment(commentId: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await firstValueFrom(this.commentService.deleteComment(commentId));
      this.loadFeed();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  }

  // Edit post functionality
  startEditPost(post: Post): void {
    if (!post.postId) {
      return;
    }

    this.editingPostId.set(post.postId);
    this.editPostContent.set(post.content ?? '');
    this.editPostLocation.set(post.location ?? '');
    this.editPostVisibility.set(post.visibility ?? 'public');
  }

  cancelEditPost(): void {
    this.editingPostId.set(null);
    this.editPostContent.set('');
    this.editPostLocation.set('');
    this.editPostVisibility.set('public');
    this.isSavingEdit.set(false);
  }

  isEditingPost(postId: number): boolean {
    return this.editingPostId() === postId;
  }

  async saveEditedPost(post: Post): Promise<void> {
    const postId = post.postId;
    if (!postId) {
      return;
    }

    const content = this.editPostContent().trim();
    if (!content || this.isSavingEdit()) {
      return;
    }

    this.isSavingEdit.set(true);

    try {
      await firstValueFrom(
        this.postService.updatePost(postId, {
          content,
          location: this.editPostLocation().trim() || null,
          visibility: this.editPostVisibility() || 'public',
          likesCount: post.likesCount ?? 0,
          commentsCount: post.commentsCount ?? 0,
        })
      );

      this.cancelEditPost();
      this.loadFeed();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post');
      this.isSavingEdit.set(false);
    }
  }

  // Reply functionality
  openReply(commentId: number): void {
    this.activeReplyCommentId.set(commentId);
  }

  closeReply(): void {
    this.activeReplyCommentId.set(null);
  }

  // Modals & Section Toggles
  toggleLikersModal(postId: number | null): void {
    this.activeLikersPostId.set(postId);
  }

  toggleComments(postId: number): void {
    const expanded = new Set(this.expandedCommentsPostIds());
    if (expanded.has(postId)) {
      expanded.delete(postId);
    } else {
      expanded.add(postId);
    }
    this.expandedCommentsPostIds.set(expanded);
  }

  isCommentsExpanded(postId: number): boolean {
    return this.expandedCommentsPostIds().has(postId);
  }

  // Comments modal
  openCommentsModal(postId: number): void {
    this.activeCommentsPostId.set(postId);
  }

  closeCommentsModal(): void {
    this.activeCommentsPostId.set(null);
  }

  getFirstComment(postId: number): CommentWithChildren | null {
    const tree = this.commentTreeForPost(postId);
    return tree.length > 0 ? tree[0] : null;
  }

  // TrackBy functions for performance
  trackByComment(index: number, comment: Comment): number {
    return comment.commentId || index;
  }

  trackByPost(index: number, post: Post): number {
    return post.postId || index;
  }

  trackByMedia(index: number, media: PostMedia): number {
    return media.mediaId || index;
  }

  trackByNickname(index: number, nickname: string): string {
    return nickname;
  }

  // Legacy methods for HTML template compatibility
  currentUserId(): number {
    return this.authService.currentUser()?.id || 0;
  }

  setUserId(value: string): void {
    // This method is deprecated - userId is now handled by JWT authentication
    console.warn('setUserId is deprecated - using JWT authentication');
  }

  trackByPostMedia(index: number, media: PostMedia): number {
    return media.mediaId || index;
  }

  onAddMediaFiles(postId: number, event: Event): void {
    this.uploadMedia(event, postId);
  }

  getPostDraft(postId: number): string {
    return this.getCommentDraft(postId);
  }

  setPostDraft(postId: number, value: string): void {
    this.setCommentDraft(postId, value);
  }

  getReplyDraft(commentId: number): string {
    return this.replyDrafts()[commentId] || '';
  }

  setReplyDraft(commentId: number, value: string): void {
    const drafts = this.replyDrafts();
    drafts[commentId] = value;
    this.replyDrafts.set({ ...drafts });
  }

  // Add comment with optional parent for replies
  async addComment(postId: number, parentCommentId?: number): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/signin']);
      return;
    }

    const isReply = parentCommentId != null;
    const draft = isReply
      ? this.getReplyDraft(parentCommentId)
      : this.getCommentDraft(postId);
    const content = draft.trim();
    if (!content) return;

    try {
      const newComment: Omit<Comment, 'commentId' | 'author' | 'createdAt' | 'updatedAt'> = {
        post: { postId },
        content,
        parent: isReply ? { commentId: parentCommentId } : null,
      };

      await firstValueFrom(this.commentService.addComment(newComment));
      
      // Clear draft and reload feed
      if (isReply) {
        this.setReplyDraft(parentCommentId, '');
        this.activeReplyCommentId.set(null);
      } else {
        this.setCommentDraft(postId, '');
      }
      this.loadFeed();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  // Helper methods used in HTML template
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
    const post = this.posts().find((p) => p.postId === postId);
    if (typeof post?.likesCount === 'number') {
      return post.likesCount;
    }
    return this.likes().filter((l) => l.post?.postId === postId).length;
  }

  getCommentCount(postId: number): number {
    const post = this.posts().find((p) => p.postId === postId);
    if (typeof post?.commentsCount === 'number') {
      return post.commentsCount;
    }
    return this.comments().filter((c) => c.post?.postId === postId).length;
  }

  isPostLiked(postId: number): boolean {
    return this.likeStatuses().get(postId) || false;
  }

  getMediaForPost(postId: number): PostMedia[] {
    return this.medias()
      .filter((m) => m.post?.postId === postId)
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
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

  private sortComments(a: Comment, b: Comment): number {
    const da = this.parseDate(a.createdAt ?? null);
    const db = this.parseDate(b.createdAt ?? null);
    if (da !== db) return db - da; // newest first
    return (b.commentId ?? 0) - (a.commentId ?? 0);
  }
}
