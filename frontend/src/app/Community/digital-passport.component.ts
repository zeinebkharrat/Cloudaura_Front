import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../core/auth.service';
import { CityOption } from '../core/auth.types';
import { DigitalPassportService } from './digital-passport.service';
import { DigitalPassport, PassportCityProgressView, PassportStampView } from './digital-passport.types';

type PassportStampEntry = {
  stampId: number;
  cityName: string;
  imageUrl: string;
};

type StyleMap = Record<string, string | number>;

@Component({
  selector: 'app-digital-passport',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './digital-passport.component.html',
  styleUrl: './digital-passport.component.css',
})
export class DigitalPassportComponent {
  private readonly passportService = inject(DigitalPassportService);
  readonly authService = inject(AuthService);

  readonly loading = signal<boolean>(true);
  readonly busy = signal<boolean>(false);
  readonly passportOpen = signal<boolean>(false);
  readonly passportAnimating = signal<boolean>(false);
  readonly openedPageIndex = signal<number>(0);
  readonly missingStampImages = signal<Record<string, true>>({});
  readonly error = signal<string | null>(null);
  readonly passport = signal<DigitalPassport | null>(null);
  readonly cities = signal<CityOption[]>([]);

  readonly profileBadge = signal<string>('Curious Traveler');
  readonly profileBio = signal<string>('');

  readonly stampCityId = signal<number | null>(null);
  readonly stampVisitedAt = signal<string>('');
  readonly stampEmblem = signal<string>('');
  readonly stampNote = signal<string>('');
  readonly stampPhotoUrl = signal<string>('');

  readonly photoCityId = signal<number | null>(null);
  readonly photoUrl = signal<string>('');
  readonly photoCaption = signal<string>('');

  private readonly stampFileByCityKey: Record<string, string> = {
    tunis: 'Tunis',
    ariana: 'Ariana',
    benarous: 'Ben Arous',
    bizerte: 'Bizerte',
    nabeul: 'Nabeul',
    sousse: 'Sousse',
    monastir: 'Monastir',
    mahdia: 'Mahdia',
    sfax: 'Sfax',
    gafsa: 'Gafsa',
    tozeur: 'Tozeur',
    tataouine: 'Tataouine',
    medenine: 'Medenine',
    gabes: 'Gabes',
    kebili: 'Kebili',
    jendouba: 'Jendouba',
    beja: 'Beja',
    kef: 'Kef',
    lekef: 'Kef',
    kairouan: 'Kairouan',
    kasserine: 'Kasserine',
    sidibouzid: 'Sidi Bouzid',
    siliana: 'Siliana',
    zaghouan: 'Zaghouan',
    manouba: 'Manouba',
  };

  async ngOnInit(): Promise<void> {
    await this.loadInitial();
  }

  async loadInitial(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [passport, cities] = await Promise.all([
        firstValueFrom(this.passportService.getMyPassport()),
        firstValueFrom(this.authService.getCities()),
      ]);

      this.passport.set(passport);
      this.cities.set(cities || []);
      this.profileBadge.set(passport.travelStyleBadge || 'Curious Traveler');
      this.profileBio.set(passport.bioNote || '');
    } catch (err) {
      console.error('Failed to load digital passport:', err);
      this.error.set('Could not load your digital passport.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    this.busy.set(true);
    try {
      const next = await firstValueFrom(
        this.passportService.updateMyProfile({
          travelStyleBadge: this.profileBadge().trim() || null,
          bioNote: this.profileBio().trim() || null,
        })
      );
      this.passport.set(next);
      await Swal.fire({
        icon: 'success',
        title: 'Passport profile updated',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });
    } catch (err) {
      console.error('Failed to update profile:', err);
      await this.errorAlert('Could not update passport profile.');
    } finally {
      this.busy.set(false);
    }
  }

  async addStamp(): Promise<void> {
    const cityId = this.stampCityId();
    if (!cityId) {
      await this.errorAlert('Please select a city before adding a stamp.');
      return;
    }

    this.busy.set(true);
    try {
      const next = await firstValueFrom(
        this.passportService.addOrUpdateStamp({
          cityId,
          visitedAt: this.stampVisitedAt() || null,
          emblemKey: this.stampEmblem().trim() || null,
          memoryNote: this.stampNote().trim() || null,
          photoUrl: this.stampPhotoUrl().trim() || null,
        })
      );
      this.passport.set(next);
      this.stampVisitedAt.set('');
      this.stampEmblem.set('');
      this.stampNote.set('');
      this.stampPhotoUrl.set('');

      await Swal.fire({
        icon: 'success',
        title: 'City stamped',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });
    } catch (err) {
      console.error('Failed to add stamp:', err);
      await this.errorAlert('Could not add city stamp.');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteStamp(stamp: PassportStampView): Promise<void> {
    if (!stamp.stampId) {
      return;
    }

    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Delete this city stamp?',
      text: 'This city entry will be removed from your passport.',
      showCancelButton: true,
      confirmButtonText: 'Delete stamp',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e63946',
      ...this.swalTheme(),
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.busy.set(true);
    try {
      const next = await firstValueFrom(this.passportService.deleteStamp(stamp.stampId));
      this.passport.set(next);
    } catch (err) {
      console.error('Failed to delete stamp:', err);
      await this.errorAlert('Could not delete this stamp.');
    } finally {
      this.busy.set(false);
    }
  }

  async addPhoto(): Promise<void> {
    const url = this.photoUrl().trim();
    if (!url) {
      await this.errorAlert('Please provide a photo URL.');
      return;
    }

    this.busy.set(true);
    try {
      const next = await firstValueFrom(
        this.passportService.addPhoto({
          cityId: this.photoCityId(),
          photoUrl: url,
          caption: this.photoCaption().trim() || null,
        })
      );
      this.passport.set(next);
      this.photoUrl.set('');
      this.photoCaption.set('');

      await Swal.fire({
        icon: 'success',
        title: 'Photo added',
        timer: 1200,
        showConfirmButton: false,
        ...this.swalTheme(),
      });
    } catch (err) {
      console.error('Failed to add photo:', err);
      await this.errorAlert('Could not add photo to passport gallery.');
    } finally {
      this.busy.set(false);
    }
  }

  async deletePhoto(photoId: number): Promise<void> {
    this.busy.set(true);
    try {
      const next = await firstValueFrom(this.passportService.deletePhoto(photoId));
      this.passport.set(next);
    } catch (err) {
      console.error('Failed to delete photo:', err);
      await this.errorAlert('Could not delete photo.');
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '-';
    }
    const d = Date.parse(value);
    if (!Number.isFinite(d)) {
      return value;
    }
    return new Date(d).toLocaleDateString();
  }

  hasVisited(city: PassportCityProgressView): boolean {
    return city.visited;
  }

  isFrequent(stamp: PassportStampView): boolean {
    return (stamp.visitCount || 0) >= 3;
  }

  passportHolderName(passport: DigitalPassport): string {
    const fullName = this.authService.currentUser()
      ? `${this.authService.currentUser()?.firstName || ''} ${this.authService.currentUser()?.lastName || ''}`.trim()
      : '';
    return fullName || passport.displayName || passport.username || 'Unknown Traveler';
  }

  passportEmail(passport: DigitalPassport): string {
    return this.authService.currentUser()?.email || passport.username || '-';
  }

  passportPhoto(passport: DigitalPassport): string | null {
    return this.normalizeMediaUrl(this.authService.currentUser()?.profileImageUrl || passport.profileImageUrl || null);
  }

  passportInitials(passport: DigitalPassport): string {
    const name = this.passportHolderName(passport);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return 'YT';
    }
    const first = parts[0]?.charAt(0) || '';
    const second = parts.length > 1 ? parts[1]?.charAt(0) || '' : (parts[0]?.charAt(1) || '');
    return `${first}${second}`.toUpperCase();
  }

  passportMrzLine1(passport: DigitalPassport): string {
    const compactName = this.passportHolderName(passport)
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .trim()
      .replace(/\s+/g, '<');
    return `P<TUN${compactName}<`.padEnd(44, '<').slice(0, 44);
  }

  passportMrzLine2(passport: DigitalPassport): string {
    const rawNo = (passport.passportNumber || 'YT0000000').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const docNo = rawNo.padEnd(9, '<').slice(0, 9);
    const cityCount = String(passport.uniqueCitiesVisited || 0).padStart(2, '0');
    return `${docNo}1TUN${cityCount}0000000<<<<<<<<<<<<<<06`.padEnd(44, '<').slice(0, 44);
  }

  normalizeMediaUrl(url?: string | null): string | null {
    const raw = (url ?? '').trim();
    if (!raw) {
      return null;
    }
    if (/^(https?:\/\/|data:|blob:)/i.test(raw)) {
      return raw;
    }
    if (raw.startsWith('/')) {
      return raw;
    }
    if (raw.startsWith('uploads/')) {
      return `/${raw}`;
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(raw)) {
      return `https://${raw}`;
    }
    return raw;
  }

  isVideoUrl(url?: string | null): boolean {
    const normalized = this.normalizeMediaUrl(url) ?? '';
    return /\.(mp4|webm|ogg|mov)(?:$|[?#])/i.test(normalized);
  }

  passportStampEntries(passport: DigitalPassport): PassportStampEntry[] {
    const uniqueByCity = new Set<string>();
    const entries: PassportStampEntry[] = [];

    for (const stamp of passport.stamps || []) {
      const cityName = (stamp.cityName || '').trim();
      if (!cityName) {
        continue;
      }

      const key = this.normalizeCityKey(cityName);
      if (!key || uniqueByCity.has(key)) {
        continue;
      }
      uniqueByCity.add(key);

      const fileCityName = this.stampFileByCityKey[key] || cityName;
      entries.push({
        stampId: stamp.stampId || Number(entries.length + 1),
        cityName,
        imageUrl: `/assets/stamps/${fileCityName}Stamp.png`,
      });
    }

    return entries.slice(0, 12);
  }

  isStampImageMissing(imageUrl: string): boolean {
    return !!this.missingStampImages()[imageUrl];
  }

  onStampImageError(imageUrl: string): void {
    this.missingStampImages.update((current) => ({ ...current, [imageUrl]: true }));
  }

  stampParachuteStyle(entry: PassportStampEntry, index: number): StyleMap {
    const seedBase = this.hashSeed(`${entry.stampId}-${entry.cityName}`);
    const x = 4 + this.seeded(seedBase + 1) * 80;
    const y = 6 + this.seeded(seedBase + 2) * 74;
    const rotate = -18 + this.seeded(seedBase + 3) * 36;
    const scale = 0.82 + this.seeded(seedBase + 4) * 0.3;
    const staggerX = (index % 4) * 1.8;
    const staggerY = (Math.floor(index / 4) % 3) * 2.6;
    const left = Math.min(88, x + staggerX);
    const top = Math.min(84, y + staggerY);

    return {
      left: `${left}%`,
      top: `${top}%`,
      '--stamp-transform': `translate(-50%, -50%) rotate(${rotate.toFixed(1)}deg) scale(${scale.toFixed(2)})`,
      '--drop-delay': `${Math.min(700, index * 90)}ms`,
      zIndex: 10 + index,
    };
  }

  togglePassport(event?: Event): void {
    event?.stopPropagation();
    if (this.passportAnimating()) {
      return;
    }
    const nextState = !this.passportOpen();
    this.passportAnimating.set(true);
    this.passportOpen.set(nextState);
    if (!nextState) {
      this.openedPageIndex.set(0);
    }
    setTimeout(() => this.passportAnimating.set(false), 900);
  }

  goToNextOpenedPage(event?: Event): void {
    event?.stopPropagation();
    this.openedPageIndex.update((current) => Math.min(1, current + 1));
  }

  goToPreviousOpenedPage(event?: Event): void {
    event?.stopPropagation();
    this.openedPageIndex.update((current) => Math.max(0, current - 1));
  }

  private normalizeCityKey(cityName: string): string {
    return cityName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private hashSeed(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash || 1;
  }

  private seeded(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private async errorAlert(text: string): Promise<void> {
    await Swal.fire({
      icon: 'error',
      title: 'Oops',
      text,
      ...this.swalTheme(),
    });
  }

  private swalTheme(): { background: string; color: string } {
    const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      background: darkMode ? '#181d24' : '#ffffff',
      color: darkMode ? '#e2e8f0' : '#1d2433',
    };
  }
}
