import { Component, OnInit, signal, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LudificationService } from '../core/ludification.service';

interface Instrument {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  activeSoundId?: string;
  sounds: { key: string; note: string; frequency: number; type?: 'white' | 'black' }[];
}

@Component({
  selector: 'app-tunisian-music-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="music-game-container">
      <div class="glass-header">
        <div class="header-content">
          <h1>Rythmes de Tunisie</h1>
          <p>Explorez les sonorités traditionnelles et créez votre propre mélodie.</p>
        </div>
        <div class="controls">
          <button class="btn-secondary" (click)="goBack()">Retour aux jeux</button>
        </div>
      </div>

      <div class="game-controls">
        <div class="instrument-selector">
          @for (inst of instruments; track inst.id) {
            <button 
              class="inst-card" 
              [class.active]="activeInstrument().id === inst.id"
              [style.--inst-color]="inst.color"
              (click)="selectInstrument(inst)">
              <span class="inst-icon">{{ inst.icon }}</span>
              <span class="inst-name">{{ inst.name }}</span>
            </button>
          }
        </div>

        <div class="rhythm-selector">
          <h3>Rythme de fond</h3>
          <div class="rhythm-buttons">
            @for (r of rhythms; track r.id) {
              <button 
                class="btn-rhythm" 
                [class.active]="activeRhythm() === r.id"
                (click)="selectRhythm(r.id)">
                {{ r.name }}
              </button>
            }
          </div>
        </div>
      </div>

      <div class="playing-area" [style.--active-color]="activeInstrument().color" [class.pro-mode]="activeInstrument().id === 'org'">
        @if (activeInstrument().id === 'org') {
          <div class="org-main-controls">
            <div class="pitch-bend-side">
              <div class="joystick-base">
                <div class="joystick-handle"></div>
              </div>
              <span class="side-label">PITCH BEND</span>
            </div>

            <div class="org-pro-panel">
              <div class="panel-top">
                <div class="sliders-group">
                  @for (i of [1,2,3,4]; track i) {
                    <div class="slider-wrapper">
                      <div class="slider-track"><div class="slider-thumb" [style.bottom.%]="i === 1 ? 60 : 30 + i*5"></div></div>
                      <span class="slider-label">ACC {{i}}</span>
                    </div>
                  }
                </div>
                
                <div class="lcd-screen">
                  <div class="lcd-header">
                    <span>Main Page</span>
                    <span>&lt;no chord&gt;</span>
                  </div>
                  <div class="lcd-body">
                    <div class="lcd-left">
                      <div class="style-name">TH-Rbeybi</div>
                      <div class="style-meta">tempo 180 bpm</div>
                      <div class="style-setting">OCTAVE: {{ octaveOffset() > 0 ? '+' : '' }}{{ octaveOffset() }}</div>
                      <div class="style-setting">REVERB: {{ reverbAmount() }}%</div>
                    </div>
                    <div class="lcd-right">
                      <div class="track-info" [class.highlight]="activeInstrument().activeSoundId === 'flute'" (click)="setOrgSound('flute')">11-05 FLUTE</div>
                      <div class="track-info" [class.highlight]="activeInstrument().activeSoundId === 'jazz'" (click)="setOrgSound('jazz')">11-17 JAZZ ORGA</div>
                      <div class="track-info" [class.highlight]="activeInstrument().activeSoundId === 'kanoun'" (click)="setOrgSound('kanoun')">11-06 KANOUN.exs</div>
                    </div>
                  </div>
                  <div class="lcd-footer">
                    <div class="loading-bar"></div>
                  </div>
                </div>

                <div class="knobs-group">
                  <div class="knob-large">
                    <div class="knob-cap"></div>
                  </div>
                  <div class="knob-controls">
                    <div class="control-row">
                      <button class="btn-tiny" (click)="changeOctave(-1)">-</button>
                      <span class="tiny-label">OCT</span>
                      <button class="btn-tiny" (click)="changeOctave(1)">+</button>
                    </div>
                    <div class="control-row">
                      <input type="range" class="mini-slider" min="0" max="100" [value]="reverbAmount()" (input)="updateReverb($event)">
                      <span class="tiny-label">REV</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="panel-middle">
                <div class="variation-group">
                  <span class="group-label">VARIATION</span>
                  <div class="var-btns">
                    @for (v of [1,2,3,4]; track v) {
                      <button class="btn-var" [class.active]="v === 4"><span>{{v}}</span></button>
                    }
                  </div>
                </div>
                <div class="variation-group">
                  <span class="group-label">FILL / BREAK</span>
                  <div class="var-btns">
                    <button class="btn-var"><span>IN</span></button>
                    <button class="btn-var"><span>FILL</span></button>
                    <button class="btn-var"><span>BREAK</span></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        } @else {
          <div class="instrument-display">
            <div class="instrument-info">
              <h2>{{ activeInstrument().name }}</h2>
              <p>{{ activeInstrument().description }}</p>
            </div>
            
            <div class="visualizer" id="visualizer">
              @for (bar of bars(); track $index) {
                <div class="bar" [style.height.%]="bar" [style.background-color]="activeInstrument().color"></div>
              }
            </div>
          </div>
        }

        <div class="keyboard" [class.labeled]="activeInstrument().id === 'org'" [class.piano-style]="activeInstrument().id === 'org'">
          @for (sound of activeInstrument().sounds; track sound.key; let idx = $index) {
            <div 
              class="key" 
              [class.pressing]="pressingKeys().has(sound.key)"
              [class.black-key]="sound.type === 'black'"
              [class.white-key]="sound.type === 'white' || !sound.type"
              (mousedown)="playSound(sound)"
              (mouseup)="stopSound(sound.key)"
              (mouseleave)="stopSound(sound.key)">
              <span class="key-label">{{ sound.key }}</span>
              <span class="note-label">{{ sound.note }}</span>
              @if (activeInstrument().id === 'org' && (sound.type === 'white' || !sound.type)) {
                <span class="solfege-label" [style.color]="idx % 12 < 5 ? '#22c55e' : '#ef4444'">
                   {{ ['Do','','Re','','Mi','Fa','','Sol','','La','','Si','Do'][idx % 13] }}
                </span>
              }
            </div>
          }
        </div>
      </div>

      <div class="recording-bar" [class.recording]="isRecording()">
        <div class="rec-status">
          <div class="dot"></div>
          <span>{{ isRecording() ? 'Enregistrement...' : 'Prêt à jouer' }}</span>
        </div>
        <div class="rec-actions">
          <button class="btn-rec" (click)="toggleRecording()">
            {{ isRecording() ? 'Arrêter' : 'Enregistrer' }}
          </button>
          @if (recordedSequence().length > 0 && !isRecording()) {
            <button class="btn-play" (click)="playRecording()">Rejouer</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      background: linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)),
                  url('/mezwed/bg_mezwed.png');
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
      color: white;
      font-family: 'Inter', sans-serif;
      overflow-y: auto;
    }

    .music-game-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 1rem 10rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 100vh;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(5px);
    }

    .glass-header {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      padding: 1rem 1.5rem;
      border-radius: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-content h1 {
      margin: 0;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .header-content p {
      margin: 0.5rem 0 0;
      color: #94a3b8;
    }

    .game-controls {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
    }

    .instrument-selector {
      flex: 3;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5rem;
    }

    .rhythm-selector {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      padding: 1.5rem;
      border-radius: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .rhythm-selector h3 {
      margin: 0 0 1rem;
      font-size: 1rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .rhythm-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .btn-rhythm {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      padding: 0.75rem;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-rhythm:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-rhythm.active {
      background: #3b82f6;
      border-color: #60a5fa;
      box-shadow: 0 0 15px -5px #3b82f6;
    }

    /* PRO MODE (ORG) */
    .pro-mode {
      background: #27272a !important;
      border: 4px solid #18181b !important;
      padding: 1.5rem !important;
      gap: 1.5rem !important;
      border-radius: 1rem !important;
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .org-main-controls {
      display: flex;
      align-items: center;
      gap: 2rem;
      background: #18181b;
      padding: 1rem;
      border-radius: 0.5rem;
      border: 1px solid #3f3f46;
    }

    .pitch-bend-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      border-right: 1px solid #3f3f46;
      padding-right: 1rem;
    }

    .joystick-base {
      width: 50px;
      height: 80px;
      background: #000;
      border-radius: 25px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #3f3f46;
    }

    .joystick-handle {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #71717a, #3f3f46);
      border-radius: 50%;
      border: 2px solid #18181b;
      box-shadow: 0 4px 6px rgba(0,0,0,0.5);
    }

    .side-label {
      font-size: 0.5rem;
      font-weight: 800;
      color: #71717a;
      letter-spacing: 0.1em;
    }

    .org-pro-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 1;
    }

    .panel-top {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      height: 180px;
    }

    .sliders-group {
      display: flex;
      gap: 1rem;
    }

    .slider-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .slider-track {
      width: 12px;
      height: 120px;
      background: #18181b;
      border-radius: 6px;
      position: relative;
      border: 1px solid rgba(255,255,255,0.05);
    }

    .slider-thumb {
      width: 24px;
      height: 36px;
      background: linear-gradient(to bottom, #52525b, #27272a);
      border: 1px solid #71717a;
      border-radius: 4px;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);
    }

    .slider-label {
      font-size: 0.6rem;
      color: #71717a;
      font-weight: 700;
    }

    .lcd-screen {
      flex: 1;
      background: #000;
      border: 6px solid #3f3f46;
      border-radius: 4px;
      padding: 0.75rem;
      font-family: 'Courier New', Courier, monospace;
      color: #fdba74;
      display: flex;
      flex-direction: column;
      box-shadow: inset 0 0 20px rgba(253, 186, 116, 0.1);
    }

    .lcd-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      border-bottom: 1px solid #27272a;
      padding-bottom: 0.5rem;
      color: #f97316;
    }

    .lcd-body {
      flex: 1;
      display: flex;
      padding: 0.5rem 0;
    }

    .lcd-left {
      flex: 1;
      border-right: 1px solid #27272a;
    }

    .style-name {
      font-size: 1.2rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .style-meta, .style-setting {
      font-size: 0.7rem;
      opacity: 0.8;
      margin-bottom: 2px;
    }

    .style-setting {
      color: #f97316;
      font-weight: 700;
    }

    .control-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
    }

    .tiny-label {
      font-size: 0.5rem;
      color: #71717a;
      width: 25px;
      text-align: center;
    }

    .mini-slider {
      width: 60px;
      height: 4px;
      accent-color: #f97316;
    }

    .lcd-right {
      flex: 1;
      padding-left: 0.75rem;
    }

    .track-info {
      font-size: 0.8rem;
      margin-bottom: 0.25rem;
      opacity: 0.7;
    }

    .track-info.highlight {
      background: #f97316;
      color: #000;
      padding: 0 4px;
      opacity: 1;
    }

    .loading-bar {
      height: 4px;
      background: #27272a;
      width: 100%;
      position: relative;
    }

    .loading-bar::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 60%;
      background: #f97316;
    }

    .knobs-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .knob-large {
      width: 80px;
      height: 80px;
      background: #3f3f46;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 4px solid #18181b;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
    }

    .knob-cap {
      width: 80%;
      height: 80%;
      background: linear-gradient(135deg, #71717a, #3f3f46);
      border-radius: 50%;
      position: relative;
    }

    .knob-cap::after {
      content: '';
      position: absolute;
      top: 10%;
      left: 50%;
      width: 4px;
      height: 12px;
      background: white;
      transform: translateX(-50%);
    }

    .btn-tiny {
      background: #3f3f46;
      border: 1px solid #52525b;
      color: white;
      font-size: 0.6rem;
      padding: 2px 8px;
      border-radius: 2px;
      cursor: pointer;
    }

    .panel-middle {
      background: #18181b;
      padding: 0.75rem;
      border-radius: 4px;
      display: flex;
      gap: 2rem;
    }

    .variation-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .group-label {
      font-size: 0.6rem;
      color: #71717a;
      font-weight: 800;
      letter-spacing: 0.1em;
    }

    .var-btns {
      display: flex;
      gap: 0.4rem;
    }

    .btn-var {
      background: linear-gradient(to bottom, #52525b, #3f3f46);
      border: 1px solid #18181b;
      color: #a1a1aa;
      width: 44px;
      height: 32px;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .btn-var.active {
      background: #f97316;
      color: white;
      border-color: #fb923c;
      box-shadow: 0 0 10px rgba(249, 115, 22, 0.4);
    }

    .solfege-label {
      font-size: 0.9rem;
      font-weight: 800;
      margin-top: 5px;
    }

    .keyboard.labeled .note-label {
      display: none;
    }

    .inst-card {
      background: rgba(255, 255, 255, 0.03);
      border: 2px solid rgba(255, 255, 255, 0.05);
      border-radius: 1rem;
      padding: 0.75rem;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
    }

    .inst-card:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-4px);
      border-color: var(--inst-color);
    }

    .inst-card.active {
      background: rgba(255, 255, 255, 0.12);
      border-color: var(--inst-color);
      box-shadow: 0 0 20px -5px var(--inst-color);
    }

    .inst-icon {
      font-size: 1.5rem;
    }

    .inst-name {
      font-weight: 600;
      font-size: 0.9rem;
    }

    .playing-area {
      flex: 1;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 2rem;
      padding: 2.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
      position: relative;
    }

    .instrument-display {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .instrument-info h2 {
      margin: 0;
      font-size: 2.5rem;
      color: var(--active-color);
    }

    .instrument-info p {
      color: #94a3b8;
      max-width: 400px;
      margin: 0.5rem 0 0;
    }

    .visualizer {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 100px;
      padding: 1rem;
    }

    .bar {
      width: 6px;
      border-radius: 3px;
      transition: height 0.1s ease;
      opacity: 0.6;
    }

    .keyboard {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      padding: 1rem;
    }

    .keyboard.piano-style {
      gap: 0;
      position: relative;
      background: #f8fafc;
      padding: 0 1rem 1rem 1rem;
      border-radius: 0.5rem;
      border: 10px solid #18181b;
      box-shadow: inset 0 20px 30px rgba(0,0,0,0.8);
      width: fit-content;
      margin: 0 auto;
      height: 220px;
      display: flex;
    }

    .keyboard.piano-style::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 20px;
      background: linear-gradient(to bottom, #000, transparent);
      z-index: 10;
      pointer-events: none;
    }

    .key {
      position: relative;
      cursor: pointer;
      user-select: none;
      transition: all 0.1s;
    }

    .white-key {
      width: 55px;
      height: 180px;
      background: linear-gradient(to bottom, #f8fafc 0%, #e2e8f0 100%);
      border: 1px solid #94a3b8;
      border-bottom-left-radius: 6px;
      border-bottom-right-radius: 6px;
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      padding-bottom: 2rem;
      color: #334155;
    }

    .black-key {
      width: 32px;
      height: 110px;
      background: linear-gradient(to bottom, #1e293b 0%, #000 100%);
      border: 1px solid #1e293b;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      margin-left: -16px;
      margin-right: -16px;
      z-index: 2;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      padding-bottom: 1rem;
      color: white;
      box-shadow: 0 4px 6px rgba(0,0,0,0.5);
    }

    .key.pressing.white-key {
      background: #e2e8f0;
      transform: translateY(2px);
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    }

    .key.pressing.black-key {
      background: #334155;
      transform: translateY(2px);
    }

    .key-label {
      position: absolute;
      top: 0.5rem;
      font-size: 0.7rem;
      opacity: 0.4;
    }

    .white-key .note-label {
      font-weight: 800;
      font-size: 1rem;
    }

    .black-key .note-label {
      font-size: 0.7rem;
      opacity: 0.7;
    }

    .recording-bar {
      background: rgba(0, 0, 0, 0.5);
      padding: 1rem 2rem;
      border-radius: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .rec-status {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .dot {
      width: 12px;
      height: 12px;
      background: #475569;
      border-radius: 50%;
    }

    .recording .dot {
      background: #ef4444;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    .rec-actions {
      display: flex;
      gap: 1rem;
    }

    .btn-rec {
      background: #ef4444;
      color: white;
      border: none;
      padding: 0.5rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-play {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 0.5rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-secondary {
      background: transparent;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  `]
})
export class TunisianMusicPlayerComponent implements OnInit, OnDestroy {
  private ludification = inject(LudificationService);

  instruments: Instrument[] = [
    {
      id: 'darbuka',
      name: 'Darbuka',
      description: 'Le cœur percutant de la musique tunisienne, offrant des rythmes profonds et cristallins.',
      icon: '🥁',
      color: '#f59e0b',
      sounds: [
        { key: 'A', note: 'Dum', frequency: 110 },
        { key: 'S', note: 'Tak', frequency: 220 },
        { key: 'D', note: 'Ka', frequency: 165 },
        { key: 'F', note: 'Slap', frequency: 330 },
        { key: 'G', note: 'Roll', frequency: 440 },
        { key: 'H', note: 'Rim', frequency: 550 },
      ]
    },
    {
      id: 'oud',
      name: 'Oud',
      description: 'L’instrument roi des maqams, une poésie cordée qui traverse les âges.',
      icon: '🪕',
      color: '#8b5cf6',
      sounds: [
        { key: 'A', note: 'C2', frequency: 130.81 },
        { key: 'S', note: 'D2', frequency: 146.83 },
        { key: 'D', note: 'E2', frequency: 164.81 },
        { key: 'F', note: 'F2', frequency: 174.61 },
        { key: 'G', note: 'G2', frequency: 196.00 },
        { key: 'H', note: 'A2', frequency: 220.00 },
      ]
    },
    {
      id: 'org',
      name: 'Orgue / Synthé',
      description: 'Le son moderne indispensable des mariages et des fêtes populaires tunisiennes.',
      icon: '🎹',
      color: '#0ea5e9',
      activeSoundId: 'jazz',
      sounds: [
        // Octave 3 (Adjusted Black keys alignment)
        { key: 'Q', note: 'C3', frequency: 130.81, type: 'white' },
        { key: 'A', note: 'C#3', frequency: 138.59, type: 'black' },
        { key: 'S', note: 'D3', frequency: 146.83, type: 'white' },
        { key: 'Z', note: 'C#3', frequency: 155.56, type: 'black' }, // Actually D#3
        { key: 'D', note: 'E3', frequency: 164.81, type: 'white' },
        { key: 'F', note: 'F3', frequency: 174.61, type: 'white' },
        { key: 'R', note: 'F#3', frequency: 185.00, type: 'black' },
        { key: 'G', note: 'G3', frequency: 196.00, type: 'white' },
        { key: 'T', note: 'G#3', frequency: 207.65, type: 'black' },
        { key: 'H', note: 'A3', frequency: 220.00, type: 'white' },
        { key: 'Y', note: 'A#3', frequency: 233.08, type: 'black' },
        { key: 'J', note: 'B3', frequency: 246.94, type: 'white' },
        // Beginning of Octave 4
        { key: 'K', note: 'C4', frequency: 261.63, type: 'white' },
        { key: 'I', note: 'C#4', frequency: 277.18, type: 'black' },
        { key: 'L', note: 'D4', frequency: 293.66, type: 'white' },
        { key: 'O', note: 'D#4', frequency: 311.13, type: 'black' },
        { key: 'M', note: 'E4', frequency: 329.63, type: 'white' },
      ]
    },
    {
      id: 'mezoued',
      name: 'Mezoued',
      description: 'Le souffle de la terre tunisienne, une cornemuse traditionnelle au caractère puissant.',
      icon: '🎷',
      color: '#ef4444',
      sounds: [
        { key: 'A', note: 'G3', frequency: 196.00 },
        { key: 'S', note: 'A3', frequency: 220.00 },
        { key: 'D', note: 'B3', frequency: 246.94 },
        { key: 'F', note: 'C4', frequency: 261.63 },
        { key: 'G', note: 'D4', frequency: 293.66 },
        { key: 'H', note: 'E4', frequency: 329.63 },
      ]
    }
  ];

  rhythms = [
    { name: 'Aucun', id: 'none' },
    { name: 'Fazani', id: 'fazani', file: '/mezwed/Fazeni.m4a' },
    { name: 'Ghita', id: 'ghita', file: '/mezwed/Ghita.m4a' },
    { name: 'Gobehi', id: 'gobehi', file: '/mezwed/gobe7i.m4a' }
  ];

  activeInstrument = signal<Instrument>(this.instruments[0]);
  activeRhythm = signal<string>('none');
  pressingKeys = signal<Set<string>>(new Set());
  bars = signal<number[]>(Array(40).fill(10));
  isRecording = signal<boolean>(false);
  recordedSequence = signal<{ sound: any, timestamp: number }[]>([]);
  recordingStartTime = 0;

  // Global Org Settings
  octaveOffset = signal<number>(0);
  reverbAmount = signal<number>(30); // 0-100

  private audioCtx?: AudioContext;
  private activeOscillators: Map<string, any> = new Map();
  private rhythmSource?: AudioBufferSourceNode; // Track current playing loop
  private audioBuffers: Map<string, AudioBuffer> = new Map();

  ngOnInit() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.startVisualizerAnimation();
    this.preloadSamples();
  }

  ngOnDestroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.stopRhythm();
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }

  private preloadSamples() {
    this.initAudio();
    const sampleUrls: any = {
      'flute': 'https://vinstra.io/samples/ney_c4.mp3',
      'jazz': 'https://vinstra.io/samples/jazz_organ_c4.mp3',
      'kanoun': 'https://vinstra.io/samples/kanoun_c4.mp3'
    };

    // Add rhythms to preloader
    this.rhythms.forEach(r => {
      if (r.file) sampleUrls[r.id] = r.file;
    });

    Object.entries(sampleUrls).forEach(([id, url]) => {
      fetch(url as string)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
          if (this.audioCtx) return this.audioCtx.decodeAudioData(arrayBuffer);
          throw new Error('No Context');
        })
        .then(audioBuffer => this.audioBuffers.set(id, audioBuffer))
        .catch(e => console.error('Error loading sample', id, e));
    });
  }

  private initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  selectInstrument(inst: Instrument) {
    this.activeInstrument.set(inst);
  }

  setOrgSound(sid: string) {
    this.activeInstrument.update(inst => ({ ...inst, activeSoundId: sid }));
  }

  changeOctave(delta: number) {
    this.octaveOffset.update(v => {
      const next = v + delta;
      return (next >= -2 && next <= 2) ? next : v;
    });
  }

  updateReverb(e: any) {
    this.reverbAmount.set(parseInt(e.target.value));
  }

  selectRhythm(rid: string) {
    this.activeRhythm.set(rid);
    this.stopRhythm();
    if (rid !== 'none') {
      this.startRhythm(rid);
    }
  }

  private startRhythm(rid: string) {
    const buffer = this.audioBuffers.get(rid);
    if (!buffer || !this.audioCtx) return;

    this.rhythmSource = this.audioCtx.createBufferSource();
    this.rhythmSource.buffer = buffer;
    this.rhythmSource.loop = true;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.6, this.audioCtx.currentTime); // Adjust loop volume

    this.rhythmSource.connect(gain);
    gain.connect(this.audioCtx.destination);

    this.rhythmSource.start();
  }

  private stopRhythm() {
    if (this.rhythmSource) {
      try {
        this.rhythmSource.stop();
      } catch (e) { }
      this.rhythmSource = undefined;
    }
  }

  private playBeat(rid: string, beat: number) {
    if (!this.audioCtx) return;

    let playDum = false;
    let playTak = false;

    if (rid === 'fazani') {
      if (beat === 0 || beat === 4) playDum = true;
      if (beat === 3 || beat === 6) playTak = true;
    } else if (rid === 'ghita') {
      if (beat === 0 || beat === 2) playDum = true;
      if (beat === 4 || beat === 6) playTak = true;
    } else if (rid === 'masmoudi') {
      if (beat === 0 || beat === 1) playDum = true;
      if (beat === 4) playTak = true;
    }

    if (playDum) this.synthDrum(80, 0.2);
    if (playTak) this.synthDrum(400, 0.05);
  }

  private synthDrum(freq: number, decay: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + decay);

    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + decay);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + decay);
  }

  handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toUpperCase();
    const sound = this.activeInstrument().sounds.find(s => s.key === key);
    if (sound && !this.pressingKeys().has(key)) {
      this.playSound(sound);
    }
  }

  handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toUpperCase();
    this.stopSound(key);
  }

  playSound(sound: any) {
    this.initAudio();
    if (!this.audioCtx) return;

    this.pressingKeys.update(keys => {
      const next = new Set(keys);
      next.add(sound.key);
      return next;
    });

    const sid = this.activeInstrument().activeSoundId;
    const buffer = sid ? this.audioBuffers.get(sid) : null;
    let source: any;
    const gain = this.audioCtx.createGain();

    if (this.activeInstrument().id === 'org' && buffer) {
      source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      const baseFreq = 261.63; // C4
      let freq = sound.frequency * Math.pow(2, this.octaveOffset());
      source.playbackRate.setValueAtTime(freq / baseFreq, this.audioCtx.currentTime);
      source.connect(gain);
    } else {
      const osc = this.audioCtx.createOscillator();
      source = osc;
      switch (this.activeInstrument().id) {
        case 'darbuka':
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.2);
          break;
        case 'oud':
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.8);
          break;
        case 'org':
          if (sid === 'flute') {
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
          } else if (sid === 'kanoun') {
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
          } else {
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
          }
          gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1.0);
          break;
        case 'mezoued':
          osc.type = 'square';
          gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
          break;
      }

      let freq = sound.frequency;
      if (this.activeInstrument().id === 'org') {
        freq = freq * Math.pow(2, this.octaveOffset());
      }
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.connect(gain);
    }

    gain.connect(this.audioCtx.destination);
    source.start();
    this.activeOscillators.set(sound.key, source);

    if (this.isRecording()) {
      this.recordedSequence.update(seq => [...seq, { sound, timestamp: Date.now() - this.recordingStartTime }]);
    }

    this.bars.update(b => {
      const nb = [...b];
      for (let i = 0; i < nb.length; i++) nb[i] = Math.min(100, nb[i] + Math.random() * 50);
      return nb;
    });
  }

  stopSound(key: string) {
    const source = this.activeOscillators.get(key);
    if (source) {
      try {
        source.stop();
      } catch (e) { }
      this.activeOscillators.delete(key);
    }

    this.pressingKeys.update(keys => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
  }

  toggleRecording() {
    if (!this.isRecording()) {
      this.isRecording.set(true);
      this.recordedSequence.set([]);
      this.recordingStartTime = Date.now();
    } else {
      this.isRecording.set(false);
    }
  }

  playRecording() {
    const seq = this.recordedSequence();
    seq.forEach(item => {
      setTimeout(() => {
        this.playSound(item.sound);
        setTimeout(() => this.stopSound(item.sound.key), 200);
      }, item.timestamp);
    });
  }

  private startVisualizerAnimation() {
    setInterval(() => {
      this.bars.update(b => b.map(v => Math.max(10, v - 2)));
    }, 50);
  }

  goBack() {
    this.ludification.reportStandaloneGame({
      gameKind: 'MUSIC',
      gameId: 1,
      score: 100,
      maxScore: 100
    }).subscribe();
    window.history.back();
  }
}
