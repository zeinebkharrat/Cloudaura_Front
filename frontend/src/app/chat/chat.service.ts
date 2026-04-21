import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Client, IFrame, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from '../core/auth.service';
import { ChatE2eeService, ReceiverHasNoE2eeKeyError } from './chat-e2ee.service';
import {
  ChatRoomResponse,
  ConversationResponse,
  MessageResponse,
  SendMessageRequest,
  TypingEvent,
  UserStatusEvent,
} from './chat.types';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly e2eeService = inject(ChatE2eeService);
  private readonly baseUrl = '';

  private stompClient: Client | null = null;
  private subscriptions: Map<string, any> = new Map();
  private pendingPublishes: Array<() => void> = [];
  private pendingOnReady: Array<() => void> = [];

  // Reactive state
  readonly conversations = signal<ConversationResponse[]>([]);
  readonly onlineUsers = signal<Set<number>>(new Set());
  readonly connected = signal(false);
  readonly bubbleOpenRequest = signal<{ userId: number; requestId: number } | null>(null);
  private bubbleRequestSeq = 0;

  // ──────────────────────────────────────────────
  // HTTP Methods
  // ──────────────────────────────────────────────

  getConversations(): Observable<ConversationResponse[]> {
    return this.http.get<ConversationResponse[]>(`${this.baseUrl}/chatroom/my`);
  }

  getOrCreateChatRoom(targetUserId: number): Observable<ChatRoomResponse> {
    return this.http.post<ChatRoomResponse>(
      `${this.baseUrl}/chatroom/dm/${targetUserId}`,
      {}
    );
  }

  searchUsers(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/chatroom/users/search`, {
      params: { q: query },
    });
  }

  getMessages(chatRoomId: number): Observable<MessageResponse[]> {
    return this.http.get<MessageResponse[]>(
      `${this.baseUrl}/chatroom/${chatRoomId}/messages`
    );
  }

  deleteOwnMessage(chatRoomId: number, messageId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/chatroom/${chatRoomId}/messages/${messageId}`
    );
  }

  sendVoiceMessage(chatRoomId: number, file: File, durationSec?: number): Observable<MessageResponse> {
    const formData = new FormData();
    formData.set('file', file);
    if (durationSec != null && Number.isFinite(durationSec) && durationSec > 0) {
      formData.set('durationSec', String(Math.floor(durationSec)));
    }

    return this.http.post<MessageResponse>(
      `${this.baseUrl}/chatroom/${chatRoomId}/voice`,
      formData
    );
  }

  markAsSeen(chatRoomId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/chatroom/${chatRoomId}/seen`, {});
  }

  // ──────────────────────────────────────────────
  // WebSocket Methods
  // ──────────────────────────────────────────────

  connect(): void {
    if (this.stompClient?.active) {
      return; // Already connected
    }

    const token = this.authService.token();
    if (!token) {
      console.warn('ChatService: No auth token available, cannot connect WebSocket');
      return;
    }

    this.stompClient = new Client({
      // Backend exposes STOMP endpoint at /ws with SockJS.
      webSocketFactory: () => new SockJS('/ws'),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        this.connected.set(true);
        console.log('ChatService: WebSocket connected');

        // Subscribe to user status updates
        this.subscribeToUserStatus();

        // Ensure queued subscriptions are attached before flushing queued sends.
        const onReadyTasks = [...this.pendingOnReady];
        this.pendingOnReady = [];
        onReadyTasks.forEach((task) => {
          try {
            task();
          } catch (err) {
            console.error('ChatService: failed to run queued on-ready task', err);
          }
        });

        // Flush queued publish operations captured while socket was connecting.
        const queued = [...this.pendingPublishes];
        this.pendingPublishes = [];
        queued.forEach((publish) => {
          try {
            publish();
          } catch (err) {
            console.error('ChatService: failed to flush queued publish', err);
          }
        });
      },

      onDisconnect: () => {
        this.connected.set(false);
        console.log('ChatService: WebSocket disconnected');
      },

      onStompError: (frame: IFrame) => {
        console.error('ChatService: STOMP error', frame);
        this.connected.set(false);
      },
    });

    this.stompClient.activate();
  }

  disconnect(): void {
    if (this.stompClient) {
      // Unsubscribe all
      this.subscriptions.forEach((sub) => sub.unsubscribe());
      this.subscriptions.clear();
      this.pendingPublishes = [];
      this.pendingOnReady = [];

      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected.set(false);
    }
  }

  async sendMessage(chatRoomId: number, receiverId: number, plainText: string): Promise<void> {
    const token = this.authService.token();
    const senderId = this.authService.currentUser()?.id;
    if (!senderId) {
      throw new Error('Cannot send encrypted message without authenticated sender');
    }

    let request: SendMessageRequest;
    try {
      const encrypted = await this.e2eeService.encryptTextForParticipants(senderId, receiverId, plainText);
      request = {
        chatRoomId,
        receiverId,
        encryptedMessage: encrypted.encryptedMessage,
        encryptedKey: encrypted.encryptedKey,
        iv: encrypted.iv,
      };
    } catch (e: unknown) {
      const noKey =
        e instanceof ReceiverHasNoE2eeKeyError ||
        (typeof e === 'object' &&
          e !== null &&
          (e as { name?: string }).name === 'ReceiverHasNoE2eeKeyError');
      if (noKey) {
        console.warn(
          'Chat: receiver has no E2EE public key — sending plaintext until they log in and keys are registered.',
        );
        request = {
          chatRoomId,
          receiverId,
          content: plainText,
        };
      } else {
        throw e;
      }
    }

    const publish = () =>
      this.stompClient?.publish({
        destination: '/app/send-message',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(request),
      });

    if (!this.isStompReady()) {
      this.pendingPublishes.push(publish);
      this.connect();
      return;
    }

    publish();
  }

  async ensureE2eeReadyForCurrentUser(): Promise<void> {
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return;
    }
    await this.e2eeService.ensureKeyPairReady(userId);
  }

  async decryptMessageContent(msg: MessageResponse): Promise<string> {
    const userId = this.authService.currentUser()?.id ?? null;
    return this.e2eeService.decryptTextMessage(msg, userId);
  }

  sendTyping(chatRoomId: number, typing: boolean): void {
    const token = this.authService.token();
    const event: TypingEvent = {
      chatRoomId,
      userId: 0, // Server will override with authenticated user
      username: '',
      typing,
    };

    const publish = () =>
      this.stompClient?.publish({
        destination: '/app/typing',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(event),
      });

    // Don't queue every typing event; only send when socket is ready.
    if (!this.isStompReady()) {
      this.connect();
      return;
    }

    publish();
  }

  subscribeToChatRoom(chatRoomId: number): Observable<MessageResponse> {
    return new Observable<MessageResponse>((observer) => {
      const destination = `/topic/chat/${chatRoomId}`;
      let sub: any = null;
      let cancelled = false;

      const bind = () => {
        if (cancelled || !this.isStompReady()) {
          return;
        }

        if (this.subscriptions.has(destination)) {
          this.subscriptions.get(destination).unsubscribe();
        }

        sub = this.stompClient!.subscribe(destination, (message: IMessage) => {
          const msg: MessageResponse = JSON.parse(message.body);
          observer.next(msg);
        });

        this.subscriptions.set(destination, sub);
      };

      this.ensureConnected(bind);

      return () => {
        cancelled = true;
        if (sub) {
          sub.unsubscribe();
        }
        this.subscriptions.delete(destination);
      };
    });
  }

  subscribeToTyping(chatRoomId: number): Observable<TypingEvent> {
    return new Observable<TypingEvent>((observer) => {
      const destination = `/topic/chat/${chatRoomId}/typing`;
      let sub: any = null;
      let cancelled = false;

      const bind = () => {
        if (cancelled || !this.isStompReady()) {
          return;
        }

        if (this.subscriptions.has(destination)) {
          this.subscriptions.get(destination).unsubscribe();
        }

        sub = this.stompClient!.subscribe(destination, (message: IMessage) => {
          const event: TypingEvent = JSON.parse(message.body);
          observer.next(event);
        });

        this.subscriptions.set(destination, sub);
      };

      this.ensureConnected(bind);

      return () => {
        cancelled = true;
        if (sub) {
          sub.unsubscribe();
        }
        this.subscriptions.delete(destination);
      };
    });
  }

  // ──────────────────────────────────────────────
  // User Status
  // ──────────────────────────────────────────────

  private subscribeToUserStatus(): void {
    if (!this.isStompReady()) {
      return;
    }

    const destination = '/topic/user-status';

    if (this.subscriptions.has(destination)) {
      return; // Already subscribed
    }

    const sub = this.stompClient!.subscribe(destination, (message: IMessage) => {
      const event: UserStatusEvent = JSON.parse(message.body);
      const current = new Set(this.onlineUsers());

      if (event.online) {
        current.add(event.userId);
      } else {
        current.delete(event.userId);
      }

      this.onlineUsers.set(current);
    });

    this.subscriptions.set(destination, sub);
  }

  private isStompReady(): boolean {
    return !!this.stompClient && this.stompClient.active && this.stompClient.connected;
  }

  private ensureConnected(onReady: () => void): void {
    if (this.isStompReady()) {
      onReady();
      return;
    }

    this.pendingOnReady.push(onReady);
    this.connect();
  }

  isUserOnline(userId: number): boolean {
    return this.onlineUsers().has(userId);
  }

  // ──────────────────────────────────────────────
  // Conversation helpers
  // ──────────────────────────────────────────────

  loadConversations(): void {
    this.getConversations().subscribe({
      next: (convos) => this.conversations.set(convos),
      error: (err) => console.error('ChatService: Failed to load conversations', err),
    });
  }

  updateConversationWithNewMessage(msg: MessageResponse): void {
    const current = [...this.conversations()];
    const idx = current.findIndex((c) => c.chatRoomId === msg.chatRoomId);

    if (idx >= 0) {
      const conv = current[idx];
      current[idx] = {
        ...conv,
        lastMessage: this.previewText(msg),
        lastMessageTime: msg.sentAt,
        unreadCount: conv.unreadCount + 1,
      };
      // Move to top
      const updated = current.splice(idx, 1)[0];
      current.unshift(updated);
      this.conversations.set(current);
    } else {
      // New conversation — reload from server
      this.loadConversations();
    }
  }

  clearUnreadCount(chatRoomId: number): void {
    const current = [...this.conversations()];
    const idx = current.findIndex((c) => c.chatRoomId === chatRoomId);

    if (idx >= 0) {
      current[idx] = { ...current[idx], unreadCount: 0 };
      this.conversations.set(current);
    }
  }

  requestOpenBubbleForUser(userId: number): void {
    if (!Number.isInteger(userId) || userId <= 0) {
      return;
    }
    this.bubbleOpenRequest.set({ userId, requestId: ++this.bubbleRequestSeq });
  }

  clearBubbleOpenRequest(): void {
    this.bubbleOpenRequest.set(null);
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  ngOnDestroy(): void {
    this.disconnect();
  }

  private previewText(msg: MessageResponse): string {
    if (msg.messageType === 'VOICE') {
      return 'Voice message';
    }
    if ((msg.content || '').startsWith('YALLA_STORY_REPLY::')) {
      return 'Replied to your story';
    }
    if (this.e2eeService.isEncryptedTextPayload(msg.content)) {
      return 'Encrypted message';
    }
    return msg.content;
  }
}
