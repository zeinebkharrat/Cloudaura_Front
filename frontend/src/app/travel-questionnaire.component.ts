import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './core/auth.service';
import { markQuestionnaireDoneForUser } from './core/questionnaire-session.util';

type QuizStep = 'welcome' | 'hebergement' | 'transport' | 'all-done';

@Component({
  selector: 'app-travel-questionnaire',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="tq-overlay">
      <!-- Ambient orbs -->
      <div class="tq-orb tq-orb-1"></div>
      <div class="tq-orb tq-orb-2"></div>
      <div class="tq-orb tq-orb-3"></div>

      <!-- Grid pattern -->
      <div class="tq-grid"></div>

      <div class="tq-container">

        <!-- Progress bar -->
        <div class="tq-progress-bar">
          <div class="tq-progress-fill" [style.width]="progressWidth()"></div>
        </div>

        <!-- Step indicators -->
        <div class="tq-steps">
          <div class="tq-step-dot" [class.active]="currentStep() === 'welcome'" [class.done]="stepIndex() > 0"></div>
          <div class="tq-step-line" [class.filled]="stepIndex() > 0"></div>
          <div class="tq-step-dot" [class.active]="currentStep() === 'hebergement'" [class.done]="stepIndex() > 1"></div>
          <div class="tq-step-line" [class.filled]="stepIndex() > 1"></div>
          <div class="tq-step-dot" [class.active]="currentStep() === 'transport' || currentStep() === 'all-done'" [class.done]="currentStep() === 'all-done'"></div>
        </div>

        <!-- ══ WELCOME STEP ══ -->
        @if (currentStep() === 'welcome') {
          <div class="tq-card tq-animate-in">
            <div class="tq-welcome-icon">
              <i class="pi pi-compass tq-welcome-pi"></i>
              <div class="tq-wave-ring"></div>
            </div>

            <h1 class="tq-main-title">
              Welcome, <span class="tq-name">{{ userName() }}</span>!
            </h1>
            <p class="tq-main-sub">
              Let us help you plan your trip to Tunisia.<br>
              A few quick questions to guide you.
            </p>

            <div class="tq-features">
              <div class="tq-feat">
                <i class="pi pi-building tq-feat-pi"></i>
                <span>Accommodation</span>
              </div>
              <div class="tq-feat-sep" aria-hidden="true">&gt;</div>
              <div class="tq-feat">
                <i class="pi pi-car tq-feat-pi"></i>
                <span>Transport</span>
              </div>
              <div class="tq-feat-sep" aria-hidden="true">&gt;</div>
              <div class="tq-feat">
                <i class="pi pi-check-circle tq-feat-pi"></i>
                <span>Trip ready</span>
              </div>
            </div>

            <div class="tq-actions">
              <button type="button" class="tq-btn-primary" (click)="goToStep('hebergement')">
                Start <i class="pi pi-arrow-right tq-btn-arrow-pi"></i>
              </button>
              <button type="button" class="tq-btn-ghost" (click)="skipQuestionnaire()">
                Skip this step
              </button>
            </div>
          </div>
        }

        <!-- ══ HEBERGEMENT STEP ══ -->
        @if (currentStep() === 'hebergement') {
          <div class="tq-card tq-animate-in">
            <div class="tq-step-label">
              <span class="tq-step-num">01</span>
              <span class="tq-step-title">Accommodation</span>
            </div>

            <div class="tq-question-icon-wrap"><i class="pi pi-building tq-question-pi"></i></div>
            <h2 class="tq-question">
              Have you already booked <span class="tq-highlight">accommodation</span>?
            </h2>
            <p class="tq-question-desc">
              Hotel, guest house, or B&amp;B — do you already have a place to stay?
            </p>

            <div class="tq-choices">
              <button type="button" class="tq-choice tq-choice-yes" (click)="answerHebergement(true)">
                <div class="tq-choice-icon"><i class="pi pi-check"></i></div>
                <div class="tq-choice-body">
                  <span class="tq-choice-title">Yes, I have accommodation</span>
                  <span class="tq-choice-desc">Continue to transport search</span>
                </div>
                <i class="pi pi-arrow-right tq-choice-arrow-pi"></i>
              </button>

              <button type="button" class="tq-choice tq-choice-no" (click)="answerHebergement(false)">
                <div class="tq-choice-icon"><i class="pi pi-building"></i></div>
                <div class="tq-choice-body">
                  <span class="tq-choice-title">No, I need to book</span>
                  <span class="tq-choice-desc">Find accommodation now</span>
                </div>
                <i class="pi pi-arrow-right tq-choice-arrow-pi"></i>
              </button>
            </div>

            <button type="button" class="tq-btn-back" (click)="goToStep('welcome')">
              <i class="pi pi-arrow-left"></i> Back
            </button>
          </div>
        }

        <!-- ══ TRANSPORT STEP ══ -->
        @if (currentStep() === 'transport') {
          <div class="tq-card tq-animate-in">
            <div class="tq-step-label">
              <span class="tq-step-num">02</span>
              <span class="tq-step-title">Transport</span>
            </div>

            <div class="tq-question-icon-wrap"><i class="pi pi-car tq-question-pi"></i></div>
            <h2 class="tq-question">
              Do you already have <span class="tq-highlight-red">transport</span> or a vehicle?
            </h2>
            <p class="tq-question-desc">
              Personal car, booked bus, taxi, shared taxi (louage), or flight — is your travel sorted?
            </p>

            <div class="tq-choices">
              <button type="button" class="tq-choice tq-choice-yes" (click)="answerTransport(true)">
                <div class="tq-choice-icon"><i class="pi pi-check"></i></div>
                <div class="tq-choice-body">
                  <span class="tq-choice-title">Yes, I already have transport</span>
                  <span class="tq-choice-desc">Browse available activities</span>
                </div>
                <i class="pi pi-arrow-right tq-choice-arrow-pi"></i>
              </button>

              <button type="button" class="tq-choice tq-choice-no" (click)="answerTransport(false)">
                <div class="tq-choice-icon"><i class="pi pi-car"></i></div>
                <div class="tq-choice-body">
                  <span class="tq-choice-title">No, I need to book transport</span>
                  <span class="tq-choice-desc">Search bus, taxi, louage, or flights</span>
                </div>
                <i class="pi pi-arrow-right tq-choice-arrow-pi"></i>
              </button>
            </div>

            <button type="button" class="tq-btn-back" (click)="goToStep('hebergement')">
              <i class="pi pi-arrow-left"></i> Back
            </button>
          </div>
        }

        <!-- ══ ALL DONE STEP ══ -->
        @if (currentStep() === 'all-done') {
          <div class="tq-card tq-animate-in tq-done-card">
            <div class="tq-done-circle">
              <i class="pi pi-check tq-done-check-pi"></i>
            </div>
            <h2 class="tq-done-title">You’re all set!</h2>
            <p class="tq-done-desc">
              Accommodation and transport are covered. Enjoy the activities Tunisia has to offer!
            </p>

            <div class="tq-done-cards">
              <div class="tq-done-item">
                <i class="pi pi-building tq-done-item-pi"></i>
                <span>Accommodation sorted</span>
              </div>
              <div class="tq-done-item">
                <i class="pi pi-car tq-done-item-pi"></i>
                <span>Transport sorted</span>
              </div>
            </div>

            <div class="tq-actions">
              <button type="button" class="tq-btn-primary" (click)="goActivities()">
                Explore activities
              </button>
              <button type="button" class="tq-btn-ghost" (click)="viewReservations()">
                My bookings
              </button>
            </div>
          </div>
        }

        <!-- Skip link -->
        @if (currentStep() !== 'all-done') {
          <p class="tq-skip-link" (click)="skipQuestionnaire()">
            Go straight to my profile
          </p>
        }

      </div>
    </div>
  `,
  styles: [`
    .tq-overlay {
      position: fixed; inset: 0; z-index: 10050;
      display: flex; align-items: center; justify-content: center;
      background: var(--surface-0, #0b0f1a);
      overflow: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    /* Ambient orbs */
    .tq-orb {
      position: absolute; border-radius: 50%;
      filter: blur(80px); pointer-events: none; opacity: 0.3;
    }
    .tq-orb-1 { width: 500px; height: 500px; top: -100px; left: -100px; background: rgba(0,119,182,0.5); animation: orbFloat 12s ease-in-out infinite; }
    .tq-orb-2 { width: 400px; height: 400px; bottom: -80px; right: -60px; background: rgba(241,37,69,0.5); animation: orbFloat 9s ease-in-out infinite reverse; }
    .tq-orb-3 { width: 300px; height: 300px; top: 50%; left: 50%; transform: translate(-50%,-50%); background: rgba(72,202,228,0.25); animation: orbFloat 15s ease-in-out infinite 2s; }
    @keyframes orbFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(20px, -20px) scale(1.05); }
    }
    .tq-orb-3 { animation: orbFloat3 15s ease-in-out infinite 2s; }
    @keyframes orbFloat3 {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(calc(-50% + 20px), calc(-50% - 20px)) scale(1.05); }
    }

    /* Grid */
    .tq-grid {
      position: absolute; inset: 0; pointer-events: none; opacity: 0.04;
      background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 50px 50px;
    }

    .tq-container {
      position: relative; z-index: 3;
      width: 100%; max-width: 540px;
      padding: 1.5rem;
      margin: auto;
      pointer-events: auto;
    }

    /* Progress */
    .tq-progress-bar {
      height: 3px; background: rgba(255,255,255,0.08);
      border-radius: 2px; margin-bottom: 1.5rem;
      overflow: hidden;
    }
    .tq-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #f12545, #ff6b6b);
      border-radius: 2px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Step dots */
    .tq-steps {
      display: flex; align-items: center; justify-content: center;
      gap: 0; margin-bottom: 2rem;
    }
    .tq-step-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: rgba(255,255,255,0.15);
      border: 2px solid rgba(255,255,255,0.15);
      transition: all 0.3s;
    }
    .tq-step-dot.active {
      background: #f12545; border-color: #f12545;
      box-shadow: 0 0 0 4px rgba(241,37,69,0.2);
      transform: scale(1.3);
    }
    .tq-step-dot.done {
      background: #22c55e; border-color: #22c55e;
    }
    .tq-step-line {
      flex: 1; max-width: 80px; height: 2px;
      background: rgba(255,255,255,0.1);
      transition: background 0.3s;
    }
    .tq-step-line.filled { background: #22c55e; }

    /* Card */
    .tq-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 2.5rem 2rem;
      backdrop-filter: blur(20px);
      box-shadow: 0 32px 64px rgba(0,0,0,0.4);
    }
    .tq-animate-in {
      animation: fadeSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Welcome */
    .tq-welcome-icon {
      position: relative; display: flex; align-items: center;
      justify-content: center; margin-bottom: 1.5rem;
    }
    .tq-welcome-pi { font-size: 2.75rem; color: #f12545; display: block; text-align: center; z-index: 1; position: relative; }
    .tq-wave-ring {
      position: absolute; width: 80px; height: 80px; border-radius: 50%;
      border: 2px solid rgba(241,37,69,0.2);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.4; }
      50% { transform: scale(1.2); opacity: 0.1; }
    }

    .tq-main-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.8rem; font-weight: 800;
      text-align: center; margin: 0 0 0.75rem;
      color: var(--text-color, #fff);
    }
    .tq-name { color: #f12545; }
    .tq-main-sub {
      text-align: center; font-size: 0.9rem;
      color: var(--text-muted, #a8b3c7);
      margin: 0 0 2rem; line-height: 1.6;
    }

    /* Features row */
    .tq-features {
      display: flex; align-items: center; justify-content: center;
      gap: 0.75rem; margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .tq-feat {
      display: flex; align-items: center; gap: 0.4rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 50px; padding: 0.5rem 1rem;
      font-size: 0.82rem; font-weight: 600; color: var(--text-color, #fff);
    }
    .tq-feat-pi { font-size: 1rem; color: #f12545; }
    .tq-feat-sep { color: var(--text-muted, #a8b3c7); font-size: 1.1rem; }

    /* Step label */
    .tq-step-label {
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .tq-step-num {
      font-family: 'Outfit', sans-serif;
      font-size: 0.7rem; font-weight: 800; letter-spacing: 1px;
      background: rgba(241,37,69,0.1); border: 1px solid rgba(241,37,69,0.2);
      color: #f12545; border-radius: 6px; padding: 2px 8px;
    }
    .tq-step-title {
      font-size: 0.78rem; font-weight: 700; letter-spacing: 0.5px;
      text-transform: uppercase; color: var(--text-muted, #a8b3c7);
    }

    /* Question */
    .tq-question-icon-wrap { text-align: center; margin-bottom: 1.25rem; }
    .tq-question-pi { font-size: 2.75rem; color: #f12545; }
    .tq-question {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem; font-weight: 800;
      text-align: center; margin: 0 0 0.75rem;
      color: var(--text-color, #fff); line-height: 1.3;
    }
    .tq-highlight { color: #0077b6; }
    .tq-highlight-red { color: #f12545; }
    .tq-question-desc {
      text-align: center; font-size: 0.88rem;
      color: var(--text-muted, #a8b3c7);
      margin: 0 0 2rem; line-height: 1.6;
    }

    /* Choices */
    .tq-choices { display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.5rem; }
    .tq-choice {
      display: flex; align-items: center; gap: 1rem;
      width: 100%;
      padding: 1.1rem 1.25rem; border-radius: 16px;
      border: 1.5px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
      cursor: pointer; text-align: left;
      font: inherit; color: inherit;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      color: var(--text-color, #fff);
    }
    .tq-choice:hover { transform: translateX(4px); }
    .tq-choice-yes:hover {
      border-color: rgba(34,197,94,0.35);
      background: rgba(34,197,94,0.06);
      box-shadow: 0 4px 20px rgba(34,197,94,0.1);
    }
    .tq-choice-no:hover {
      border-color: rgba(241,37,69,0.35);
      background: rgba(241,37,69,0.06);
      box-shadow: 0 4px 20px rgba(241,37,69,0.1);
    }

    .tq-choice-icon { font-size: 1.25rem; flex-shrink: 0; color: #22c55e; display: flex; align-items: center; justify-content: center; width: 2.25rem; }
    .tq-choice-no .tq-choice-icon { color: #f12545; }
    .tq-choice-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .tq-choice-title { font-weight: 700; font-size: 0.95rem; }
    .tq-choice-desc { font-size: 0.78rem; color: var(--text-muted, #a8b3c7); }
    .tq-choice-arrow-pi { font-size: 1rem; color: var(--text-muted, #a8b3c7); flex-shrink: 0; transition: transform 0.2s; }
    .tq-choice:hover .tq-choice-arrow-pi { transform: translateX(4px); color: var(--text-color, #fff); }

    /* Done card */
    .tq-done-card { text-align: center; }
    .tq-done-circle {
      width: 80px; height: 80px; border-radius: 50%;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.5rem;
      box-shadow: 0 8px 32px rgba(34,197,94,0.3);
      animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
    .tq-done-check-pi { font-size: 2rem; color: #fff; }
    .tq-done-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.6rem; font-weight: 800;
      margin: 0 0 0.75rem; color: var(--text-color, #fff);
    }
    .tq-done-desc {
      font-size: 0.9rem; color: var(--text-muted, #a8b3c7);
      margin: 0 0 1.75rem; line-height: 1.6;
    }
    .tq-done-cards {
      display: flex; gap: 0.75rem; justify-content: center;
      margin-bottom: 2rem; flex-wrap: wrap;
    }
    .tq-done-item {
      display: flex; align-items: center; gap: 0.5rem;
      background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
      border-radius: 50px; padding: 0.5rem 1.1rem;
      font-size: 0.85rem; font-weight: 600; color: #22c55e;
    }
    .tq-done-item-pi { font-size: 1rem; }

    /* Buttons */
    .tq-actions { display: flex; flex-direction: column; gap: 0.75rem; align-items: center; }
    .tq-btn-primary {
      width: 100%; max-width: 340px;
      padding: 1rem 2rem; border-radius: 50px;
      background: linear-gradient(135deg, #f12545, #c41230);
      color: #fff; font-weight: 800; font-size: 1rem;
      border: none; cursor: pointer;
      box-shadow: 0 8px 28px rgba(241,37,69,0.3);
      transition: all 0.25s;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
    .tq-btn-primary:hover {
      box-shadow: 0 12px 36px rgba(241,37,69,0.4);
      transform: translateY(-2px);
    }
    .tq-btn-arrow-pi { font-size: 1rem; margin-left: 0.35rem; transition: transform 0.2s; }
    .tq-btn-primary:hover .tq-btn-arrow-pi { transform: translateX(4px); }

    .tq-btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 0.85rem; color: var(--text-muted, #a8b3c7);
      padding: 0.5rem; transition: color 0.2s;
    }
    .tq-btn-ghost:hover { color: var(--text-color, #fff); }

    .tq-btn-back {
      display: block; margin: 0 auto;
      background: none; border: none; cursor: pointer;
      font-size: 0.82rem; color: var(--text-muted, #a8b3c7);
      padding: 0.5rem; transition: color 0.2s;
    }
    .tq-btn-back:hover { color: var(--text-color, #fff); }

    /* Skip */
    .tq-skip-link {
      text-align: center; margin-top: 1.25rem;
      font-size: 0.78rem; color: var(--text-muted, #a8b3c7);
      cursor: pointer; transition: color 0.2s;
    }
    .tq-skip-link:hover { color: var(--text-color, #fff); text-decoration: underline; }

    @media (max-width: 480px) {
      .tq-card { padding: 1.75rem 1.25rem; }
      .tq-main-title { font-size: 1.5rem; }
      .tq-question { font-size: 1.3rem; }
    }
  `]
})
export class TravelQuestionnaireComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  currentStep = signal<QuizStep>('welcome');

  userName = () => {
    const user = this.authService.currentUser();
    return user?.firstName || user?.username || 'Traveller';
  };

  stepIndex = () => {
    const map: Record<QuizStep, number> = { welcome: 0, hebergement: 1, transport: 2, 'all-done': 3 };
    return map[this.currentStep()];
  };

  progressWidth = () => {
    const pct = (this.stepIndex() / 3) * 100;
    return `${pct}%`;
  };

  goToStep(step: QuizStep) {
    this.currentStep.set(step);
  }

  answerHebergement(hasIt: boolean) {
    if (hasIt) {
      this.currentStep.set('transport');
    } else {
      this.markQuestionnaireDone();
      this.router.navigate(['/hebergement']);
    }
  }

  answerTransport(hasIt: boolean) {
    this.markQuestionnaireDone();
    if (hasIt) {
      this.router.navigate(['/activites']);
    } else {
      this.router.navigate(['/transport']);
    }
  }

  goActivities() {
    this.markQuestionnaireDone();
    this.router.navigate(['/activites']);
  }

  viewReservations() {
    this.markQuestionnaireDone();
    this.router.navigate(['/mes-reservations']);
  }

  goHome() {
    this.markQuestionnaireDone();
    this.router.navigate(['/']);
  }

  skipQuestionnaire() {
    this.markQuestionnaireDone();
    this.router.navigate(['/profile']);
  }

  private markQuestionnaireDone() {
    markQuestionnaireDoneForUser(this.authService.currentUser()?.id);
  }
}
