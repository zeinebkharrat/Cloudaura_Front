export type StoryMediaType = 'IMAGE' | 'VIDEO' | string;

export interface Story {
  storyId: number;
  authorId: number;
  authorUsername: string;
  authorFirstName?: string | null;
  authorLastName?: string | null;
  authorProfileImageUrl?: string | null;
  caption?: string | null;
  visibility?: string | null;
  status?: string | null;
  viewsCount: number;
  likesCount: number;
  createdAt?: string | null;
  expiresAt?: string | null;
  archivedAt?: string | null;
  mediaUrl?: string | null;
  mediaType?: StoryMediaType | null;
  viewedByCurrentUser: boolean;
  likedByCurrentUser: boolean;
}

export interface StoryInteractionUser {
  userId: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  actedAt?: string | null;
}
