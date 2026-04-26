import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  Input,
  Output,
  EventEmitter,
  signal,
  viewChild,
  ElementRef,
  inject,
  EnvironmentInjector,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { City } from '../../../core/models/travel.models';

/**
 * Shared city dropdown: same UX as {@link AccommodationListPageComponent} filters (trigger + scrollable panel).
 * {@code selectedId === 0} means “all / none”.
 */
@Component({
  selector: 'app-governorate-city-picker',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="gcp-root" #gcpRoot>
      @if (fieldLabelKey) {
        <label class="gcp-field-label">
          @if (showCityIcon) {
            <img src="/icones/city.png" alt="" class="gcp-label-icon" />
          }
          {{ fieldLabelKey | translate }}
        </label>
      }
      <button
        type="button"
        class="gcp-trigger"
        [class.open]="open()"
        (click)="toggle($event)"
        [attr.aria-expanded]="open()"
        [attr.aria-haspopup]="'listbox'"
      >
        <span class="gcp-trigger-label">
          @if (selectedId === 0) {
            {{ allOptionLabelKey | translate }}
          } @else {
            {{ nameForSelected() }}
          }
        </span>
        <span class="gcp-chevron" [class.up]="open()" aria-hidden="true"></span>
      </button>
      @if (open()) {
        <div
          #gcpPanel
          class="gcp-panel"
          role="listbox"
          [attr.aria-label]="(panelAriaLabelKey | translate)"
        >
          <button
            type="button"
            role="option"
            class="gcp-option"
            [class.active]="selectedId === 0"
            (click)="pick(0, $event)"
          >
            {{ allOptionLabelKey | translate }}
          </button>
          @for (city of cities; track city.id) {
            <button
              type="button"
              role="option"
              class="gcp-option"
              [class.active]="selectedId === city.id"
              (click)="pick(city.id, $event)"
            >
              {{ city.name }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .gcp-root {
      position: relative;
      width: 100%;
    }
    .gcp-field-label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--crx-muted, var(--text-muted));
      margin-bottom: 0.45rem;
    }
    :host-context(:not(.crx-search-card)) .gcp-field-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
      color: var(--text-muted);
      margin-bottom: 10px;
      gap: 0.4rem;
    }
    .gcp-label-icon {
      width: 1rem;
      height: 1rem;
      object-fit: contain;
      opacity: 0.9;
    }
    .gcp-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: var(--crx-input-bg, var(--input-bg));
      border: 1px solid var(--crx-card-border, var(--border-soft));
      border-radius: 14px;
      padding: 0.65rem 0.85rem;
      color: var(--crx-text, var(--text-color));
      font-size: 0.95rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    :host-context(:not(.crx-search-card)) .gcp-trigger {
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .gcp-trigger:hover {
      border-color: color-mix(in srgb, var(--tunisia-red) 35%, var(--crx-card-border, var(--border-soft)));
    }
    .gcp-trigger.open {
      border-color: var(--tunisia-red);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--tunisia-red) 18%, transparent);
    }
    .gcp-trigger-label {
      text-align: left;
      flex: 1;
    }
    .gcp-chevron {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 6px solid var(--crx-muted, var(--text-muted));
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .gcp-chevron.up {
      transform: rotate(180deg);
      border-top-color: var(--tunisia-red);
    }
    .gcp-panel {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 6px);
      z-index: 80;
      max-height: min(280px, 55vh);
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: var(--tunisia-red) var(--surface-2);
      background: linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%);
      border: 1px solid color-mix(in srgb, var(--tunisia-red) 22%, var(--crx-card-border, var(--border-soft)));
      border-radius: 12px;
      padding: 6px;
      box-shadow: var(--shadow-card, 0 16px 40px rgba(0, 0, 0, 0.2));
      animation: gcpPanelIn 0.2s ease-out;
    }
    /* Car rental card: open list upward + opaque panel (readable light / dark) */
    :host-context(.crx-search-card) .gcp-panel {
      top: auto;
      bottom: calc(100% + 6px);
      z-index: 200;
      isolation: isolate;
      background: #ffffff;
      background-image: none;
      color: #0f172a;
      border: 1px solid rgba(15, 23, 42, 0.12);
      box-shadow: 0 -12px 40px rgba(15, 23, 42, 0.14);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      scrollbar-color: #f12545 #e2e8f0;
      animation: gcpPanelInUp 0.2s ease-out;
    }
    :host-context(html[data-theme='dark'] .crx-search-card) .gcp-panel {
      background: #0f172a;
      background-image: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      color: #f1f5f9;
      border: 1px solid rgba(148, 163, 184, 0.28);
      box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.55);
      scrollbar-color: #f12545 #1e293b;
    }
    :host-context(.crx-search-card) .gcp-panel::-webkit-scrollbar-track {
      background: #e2e8f0;
    }
    :host-context(html[data-theme='dark'] .crx-search-card) .gcp-panel::-webkit-scrollbar-track {
      background: #1e293b;
    }
    /* Panel uses fixed light/dark fills; override option color (else --crx-text stays light on white in dark theme) */
    :host-context(.crx-search-card) .gcp-option {
      color: #0f172a;
    }
    :host-context(html[data-theme='dark'] .crx-search-card) .gcp-option {
      color: #f1f5f9;
    }
    :host-context(.crx-search-card) .gcp-option:hover {
      background: rgba(241, 37, 69, 0.1);
      color: #0f172a;
    }
    :host-context(html[data-theme='dark'] .crx-search-card) .gcp-option:hover {
      background: rgba(241, 37, 69, 0.15);
      color: #f8fafc;
    }
    :host-context(.crx-search-card) .gcp-option.active {
      background: rgba(241, 37, 69, 0.14);
      color: #c81e3a;
    }
    :host-context(html[data-theme='dark'] .crx-search-card) .gcp-option.active {
      background: rgba(241, 37, 69, 0.22);
      color: #fda4af;
    }
    @keyframes gcpPanelIn {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes gcpPanelInUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .gcp-panel::-webkit-scrollbar {
      width: 8px;
    }
    .gcp-panel::-webkit-scrollbar-track {
      background: var(--surface-2);
      border-radius: 10px;
      margin: 4px 0;
    }
    .gcp-panel::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, var(--tunisia-red), color-mix(in srgb, var(--tunisia-red) 65%, #000));
      border-radius: 10px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    .gcp-panel::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--tunisia-red) 90%, #fff),
        var(--tunisia-red)
      );
      background-clip: padding-box;
    }
    .gcp-option {
      display: block;
      width: 100%;
      text-align: left;
      padding: 10px 12px;
      margin: 2px 0;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--crx-text, var(--text-color));
      font-size: 0.88rem;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, transform 0.12s;
    }
    .gcp-option:hover {
      background: color-mix(in srgb, var(--tunisia-red) 12%, var(--surface-2));
      color: var(--crx-text, var(--text-color));
      transform: translateX(2px);
    }
    .gcp-option.active {
      background: color-mix(in srgb, var(--tunisia-red) 18%, var(--surface-1));
      color: var(--tunisia-red);
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GovernorateCityPickerComponent {
  private readonly envInjector = inject(EnvironmentInjector);

  @Input({ required: true }) cities: City[] = [];
  @Input() selectedId = 0;
  @Input() fieldLabelKey = '';
  @Input() allOptionLabelKey = 'HEBERG.LIST.ALL_CITIES';
  @Input() panelAriaLabelKey = 'HEBERG.LIST.CITIES_ARIA';
  @Input() showCityIcon = true;

  @Output() readonly selectedIdChange = new EventEmitter<number>();

  gcpRoot = viewChild<ElementRef<HTMLElement>>('gcpRoot');
  gcpPanel = viewChild<ElementRef<HTMLElement>>('gcpPanel');

  readonly open = signal(false);

  nameForSelected(): string {
    return this.cities.find((x) => x.id === this.selectedId)?.name ?? '';
  }

  toggle(ev: MouseEvent): void {
    ev.stopPropagation();
    const next = !this.open();
    this.open.set(next);
    if (next) {
      afterNextRender(
        () => {
          const el = this.gcpPanel()?.nativeElement;
          if (el) {
            el.scrollTop = 0;
          }
        },
        { injector: this.envInjector },
      );
    }
  }

  pick(id: number, ev: MouseEvent): void {
    ev.stopPropagation();
    this.open.set(false);
    this.selectedIdChange.emit(id);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const root = this.gcpRoot()?.nativeElement;
    if (!this.open() || !root) {
      return;
    }
    if (!root.contains(ev.target as Node)) {
      this.open.set(false);
    }
  }
}
