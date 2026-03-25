export type MediaType = 'IMAGE' | 'VIDEO' | 'PANORAMA' | string;

export interface UserRef {
  userId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  // Other fields exist on the backend User, but we only need the above for display + create payloads.
}

export interface Post {
  postId?: number;
  author?: UserRef;
  content?: string;
  location?: string | null;
  visibility?: string | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Comment {
  commentId?: number;
  post?: { postId?: number };
  author?: UserRef;
  parent?: { commentId?: number } | null;
  content?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CommentWithChildren extends Comment {
  children: CommentWithChildren[];
}

export interface LikeEntity {
  likeId?: number;
  user?: UserRef;
  post?: { postId?: number };
  createdAt?: string | null;
}

export interface PostMedia {
  mediaId?: number;
  post?: { postId?: number };
  fileUrl?: string | null;
  mediaType?: MediaType | null;
  orderIndex?: number | null;
}

