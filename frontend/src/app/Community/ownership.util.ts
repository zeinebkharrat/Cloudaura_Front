import { AuthService } from '../core/auth.service';
import { Post, Comment, UserRef } from './community.types';

/**
 * Utility functions to check ownership of posts and comments
 * All functions require AuthService to be passed as a parameter
 */
export class OwnershipUtil {

  /**
   * Check if current user is the author of a post
   */
  static isPostAuthor(post: Post, authService: AuthService): boolean {
    const currentUser = authService.currentUser();
    if (!currentUser || !post.author) {
      return false;
    }
    
    return currentUser.id === post.author.userId;
  }

  /**
   * Check if current user is the author of a comment
   */
  static isCommentAuthor(comment: Comment, authService: AuthService): boolean {
    const currentUser = authService.currentUser();
    if (!currentUser || !comment.author) {
      return false;
    }
    
    return currentUser.id === comment.author.userId;
  }

  /**
   * Check if current user can edit a post
   */
  static canEditPost(post: Post, authService: AuthService): boolean {
    return this.isPostAuthor(post, authService);
  }

  /**
   * Check if current user can delete a post
   */
  static canDeletePost(post: Post, authService: AuthService): boolean {
    return this.isPostAuthor(post, authService);
  }

  /**
   * Check if current user can edit a comment
   */
  static canEditComment(comment: Comment, authService: AuthService): boolean {
    return this.isCommentAuthor(comment, authService);
  }

  /**
   * Check if current user can delete a comment
   */
  static canDeleteComment(comment: Comment, authService: AuthService): boolean {
    return this.isCommentAuthor(comment, authService);
  }

  /**
   * Check if current user can interact with content (like, comment)
   */
  static canInteract(authService: AuthService): boolean {
    return authService.isAuthenticated();
  }

  /**
   * Get the current user's ID
   */
  static getCurrentUserId(authService: AuthService): number | null {
    const currentUser = authService.currentUser();
    return currentUser?.id || null;
  }

  /**
   * Check if a user reference matches the current user
   */
  static isCurrentUser(userRef: UserRef, authService: AuthService): boolean {
    const currentUserId = this.getCurrentUserId(authService);
    return currentUserId !== null && userRef.userId === currentUserId;
  }
}
