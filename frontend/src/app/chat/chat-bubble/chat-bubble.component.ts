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
import { Subscription } from 'rxjs';
import { ChatService } from '../chat.service';
import { AuthService } from '../../auth.service';
import { ConversationResponse, MessageResponse, TypingEvent } from '../chat.types';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-bubble.component.html',
  styleUrl: './chat-bubble.component.css',
})
export class ChatBubbleComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  // View state
  isOpen = signal(false);
  activeChatRoomId = signal<number | null>(null);
  activeConversation = signal<ConversationResponse | null>(null);

  // Chat data
  readonly conversations = this.chatService.conversations;
  readonly currentUser = this.authService.currentUser;
  
  messages = signal<MessageResponse[]>([]);
  newMessage = signal('');
  messagesLoading = signal(false);

  // Computed
  unreadTotal = computed(() => {
    return this.conversations().reduce((sum, conv) => sum + conv.unreadCount, 0);
  });

  // Typing
  typingUsers = signal<Map<number, TypingEvent>>(new Map());
  private typingTimeout: any = null;
  private lastTypingSent = 0;

  private chatSub: Subscription | null = null;
  private typingSub: Subscription | null = null;
  private shouldScrollToBottom = false;

  ngOnInit() {
     // Intentionally empty. Connection logic moved to appComponent
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.chatSub?.unsubscribe();
    this.typingSub?.unsubscribe();
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }

  toggleBubble() {
    this.isOpen.update((v) => !v);
    if (!this.isOpen()) {
       this.backToList();
    }
  }

  selectConversation(conv: ConversationResponse): void {
    if (this.activeChatRoomId() === conv.chatRoomId) return;

    this.activeChatRoomId.set(conv.chatRoomId);
    this.activeConversation.set(conv);
    this.messages.set([]);
    this.typingUsers.set(new Map());

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

    setTimeout(() => this.messageInput?.nativeElement?.focus(), 100);
  }

  sendMessage(): void {
    const content = this.newMessage().trim();
    const chatRoomId = this.activeChatRoomId();
    if (!content || !chatRoomId) return;

    this.chatService.sendMessage(chatRoomId, content);
    this.newMessage.set('');
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

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.sendTyping(chatRoomId, false);
    }, 2000);
  }

  isOwnMessage(msg: MessageResponse): boolean {
    return msg.senderId === this.currentUser()?.id;
  }

  isUserOnline(userId: number): boolean {
    return this.chatService.isUserOnline(userId);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2);
  }

  getTypingText(): string {
    const users = Array.from(this.typingUsers().values());
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0].username} écrit...`;
    return `Plusieurs écrivent...`;
  }

  formatMessageTime(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  backToList(): void {
    this.activeChatRoomId.set(null);
    this.activeConversation.set(null);
    this.messages.set([]);
    this.chatSub?.unsubscribe();
    this.typingSub?.unsubscribe();
  }

  openFullChat() {
    this.isOpen.set(false); // Close bubble
    this.router.navigate(['/chat']);
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
