import { Component, ElementRef, HostListener, OnDestroy, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as echarts from 'echarts';
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
import { CityOption, CityService } from './city.service';
import { FollowService, HoverUserSummary, LeaderboardUserSummary } from './follow.service';
import { SavedPostService } from './saved-post.service';
import { AuthService } from '../core/auth.service';
import { OwnershipUtil } from './ownership.util';
import { ChatService } from '../chat/chat.service';
import { extractApiErrorMessage } from '../api-error.util';
import Swal from 'sweetalert2';
import { GiphyItem, GiphyMediaType, GiphyService } from './giphy.service';
import { tunisiaGeoJson } from '../tunisia-map';
import { GOVERNORATE_LABEL_EN, GOVERNORATE_LABEL_FR } from '../tunisia-governorate-labels';
import { CommunityStoriesComponent } from './community-stories.component';
import { TranslateModule } from '@ngx-translate/core';

const MINI_TUNISIA_MAP_NAME = 'TunisiaMiniPreview';
const MINI_TUNISIA_MAP_NAME_PROP = '_echartsRegionId';

type LocationHoverCard = {
  title: string;
  subtitle: string;
  mapRegionId: string | null;
  highlightLabel: string | null;
};

type HoverCardUser = UserRef & {
  userId: number;
  followersCount?: number;
  followingCount?: number;
  age?: number | null;
  coverImageUrl?: string | null;
  country?: string | null;
  nationality?: string | null;
  cityName?: string | null;
};

type HoverCardState = {
  user: HoverCardUser;
  top: number;
  left: number;
};

function normalizeRegionToken(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function tunisiaGeoWithUniqueRegionIds(geo: any) {
  return {
    ...geo,
    features: geo.features.map((f: any, i: number) => ({
      ...f,
      properties: {
        ...f.properties,
        [MINI_TUNISIA_MAP_NAME_PROP]: `${f.properties?.gouv_id ?? 'region'}_${i}`,
      },
    })),
  };
}

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, CommunityStoriesComponent, TranslateModule],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css',
})
export class CommunityComponent {
  private static readonly POSTS_PAGE_SIZE = 10;

  @ViewChild('locationMiniMap')
  private locationMiniMapRef?: ElementRef<HTMLDivElement>;

  /** Stable TemplateRef for recursive comments (avoids NgTemplateOutlet receiving a non-TemplateRef). */
  @ViewChild('commentTpl', { static: true })
  commentTplRef!: TemplateRef<unknown>;

  private readonly postService = inject(PostService);
  private readonly commentService = inject(CommentService);
  private readonly likeService = inject(LikeService);
  private readonly postMediaService = inject(PostMediaService);
  private readonly cityService = inject(CityService);
  private readonly followService = inject(FollowService);
  private readonly savedPostService = inject(SavedPostService);
  private readonly giphyService = inject(GiphyService);
  public readonly authService = inject(AuthService);
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Feed state
  readonly posts = signal<Post[]>([]);
  readonly likes = signal<LikeEntity[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly medias = signal<PostMedia[]>([]);
  readonly likeStatuses = signal<Map<number, boolean>>(new Map());
  readonly likeUserNicknames = signal<Map<number, string[]>>(new Map());
  readonly likeUsersByPost = signal<Map<number, UserRef[]>>(new Map());
  readonly followingByAuthor = signal<Map<number, boolean>>(new Map());
  readonly savedByPost = signal<Map<number, boolean>>(new Map());
  readonly suggestedUsers = signal<UserRef[]>([]);
  readonly leaderboardUsers = signal<LeaderboardUserSummary[]>([]);
  readonly cities = signal<CityOption[]>([]);
  readonly loadingCities = signal<boolean>(false);
  readonly savedPosts = signal<Post[]>([]);
  readonly showSavedOnly = signal<boolean>(false);

  readonly loadError = signal<string | null>(null);
  readonly feedLoaded = signal(false);
  readonly visiblePostsLimit = signal<number>(CommunityComponent.POSTS_PAGE_SIZE);
  /** Placeholder discovery chips — use asset paths instead of emoji */
  readonly cityDiscovery = signal<Array<{ label: string; icon: string }>>([
    { label: 'Kairouan', icon: 'icones/city.png' },
    { label: 'Djerba', icon: 'icones/city.png' },
    { label: 'Sidi Bou', icon: 'icones/city.png' },
    { label: 'Douz', icon: 'icones/city.png' },
    { label: 'El Jem', icon: 'icones/city.png' },
    { label: 'Nabeul', icon: 'icones/city.png' },
  ]);

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

  // Post action menu
  readonly activePostMenuId = signal<number | null>(null);

  // Like toggle
  readonly togglingLikePostId = signal<number | null>(null);

  // Comments drafts
  readonly postCommentDrafts = signal<Record<number, string>>({});
  readonly replyDrafts = signal<Record<number, string>>({});
  readonly activeReplyCommentId = signal<number | null>(null);
  readonly postCommentGiphy = signal<Record<number, GiphyItem | null>>({});
  readonly replyCommentGiphy = signal<Record<number, GiphyItem | null>>({});

  // GIPHY picker
  readonly showGiphyPicker = signal<boolean>(false);
  readonly giphyContext = signal<{ kind: 'post' | 'reply'; id: number } | null>(null);
  readonly giphyQuery = signal<string>('');
  readonly giphyType = signal<GiphyMediaType>('gif');
  readonly giphyResults = signal<GiphyItem[]>([]);
  readonly giphyLoading = signal<boolean>(false);
  readonly giphyError = signal<string | null>(null);

  private giphySearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Media uploads
  readonly uploadingPostId = signal<number | null>(null);

  // UI State Modals & Toggles
  readonly activeLikersPostId = signal<number | null>(null);
  readonly activeCommentsPostId = signal<number | null>(null);
  readonly expandedCommentsPostIds = signal<Set<number>>(new Set());
  readonly activeMediaPostId = signal<number | null>(null);
  readonly activeMediaIndex = signal<number>(0);
  readonly hoveredLocationPostId = signal<number | null>(null);
  readonly hoveredLocationCard = signal<LocationHoverCard | null>(null);
  readonly hoveredUserCard = signal<HoverCardState | null>(null);
  readonly focusedPostId = signal<number | null>(null);

  private static miniMapRegistered = false;
  private readonly miniTunisiaGeo = tunisiaGeoWithUniqueRegionIds(tunisiaGeoJson);
  private readonly miniGovernorateLookup = this.buildGovernorateLookup();
  private miniMapChart: echarts.ECharts | null = null;
  private hoverCardCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly hoverUserCache = new Map<number, HoverCardUser>();
  private postViewObserver: IntersectionObserver | null = null;
  private readonly postViewTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly sentViewKeys = new Set<string>();
  private feedAutoLoadPending = false;
  private suggestionsRequestSeq = 0;

  constructor() {
    // No more manual userId selection - use JWT authentication
  }

  ngOnInit(): void {
    const savedOnly = !!this.route.snapshot.data['savedOnly'];
    this.showSavedOnly.set(savedOnly);

    this.loadCities();
    this.loadFeed();

    if (savedOnly && this.authService.isAuthenticated()) {
      this.loadSavedPosts();
    }
  }

  ngOnDestroy(): void {
    if (this.giphySearchDebounceTimer) {
      clearTimeout(this.giphySearchDebounceTimer);
      this.giphySearchDebounceTimer = null;
    }
    if (this.hoverCardCloseTimer) {
      clearTimeout(this.hoverCardCloseTimer);
      this.hoverCardCloseTimer = null;
    }
    this.postViewObserver?.disconnect();
    this.postViewObserver = null;
    for (const timer of this.postViewTimers.values()) {
      clearTimeout(timer);
    }
    this.postViewTimers.clear();
    this.disposeMiniMapChart();
  }

  private loadCities(): void {
    this.loadingCities.set(true);
    this.cityService.getCities().pipe(
      catchError((err) => {
        console.error('Failed to load cities:', err);
        return of([]);
      })
    ).subscribe((cities) => {
      this.cities.set(Array.isArray(cities) ? cities : []);
      this.loadingCities.set(false);
    });
  }

  private loadFeed(): void {
    this.loadError.set(null);
    this.feedLoaded.set(false);
    this.resetVisiblePostsLimit();

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
        void this.refreshSuggestions();
        void this.refreshLeaderboard();
        this.resetVisiblePostsLimit();
        this.feedLoaded.set(true);
        setTimeout(() => this.setupPostViewObserver(), 0);
        
        // Load like statuses and nicknames for each post
        this.loadLikeStatusesAndNicknames();
        this.loadFollowAndSaveStatuses();
      },
      error: (err) => {
        console.error('Error loading feed:', err);
        this.loadError.set('Error loading feed');
        this.feedLoaded.set(true);
      },
    });
  }

  private loadFollowAndSaveStatuses(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const postList = this.posts();
    const authorIds = Array.from(
      new Set(
        postList
          .map((post) => post.author?.userId)
          .filter((id): id is number => id != null)
      )
    );

    const postIds = postList
      .map((post) => post.postId)
      .filter((id): id is number => id != null);

    if (authorIds.length > 0) {
      forkJoin(
        authorIds.map((id) =>
          this.followService.isFollowing(id).pipe(catchError(() => of({ following: false })))
        )
      ).subscribe((responses) => {
        const map = new Map<number, boolean>();
        authorIds.forEach((authorId, index) => map.set(authorId, responses[index].following));
        this.followingByAuthor.set(map);
        void this.refreshSuggestions();
      });
    }

    if (postIds.length > 0) {
      forkJoin(
        postIds.map((id) =>
          this.savedPostService.isSaved(id).pipe(catchError(() => of({ saved: false })))
        )
      ).subscribe((responses) => {
        const map = new Map<number, boolean>();
        postIds.forEach((postId, index) => map.set(postId, responses[index].saved));
        this.savedByPost.set(map);
      });
    }
  }

  private loadLikeStatusesAndNicknames(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const posts = this.posts();
    const likeStatusMap = new Map<number, boolean>();
    const nicknameMap = new Map<number, string[]>();
    const usersMap = new Map<number, UserRef[]>();

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
          const users = (response.likes ?? [])
            .map((like) => like.user)
            .filter((user): user is UserRef => !!user)
            .reduce<UserRef[]>((acc, user) => {
              const userId = user.userId;
              if (userId != null && acc.some((entry) => entry.userId === userId)) {
                return acc;
              }
              if (userId == null && acc.some((entry) => this.displayName(entry) === this.displayName(user))) {
                return acc;
              }
              acc.push(user);
              return acc;
            }, []);
          usersMap.set(post.postId!, users);
        });
        this.likeStatuses.set(likeStatusMap);
        this.likeUserNicknames.set(nicknameMap);
        this.likeUsersByPost.set(usersMap);
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
    const location = this.newPostLocation().trim();
    if (!content) {
      return;
    }

    if (!location) {
      await Swal.fire({
        icon: 'warning',
        title: 'Location required',
        text: 'Please choose a place before publishing.',
        ...this.swalTheme(),
      });
      return;
    }

    this.isPosting.set(true);

    try {
      const newPost: Omit<Post, 'postId' | 'author' | 'createdAt' | 'updatedAt'> = {
        content,
        hashtags: this.extractHashtags(content).join(' '),
        location: location || null,
        visibility: this.newPostVisibility() || 'public',
        likesCount: 0,
        commentsCount: 0,
      };

      let createdPost = await firstValueFrom(this.postService.addPost(newPost));
      const uploadedMedias: PostMedia[] = [];
      
      // Upload media files if any
      const mediaFiles = this.newPostMediaFiles();
      if (createdPost?.postId && mediaFiles.length > 0) {
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
          try {
            const uploadedMedia = await firstValueFrom(
              this.postMediaService.uploadMedia(file, createdPost.postId, mediaType as MediaType, i)
            );
            uploadedMedias.push(uploadedMedia);
          } catch (mediaErr) {
            console.error('Error uploading media file:', mediaErr);
          }
        }

        // Gemini auto-tagging updates hashtags during media upload on backend.
        // Refresh the just-created post so hashtags are visible immediately in UI.
        try {
          createdPost = await firstValueFrom(this.postService.getPost(createdPost.postId));
        } catch (refreshErr) {
          console.warn('Could not refresh created post hashtags after media upload:', refreshErr);
        }
      }

      if (createdPost?.postId) {
        const normalizedPost: Post = {
          ...createdPost,
          likesCount: createdPost.likesCount ?? 0,
          commentsCount: createdPost.commentsCount ?? 0,
        };
        this.posts.set([normalizedPost, ...this.posts()]);
      }

      if (uploadedMedias.length > 0) {
        this.medias.set([...this.medias(), ...uploadedMedias]);
      }
      
      // Reset form
      this.newPostContent.set('');
      this.newPostLocation.set('');
      this.newPostVisibility.set('public');
      this.clearNewPostMedia();
      this.showCreatePostForm.set(false);
      this.closePostMenu();
      
    } catch (error) {
      console.error('Error creating post:', error);

      const httpError = error as HttpErrorResponse;
      const backendMessage =
        (typeof httpError?.error === 'string' && httpError.error.trim().length > 0)
          ? httpError.error
          : (typeof httpError?.error?.message === 'string' ? httpError.error.message : '');

      if (
        httpError?.status === 422 &&
        /bad words|inappropriate|profanity|cannot be published/i.test(backendMessage)
      ) {
        await Swal.fire({
          icon: 'warning',
          title: 'Post blocked',
          text: backendMessage || 'You cannot use bad words in posts.',
          ...this.swalTheme(),
        });
      } else {
        this.loadError.set('Failed to create post');
      }
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
      this.router.navigate(['/signin']);
      return;
    }

    this.togglingLikePostId.set(postId);

    try {
      const response = await firstValueFrom(this.likeService.toggleLike(postId));
      
      // Update like status locally without reloading
      const currentStatuses = this.likeStatuses();
      currentStatuses.set(postId, response.liked);
      this.likeStatuses.set(new Map(currentStatuses));

      this.updatePostCounts(postId, { likesCount: response.count });
      
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
      this.router.navigate(['/signin']);
      return;
    }
    const userId = this.authService.currentUser()?.id;
    if (userId) {
      this.router.navigate(['/communaute/user', userId]);
      return;
    }
    this.router.navigate(['/communaute/my-posts']);
  }

  backToCommunity(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToUserProfile(userId?: number): void {
    if (!userId) {
      return;
    }
    this.hoveredUserCard.set(null);
    this.router.navigate(['/communaute/user', userId]);
  }

  openUserHoverFromEvent(event: MouseEvent, user?: UserRef): void {
    if (!user?.userId) {
      return;
    }

    const anchor = event.currentTarget as HTMLElement | null;
    if (!anchor) {
      return;
    }

    this.clearUserHoverCloseTimer();
    const baseUser = this.buildHoverUser(user);
    const { top, left } = this.computeUserHoverPosition(anchor.getBoundingClientRect());
    this.hoveredUserCard.set({ user: baseUser, top, left });
    this.loadHoverUserSummary(baseUser.userId);
  }

  keepUserHoverOpen(): void {
    this.clearUserHoverCloseTimer();
  }

  scheduleUserHoverClose(): void {
    this.clearUserHoverCloseTimer();
    this.hoverCardCloseTimer = setTimeout(() => {
      this.hoveredUserCard.set(null);
      this.hoverCardCloseTimer = null;
    }, 1000);
  }

  goToHoveredUserProfile(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    const card = this.hoveredUserCard();
    if (!card?.user.userId) {
      return;
    }
    this.goToUserProfile(card.user.userId);
  }

  openChatWithHoveredUser(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }

    const card = this.hoveredUserCard();
    const userId = card?.user.userId;
    if (!userId || userId === this.authService.currentUser()?.id) {
      return;
    }

    this.hoveredUserCard.set(null);
    this.chatService.requestOpenBubbleForUser(userId);
  }

  async toggleFollowFromHover(userId: number, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    await this.toggleFollow(userId);
  }

  hoverCardCountry(user?: HoverCardUser | null): string {
    const value = (user?.country ?? user?.nationality ?? '').trim();
    return value.length > 0 ? value : 'Unknown';
  }

  hoverCardAge(user?: HoverCardUser | null): string {
    if (typeof user?.age === 'number' && Number.isFinite(user.age) && user.age > 0) {
      return String(user.age);
    }
    return 'Not shared';
  }

  hoverCardCover(user?: HoverCardUser | null): string {
    const cover = (user?.coverImageUrl ?? '').trim();
    const source = cover.length > 0 ? cover : '/assets/banner.png';
    return `linear-gradient(180deg, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.42)), url('${source}')`;
  }

  private buildHoverUser(user: UserRef): HoverCardUser {
    const userId = user.userId!;
    const cached = this.hoverUserCache.get(userId);
    if (cached) {
      return {
        ...cached,
        ...user,
        userId,
      };
    }

    return {
      ...user,
      userId,
      coverImageUrl: (user as UserRef & { coverImageUrl?: string | null }).coverImageUrl ?? null,
      country: user.country ?? null,
      nationality: user.nationality ?? null,
      cityName: user.cityName ?? null,
      age: user.age ?? null,
    };
  }

  private loadHoverUserSummary(userId: number): void {
    if (this.hoverUserCache.has(userId)) {
      const card = this.hoveredUserCard();
      if (card?.user.userId === userId) {
        card.user = { ...card.user, ...this.hoverUserCache.get(userId)! };
        this.hoveredUserCard.set({ ...card });
      }
      return;
    }

    this.followService.userSummary(userId).pipe(
      catchError(() => of(null))
    ).subscribe((summary) => {
      if (!summary) {
        return;
      }

      const merged: HoverCardUser = {
        userId,
        username: summary.username,
        firstName: summary.firstName,
        lastName: summary.lastName,
        profileImageUrl: summary.profileImageUrl ?? null,
        coverImageUrl: summary.coverImageUrl ?? null,
        country: summary.country ?? summary.nationality ?? null,
        nationality: summary.nationality ?? summary.country ?? null,
        cityName: summary.cityName ?? null,
        age: summary.age ?? null,
        followersCount: summary.followersCount,
        followingCount: summary.followingCount,
      };

      this.hoverUserCache.set(userId, merged);
      const card = this.hoveredUserCard();
      if (card?.user.userId === userId) {
        this.hoveredUserCard.set({
          ...card,
          user: {
            ...card.user,
            ...merged,
          },
        });
      }
    });
  }

  private computeUserHoverPosition(rect: DOMRect): { top: number; left: number } {
    const cardWidth = 340;
    const cardHeight = 338;
    const gap = 10;
    const viewportPadding = 12;

    let left = rect.left;
    if (left + cardWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - cardWidth - viewportPadding;
    }
    if (left < viewportPadding) {
      left = viewportPadding;
    }

    let top = rect.bottom + gap;
    if (top + cardHeight > window.innerHeight - viewportPadding) {
      top = rect.top - cardHeight - gap;
    }
    if (top < viewportPadding) {
      top = viewportPadding;
    }

    return { top, left };
  }

  private clearUserHoverCloseTimer(): void {
    if (this.hoverCardCloseTimer) {
      clearTimeout(this.hoverCardCloseTimer);
      this.hoverCardCloseTimer = null;
    }
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

  getLikeUsers(postId: number): UserRef[] {
    return this.likeUsersByPost().get(postId) || [];
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
      this.router.navigate(['/signin']);
      return;
    }

    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    // Check if user is post owner
    const post = this.posts().find(p => p.postId === postId);
    if (!post || !OwnershipUtil.canEditPost(post, this.authService)) {
      await Swal.fire({
        icon: 'error',
        title: 'Action denied',
        text: 'Only the post owner can add media.',
        ...this.swalTheme(),
      });
      return;
    }

    this.uploadingPostId.set(postId);

    try {
      const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      const uploadedMedia = await firstValueFrom(
        this.postMediaService.uploadMedia(file, postId, mediaType as MediaType)
      );

      const next = [...this.medias(), uploadedMedia].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );
      this.medias.set(next);

      (event.target as HTMLInputElement).value = '';
    } catch (error) {
      console.error('Error uploading media:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Upload failed',
        text: 'The media could not be added.',
        ...this.swalTheme(),
      });
    } finally {
      this.uploadingPostId.set(null);
    }
  }

  // Delete post
  async deletePost(postId: number): Promise<void> {
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

    try {
      await firstValueFrom(this.postService.deletePost(postId));
      this.closePostMenu();
      this.loadFeed();
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

  // Delete comment
  async deleteComment(commentId: number): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete this comment?',
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

    try {
      await firstValueFrom(this.commentService.deleteComment(commentId));
      this.loadFeed();
      await Swal.fire({
        icon: 'success',
        title: 'Commentaire supprime',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Could not delete',
        text: 'The comment could not be deleted.',
        ...this.swalTheme(),
      });
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
    this.closePostMenu();
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
    if (!content || !this.editPostLocation().trim() || this.isSavingEdit()) {
      return;
    }

    this.isSavingEdit.set(true);

    try {
      await firstValueFrom(
        this.postService.updatePost(postId, {
          content,
          hashtags: this.extractHashtags(content).join(' '),
          location: this.editPostLocation().trim() || null,
          visibility: this.editPostVisibility() || 'public',
          likesCount: post.likesCount ?? 0,
          commentsCount: post.commentsCount ?? 0,
        })
      );

      this.cancelEditPost();
      this.closePostMenu();
      this.loadFeed();
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

  togglePostMenu(postId: number): void {
    this.activePostMenuId.set(this.activePostMenuId() === postId ? null : postId);
  }

  closePostMenu(): void {
    this.activePostMenuId.set(null);
  }

  @HostListener('document:click')
  handleDocumentClick(): void {
    this.closePostMenu();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.activeMediaPostId() == null) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeMediaLightbox();
      return;
    }

    if (event.key === 'ArrowLeft') {
      this.prevMedia();
      return;
    }

    if (event.key === 'ArrowRight') {
      this.nextMedia();
    }
  }

  @HostListener('window:scroll')
  handleWindowScroll(): void {
    if (!this.feedLoaded() || this.feedAutoLoadPending) {
      return;
    }

    if (!this.canLoadMorePosts()) {
      return;
    }

    const viewportBottom = window.scrollY + window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const threshold = 260;

    if (viewportBottom < documentHeight - threshold) {
      return;
    }

    this.feedAutoLoadPending = true;
    this.loadMorePosts();
    setTimeout(() => {
      this.feedAutoLoadPending = false;
    }, 120);
  }

  cityDisplay(city: CityOption): string {
    if (!city.region) {
      return city.name;
    }
    return `${city.name} (${city.region})`;
  }

  showLocationHover(postId: number, location: string | null | undefined, event: MouseEvent): void {
    this.hoveredLocationPostId.set(postId);
    const hoverCard = this.buildLocationHoverCard(location);
    this.hoveredLocationCard.set(hoverCard);

    if (hoverCard?.mapRegionId) {
      this.scheduleMiniMapRender();
    }
  }

  hideLocationHover(postId: number): void {
    if (this.hoveredLocationPostId() === postId) {
      this.hoveredLocationPostId.set(null);
      this.hoveredLocationCard.set(null);
      this.disposeMiniMapChart();
    }
  }

  isLocationHoverVisible(postId: number): boolean {
    return this.hoveredLocationPostId() === postId;
  }

  openCityFromLocation(location: string | null | undefined, event?: Event): void {
    event?.stopPropagation();

    const cleaned = (location ?? '').trim();
    if (!cleaned) {
      return;
    }

    const city = this.findCityByName(cleaned);
    if (!city?.cityId) {
      return;
    }

    this.router.navigate(['/city', city.cityId]);
  }

  private buildLocationHoverCard(location: string | null | undefined): LocationHoverCard | null {
    const cleaned = (location ?? '').trim();
    if (!cleaned) {
      return null;
    }

    const city = this.findCityByName(cleaned);
    const regionMatch = city
      ? this.resolveGovernorateFromCity(city, cleaned)
      : this.findRegionForLocation(cleaned);

    if (!city) {
      return {
        title: cleaned,
        subtitle: 'Tunisia',
        mapRegionId: regionMatch?.regionId ?? null,
        highlightLabel: regionMatch?.label ?? null,
      };
    }

    return {
      title: city.name,
      subtitle: city.region || 'Tunisia',
      mapRegionId: regionMatch?.regionId ?? null,
      highlightLabel: regionMatch?.label ?? city.region ?? null,
    };
  }

  private resolveGovernorateFromCity(city: CityOption, rawLocation: string): { regionId: string; label: string } | null {
    const byCityName = this.findRegionForLocation(city.name);
    if (byCityName) {
      return byCityName;
    }

    const regionToken = this.normalizeLocationKey(city.region ?? '');
    const isMacroRegion = regionToken === 'north' || regionToken === 'south' || regionToken === 'center' || regionToken === 'centre';
    if (!isMacroRegion && city.region) {
      const byRegion = this.findRegionForLocation(city.region);
      if (byRegion) {
        return byRegion;
      }
    }

    return this.findRegionForLocation(rawLocation);
  }

  private findCityByName(location: string): CityOption | null {
    const normalized = this.normalizeLocationKey(location);
    const city = this.cities().find((item) =>
      this.normalizeLocationKey(item.name) === normalized
    );
    return city ?? null;
  }

  private normalizeLocationKey(value: string): string {
    return normalizeRegionToken(value);
  }

  private buildGovernorateLookup(): Array<{ regionId: string; label: string; tokens: string[] }> {
    return this.miniTunisiaGeo.features.map((feature: any) => {
      const gouvId = feature.properties?.gouv_id as string | undefined;
      const gouvFr = feature.properties?.gouv_fr as string | undefined;
      const regionId = feature.properties?.[MINI_TUNISIA_MAP_NAME_PROP] as string;
      const label =
        (gouvId ? GOVERNORATE_LABEL_EN[gouvId] : undefined) ??
        (gouvId ? GOVERNORATE_LABEL_FR[gouvId] : undefined) ??
        gouvFr ??
        'Tunisia';

      return {
        regionId,
        label,
        tokens: [gouvId, gouvFr, GOVERNORATE_LABEL_EN[gouvId ?? ''], GOVERNORATE_LABEL_FR[gouvId ?? '']]
          .map((token) => normalizeRegionToken(token))
          .filter((token) => token.length > 0),
      };
    });
  }

  private findRegionForLocation(value: string): { regionId: string; label: string } | null {
    const normalized = this.normalizeLocationKey(value);
    if (!normalized) {
      return null;
    }

    const exact = this.miniGovernorateLookup.find((entry) => entry.tokens.includes(normalized));
    if (exact) {
      return { regionId: exact.regionId, label: exact.label };
    }

    const fuzzy = this.miniGovernorateLookup.find((entry) =>
      entry.tokens.some((token) => token.includes(normalized) || normalized.includes(token))
    );
    if (!fuzzy) {
      return null;
    }

    return { regionId: fuzzy.regionId, label: fuzzy.label };
  }

  private scheduleMiniMapRender(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => this.renderMiniMapForCurrentHover(2));
  }

  private renderMiniMapForCurrentHover(retriesLeft: number): void {
    const hoverCard = this.hoveredLocationCard();
    const host = this.locationMiniMapRef?.nativeElement;

    if (!hoverCard?.mapRegionId || !host) {
      if (retriesLeft > 0 && this.hoveredLocationCard()?.mapRegionId) {
        window.requestAnimationFrame(() => this.renderMiniMapForCurrentHover(retriesLeft - 1));
      }
      return;
    }

    if (!CommunityComponent.miniMapRegistered) {
      echarts.registerMap(MINI_TUNISIA_MAP_NAME, this.miniTunisiaGeo);
      CommunityComponent.miniMapRegistered = true;
    }

    this.disposeMiniMapChart();
    this.miniMapChart = echarts.init(host);

    this.miniMapChart.setOption({
      backgroundColor: '#081531',
      animation: false,
      tooltip: { show: false },
      series: [
        {
          type: 'map',
          map: MINI_TUNISIA_MAP_NAME,
          nameProperty: MINI_TUNISIA_MAP_NAME_PROP,
          roam: false,
          silent: true,
          zoom: 1.08,
          label: { show: false },
          itemStyle: {
            areaColor: '#263858',
            borderColor: '#6f93c6',
            borderWidth: 1.6,
            shadowColor: 'rgba(73, 133, 224, 0.3)',
            shadowBlur: 12,
          },
          emphasis: {
            disabled: true,
          },
          data: [
            {
              name: hoverCard.mapRegionId,
              label: {
                show: true,
                color: '#f8fbff',
                fontSize: 14,
                fontWeight: 'bold',
                formatter: hoverCard.highlightLabel || hoverCard.title,
              },
              itemStyle: {
                areaColor: '#4f89de',
                borderColor: '#b4d8ff',
                borderWidth: 2,
                shadowColor: 'rgba(96, 165, 250, 0.56)',
                shadowBlur: 20,
              },
            },
          ],
        },
      ],
    });

    this.miniMapChart.resize();
  }

  private disposeMiniMapChart(): void {
    if (this.miniMapChart) {
      this.miniMapChart.dispose();
      this.miniMapChart = null;
    }
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

  trackByUserRef(index: number, user: UserRef): number | string {
    return user.userId ?? `${this.displayName(user)}-${index}`;
  }

  trackByGiphy(index: number, item: GiphyItem): string {
    return item.id || `${item.mediaType}-${index}`;
  }

  trackByCity(index: number, city: CityOption): number {
    return city.cityId;
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
      this.router.navigate(['/signin']);
      return;
    }

    const isReply = parentCommentId != null;
    const draft = isReply
      ? this.getReplyDraft(parentCommentId)
      : this.getCommentDraft(postId);
    const content = draft.trim();
    const selectedGiphy = isReply
      ? this.getSelectedGiphyForReply(parentCommentId)
      : this.getSelectedGiphyForPost(postId);

    if (!content && !selectedGiphy) {
      return;
    }

    try {
      const newComment: Omit<Comment, 'commentId' | 'author' | 'createdAt' | 'updatedAt'> = {
        post: { postId },
        content,
        gifs: selectedGiphy?.fullUrl ?? null,
        parent: isReply ? { commentId: parentCommentId } : null,
      };

      const createdComment = await firstValueFrom(this.commentService.addComment(newComment));

      this.comments.set([...this.comments(), createdComment]);
      this.updatePostCounts(postId, {
        commentsCount: this.getCommentCount(postId) + 1,
      });
      
      // Clear draft and reload feed
      if (isReply) {
        this.setReplyDraft(parentCommentId, '');
        this.setReplyGiphy(parentCommentId, null);
        this.activeReplyCommentId.set(null);
      } else {
        this.setCommentDraft(postId, '');
        this.setPostCommentGiphy(postId, null);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      const message = error instanceof HttpErrorResponse
        ? extractApiErrorMessage(error, 'Unable to add comment right now.')
        : 'Unable to add comment right now.';
      await Swal.fire({
        icon: 'warning',
        title: 'Comment blocked',
        text: message,
        ...this.swalTheme(),
      });
    }
  }

  openGiphyPickerForPost(postId: number): void {
    this.giphyContext.set({ kind: 'post', id: postId });
    this.openGiphyPicker();
  }

  openGiphyPickerForReply(commentId: number): void {
    this.giphyContext.set({ kind: 'reply', id: commentId });
    this.openGiphyPicker();
  }

  onGiphyQueryInput(value: string): void {
    this.giphyQuery.set(value);
    this.scheduleGiphySearch();
  }

  setGiphyType(type: GiphyMediaType): void {
    this.giphyType.set(type);
    this.scheduleGiphySearch();
  }

  selectGiphy(item: GiphyItem): void {
    const context = this.giphyContext();
    if (!context) {
      return;
    }

    if (context.kind === 'post') {
      this.setPostCommentGiphy(context.id, item);
    } else {
      this.setReplyGiphy(context.id, item);
    }

    this.closeGiphyPicker();
  }

  closeGiphyPicker(): void {
    this.showGiphyPicker.set(false);
    this.giphyContext.set(null);
    this.giphyQuery.set('');
    this.giphyResults.set([]);
    this.giphyError.set(null);
    this.giphyLoading.set(false);
    if (this.giphySearchDebounceTimer) {
      clearTimeout(this.giphySearchDebounceTimer);
      this.giphySearchDebounceTimer = null;
    }
  }

  clearSelectedGiphyForPost(postId: number): void {
    this.setPostCommentGiphy(postId, null);
  }

  clearSelectedGiphyForReply(commentId: number): void {
    this.setReplyGiphy(commentId, null);
  }

  getSelectedGiphyForPost(postId: number): GiphyItem | null {
    return this.postCommentGiphy()[postId] || null;
  }

  getSelectedGiphyForReply(commentId: number): GiphyItem | null {
    return this.replyCommentGiphy()[commentId] || null;
  }

  getCommentDisplayText(comment: Comment): string {
    return this.parseCommentPayload(comment.content, comment.gifs).text;
  }

  getCommentGiphy(comment: Comment): GiphyItem | null {
    return this.parseCommentPayload(comment.content, comment.gifs).giphy;
  }

  private openGiphyPicker(): void {
    this.showGiphyPicker.set(true);
    this.giphyError.set(null);
    this.giphyResults.set([]);
  }

  private scheduleGiphySearch(): void {
    if (!this.showGiphyPicker()) {
      return;
    }

    if (this.giphySearchDebounceTimer) {
      clearTimeout(this.giphySearchDebounceTimer);
    }

    const q = this.giphyQuery().trim();
    if (!q) {
      this.giphyResults.set([]);
      this.giphyError.set(null);
      return;
    }

    this.giphySearchDebounceTimer = setTimeout(() => {
      this.searchGiphy();
    }, 280);
  }

  private async searchGiphy(): Promise<void> {
    const q = this.giphyQuery().trim();
    if (!q) {
      this.giphyResults.set([]);
      this.giphyError.set(null);
      return;
    }

    this.giphyLoading.set(true);
    this.giphyError.set(null);

    try {
      const results = await firstValueFrom(this.giphyService.search(q, this.giphyType(), 24));
      this.giphyResults.set(results);
      if (!results.length) {
        this.giphyError.set('No result found. Try another keyword.');
      }
    } catch (error) {
      console.error('Error searching GIPHY:', error);
      this.giphyError.set('GIPHY search failed. Check API key configuration.');
      this.giphyResults.set([]);
    } finally {
      this.giphyLoading.set(false);
    }
  }

  private setPostCommentGiphy(postId: number, item: GiphyItem | null): void {
    const next = { ...this.postCommentGiphy() };
    if (item) {
      next[postId] = item;
    } else {
      delete next[postId];
    }
    this.postCommentGiphy.set(next);
  }

  private setReplyGiphy(commentId: number, item: GiphyItem | null): void {
    const next = { ...this.replyCommentGiphy() };
    if (item) {
      next[commentId] = item;
    } else {
      delete next[commentId];
    }
    this.replyCommentGiphy.set(next);
  }

  private parseCommentPayload(content?: string, gifs?: string | null): { text: string; giphy: GiphyItem | null } {
    const rawText = (content ?? '').trim();
    const directGifs = (gifs ?? '').trim();

    if (directGifs && this.isAllowedGiphyUrl(directGifs)) {
      return {
        text: rawText,
        giphy: {
          id: directGifs,
          title: 'giphy',
          mediaType: 'gif',
          previewUrl: directGifs,
          fullUrl: directGifs,
        },
      };
    }

    // Backward compatibility for old comments that stored GIPHY marker inside content.
    if (!rawText) {
      return { text: '', giphy: null };
    }

    const match = rawText.match(/^\[\[GIPHY\|(gif|sticker)\|([^\]]+)\]\]\s*/i);
    if (!match) {
      return { text: rawText, giphy: null };
    }

    const mediaType = (match[1].toLowerCase() === 'sticker' ? 'sticker' : 'gif') as GiphyMediaType;
    const fullUrl = match[2].trim();

    if (!this.isAllowedGiphyUrl(fullUrl)) {
      return { text: rawText, giphy: null };
    }

    const text = rawText.slice(match[0].length).trim();
    return {
      text,
      giphy: {
        id: fullUrl,
        title: mediaType,
        mediaType,
        previewUrl: fullUrl,
        fullUrl,
      },
    };
  }

  private isAllowedGiphyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return false;
      }
      return parsed.hostname.endsWith('giphy.com') || parsed.hostname.endsWith('giphyusercontent.com');
    } catch {
      return false;
    }
  }

  async toggleFollow(authorId?: number): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;
    if (!authorId || !this.authService.isAuthenticated() || currentUserId === authorId) {
      return;
    }

    try {
      const response = await firstValueFrom(this.followService.toggleFollow(authorId));
      const next = new Map(this.followingByAuthor());
      next.set(authorId, response.following);
      this.followingByAuthor.set(next);
      void this.refreshSuggestions();
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  }

  isFollowing(authorId?: number): boolean {
    if (!authorId) {
      return false;
    }
    return this.followingByAuthor().get(authorId) || false;
  }

  async toggleSavePost(postId: number): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }

    try {
      const response = await firstValueFrom(this.savedPostService.toggleSave(postId));
      const next = new Map(this.savedByPost());
      next.set(postId, response.saved);
      this.savedByPost.set(next);
      if (this.showSavedOnly()) {
        await this.loadSavedPosts();
      }
    } catch (error) {
      console.error('Error saving post:', error);
    }
  }

  isPostSaved(postId: number): boolean {
    return this.savedByPost().get(postId) || false;
  }

  async repost(postId: number): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }

    const dialog = await Swal.fire({
      title: 'Add a caption to your repost',
      input: 'textarea',
      inputPlaceholder: 'Write your own caption (optional)',
      inputAttributes: {
        'aria-label': 'Repost caption',
      },
      inputValue: '',
      showCancelButton: true,
      confirmButtonText: 'Repost',
      cancelButtonText: 'Cancel',
      ...this.swalTheme(),
    });

    if (!dialog.isConfirmed) {
      return;
    }

    const caption = typeof dialog.value === 'string' ? dialog.value.trim() : '';

    try {
      await firstValueFrom(this.postService.repost(postId, caption));
      this.loadFeed();
      await Swal.fire({
        icon: 'success',
        title: 'Reposted',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });
    } catch (error) {
      console.error('Error reposting:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Could not repost',
        text: 'Please try again.',
        ...this.swalTheme(),
      });
    }
  }

  async toggleSavedMode(): Promise<void> {
    const next = !this.showSavedOnly();
    this.showSavedOnly.set(next);
    this.resetVisiblePostsLimit();
    if (next) {
      await this.loadSavedPosts();
    }
    setTimeout(() => this.setupPostViewObserver(), 0);
  }

  private async loadSavedPosts(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.savedPosts.set([]);
      return;
    }
    try {
      const posts = await firstValueFrom(this.savedPostService.mySavedPosts());
      this.savedPosts.set(posts || []);
      this.resetVisiblePostsLimit();
      setTimeout(() => this.setupPostViewObserver(), 0);
    } catch (error) {
      console.error('Error loading saved posts:', error);
      this.savedPosts.set([]);
      this.resetVisiblePostsLimit();
    }
  }

  visiblePosts(): Post[] {
    const source = this.showSavedOnly() ? this.savedPosts() : this.posts();
    return source.slice(0, this.visiblePostsLimit());
  }

  suggestionLocation(user?: UserRef): string {
    return (user?.cityName || user?.country || user?.nationality || '').trim();
  }

  private async refreshSuggestions(): Promise<void> {
    const requestId = ++this.suggestionsRequestSeq;
    const currentUserId = this.authService.currentUser()?.id;
    const followMap = this.followingByAuthor();
    const unique = new Map<number, UserRef>();

    // Fetch candidates directly from users search endpoint (same source as search bar).
    // Some backends ignore very short queries, so we use 2+ character seed batches.
    const seedBatches: string[][] = [
      this.randomSuggestionSeeds(8),
      ['an', 'ar', 'ma', 'sa', 'la', 'ra', 'na', 'ou'],
      this.randomSuggestionSeeds(8),
    ];

    for (const seeds of seedBatches) {
      const searchResults = await Promise.all(
        seeds.map((seed) =>
          firstValueFrom(
            this.chatService.searchUsers(seed).pipe(catchError(() => of([])))
          )
        )
      );

      if (requestId !== this.suggestionsRequestSeq) {
        return;
      }

      for (const list of searchResults) {
        for (const item of list || []) {
          const userId = Number(item?.userId);
          if (!Number.isInteger(userId) || userId <= 0) {
            continue;
          }

          if (currentUserId && userId === currentUserId) {
            continue;
          }

          if (followMap.get(userId)) {
            continue;
          }

          if (!unique.has(userId)) {
            unique.set(userId, {
              userId,
              username: item?.username,
              firstName: item?.firstName,
              lastName: item?.lastName,
              profileImageUrl: item?.profileImageUrl ?? null,
              cityName: item?.cityName ?? null,
              country: item?.country ?? null,
              nationality: item?.nationality ?? null,
            });
          }
        }
      }

      if (unique.size >= 4) {
        break;
      }
    }

    const shuffled = Array.from(unique.values()).sort(() => Math.random() - 0.5);
    this.suggestedUsers.set(shuffled.slice(0, 4));
  }

  private async refreshLeaderboard(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.leaderboardUsers.set([]);
      return;
    }

    try {
      const result = await firstValueFrom(
        this.followService.monthlyLeaderboard(3).pipe(catchError(() => of({ users: [] as LeaderboardUserSummary[] })))
      );
      this.leaderboardUsers.set(Array.isArray(result?.users) ? result.users : []);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      this.leaderboardUsers.set([]);
    }
  }

  leaderboardMonthlyScore(user: LeaderboardUserSummary): string {
    const value = Number(user.monthlyScore ?? 0);
    if (!Number.isFinite(value)) {
      return '0.0';
    }
    return value.toFixed(1);
  }

  private randomSuggestionSeeds(count: number): string[] {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const seeds = new Set<string>();
    while (seeds.size < count) {
      const firstIndex = Math.floor(Math.random() * alphabet.length);
      const secondIndex = Math.floor(Math.random() * alphabet.length);
      seeds.add(`${alphabet[firstIndex]}${alphabet[secondIndex]}`);
    }
    return Array.from(seeds);
  }

  loadMorePosts(): void {
    if (!this.canLoadMorePosts()) {
      return;
    }

    const next = this.visiblePostsLimit() + CommunityComponent.POSTS_PAGE_SIZE;
    this.visiblePostsLimit.set(next);
    setTimeout(() => this.setupPostViewObserver(), 0);
  }

  canLoadMorePosts(): boolean {
    const sourceLength = this.showSavedOnly() ? this.savedPosts().length : this.posts().length;
    return this.visiblePostsLimit() < sourceLength;
  }

  private resetVisiblePostsLimit(): void {
    this.visiblePostsLimit.set(CommunityComponent.POSTS_PAGE_SIZE);
  }

  isRepost(post: Post): boolean {
    return !!post.repostOf;
  }

  getHashtagsFromText(source?: string | null): string[] {
    return this.extractHashtags(source);
  }

  getHashtags(post: Post): string[] {
    const explicit = this.extractHashtags(post.hashtags);
    const fromContent = this.extractHashtags(post.content);
    return Array.from(new Set([...explicit, ...fromContent]));
  }

  private extractHashtags(source?: string | null): string[] {
    if (!source) {
      return [];
    }

    const tags = source.match(/#[\p{L}\p{N}_]+/gu) || [];
    return Array.from(new Set(tags.map((tag) => tag.trim())));
  }

  // Helper methods used in HTML template
  displayName(user?: UserRef): string {
    return (
      user?.username ??
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ??
      'User'
    );
  }

  userAvatarUrl(user?: UserRef): string | null {
    return this.normalizeProfileImageUrl(user?.profileImageUrl);
  }

  currentUserAvatarUrl(): string | null {
    return this.normalizeProfileImageUrl(this.authService.currentUser()?.profileImageUrl ?? null);
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
    const post = this.findPostById(postId);
    if (typeof post?.likesCount === 'number') {
      return post.likesCount;
    }
    return this.likes().filter((l) => l.post?.postId === postId).length;
  }

  getCommentCount(postId: number): number {
    const post = this.findPostById(postId);
    if (typeof post?.commentsCount === 'number') {
      return post.commentsCount;
    }
    return this.comments().filter((c) => c.post?.postId === postId).length;
  }

  private findPostById(postId: number): Post | undefined {
    return this.posts().find((p) => p.postId === postId)
      ?? this.savedPosts().find((p) => p.postId === postId)
      ?? this.visiblePosts().find((p) => p.postId === postId);
  }

  private updatePostCounts(postId: number, values: Partial<Pick<Post, 'likesCount' | 'commentsCount' | 'totalViews' | 'postScore'>>): void {
    this.posts.set(
      this.posts().map((post) =>
        post.postId === postId ? { ...post, ...values } : post
      )
    );

    this.savedPosts.set(
      this.savedPosts().map((post) =>
        post.postId === postId ? { ...post, ...values } : post
      )
    );
  }

  private setupPostViewObserver(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.postViewObserver?.disconnect();

    this.postViewObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          const postId = Number(node.dataset['postId']);
          if (!Number.isFinite(postId) || postId <= 0) {
            continue;
          }

          if (entry.isIntersecting) {
            this.startPostViewTimer(postId);
          } else {
            this.stopPostViewTimer(postId);
          }
        }
      },
      { threshold: 0.5 }
    );

    const cards = document.querySelectorAll<HTMLElement>('article[data-post-id]');
    cards.forEach((card) => this.postViewObserver?.observe(card));
  }

  private startPostViewTimer(postId: number): void {
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return;
    }

    const viewKey = `${userId}:${postId}:${this.currentMonthKeyUtc()}`;
    if (this.sentViewKeys.has(viewKey) || this.postViewTimers.has(postId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.postViewTimers.delete(postId);
      this.postService.recordView(postId).pipe(catchError(() => of({ counted: false }))).subscribe((res) => {
        if (!res?.counted) {
          return;
        }

        this.sentViewKeys.add(viewKey);
        const post = this.findPostById(postId);
        const nextViews = (post?.totalViews ?? 0) + 1;
        const likes = post?.likesCount ?? 0;
        const comments = post?.commentsCount ?? 0;
        const reposts = post?.repostCount ?? 0;
        const score = (likes * 2) + (comments * 3) + (nextViews * 0.5) + 1 + (reposts * 4);
        this.updatePostCounts(postId, { totalViews: nextViews, postScore: Number(score.toFixed(2)) });
      });
    }, 8000);

    this.postViewTimers.set(postId, timer);
  }

  private stopPostViewTimer(postId: number): void {
    const timer = this.postViewTimers.get(postId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.postViewTimers.delete(postId);
  }

  private currentMonthKeyUtc(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
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

  getImageMediaForPost(postId: number): PostMedia[] {
    return this.getMediaForPost(postId).filter(
      (m) => m.mediaType !== 'VIDEO' && !!m.fileUrl
    );
  }

  getVideoMediaForPost(postId: number): PostMedia[] {
    return this.getMediaForPost(postId).filter(
      (m) => m.mediaType === 'VIDEO' && !!m.fileUrl
    );
  }

  getDisplayImagesForPost(postId: number): PostMedia[] {
    const images = this.getImageMediaForPost(postId);
    if (images.length <= 2) {
      return images;
    }
    return images.slice(0, 2);
  }

  getRemainingImagesCount(postId: number): number {
    const images = this.getImageMediaForPost(postId);
    return Math.max(images.length - 2, 0);
  }

  isCollapsedImageTile(postId: number, index: number): boolean {
    return index === 1 && this.getRemainingImagesCount(postId) > 0;
  }

  openMediaLightbox(postId: number, startIndex: number): void {
    const images = this.getImageMediaForPost(postId);
    if (images.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(startIndex, images.length - 1));
    this.activeMediaPostId.set(postId);
    this.activeMediaIndex.set(safeIndex);
  }

  closeMediaLightbox(): void {
    this.activeMediaPostId.set(null);
    this.activeMediaIndex.set(0);
  }

  activeMediaList(): PostMedia[] {
    const postId = this.activeMediaPostId();
    if (postId == null) {
      return [];
    }
    return this.getImageMediaForPost(postId);
  }

  currentLightboxMedia(): PostMedia | null {
    const list = this.activeMediaList();
    if (list.length === 0) {
      return null;
    }
    return list[this.activeMediaIndex()] ?? list[0] ?? null;
  }

  prevMedia(): void {
    const list = this.activeMediaList();
    if (list.length <= 1) {
      return;
    }
    const current = this.activeMediaIndex();
    const nextIndex = (current - 1 + list.length) % list.length;
    this.activeMediaIndex.set(nextIndex);
  }

  nextMedia(): void {
    const list = this.activeMediaList();
    if (list.length <= 1) {
      return;
    }
    const current = this.activeMediaIndex();
    const nextIndex = (current + 1) % list.length;
    this.activeMediaIndex.set(nextIndex);
  }

  private swalTheme(): { background: string; color: string } {
    const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      background: darkMode ? '#181d24' : '#ffffff',
      color: darkMode ? '#e2e8f0' : '#1d2433',
    };
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
