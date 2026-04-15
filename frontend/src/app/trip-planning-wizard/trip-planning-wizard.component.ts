import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../core/auth.service';

type Tri = boolean | null;

@Component({
  selector: 'app-trip-planning-wizard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './trip-planning-wizard.component.html',
  styleUrl: './trip-planning-wizard.component.css',
})
export class TripPlanningWizardComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** 1 hébergement, 2 transport, 3 résultat (no separate intro — Stays opens here) */
  readonly step = signal(1);
  readonly hasAccommodation = signal<Tri>(null);
  readonly hasTransport = signal<Tri>(null);

  readonly canAdvanceFromStep1 = computed(() => this.hasAccommodation() !== null);
  readonly canAdvanceFromStep2 = computed(() => this.hasTransport() !== null);

  readonly progressPct = computed(() => {
    const s = this.step();
    if (s === 1) return 36;
    if (s === 2) return 72;
    return 100;
  });

  setAccommodation(value: boolean): void {
    this.hasAccommodation.set(value);
  }

  setTransport(value: boolean): void {
    this.hasTransport.set(value);
  }

  /** Après réponse hébergement : si non → séjours ; si oui → question transport */
  continueFromAccommodation(): void {
    if (this.hasAccommodation() === false) {
      this.router.navigate(['/hebergement']);
      return;
    }
    if (this.hasAccommodation() === true) {
      this.step.set(2);
    }
  }

  /** Après réponse transport */
  continueFromTransport(): void {
    const heb = this.hasAccommodation();
    const tr = this.hasTransport();
    if (heb !== true || tr === null) return;

    if (tr === false) {
      this.router.navigate(['/transport']);
      return;
    }

    this.step.set(3);
  }

  /** Écran final : tout est couvert */
  goToNextExperience(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/mes-reservations']);
    } else {
      this.router.navigate(['/services/activities']);
    }
  }

  restart(): void {
    this.step.set(1);
    this.hasAccommodation.set(null);
    this.hasTransport.set(null);
  }

  back(): void {
    if (this.step() !== 2) return;
    this.step.set(1);
    this.hasTransport.set(null);
  }
}
