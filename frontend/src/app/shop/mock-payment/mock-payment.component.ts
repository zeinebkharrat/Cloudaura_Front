import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { API_BASE_URL } from '../../core/api-url';

@Component({
  selector: 'app-mock-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mock-payment.component.html',
  styleUrl: './mock-payment.component.css'
})
export class MockPaymentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  readonly orderId = signal<string | null>(null);
  readonly amount = signal<string | null>(null);
  readonly loading = signal(false);
  readonly showSuccess = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.orderId.set(params['orderId']);
      this.amount.set(params['amount']);
      
      if (!this.orderId()) {
        this.error.set('Commande invalide.');
      }
    });
  }

  confirmPayment(ev?: Event): void {
    ev?.preventDefault();
    if (!this.orderId()) return;

    this.loading.set(true);
    this.error.set(null);

    this.http.post(`${API_BASE_URL}/api/payment/mock-confirm/${this.orderId()}`, {}).subscribe({
      next: () => {
        this.loading.set(false);
        this.showSuccess.set(true);
        setTimeout(() => {
          this.router.navigate(['/mes-commandes'], { queryParams: { success: 'true' } });
        }, 2500);
      },
      error: () => {
        this.error.set('Impossible de confirmer le paiement simulé. Réessayez ou contactez le support.');
        this.loading.set(false);
      }
    });
  }

  cancelPayment() {
    this.router.navigate(['/mes-commandes'], { queryParams: { canceled: 'true' } });
  }

  isEligibleForPromo(): boolean {
    const val = Number(this.amount() ?? 0);
    return val >= 200;
  }

  formatAmount(val: string | null): string {
    if (!val) return '—';
    const num = Number(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', minimumFractionDigits: 2 }).format(num);
  }
}
