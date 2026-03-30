import { Component, computed, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl:    './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  user = computed(() => this.auth.currentUser());
  
  @ViewChild('lineChart') lineChartRef!: ElementRef;
  @ViewChild('doughnutChart') doughnutChartRef!: ElementRef;

  constructor(public auth: AuthService) {}

  ngOnInit() {}

  ngAfterViewInit() {
    this.createLineChart();
    this.createDoughnutChart();
  }

  createLineChart() {
    const ctx = this.lineChartRef.nativeElement.getContext('2d');
    
    // Create a smooth gradient for the line chart fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(230, 57, 70, 0.4)');
    gradient.addColorStop(1, 'rgba(230, 57, 70, 0.01)');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
        datasets: [{
          label: 'Réservations Mensuelles',
          data: [120, 190, 300, 250, 420, 500],
          borderColor: '#e63946',
          backgroundColor: gradient,
          borderWidth: 3,
          tension: 0.4, // Smooth curve
          fill: true,
          pointBackgroundColor: '#11161d',
          pointBorderColor: '#e63946',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 22, 29, 0.9)',
            titleColor: '#fff',
            bodyColor: '#a0aec0',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'Outfit', size: 12 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            beginAtZero: true,
            ticks: { color: '#64748b', font: { family: 'Outfit', size: 12 } }
          }
        }
      }
    });
  }

  createDoughnutChart() {
    const ctx = this.doughnutChartRef.nativeElement.getContext('2d');
    
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Hébergements', 'Transports', 'Activités', 'Événements'],
        datasets: [{
          data: [45, 25, 20, 10],
          backgroundColor: [
            '#e63946', // Red
            '#3b82f6', // Blue
            '#10b981', // Green
            '#f59e0b'  // Yellow
          ],
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#a0aec0',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20,
              font: { family: 'Outfit', size: 13 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 22, 29, 0.9)',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12
          }
        }
      }
    });
  }
}
