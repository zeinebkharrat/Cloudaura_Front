import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from './core/auth.service';

interface AssistantMessage {
  role: 'assistant' | 'user';
  text: string;
}

interface MessagePart {
  kind: 'text' | 'link';
  value: string;
  href?: string;
}

interface ChatbotQueryResponse {
  answer: string;
  outOfScope: boolean;
  sources: string[];
  confidence: number;
}

interface ChatbotQueryRequest {
  question: string;
  conversation: string[];
}

interface ChatbotConversationResponse {
  conversation: string[];
}

@Component({
  selector: 'app-home-assistant-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-assistant-widget.component.html',
  styleUrl: './home-assistant-widget.component.css',
})
export class HomeAssistantWidgetComponent {
  private static readonly URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;
  private static readonly CLIENT_SESSION_STORAGE_KEY = 'assistant_chat_session_id';
  private static readonly WELCOME_MESSAGE = 'Salam! Welcome to YallaTN, your AI guide for exploring Tunisia. Ask me anything about transport, accommodations, restaurants, activities, events, and artisan products!';

  private readonly authService = inject(AuthService);
  private previousAuthToken: string | null = null;
  private clientSessionId = '';

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly quickPrompts = [
    'Meilleur restaurant a Tunis',
    'Transport entre Sousse et Tunis',
    'Evenements disponibles ce mois',
    'Produits d artisanat disponibles',
  ];
  readonly messages = signal<AssistantMessage[]>([
    this.buildWelcomeMessage(),
  ]);

  draft = '';

  constructor(private readonly http: HttpClient) {
    this.previousAuthToken = this.authService.token();
    this.clientSessionId = this.readOrCreateClientSessionId();
    this.loadConversationHistory();

    effect(() => {
      const currentToken = this.authService.token();
      if (currentToken === this.previousAuthToken) {
        return;
      }

      this.previousAuthToken = currentToken;
      this.rotateClientSessionId();
      this.messages.set([this.buildWelcomeMessage()]);
      this.loadConversationHistory();
    });
  }

  togglePanel(): void {
    this.isOpen.update((open) => !open);
  }

  sendQuestion(): void {
    const question = this.draft.trim();
    if (!question || this.loading()) {
      return;
    }

    this.messages.update((current) => [...current, { role: 'user', text: question }]);
    this.draft = '';
    this.loading.set(true);

    const conversation = this.messages()
      .slice(-10)
      .map((message) => `${message.role}: ${message.text}`);

    const payload: ChatbotQueryRequest = {
      question,
      conversation,
    };

    this.http.post<ChatbotQueryResponse>('/api/public/chatbot/query', payload, { headers: this.chatHeaders() }).subscribe({
      next: (response) => {
        this.loading.set(false);
        const answer = (response?.answer || 'Je peux repondre uniquement aux questions liees a la Tunisie et a cette application.').trim();
        this.messages.update((current) => [...current, { role: 'assistant', text: answer }]);
      },
      error: () => {
        this.loading.set(false);
        this.messages.update((current) => [
          ...current,
          {
            role: 'assistant',
            text: 'Le guide IA est temporairement indisponible. Reessayez dans quelques secondes.',
          },
        ]);
      },
    });
  }

  sendQuickPrompt(prompt: string): void {
    if (this.loading()) {
      return;
    }
    this.draft = prompt;
    this.sendQuestion();
  }

  messageParts(text: string): MessagePart[] {
    if (!text) {
      return [];
    }

    const parts: MessagePart[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(HomeAssistantWidgetComponent.URL_REGEX);

    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const urlIndex = match.index;

      if (urlIndex > lastIndex) {
        parts.push({
          kind: 'text',
          value: text.slice(lastIndex, urlIndex),
        });
      }

      const normalized = this.trimTrailingPunctuation(fullMatch);
      const trailing = fullMatch.slice(normalized.length);

      parts.push({
        kind: 'link',
        value: this.linkLabel(text),
        href: normalized,
      });

      if (trailing) {
        parts.push({
          kind: 'text',
          value: trailing,
        });
      }

      lastIndex = urlIndex + fullMatch.length;
    }

    if (lastIndex < text.length) {
      parts.push({
        kind: 'text',
        value: text.slice(lastIndex),
      });
    }

    return parts;
  }

  private trimTrailingPunctuation(value: string): string {
    return value.replace(/[),.;!?]+$/g, '');
  }

  private linkLabel(messageText: string): string {
    if (/[\u0600-\u06FF]/.test(messageText || '')) {
      return 'هذا الرابط';
    }

    const text = (messageText || '').toLowerCase();
    if (
      text.includes(' use this link')
      || text.includes(' here is this link')
      || text.includes(' book')
      || text.includes(' booking')
      || text.includes(' reserve')
    ) {
      return 'this link';
    }

    return 'le lien';
  }

  private loadConversationHistory(): void {
    this.http.get<ChatbotConversationResponse>('/api/public/chatbot/history', { headers: this.chatHeaders() }).subscribe({
      next: (response) => {
        const restored = this.deserializeConversation(response?.conversation ?? []);
        this.messages.set(restored.length > 0 ? restored : [this.buildWelcomeMessage()]);
      },
      error: () => {
        this.messages.set([this.buildWelcomeMessage()]);
      },
    });
  }

  private deserializeConversation(lines: string[]): AssistantMessage[] {
    if (!Array.isArray(lines) || lines.length === 0) {
      return [];
    }

    const parsed = lines
      .map((line) => this.parseConversationLine(line))
      .filter((message): message is AssistantMessage => message !== null);

    return parsed.slice(-24);
  }

  private parseConversationLine(line: string): AssistantMessage | null {
    if (typeof line !== 'string') {
      return null;
    }

    const normalized = line.trim();
    if (!normalized) {
      return null;
    }

    const separatorIndex = normalized.indexOf(':');
    if (separatorIndex <= 0) {
      return { role: 'assistant', text: normalized };
    }

    const roleToken = normalized.slice(0, separatorIndex).trim().toLowerCase();
    const text = normalized.slice(separatorIndex + 1).trim();
    if (!text) {
      return null;
    }

    if (roleToken === 'user' || roleToken === 'assistant') {
      return {
        role: roleToken,
        text,
      };
    }

    return { role: 'assistant', text: normalized };
  }

  private buildWelcomeMessage(): AssistantMessage {
    return {
      role: 'assistant',
      text: HomeAssistantWidgetComponent.WELCOME_MESSAGE,
    };
  }

  private chatHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-Chat-Session-Id': this.clientSessionId,
    });
  }

  private readOrCreateClientSessionId(): string {
    const existing = localStorage.getItem(HomeAssistantWidgetComponent.CLIENT_SESSION_STORAGE_KEY);
    if (this.isValidClientSessionId(existing)) {
      return existing;
    }

    const generated = this.generateClientSessionId();
    localStorage.setItem(HomeAssistantWidgetComponent.CLIENT_SESSION_STORAGE_KEY, generated);
    return generated;
  }

  private rotateClientSessionId(): void {
    this.clientSessionId = this.generateClientSessionId();
    localStorage.setItem(HomeAssistantWidgetComponent.CLIENT_SESSION_STORAGE_KEY, this.clientSessionId);
  }

  private generateClientSessionId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  private isValidClientSessionId(value: string | null): value is string {
    return !!value && /^[A-Za-z0-9._-]{8,128}$/.test(value);
  }
}
