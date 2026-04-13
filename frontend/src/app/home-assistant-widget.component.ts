import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface AssistantMessage {
  role: 'assistant' | 'user';
  text: string;
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

@Component({
  selector: 'app-home-assistant-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-assistant-widget.component.html',
  styleUrl: './home-assistant-widget.component.css',
})
export class HomeAssistantWidgetComponent {
  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly quickPrompts = [
    'Meilleur restaurant a Tunis',
    'Transport entre Sousse et Tunis',
    'Evenements disponibles ce mois',
    'Produits d artisanat disponibles',
  ];
  readonly messages = signal<AssistantMessage[]>([
    {
      role: 'assistant',
      text: 'Salam. I am your AI guide. Ask me about transport, accommodations, restaurants, activities, events, artisan products, and any app feature.',
    },
  ]);

  draft = '';

  constructor(private readonly http: HttpClient) {}

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

    this.http.post<ChatbotQueryResponse>('/api/public/chatbot/query', payload).subscribe({
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
}
