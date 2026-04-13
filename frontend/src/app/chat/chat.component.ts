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
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ChatService } from './chat.service';
import { AuthService } from '../core/auth.service';
import { AppAlertsService } from '../core/services/app-alerts.service';
import {
  ConversationResponse,
  MessageResponse,
  TypingEvent,
} from './chat.types';

interface StoryReplyPayload {
  kind: string;
  storyId: number;
  authorId: number;
  authorUsername: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  replyText: string;
  sentAt?: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly alerts = inject(AppAlertsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  // State
  readonly conversations = this.chatService.conversations;
  readonly connected = this.chatService.connected;
  readonly currentUser = this.authService.currentUser;

  activeChatRoomId = signal<number | null>(null);
  activeConversation = signal<ConversationResponse | null>(null);
  messages = signal<MessageResponse[]>([]);
  rawMessages = signal<MessageResponse[]>([]);
  messagesError = signal<string | null>(null);
  newMessage = signal('');
  loading = signal(false);
  messagesLoading = signal(false);
  uploadingVoice = signal(false);
  isRecording = signal(false);
  recordingSeconds = signal(0);
  deletingMessageId = signal<number | null>(null);
  openedMessageMenuId = signal<number | null>(null);

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
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private voiceChunks: BlobPart[] = [];
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly audioElements = new Map<number, HTMLAudioElement>();
  playingVoiceMessageId = signal<number | null>(null);

  // Mobile view
  showConversationList = signal(true);

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }

    // Load conversations
    this.loading.set(true);
    this.chatService.ensureE2eeReadyForCurrentUser().catch((err) => {
      console.error('Failed to initialize E2EE keys:', err);
    });
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

    this.subs.push(
      this.route.queryParamMap.subscribe((params) => {
        const raw = params.get('userId');
        if (!raw) {
          return;
        }

        const userId = Number(raw);
        if (!Number.isInteger(userId) || userId <= 0 || userId === this.currentUser()?.id) {
          return;
        }

        this.openConversationWithUser(userId);
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
    this.cleanupRecorder();
  }

  // ──── Conversations ────

  selectConversation(conv: ConversationResponse): void {
    if (this.activeChatRoomId() === conv.chatRoomId) return;

    this.activeChatRoomId.set(conv.chatRoomId);
    this.activeConversation.set(conv);
    this.messages.set([]);
    this.rawMessages.set([]);
    this.messagesError.set(null);
    this.typingUsers.set(new Map());
    this.showConversationList.set(false);

    // Unsubscribe previous
    this.chatSub?.unsubscribe();
    this.typingSub?.unsubscribe();

    // Load messages
    this.messagesLoading.set(true);
    this.chatService.getMessages(conv.chatRoomId).subscribe({
      next: async (msgs) => {
        this.rawMessages.set(msgs);
        await this.hydrateDisplayedMessagesFromRaw();
        this.messagesError.set(null);
        this.messagesLoading.set(false);
        this.shouldScrollToBottom = true;
      },
      error: (err) => {
        console.error('Failed to load chat history:', err);
        this.messagesError.set('Unable to load previous messages right now.');
        this.messagesLoading.set(false);
      },
    });

    // Mark as seen
    this.chatService.markAsSeen(conv.chatRoomId).subscribe();
    this.chatService.clearUnreadCount(conv.chatRoomId);

    // Subscribe to new messages
    this.chatSub = this.chatService
      .subscribeToChatRoom(conv.chatRoomId)
      .subscribe(async (msg) => {
        const currentRaw = this.rawMessages();
        // Avoid duplicates
        if (!currentRaw.find((m) => m.messageId === msg.messageId)) {
          this.rawMessages.set([...currentRaw, msg]);
          const decoded = await this.decodeMessage(msg);
          this.messages.set([...this.messages(), decoded]);
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

  async sendMessage(): Promise<void> {
    const content = this.newMessage().trim();
    const chatRoomId = this.activeChatRoomId();
    const receiverId = this.activeConversation()?.otherUserId;
    if (!content || !chatRoomId || !receiverId) return;

    await this.chatService.sendMessage(chatRoomId, receiverId, content);
    this.newMessage.set('');

    // Stop typing indicator
    this.chatService.sendTyping(chatRoomId, false);
  }

  toggleMessageMenu(messageId: number): void {
    this.openedMessageMenuId.update((current) =>
      current === messageId ? null : messageId
    );
  }

  async deleteOwnMessage(msg: MessageResponse): Promise<void> {
    const chatRoomId = this.activeChatRoomId();
    if (!chatRoomId || !msg?.messageId || !this.isOwnMessage(msg)) {
      return;
    }

    const confirm = await this.alerts.confirm({
      title: 'Delete this message?',
      text: 'This will permanently remove it for everyone in this conversation.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'warning',
    });

    if (!confirm.isConfirmed) {
      return;
    }

    this.openedMessageMenuId.set(null);
    this.deletingMessageId.set(msg.messageId);
    this.chatService.deleteOwnMessage(chatRoomId, msg.messageId).subscribe({
      next: () => {
        this.rawMessages.set(this.rawMessages().filter((m) => m.messageId !== msg.messageId));
        this.messages.set(this.messages().filter((m) => m.messageId !== msg.messageId));
        this.deletingMessageId.set(null);
      },
      error: (err) => {
        console.error('Failed to delete message:', err);
        this.deletingMessageId.set(null);
        this.alerts.error('Delete failed', 'Unable to delete this message. Please try again.');
      },
    });
  }

  async toggleVoiceRecording(): Promise<void> {
    if (this.isRecording()) {
      await this.stopVoiceRecording(true);
      return;
    }

    await this.startVoiceRecording();
  }

  async cancelVoiceRecording(): Promise<void> {
    await this.stopVoiceRecording(false);
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

  private openConversationWithUser(targetUserId: number): void {
    this.chatService.getConversations().subscribe({
      next: (convos) => {
        this.chatService.conversations.set(convos);
        const existing = convos.find((c) => c.otherUserId === targetUserId);
        if (existing) {
          this.selectConversation(existing);
          this.clearTargetUserParam();
          return;
        }

        this.chatService.getOrCreateChatRoom(targetUserId).subscribe({
          next: (room) => {
            this.chatService.getConversations().subscribe({
              next: (updatedConvos) => {
                this.chatService.conversations.set(updatedConvos);
                const created = updatedConvos.find(
                  (c) => c.chatRoomId === room.chatRoomId || c.otherUserId === targetUserId
                );
                if (created) {
                  this.selectConversation(created);
                }
                this.clearTargetUserParam();
              },
              error: () => this.clearTargetUserParam(),
            });
          },
          error: () => this.clearTargetUserParam(),
        });
      },
      error: () => this.clearTargetUserParam(),
    });
  }

  private clearTargetUserParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { userId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
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

    if (minutes < 1) return this.translate.instant('COMMUNITY.CHAT_TIME_JUST_NOW');
    if (minutes < 60) {
      return this.translate.instant('COMMUNITY.CHAT_TIME_MINUTES', { n: minutes });
    }
    if (hours < 24) {
      return this.translate.instant('COMMUNITY.CHAT_TIME_HOURS', { n: hours });
    }
    if (days < 7) {
      return this.translate.instant('COMMUNITY.CHAT_TIME_DAYS', { n: days });
    }
    const locale = this.chatDateLocale();
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }

  formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(this.chatDateLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  conversationPreview(conv: ConversationResponse): string {
    if (conv.unreadCount === 1) {
      return 'Sent you one message';
    }
    if (conv.unreadCount > 1) {
      return `Sent you ${conv.unreadCount} messages`;
    }
    return 'No new messages';
  }

  getTypingText(): string {
    const users = Array.from(this.typingUsers().values());
    if (users.length === 0) return '';
    if (users.length === 1) {
      return this.translate.instant('COMMUNITY.CHAT_TYPING_ONE', { name: users[0].username });
    }
    return this.translate.instant('COMMUNITY.CHAT_TYPING_MANY', { count: users.length });
  }

  private chatDateLocale(): string {
    const lang = (this.translate.currentLang || 'en').toLowerCase();
    if (lang.startsWith('ar')) return 'ar';
    if (lang.startsWith('fr')) return 'fr-FR';
    return 'en-GB';
  }

  isVoiceMessage(msg: MessageResponse): boolean {
    return !!msg.voiceUrl || msg.messageType === 'VOICE';
  }

  registerVoiceAudio(messageId: number, event: Event): void {
    const audio = event.target as HTMLAudioElement;
    this.audioElements.set(messageId, audio);
    audio.onended = () => {
      if (this.playingVoiceMessageId() === messageId) {
        this.playingVoiceMessageId.set(null);
      }
    };
  }

  toggleVoicePlayback(messageId: number): void {
    const currentPlaying = this.playingVoiceMessageId();
    if (currentPlaying != null && currentPlaying !== messageId) {
      const prev = this.audioElements.get(currentPlaying);
      prev?.pause();
    }

    const audio = this.audioElements.get(messageId);
    if (!audio) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
      this.playingVoiceMessageId.set(null);
      return;
    }

    audio.play().then(() => {
      this.playingVoiceMessageId.set(messageId);
    }).catch(() => {
      this.playingVoiceMessageId.set(null);
    });
  }

  formatVoiceDuration(sec?: number | null): string {
    if (!sec || sec <= 0) {
      return '';
    }
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  isVoiceMessage(msg: MessageResponse): boolean {
    return !!msg.voiceUrl || msg.messageType === 'VOICE';
  }

  isStoryReplyMessage(msg: MessageResponse): boolean {
    return this.parseStoryReply(msg.content) != null;
  }

  storyReply(msg: MessageResponse): StoryReplyPayload | null {
    return this.parseStoryReply(msg.content);
  }

  storyReplyMediaUrl(msg: MessageResponse): string {
    const parsed = this.parseStoryReply(msg.content);
    const raw = (parsed?.mediaUrl || '').trim();
    if (!raw) {
      return '';
    }
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
      return raw;
    }
    if (raw.startsWith('uploads/')) {
      return `/${raw}`;
    }
    return `/${raw.replace(/^\/+/, '')}`;
  }

  registerVoiceAudio(messageId: number, event: Event): void {
    const audio = event.target as HTMLAudioElement;
    this.audioElements.set(messageId, audio);
    audio.onended = () => {
      if (this.playingVoiceMessageId() === messageId) {
        this.playingVoiceMessageId.set(null);
      }
    };
  }

  toggleVoicePlayback(messageId: number): void {
    const currentPlaying = this.playingVoiceMessageId();
    if (currentPlaying != null && currentPlaying !== messageId) {
      const prev = this.audioElements.get(currentPlaying);
      prev?.pause();
    }

    const audio = this.audioElements.get(messageId);
    if (!audio) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
      this.playingVoiceMessageId.set(null);
      return;
    }

    audio.play().then(() => {
      this.playingVoiceMessageId.set(messageId);
    }).catch(() => {
      this.playingVoiceMessageId.set(null);
    });
  }

  formatVoiceDuration(sec?: number | null): string {
    if (!sec || sec <= 0) {
      return '';
    }
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
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

  private async startVoiceRecording(): Promise<void> {
    const chatRoomId = this.activeChatRoomId();
    if (!chatRoomId || this.uploadingVoice()) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Voice recording is not supported on this browser.');
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = this.resolveRecordingMimeType();
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.voiceChunks = [];
      this.recordingSeconds.set(0);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.voiceChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingTimer = setInterval(() => {
        this.recordingSeconds.update((v) => v + 1);
      }, 1000);
    } catch (error) {
      console.error('Could not start recording:', error);
      this.cleanupRecorder();
    }
  }

  private async stopVoiceRecording(send: boolean): Promise<void> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.cleanupRecorder();
      return;
    }

    const recorder = this.mediaRecorder;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const duration = this.recordingSeconds();
    const blobType = recorder.mimeType || 'audio/webm';
    const blob = new Blob(this.voiceChunks, { type: blobType });

    this.cleanupRecorder();

    if (!send || blob.size === 0) {
      return;
    }

    const chatRoomId = this.activeChatRoomId();
    if (!chatRoomId) {
      return;
    }

    const extension = blobType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blobType });

    this.uploadingVoice.set(true);
    this.chatService.sendVoiceMessage(chatRoomId, file, duration).subscribe({
      next: (msg) => {
        const current = this.messages();
        if (!current.find((m) => m.messageId === msg.messageId)) {
          this.messages.set([...current, msg]);
          this.shouldScrollToBottom = true;
        }
        this.chatService.updateConversationWithNewMessage(msg);
        this.uploadingVoice.set(false);
      },
      error: (err) => {
        console.error('Failed to send voice message:', err);
        this.uploadingVoice.set(false);
      },
    });
  }

  private cleanupRecorder(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
    this.voiceChunks = [];
    this.isRecording.set(false);
    this.recordingSeconds.set(0);
  }

  private resolveRecordingMimeType(): string | null {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  }

  private async hydrateDisplayedMessagesFromRaw(): Promise<void> {
    const decoded = await Promise.all(this.rawMessages().map((msg) => this.decodeMessage(msg)));
    this.messages.set(decoded);
  }

  private async decodeMessage(msg: MessageResponse): Promise<MessageResponse> {
    if (this.isVoiceMessage(msg)) {
      return msg;
    }

    const plain = await this.chatService.decryptMessageContent(msg);
    return { ...msg, content: plain };
  }

  private parseStoryReply(content?: string | null): StoryReplyPayload | null {
    const text = (content || '').trim();
    const prefix = 'YALLA_STORY_REPLY::';
    if (!text.startsWith(prefix)) {
      return null;
    }

    try {
      const parsed = JSON.parse(text.slice(prefix.length)) as Partial<StoryReplyPayload>;
      if (parsed.kind !== 'story-reply' || typeof parsed.replyText !== 'string') {
        return null;
      }
      return {
        kind: 'story-reply',
        storyId: Number(parsed.storyId || 0),
        authorId: Number(parsed.authorId || 0),
        authorUsername: (parsed.authorUsername || '').toString(),
        mediaUrl: (parsed.mediaUrl || '').toString(),
        mediaType: (parsed.mediaType || 'IMAGE').toString(),
        caption: (parsed.caption || '').toString(),
        replyText: parsed.replyText,
        sentAt: parsed.sentAt ? String(parsed.sentAt) : undefined,
      };
    } catch {
      return null;
    }
  }
}
