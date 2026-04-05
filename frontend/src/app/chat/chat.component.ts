import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ChatService } from './chat.service';
import { AuthService } from '../core/auth.service';
import {
  ConversationResponse,
  MessageResponse,
  TypingEvent,
} from './chat.types';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  // State
  readonly conversations = this.chatService.conversations;
  readonly connected = this.chatService.connected;
  readonly currentUser = this.authService.currentUser;

  activeChatRoomId = signal<number | null>(null);
  activeConversation = signal<ConversationResponse | null>(null);
  messages = signal<MessageResponse[]>([]);
  newMessage = signal('');
  loading = signal(false);
  messagesLoading = signal(false);

  // User search
  searchQuery = signal('');
  searchResults = signal<any[]>([]);
  searchLoading = signal(false);
  showSearchPanel = signal(false);

  // Typing
  typingUsers = signal<Map<number, TypingEvent>>(new Map());
  private typingTimeout: any = null;
  private lastTypingSent = 0;

  // Subscriptions
  private subs: Subscription[] = [];
  private chatSub: Subscription | null = null;
  private typingSub: Subscription | null = null;
  private searchSubject = new Subject<string>();
  private shouldScrollToBottom = false;

  // Mobile view
  showConversationList = signal(true);

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }

    // Load conversations
    this.loading.set(true);
    this.chatService.loadConversations();
    this.chatService.getConversations().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });

    // Setup search debounce
    this.subs.push(
      this.searchSubject
        .pipe(debounceTime(300), distinctUntilChanged())
        .subscribe((query) => {
          if (query.length < 2) {
            this.searchResults.set([]);
            this.searchLoading.set(false);
            return;
          }
          this.searchLoading.set(true);
          this.chatService.searchUsers(query).subscribe({
            next: (users) => {
              this.searchResults.set(users);
              this.searchLoading.set(false);
            },
            error: () => this.searchLoading.set(false),
          });
        })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.chatSub?.unsubscribe();
    this.typingSub?.unsubscribe();
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }

  // ──── Conversations ────

  selectConversation(conv: ConversationResponse): void {
    if (this.activeChatRoomId() === conv.chatRoomId) return;

    this.activeChatRoomId.set(conv.chatRoomId);
    this.activeConversation.set(conv);
    this.messages.set([]);
    this.typingUsers.set(new Map());
    this.showConversationList.set(false);

    // Unsubscribe previous
    this.chatSub?.unsubscribe();
    this.typingSub?.unsubscribe();

    // Load messages
    this.messagesLoading.set(true);
    this.chatService.getMessages(conv.chatRoomId).subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.messagesLoading.set(false);
        this.shouldScrollToBottom = true;
      },
      error: () => this.messagesLoading.set(false),
    });

    // Mark as seen
    this.chatService.markAsSeen(conv.chatRoomId).subscribe();
    this.chatService.clearUnreadCount(conv.chatRoomId);

    // Subscribe to new messages
    this.chatSub = this.chatService
      .subscribeToChatRoom(conv.chatRoomId)
      .subscribe((msg) => {
        const current = this.messages();
        // Avoid duplicates
        if (!current.find((m) => m.messageId === msg.messageId)) {
          this.messages.set([...current, msg]);
          this.shouldScrollToBottom = true;
        }

        // Mark as seen if this chat is active
        if (this.activeChatRoomId() === conv.chatRoomId) {
          this.chatService.markAsSeen(conv.chatRoomId).subscribe();
          this.chatService.clearUnreadCount(conv.chatRoomId);
        }

        // Update conversation list
        this.chatService.updateConversationWithNewMessage(msg);
      });

    // Subscribe to typing
    this.typingSub = this.chatService
      .subscribeToTyping(conv.chatRoomId)
      .subscribe((event) => {
        const userId = this.currentUser()?.id;
        if (event.userId === userId) return; // Ignore own typing

        const map = new Map(this.typingUsers());
        if (event.typing) {
          map.set(event.userId, event);
          // Auto-clear after 3 seconds
          setTimeout(() => {
            const m = new Map(this.typingUsers());
            m.delete(event.userId);
            this.typingUsers.set(m);
          }, 3000);
        } else {
          map.delete(event.userId);
        }
        this.typingUsers.set(map);
      });

    // Focus input
    setTimeout(() => this.messageInput?.nativeElement?.focus(), 100);
  }

  // ──── Send Message ────

  sendMessage(): void {
    const content = this.newMessage().trim();
    const chatRoomId = this.activeChatRoomId();
    if (!content || !chatRoomId) return;

    this.chatService.sendMessage(chatRoomId, content);
    this.newMessage.set('');

    // Stop typing indicator
    this.chatService.sendTyping(chatRoomId, false);
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onTyping(): void {
    const chatRoomId = this.activeChatRoomId();
    if (!chatRoomId) return;

    const now = Date.now();
    if (now - this.lastTypingSent > 2000) {
      this.chatService.sendTyping(chatRoomId, true);
      this.lastTypingSent = now;
    }

    // Clear previous timeout
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.sendTyping(chatRoomId, false);
    }, 2000);
  }

  // ──── User Search ────

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  toggleSearch(): void {
    this.showSearchPanel.set(!this.showSearchPanel());
    if (!this.showSearchPanel()) {
      this.searchQuery.set('');
      this.searchResults.set([]);
    }
  }

  startConversation(user: any): void {
    this.searchLoading.set(true);
    this.chatService.getOrCreateChatRoom(user.userId).subscribe({
      next: (room) => {
        this.showSearchPanel.set(false);
        this.searchQuery.set('');
        this.searchResults.set([]);

        // Reload conversations and select the new one
        this.chatService.getConversations().subscribe({
          next: (convos) => {
            this.chatService.conversations.set(convos);
            const conv = convos.find((c) => c.chatRoomId === room.chatRoomId);
            if (conv) {
              this.selectConversation(conv);
            }
            this.searchLoading.set(false);
          },
          error: () => this.searchLoading.set(false),
        });
      },
      error: () => this.searchLoading.set(false),
    });
  }

  // ──── Helpers ────

  isOwnMessage(msg: MessageResponse): boolean {
    return msg.senderId === this.currentUser()?.id;
  }

  isUserOnline(userId: number): boolean {
    return this.chatService.isUserOnline(userId);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  formatTime(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getTypingText(): string {
    const users = Array.from(this.typingUsers().values());
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0].username} is typing…`;
    return `${users.length} people are typing…`;
  }

  backToList(): void {
    this.showConversationList.set(true);
    this.activeChatRoomId.set(null);
    this.activeConversation.set(null);
  }

  trackByMessageId(_: number, msg: MessageResponse): number {
    return msg.messageId;
  }

  trackByConvId(_: number, conv: ConversationResponse): number {
    return conv.chatRoomId;
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch (_) {}
  }
}
