import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import Chart from 'chart.js/auto';

interface DashboardStatsResponse {
  success: boolean;
  data: AdminDashboardStats;
}

interface AdminDashboardStats {
  periodDays: number;
  overview: {
    registeredUsers: number;
    totalBookings: number;
    totalRevenue: number;
    reports: number;
    activeListings: number;
  };
  period: {
    newUsers: number;
    bookings: number;
    revenue: number;
    orders: number;
  };
  growth: {
    usersPct: number;
    bookingsPct: number;
    revenuePct: number;
  };
  status: {
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  inventory: {
    activities: number;
    events: number;
    accommodations: number;
    transports: number;
    restaurants: number;
  };
  trend: Array<{ label: string; bookings: number; revenue: number }>;
  categorySplit: Array<{ label: string; value: number }>;
  bookingSourceSplit: Array<{ label: string; value: number }>;
  recentActivity: Array<{
    type: string;
    title: string;
    subtitle: string;
    timeAgo: string;
  }>;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly user = computed(() => this.auth.currentUser());
  readonly loading = signal(true);
  readonly error = signal('');
  readonly stats = signal<AdminDashboardStats | null>(null);
  readonly selectedPeriod = signal<number>(30);

  readonly availablePeriods = [
    { value: 7, label: '7D' },
    { value: 30, label: '30D' },
    { value: 90, label: '90D' },
    { value: 180, label: '180D' },
    { value: 365, label: '1Y' },
  ];

  readonly overview = computed(
    () =>
      this.stats()?.overview ?? {
        registeredUsers: 0,
        totalBookings: 0,
        totalRevenue: 0,
        reports: 0,
        activeListings: 0,
      }
  );

  readonly periodStats = computed(
    () =>
      this.stats()?.period ?? {
        newUsers: 0,
        bookings: 0,
        revenue: 0,
        orders: 0,
      }
  );

  readonly growth = computed(
    () =>
      this.stats()?.growth ?? {
        usersPct: 0,
        bookingsPct: 0,
        revenuePct: 0,
      }
  );

  readonly statusStats = computed(
    () =>
      this.stats()?.status ?? {
        confirmed: 0,
        pending: 0,
        cancelled: 0,
      }
  );

  readonly inventory = computed(
    () =>
      this.stats()?.inventory ?? {
        activities: 0,
        events: 0,
        accommodations: 0,
        transports: 0,
        restaurants: 0,
      }
  );

  readonly recentActivity = computed(() => this.stats()?.recentActivity ?? []);

  @ViewChild('trendChart') trendChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('catalogChart') catalogChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('bookingSourceChart') bookingSourceChartRef?: ElementRef<HTMLCanvasElement>;

  private viewReady = false;
  private trendChart?: Chart;
  private catalogChart?: Chart;
  private bookingSourceChart?: Chart;

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  refresh(): void {
    this.loadDashboardStats();
  }

  setPeriod(days: number): void {
    if (this.selectedPeriod() === days) {
      return;
    }
    this.selectedPeriod.set(days);
    this.loadDashboardStats();
  }

  currency(value: number): string {
    return new Intl.NumberFormat('en-TN', { maximumFractionDigits: 0 }).format(value) + ' TND';
  }

  pctLabel(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  pctClass(value: number): string {
    if (value > 0) {
      return 'trend-up';
    }
    if (value < 0) {
      return 'trend-down';
    }
    return 'trend-flat';
  }

  totalStatus(): number {
    const s = this.statusStats();
    return s.confirmed + s.pending + s.cancelled;
  }

  share(part: number, total: number): number {
    if (!total) {
      return 0;
    }
    return Math.round((part / total) * 100);
  }

  private loadDashboardStats(): void {
    this.loading.set(true);
    this.error.set('');

    this.http
      .get<DashboardStatsResponse>(`/api/admin/dashboard/stats?periodDays=${this.selectedPeriod()}`)
      .subscribe({
        next: (response) => {
          this.stats.set(response?.data ?? null);
          this.loading.set(false);
          this.renderCharts();
        },
        error: () => {
          this.error.set('Unable to load live dashboard stats right now.');
          this.loading.set(false);
          this.renderCharts();
        },
      });
  }

  private renderCharts(): void {
    if (!this.viewReady || !this.trendChartRef || !this.catalogChartRef || !this.bookingSourceChartRef) {
      return;
    }

    const trend = this.stats()?.trend ?? [];
    const categorySplit = this.stats()?.categorySplit ?? [];
    const bookingSource = this.stats()?.bookingSourceSplit ?? [];

    this.createTrendChart(trend);
    this.createCatalogChart(categorySplit);
    this.createBookingSourceChart(bookingSource);
  }

  private createTrendChart(points: Array<{ label: string; bookings: number; revenue: number }>): void {
    const ctx = this.trendChartRef?.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    this.trendChart?.destroy();

    const bookingsGradient = ctx.createLinearGradient(0, 0, 0, 360);
    bookingsGradient.addColorStop(0, 'rgba(14, 165, 233, 0.32)');
    bookingsGradient.addColorStop(1, 'rgba(14, 165, 233, 0.04)');

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: 'Bookings',
            data: points.map((p) => p.bookings),
            borderColor: '#0ea5e9',
            backgroundColor: bookingsGradient,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 6,
            tension: 0.35,
            fill: true,
            yAxisID: 'yBookings',
          },
          {
            label: 'Revenue',
            data: points.map((p) => p.revenue),
            borderColor: '#ef4444',
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            tension: 0.35,
            fill: false,
            yAxisID: 'yRevenue',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#334155', font: { family: 'Sora', size: 12 } } },
          tooltip: {
            backgroundColor: 'rgba(2, 6, 23, 0.88)',
            titleColor: '#fff',
            bodyColor: '#dbeafe',
            borderColor: 'rgba(148, 163, 184, 0.3)',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.18)' },
            ticks: { color: '#475569', font: { family: 'Sora', size: 11 } },
          },
          yBookings: {
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.18)' },
            ticks: { color: '#0369a1', font: { family: 'Sora', size: 11 } },
          },
          yRevenue: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: '#b91c1c', font: { family: 'Sora', size: 11 } },
          },
        },
      },
    });
  }

  private createCatalogChart(points: Array<{ label: string; value: number }>): void {
    const ctx = this.catalogChartRef?.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    this.catalogChart?.destroy();

    this.catalogChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            data: points.map((p) => p.value),
            backgroundColor: ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#6366f1'],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#475569', usePointStyle: true, font: { family: 'Sora', size: 11 } },
          },
        },
      },
    });
  }

  private createBookingSourceChart(points: Array<{ label: string; value: number }>): void {
    const ctx = this.bookingSourceChartRef?.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    this.bookingSourceChart?.destroy();

    this.bookingSourceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: 'Items',
            data: points.map((p) => p.value),
            backgroundColor: ['#0284c7', '#0d9488', '#d97706', '#dc2626', '#4f46e5'],
            borderRadius: 10,
            maxBarThickness: 46,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#475569', font: { family: 'Sora', size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.18)' },
            ticks: { color: '#64748b', font: { family: 'Sora', size: 11 } },
          },
        },
      },
    });
  }
}
