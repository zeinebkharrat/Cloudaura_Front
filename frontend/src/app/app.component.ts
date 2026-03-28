import { Component, inject, signal, OnInit, Renderer2, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { TripContextStore } from './core/stores/trip-context.store';
import { DATA_SOURCE_TOKEN } from './core/adapters/data-source.adapter';
import { City } from './core/models/travel.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {

  private readonly router   = inject(Router);
  private readonly renderer = inject(Renderer2);
  readonly auth             = inject(AuthService);
  readonly tripStore        = inject(TripContextStore);
  private readonly dataSource = inject(DATA_SOURCE_TOKEN);

  isDarkMode = signal(true);
  cities = signal<City[]>([]);

  selectedCityName = computed(() => {
    const id = this.tripStore.selectedCityId();
    if (!id) return null;
    return this.cities().find(c => c.id === id)?.name;
  });

  ngOnInit() {
    this.loadCities();
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      this.isDarkMode.set(false);
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'light');
    } else {
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'dark');
    }
  }

  loadCities() {
    this.dataSource.getCities().subscribe(data => this.cities.set(data));
  }

  isAdminArea(): boolean {
    return this.router.url.startsWith('/admin');
  }

  toggleTheme() {
    this.isDarkMode.set(!this.isDarkMode());
    const theme = this.isDarkMode() ? 'dark' : 'light';
    this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
    localStorage.setItem('theme', theme);
  }
}
