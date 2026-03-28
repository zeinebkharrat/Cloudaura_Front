import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from '../auth.service';
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
  private readonly baseUrl = '/api';

  private stompClient: Client | null = null;
  private subscriptions: Map<string, any> = new Map();

  // Reactive state
  readonly conversations = signal<ConversationResponse[]>([]);
  readonly onlineUsers = signal<Set<number>>(new Set());
  readonly connected = signal(false);

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
      webSocketFactory: () => new SockJS(`${this.getWsBaseUrl()}/ws`),
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
      },

      onDisconnect: () => {
        this.connected.set(false);
        console.log('ChatService: WebSocket disconnected');
      },

      onStompError: (frame) => {
        console.error('ChatService: STOMP error', frame);
        this.connected.set(false);
      },
    });

    this.stompClient.activate();
  }

  disconnect(): void {
    if (this.stompClient?.active) {
      // Unsubscribe all
      this.subscriptions.forEach((sub) => sub.unsubscribe());
      this.subscriptions.clear();

      this.stompClient.deactivate();
      this.stompClient = null;
      this.connected.set(false);
    }
  }

  sendMessage(chatRoomId: number, content: string): void {
    if (!this.stompClient?.active) {
      console.warn('ChatService: WebSocket not connected, cannot send message');
      return;
    }

    const request: SendMessageRequest = { chatRoomId, content };

    this.stompClient.publish({
      destination: '/app/send-message',
      body: JSON.stringify(request),
    });
  }

  sendTyping(chatRoomId: number, typing: boolean): void {
    if (!this.stompClient?.active) {
      return;
    }

    const event: TypingEvent = {
      chatRoomId,
      userId: 0, // Server will override with authenticated user
      username: '',
      typing,
    };

    this.stompClient.publish({
      destination: '/app/typing',
      body: JSON.stringify(event),
    });
  }

  subscribeToChatRoom(chatRoomId: number): Observable<MessageResponse> {
    return new Observable<MessageResponse>((observer) => {
      const destination = `/topic/chat/${chatRoomId}`;

      if (!this.stompClient?.active) {
        console.warn('ChatService: WebSocket not connected, cannot subscribe');
        return;
      }

      // Avoid duplicate subscriptions
      if (this.subscriptions.has(destination)) {
        this.subscriptions.get(destination).unsubscribe();
      }

      const sub = this.stompClient.subscribe(destination, (message: IMessage) => {
        const msg: MessageResponse = JSON.parse(message.body);
        observer.next(msg);
      });

      this.subscriptions.set(destination, sub);

      // Cleanup on unsubscribe
      return () => {
        sub.unsubscribe();
        this.subscriptions.delete(destination);
      };
    });
  }

  subscribeToTyping(chatRoomId: number): Observable<TypingEvent> {
    return new Observable<TypingEvent>((observer) => {
      const destination = `/topic/chat/${chatRoomId}/typing`;

      if (!this.stompClient?.active) {
        return;
      }

      if (this.subscriptions.has(destination)) {
        this.subscriptions.get(destination).unsubscribe();
      }

      const sub = this.stompClient.subscribe(destination, (message: IMessage) => {
        const event: TypingEvent = JSON.parse(message.body);
        observer.next(event);
      });

      this.subscriptions.set(destination, sub);

      return () => {
        sub.unsubscribe();
        this.subscriptions.delete(destination);
      };
    });
  }

  // ──────────────────────────────────────────────
  // User Status
  // ──────────────────────────────────────────────

  private subscribeToUserStatus(): void {
    if (!this.stompClient?.active) {
      return;
    }

    const destination = '/topic/user-status';

    if (this.subscriptions.has(destination)) {
      return; // Already subscribed
    }

    const sub = this.stompClient.subscribe(destination, (message: IMessage) => {
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
        lastMessage: msg.content,
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

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private getWsBaseUrl(): string {
    // In development, proxy handles /api but WebSocket needs the actual server URL
    // If running behind Angular proxy, the ws endpoint is at the backend directly
    const loc = window.location;
    if (loc.hostname === 'localhost' && loc.port === '4200') {
      return 'http://localhost:8081';
    }
    return `${loc.protocol}//${loc.host}`;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
