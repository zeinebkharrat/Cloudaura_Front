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
  effect,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ChatService } from '../chat.service';
import { AuthService } from '../../core/auth.service';
import { ConversationResponse, MessageResponse, TypingEvent } from '../chat.types';
import { Router } from '@angular/router';
import { AppAlertsService } from '../../core/services/app-alerts.service';
import { isBackendLoginRedirectError } from '../../api-error.util';

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
  private readonly alerts = inject(AppAlertsService);
  private readonly injector = inject(Injector);

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
  rawMessages = signal<MessageResponse[]>([]);
  newMessage = signal('');
  messagesLoading = signal(false);
  uploadingVoice = signal(false);
  isRecording = signal(false);
  recordingSeconds = signal(0);
  playingVoiceMessageId = signal<number | null>(null);
  deletingMessageId = signal<number | null>(null);
  openedMessageMenuId = signal<number | null>(null);

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
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private voiceChunks: BlobPart[] = [];
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly audioElements = new Map<number, HTMLAudioElement>();

  constructor() {
    effect(
      () => {
        const request = this.chatService.bubbleOpenRequest();
        if (!request) {
          return;
        }

        this.isOpen.set(true);
        this.openConversationWithUser(request.userId);
        this.chatService.clearBubbleOpenRequest();
      },
      { injector: this.injector, allowSignalWrites: true }
    );
  }

  ngOnInit() {
    this.chatService.ensureE2eeReadyForCurrentUser().catch((err) => {
      const httpError = err as HttpErrorResponse;
      if (httpError?.status === 401 || isBackendLoginRedirectError(httpError)) {
        return;
      }
      console.error('Failed to initialize E2EE keys:', err);
    });
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
    this.cleanupRecorder();
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
    this.rawMessages.set([]);
    this.typingUsers.set(new Map());

    // Unsubscribe previous
    this.chatSub?.unsubscribe();
    this.typingSub?.unsubscribe();

    // Load messages
    this.messagesLoading.set(true);
    this.chatService.getMessages(conv.chatRoomId).subscribe({
      next: async (msgs) => {
        this.rawMessages.set(msgs);
        await this.hydrateDisplayedMessagesFromRaw();
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

  async sendMessage(): Promise<void> {
    const content = this.newMessage().trim();
    const chatRoomId = this.activeChatRoomId();
    const receiverId = this.activeConversation()?.otherUserId;
    if (!content || !chatRoomId || !receiverId) return;

    await this.chatService.sendMessage(chatRoomId, receiverId, content);
    this.newMessage.set('');
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

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.sendTyping(chatRoomId, false);
    }, 2000);
  }

  isOwnMessage(msg: MessageResponse): boolean {
    return msg.senderId === this.currentUser()?.id;
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

  conversationPreview(conv: ConversationResponse): string {
    if (conv.unreadCount === 1) {
      return 'Sent you one message';
    }
    if (conv.unreadCount > 1) {
      return `Sent you ${conv.unreadCount} messages`;
    }
    return 'No new messages';
  }

  formatVoiceDuration(sec?: number | null): string {
    if (!sec || sec <= 0) {
      return '0:00';
    }
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
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

  private openConversationWithUser(targetUserId: number): void {
    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || targetUserId === this.currentUser()?.id) {
      return;
    }

    this.chatService.getConversations().subscribe({
      next: (convos) => {
        this.chatService.conversations.set(convos);
        const existing = convos.find((c) => c.otherUserId === targetUserId);
        if (existing) {
          this.selectConversation(existing);
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
              },
            });
          },
        });
      },
    });
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
