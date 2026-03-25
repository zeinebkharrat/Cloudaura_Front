import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LudificationService, Quiz, QuizQuestion } from '../core/ludification.service';

@Component({
  selector: 'app-quiz-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-player.component.html',
  styleUrl: './quiz-player.component.css'
})
export class QuizPlayerComponent implements OnInit {
  quiz = signal<Quiz | null>(null);
  currentQuestion = signal<number>(0);
  score = signal<number>(0);
  isFinished = signal<boolean>(false);
  questions = signal<Array<{ text: string; options: string[]; correct: number }>>([]);
  isLoading = signal<boolean>(true);
  loadError = signal<string | null>(null);

  selectedOption = signal<number | null>(null);

  constructor(private route: ActivatedRoute, private api: LudificationService, private router: Router) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const numericId = Number(id);
      this.api.getQuizById(numericId).subscribe({
        next: (found) => {
          this.quiz.set(found);
          this.questions.set(this.mapQuestions(found.questions ?? []));
          if (this.questions().length === 0) {
            this.loadError.set('Ce quiz ne contient pas de questions valides.');
          } else {
            this.loadError.set(null);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.quiz.set(null);
          this.questions.set([]);
          this.loadError.set('Erreur de chargement du quiz.');
          this.isLoading.set(false);
        }
      });
    } else {
      this.quiz.set(null);
      this.questions.set([]);
      this.loadError.set('Identifiant de quiz invalide.');
      this.isLoading.set(false);
    }
  }

  selectOption(idx: number) {
    if (this.selectedOption() !== null) return; // Prevent multiple clicks
    if (!this.questions().length) return;
    this.selectedOption.set(idx);
    
    if (idx === this.questions()[this.currentQuestion()].correct) {
      this.score.update(s => s + 1);
    }

    setTimeout(() => {
      if (this.currentQuestion() < this.questions().length - 1) {
        this.currentQuestion.update(c => c + 1);
        this.selectedOption.set(null);
      } else {
        this.isFinished.set(true);
      }
    }, 1200);
  }

  backToHub() {
    this.router.navigate(['/games']);
  }

  private mapQuestions(raw: QuizQuestion[]): Array<{ text: string; options: string[]; correct: number }> {
    return [...raw]
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((question) => {
        let options: string[] = [];
        try {
          const parsed = JSON.parse(question.optionsJson || '[]');
          options = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
        } catch {
          options = [];
        }
        return {
          text: String(question.questionText ?? ''),
          options,
          correct: question.correctOptionIndex ?? 0,
        };
      })
      .filter((question) => question.text.trim().length > 0 && question.options.length > 0);
  }
}
