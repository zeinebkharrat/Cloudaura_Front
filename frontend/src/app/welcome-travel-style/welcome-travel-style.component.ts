import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../core/auth.service';
import { travelPrefsStorageKey } from '../core/travel-match.storage';
import type { TravelPreferencePayload } from '../core/travel-match.types';
import type { UserProfile } from '../core/auth.types';

function ageFromIso(dateIso: string | null | undefined): number | null {
  if (!dateIso?.trim()) {
    return null;
  }
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age >= 0 && age < 130 ? age : null;
}

/** Legacy profile / marketing labels → governorate anchor city (24-city model). */
const PROFILE_CITY_ALIASES: Readonly<Record<string, string>> = {
  djerba: 'Medenine',
  hammamet: 'Nabeul',
  tabarka: 'Jendouba',
  douz: 'Kebili',
};

function normalizeCityFromProfile(name: string | null | undefined, allowed: readonly string[]): string | null {
  if (!name?.trim()) {
    return null;
  }
  let probe = name.trim();
  const lower = probe.toLowerCase();
  if (PROFILE_CITY_ALIASES[lower]) {
    probe = PROFILE_CITY_ALIASES[lower];
  }
  for (const c of allowed) {
    if (c.toLowerCase() === probe.toLowerCase()) {
      return c;
    }
  }
  return null;
}

/** Map backend profile nationality string to classifier bucket. */
function nationalityBucket(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const s = raw.trim().toLowerCase();
  if (/(^|\b)(tunis|tn\b)/i.test(s)) {
    return 'tunisian';
  }
  if (/(arab|saudi|emirates|morocco|algeria|egypt|libya|mauritania|middle east|gulf|لبنان|مصر)/i.test(s)) {
    return 'arab';
  }
  if (/(europe|france|italy|spain|germany|uk\b|britain|sweden|norway)/i.test(s)) {
    return 'european';
  }
  if (/(africa|subsaharan|senegal|ivory|nigeria|kenya)/i.test(s)) {
    return 'african';
  }
  if (s.length >= 2) {
    return 'other';
  }
  return null;
}

function minSelectedStyles(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value as unknown;
    if (!Array.isArray(v) || v.length < min) {
      return { minStyles: true };
    }
    return null;
  };
}

const STEPS = [
  ['age', 'gender', 'nationality', 'current_city'],
  ['travel_styles', 'budget_level', 'preferred_region', 'preferred_cuisine'],
  ['travel_with', 'transport_preference', 'accommodation_type', 'travel_intensity', 'budget_avg', 'is_group'],
] as const;

@Component({
  selector: 'app-welcome-travel-style',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './welcome-travel-style.component.html',
  styleUrl: './welcome-travel-style.component.css',
})
export class WelcomeTravelStyleComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly stepIndex = signal(0);
  readonly stepCount = STEPS.length;

  readonly genders = ['female', 'male'] as const;
  readonly nationalities = ['tunisian', 'arab', 'african', 'european', 'other'] as const;
  /** Tunisia’s 24 governorates (main city per governorate — matches recommendation model labels). */
  readonly cities = [
    'Tunis',
    'Ariana',
    'Ben Arous',
    'Manouba',
    'Nabeul',
    'Zaghouan',
    'Bizerte',
    'Beja',
    'Jendouba',
    'Le Kef',
    'Siliana',
    'Sousse',
    'Monastir',
    'Mahdia',
    'Kairouan',
    'Kasserine',
    'Sidi Bouzid',
    'Gafsa',
    'Tozeur',
    'Kebili',
    'Gabes',
    'Medenine',
    'Tataouine',
    'Sfax',
  ] as const;
  readonly travelStyles = [
    'cultural',
    'beaches',
    'relaxation',
    'adventure',
    'nature',
    'luxury',
    'party',
  ] as const;
  readonly budgetLevels = ['low', 'medium', 'high'] as const;
  readonly regions = ['north', 'coastal', 'inland', 'south', 'desert'] as const;
  readonly cuisines = [
    'tunisian',
    'mediterranean',
    'middle_eastern',
    'european',
    'african',
    'american',
    'asian',
    'indian',
  ] as const;
  readonly travelWith = ['solo', 'couple', 'family', 'friends'] as const;
  readonly transports = ['car', 'public', 'plane'] as const;
  readonly accommodations = ['hotel', 'resort', 'airbnb', 'hostel'] as const;
  readonly intensities = ['low', 'medium', 'high'] as const;

  readonly form = this.fb.nonNullable.group({
    age: [32, [Validators.required, Validators.min(18), Validators.max(110)]],
    gender: ['female', Validators.required],
    nationality: ['tunisian', Validators.required],
    current_city: ['Tunis', Validators.required],
    travel_styles: this.fb.nonNullable.control<string[]>(['cultural'], {
      validators: [minSelectedStyles(1)],
    }),
    budget_level: ['medium', Validators.required],
    preferred_region: ['coastal', Validators.required],
    preferred_cuisine: ['tunisian', Validators.required],
    travel_with: ['couple', Validators.required],
    transport_preference: ['car', Validators.required],
    accommodation_type: ['hotel', Validators.required],
    travel_intensity: ['medium', Validators.required],
    budget_avg: [180, [Validators.min(20), Validators.max(8000)]],
    is_group: [0 as 0 | 1, Validators.required],
  });

  readonly stepsMeta = [
    { icon: '👤', key: 'STEP_LABEL_1' },
    { icon: '✦', key: 'STEP_LABEL_2' },
    { icon: '◇', key: 'STEP_LABEL_3' },
  ] as const;

  /** When false, field was taken from profile (hidden input). */
  readonly showAgeInput = signal(true);
  readonly showGenderInput = signal(true);
  readonly showNationalityInput = signal(true);
  readonly showCityInput = signal(true);

  ngOnInit(): void {
    this.prefillIdentityFromProfile(this.auth.currentUser());
  }

  private prefillIdentityFromProfile(u: UserProfile | null): void {
    if (!u) {
      return;
    }

    const age = ageFromIso(u.dateOfBirth ?? null);
    if (age != null && age >= 18 && age <= 110) {
      this.form.patchValue({ age });
      this.showAgeInput.set(false);
    }

    if (u.gender === 'MALE') {
      this.form.patchValue({ gender: 'male' });
      this.showGenderInput.set(false);
    } else if (u.gender === 'FEMALE') {
      this.form.patchValue({ gender: 'female' });
      this.showGenderInput.set(false);
    }

    const nat = nationalityBucket(u.nationality ?? null);
    if (nat) {
      this.form.patchValue({ nationality: nat });
      this.showNationalityInput.set(false);
    }

    const city = normalizeCityFromProfile(u.cityName ?? null, this.cities);
    if (city) {
      this.form.patchValue({ current_city: city });
      this.showCityInput.set(false);
    }
  }

  step1LeadKey(): string {
    const anyHidden =
      !this.showAgeInput() ||
      !this.showGenderInput() ||
      !this.showNationalityInput() ||
      !this.showCityInput();
    return anyHidden ? 'LEAD_1_PARTIAL' : 'LEAD_1';
  }

  progressPercent(): number {
    return Math.round(((this.stepIndex() + 1) / this.stepCount) * 100);
  }

  goStep(i: number): void {
    if (i < 0 || i >= this.stepCount) {
      return;
    }
    if (i <= this.stepIndex()) {
      this.stepIndex.set(i);
      return;
    }
    if (i === this.stepIndex() + 1 && !this.stepInvalid()) {
      this.stepIndex.set(i);
    }
  }

  toggleTravelStyle(style: string): void {
    const key = style.trim().toLowerCase();
    const ctrl = this.form.controls.travel_styles;
    const cur = [...ctrl.value];
    const ix = cur.indexOf(key);
    if (ix >= 0) {
      if (cur.length <= 1) {
        return;
      }
      cur.splice(ix, 1);
    } else {
      cur.push(key);
    }
    ctrl.setValue(cur.sort((a, b) => a.localeCompare(b)));
    ctrl.markAsTouched();
  }

  styleSelected(style: string): boolean {
    return this.form.controls.travel_styles.value.includes(style.toLowerCase());
  }

  private stepInvalid(): boolean {
    const keys = STEPS[this.stepIndex()] as readonly string[];
    let bad = false;
    for (const k of keys) {
      const c = this.form.get(k);
      c?.markAsTouched();
      if (c?.invalid) {
        bad = true;
      }
    }
    return bad;
  }

  next(): void {
    if (this.stepInvalid()) {
      return;
    }
    if (this.stepIndex() < this.stepCount - 1) {
      this.stepIndex.update((n) => n + 1);
    } else {
      this.save();
    }
  }

  back(): void {
    if (this.stepIndex() > 0) {
      this.stepIndex.update((n) => n - 1);
    }
  }

  skip(): void {
    const next = this.route.snapshot.queryParamMap.get('next') || '/';
    void this.router.navigateByUrl(next);
  }

  private save(): void {
    if (this.stepInvalid()) {
      return;
    }
    const u = this.auth.currentUser();
    if (!u?.id) {
      return;
    }
    const raw = this.form.getRawValue();
    const styles = raw.travel_styles.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    const budgetAvg =
      raw.budget_avg != null && raw.budget_avg !== ('' as unknown as number)
        ? Number(raw.budget_avg)
        : 171;
    const payload: TravelPreferencePayload = {
      age: Number(raw.age),
      gender: String(raw.gender).trim().toLowerCase(),
      nationality: String(raw.nationality).trim().toLowerCase(),
      current_city: String(raw.current_city).trim(),
      travel_style: styles[0] ?? 'cultural',
      travel_styles: styles,
      budget_level: String(raw.budget_level).trim().toLowerCase(),
      preferred_region: String(raw.preferred_region).trim().toLowerCase(),
      preferred_cuisine: String(raw.preferred_cuisine).trim().toLowerCase(),
      travel_with: String(raw.travel_with).trim().toLowerCase(),
      transport_preference: String(raw.transport_preference).trim().toLowerCase(),
      accommodation_type: String(raw.accommodation_type).trim().toLowerCase(),
      travel_intensity: String(raw.travel_intensity).trim().toLowerCase(),
      budget_avg: Number.isFinite(budgetAvg) ? budgetAvg : 171,
      is_group: Number(raw.is_group) ? 1 : 0,
    };
    localStorage.setItem(travelPrefsStorageKey(u.id), JSON.stringify(payload));
    const next = this.route.snapshot.queryParamMap.get('next') || '/';
    void this.router.navigateByUrl(next);
  }
}
