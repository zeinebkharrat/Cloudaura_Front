import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { RouterModule } from '@angular/router';

interface Card {
  id: string;
  suit: 'denarii' | 'spades' | 'clubs' | 'hearts';
  value: number; // 1-7, 8(Valet), 9(Cavalier), 10(Roi)
  display: string;
  image: string;
}

interface GameState {
  deck: Card[];
  playerHand: Card[];
  botHand: Card[];
  tableCards: Card[];
  playerGains: Card[];
  botGains: Card[];
  playerChkobbas: number;
  botChkobbas: number;
  lastTaker: 'player' | 'bot' | null;
  turn: 'player' | 'bot';
  isGameOver: boolean;
  message: string;
}

@Component({
  selector: 'app-chkobba-player',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="chkobba-container" [style.backgroundImage]="'url(' + tableBg + ')'" (click)="onGlobalClick()">
      <div class="scenic-overlay"></div>
      
      <!-- HUD Top Right: Bot & Music -->
      <div class="hud top right">
        <div class="player-info bot-info">
          <div class="avatar bot">🤖</div>
          <div class="stats">
            <span class="name">ORDINATEUR</span>
            <span class="score">Gains: {{ state.botGains.length }} | Chkobba: {{ state.botChkobbas }}</span>
          </div>
        </div>

        <div class="radio-controls">
          <button class="music-btn" (click)="toggleMusic()" [class.active]="isPlaying">
            {{ isPlaying ? '⏸️' : '▶️' }}
          </button>
          <button class="music-btn" (click)="nextTrack()">
            ⏭️
          </button>
        </div>
      </div>

      <!-- HUD Top Left: Game Title -->
      <div class="hud top left">
        <div class="game-info">
          <span class="chkobba-title">CHKOBBA TUNESIENNE</span>
        </div>
      </div>

      <!-- Main Game Area -->
      <div class="game-area">
        <!-- Bot Hand (Hidden) -->
        <div class="hand bot-hand">
          <div class="card-back" *ngFor="let c of state.botHand"></div>
        </div>

        <!-- Table Center -->
        <div class="table-container-outer">
          <div class="table-center" [@cardAnimation]="state.tableCards.length">
            <div class="card on-table" *ngFor="let card of state.tableCards; let i = index" 
                 [class.selected]="isSelected(card)"
                 [style.transform]="'rotate(' + ((i % 3) * 2 - 1) + 'deg) translate(' + (i*2) + 'px, ' + (i) + 'px)'">
              <img [src]="card.image" class="card-img" [alt]="card.id">
            </div>
          </div>
        </div>

        <!-- Player Hand -->
        <div class="hand player-hand">
          <div class="card player-card" 
               *ngFor="let card of state.playerHand"
               (click)="onPlayerCardClick(card)"
               [class.playable]="state.turn === 'player' && !pendingSelection">
            <img [src]="card.image" class="card-img" [alt]="card.id">
            <div class="playable-overlay" *ngIf="state.turn === 'player' && !pendingSelection"></div>
          </div>
        </div>
      </div>

      <!-- Selection Modal -->
      <div class="selection-modal-overlay" *ngIf="pendingSelection" [@cardAnimation]>
        <div class="selection-modal">
          <h3>Choisir la combinaison à collecter</h3>
          <p>Vous avez joué : {{ pendingSelection.card.value }}</p>
          <div class="options-container">
            <div class="option-row" *ngFor="let opt of pendingSelection.options; let i = index" (click)="selectPriseOption(opt)">
              <div class="option-header">Option {{ i + 1 }}</div>
              <div class="option-cards">
                <div class="mini-card" *ngFor="let c of opt">
                  <img [src]="c.image" alt="card">
                </div>
              </div>
            </div>
          </div>
          <button class="cancel-btn" (click)="pendingSelection = null; state.message = 'Tour annulé.'">Annuler le coup</button>
        </div>
      </div>

      <!-- HUD Bottom Left: Player Info -->
      <div class="hud bottom left">
        <div class="player-info player-info-box">
          <div class="avatar player">👤</div>
          <div class="stats">
            <span class="name">VOUS (CHEF)</span>
            <span class="score">Gains: {{ state.playerGains.length }} | Chkobba: {{ state.playerChkobbas }}</span>
          </div>
        </div>
      </div>

      <div class="shisha-interaction-zone" (click)="playShisha()">
        <div class="smoke-container" *ngIf="showSmoke">
          <div class="smoke-particle p1"></div>
          <div class="smoke-particle p2"></div>
          <div class="smoke-particle p3"></div>
          <div class="smoke-particle p4"></div>
          <div class="smoke-particle p5"></div>
          <div class="smoke-particle p6"></div>
          <div class="smoke-particle p7"></div>
          <div class="smoke-particle p8"></div>
        </div>
      </div>

      <!-- Turn Message Floating -->
      <div class="turn-status-container" *ngIf="state.message">
        <div class="game-msg">
          {{ state.message }}
        </div>
      </div>

      <!-- GameOver Overlay -->
      <div class="overlay" *ngIf="state.isGameOver">
        <div class="glass-module">
          <h2 class="result-title">{{ getWinnerMessage() }}</h2>
          <div class="score-grid">
            <div class="score-row">
              <span>Points Dinari (7♦):</span> 
              <strong [class.plus]="finalPoints.dinariResult > 0">{{ finalPoints.dinariResult }}</strong>
            </div>
            <div class="score-row">
              <span>Points Dinaryet (>5 ♦):</span> 
              <strong [class.plus]="finalPoints.dinaryet > 0">{{ finalPoints.dinaryet > 0 ? 1 : 0 }}</strong>
            </div>
            <div class="score-row">
              <span>Points Karta (Most Cards):</span> 
              <strong [class.plus]="finalPoints.karta > 0">{{ finalPoints.karta > 0 ? 1 : 0 }}</strong>
            </div>
            <div class="score-row">
              <span>Points Sabeat (Most 7s):</span> 
              <strong [class.plus]="finalPoints.sabeat > 0">{{ finalPoints.sabeat > 0 ? 1 : 0 }}</strong>
            </div>
            <div class="score-row">
              <span>Points Chkobba:</span> 
              <strong [class.plus]="state.playerChkobbas > 0">{{ state.playerChkobbas }}</strong>
            </div>
          </div>
          
          <div class="total-comparison">
            <div class="score-block">
              <span>VOUS</span>
              <h1 class="total-score">{{ totalScore }}</h1>
            </div>
            <div class="vs">VS</div>
            <div class="score-block">
              <span>BOT</span>
              <h1 class="total-score bot">{{ botScore }}</h1>
            </div>
          </div>

          <button class="primary-btn pulse" (click)="resetGame()">REJOUER</button>
          <button class="secondary-btn" routerLink="/games">QUITTER</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chkobba-container {
      width: 100vw;
      height: 100vh;
      background-size: cover;
      background-position: center;
      position: relative;
      overflow: hidden;
      font-family: 'Outfit', sans-serif;
      color: white;
      background-color: #1a1a2e; 
    }

    .scenic-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%);
      pointer-events: none;
      z-index: 1;
    }

    .hud {
      position: absolute;
      z-index: 100;
      min-width: 250px;
    }
    .hud.top.right { top: 20px; right: 20px; }
    .hud.top.left { top: 25px; left: 30px; }
    .hud.bottom.left { bottom: 25px; left: 30px; }

    .game-info {
      padding: 5px 0;
      border-bottom: 2px solid #fbbf24;
      display: inline-block;
    }
    .chkobba-title {
      font-size: 1.2rem;
      font-weight: 950;
      letter-spacing: 3px;
      color: #fff;
      text-transform: uppercase;
      text-shadow: 0 4px 10px rgba(0,0,0,0.8);
    }

    .player-info {
      display: flex;
      align-items: center;
      gap: 15px;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(15px);
      padding: 8px 25px;
      border-radius: 50px;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      white-space: nowrap;
    }
    .avatar { font-size: 1.4rem; }
    .name { font-weight: 800; font-size: 0.8rem; color: #fbbf24; }
    .score { font-size: 0.75rem; color: #fff; }

    .radio-controls {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      justify-content: flex-end;
    }
    .music-btn {
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      font-size: 1rem;
    }
    .music-btn:hover { background: rgba(0,0,0,0.8); transform: scale(1.1); }
    .music-btn.active { border-color: #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,0.3); }

    .game-area {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      align-items: center;
      padding: 20px 0 60px 0; /* Extra bottom padding for hand */
      position: relative;
      z-index: 2;
    }

    .table-container-outer {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 1400px;
    }

    .table-center {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      width: 60%; /* Closer to the green mat width */
      height: 50%;
      min-height: 380px;
      justify-content: center;
      align-content: flex-end; /* Push cards down slightly on the felt */
      padding: 20px;
      background: rgba(0, 0, 0, 0.02);
      border: 3px solid rgba(251, 191, 36, 0.2);
      border-radius: 8px;
    }

    .hand { 
      display: flex !important; 
      flex-direction: row !important; 
      gap: 20px; 
      perspective: 1000px; 
      justify-content: center;
      width: 100%;
    }

    .card {
      width: 95px;
      height: 142px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.5);
      position: relative;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      overflow: hidden;
      border: 2px solid #fff;
    }
    .card-img { width: 100%; height: 100%; object-fit: cover; }
    .on-table { width: 95px; height: 142px; }
    .on-table:hover { transform: scale(1.15) !important; z-index: 50 !important; }
    
    .player-card { cursor: pointer; }
    .player-card:hover { transform: translateY(-30px) scale(1.1); z-index: 10; }
    .player-card.playable { border-color: #fbbf24; box-shadow: 0 0 25px rgba(251,191,36,0.6); }

    .card-back {
      width: 90px;
      height: 135px;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      border: 3px solid white;
      border-radius: 8px;
    }
    
    .turn-status-container {
      position: absolute;
      bottom: 25px;
      right: 25px;
      z-index: 200;
    }

    /* Selection Modal */
    .selection-modal-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.85);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(5px);
    }
    .selection-modal {
      background: #1e293b;
      padding: 30px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.1);
      width: 90%;
      max-width: 500px;
      color: white;
      text-align: center;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }
    .selection-modal h3 { margin-top: 0; color: #fbbf24; }
    .options-container {
      margin: 20px 0;
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .option-row {
      background: rgba(255,255,255,0.05);
      padding: 15px;
      border-radius: 12px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .option-row:hover {
      background: rgba(251, 191, 36, 0.1);
      border-color: #fbbf24;
      transform: scale(1.02);
    }
    .option-header { font-size: 0.8rem; color: #94a3b8; margin-bottom: 8px; }
    .option-cards { display: flex; gap: 8px; justify-content: center; }
    .mini-card { width: 45px; height: 68px; border-radius: 4px; overflow: hidden; border: 1px solid white; }
    .mini-card img { width: 100%; height: 100%; object-fit: cover; }
    .cancel-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.2);
      color: #94a3b8;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }
    .cancel-btn:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

    .game-msg {
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: white;
      padding: 12px 30px;
      border-radius: 40px;
      font-weight: 800;
      box-shadow: 0 10px 25px rgba(37,99,235,0.3);
      animation: bounce 1.5s infinite;
      font-size: 0.9rem;
    }

    .on-table {
      width: 95px;
      height: 142px;
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    }
    .glass-module {
      background: rgba(15, 23, 42, 0.95);
      padding: 50px;
      border-radius: 40px;
      text-align: center;
      width: 90%;
      max-width: 500px;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 30px 60px rgba(0,0,0,0.8);
    }
    .result-title { font-size: 2.5rem; margin-bottom: 30px; letter-spacing: 2px; }
    .score-grid { margin: 30px 0; background: rgba(255,255,255,0.03); border-radius: 20px; padding: 15px; }
    .score-row { display: flex; justify-content: space-between; padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .score-row:last-child { border: none; }
    .plus { color: #22c55e; }
    
    .total-comparison {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 30px;
      margin: 30px 0;
    }
    .score-block span { font-size: 0.8rem; color: #64748b; font-weight: bold; }
    .total-score { font-size: 4rem; color: #22c55e; margin: 5px 0; text-shadow: 0 0 30px rgba(34,197,94,0.4); }
    .total-score.bot { color: #ef4444; text-shadow: 0 0 30px rgba(239,68,68,0.4); }
    .vs { font-size: 1.2rem; font-weight: 900; color: #475569; }

    .primary-btn {
      background: linear-gradient(135deg, #22c55e, #10b981);
      border: none;
      color: white;
      padding: 18px 50px;
      border-radius: 50px;
      font-weight: 800;
      font-size: 1.1rem;
      width: 100%;
      margin-bottom: 15px;
      cursor: pointer;
      box-shadow: 0 10px 0 #065f46;
      transition: all 0.2s;
    }
    .primary-btn:active { transform: translateY(5px); box-shadow: 0 5px 0 #065f46; }
    .secondary-btn {
      background: transparent;
      border: 2px solid rgba(255,255,255,0.1);
      color: #94a3b8;
      padding: 12px 40px;
      border-radius: 50px;
      width: 100%;
      cursor: pointer;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    .pulse { animation: pulseAnim 2s infinite; }
    @keyframes pulseAnim {
      0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
      70% { box-shadow: 0 0 0 15px rgba(34,197,94,0); }
      100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    }

    /* Shisha & Smoke Styles */
    .shisha-interaction-zone {
      position: absolute;
      top: 15%;
      left: 0;
      width: 250px;
      height: 450px;
      z-index: 50;
      cursor: url('https://cdn0.iconfinder.com/data/icons/smoking-6/512/hookah-512.png'), pointer;
    }

    .smoke-container {
      position: absolute;
      top: 15%; /* Higher up */
      left: 45%;
      pointer-events: none;
    }

    .smoke-particle {
      position: absolute;
      width: 120px; /* Bigger */
      height: 120px;
      background: radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 70%); /* More opaque */
      border-radius: 50%;
      opacity: 0;
      filter: blur(15px); /* More blurred for volume */
    }

    @keyframes smokeFloat {
      0% { transform: translateY(0) translateX(0) scale(0.5); opacity: 0.95; }
      100% { transform: translateY(-380px) translateX(40px) scale(3.5); opacity: 0; }
    }

    .p1 { animation: smokeFloat 3.5s infinite 0s ease-out; }
    .p2 { animation: smokeFloat 3.5s infinite 0.4s ease-out; }
    .p3 { animation: smokeFloat 3.5s infinite 0.8s ease-out; }
    .p4 { animation: smokeFloat 3.5s infinite 1.2s ease-out; }
    .p5 { animation: smokeFloat 3.5s infinite 1.6s ease-out; }
    .p6 { animation: smokeFloat 3.5s infinite 2.0s ease-out; }
    .p7 { animation: smokeFloat 3.5s infinite 2.4s ease-out; }
    .p8 { animation: smokeFloat 3.5s infinite 2.8s ease-out; }
  `],
  animations: [
    trigger('cardAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'scale(0.5) translateY(100px) rotate(-20deg)' }),
          stagger(80, [
            animate('0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({ opacity: 1, transform: 'scale(1) translateY(0) rotate(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class ChkobbaPlayerComponent implements OnInit, OnDestroy {
  tableBg = '/chkobba_bg.png';
  state: GameState = this.getInitialState();
  finalPoints = { karta: 0, dinariResult: 0, dinaryet: 0, sabeat: 0 };
  totalScore = 0;
  botScore = 0;
  pendingSelection: { card: Card, options: Card[][] } | null = null;

  // Audio / Radio logic
  tracks = [
    '/chkoba music/MALOUF_TUNISIEN_PARIS_-_-_Notre_invite_Mahmoud_Frih.mp3',
    '/chkoba music/video_1776008834.mp3'
  ];
  currentTrackIndex = 0;
  audio = new Audio();
  isPlaying = false;
  
  // Shisha Logic
  shishaAudio = new Audio('/Video Project.m4a');
  showSmoke = false;

  constructor() {}

  ngOnInit() {
    this.initGame();
    this.initAudio();
    this.shishaAudio.src = this.encodeUrl('/Video Project.m4a');
    this.shishaAudio.load();
  }

  ngOnDestroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.load();
      this.isPlaying = false;
    }
  }

  initAudio() {
    this.audio.src = this.encodeUrl(this.tracks[this.currentTrackIndex]);
    this.audio.load();
    this.audio.onended = () => this.nextTrack();
    
    // Attempt auto-play (might be blocked by browser until first click)
    this.playMusic();
  }

  playMusic() {
    this.audio.play().then(() => {
      this.isPlaying = true;
    }).catch(err => {
      console.log("Autoplay blocked. Waiting for user interaction.");
      this.isPlaying = false;
    });
  }

  toggleMusic() {
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.playMusic();
    }
  }

  onGlobalClick() {
    // Browsers require a user interaction to play audio. 
    // This starts it on the first click in the game area.
    if (!this.isPlaying) {
      this.playMusic();
    }
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.audio.src = this.encodeUrl(this.tracks[this.currentTrackIndex]);
    this.audio.load();
    this.playMusic();
  }

  encodeUrl(url: string): string {
    if (!url) return '';
    // Encode each part except slashes
    return url.split('/').map(part => encodeURIComponent(part)).join('/').replace(/\/\//g, '/');
  }

  playShisha() {
    this.showSmoke = true;
    this.shishaAudio.currentTime = 0;
    this.shishaAudio.volume = 1.0; // Max volume
    this.shishaAudio.play();
    
    // Stop smoke after 12 seconds instead of 10
    setTimeout(() => {
      this.showSmoke = false;
    }, 12000);
  }

  getInitialState(): GameState {
    return {
      deck: [],
      playerHand: [],
      botHand: [],
      tableCards: [],
      playerGains: [],
      botGains: [],
      playerChkobbas: 0,
      botChkobbas: 0,
      lastTaker: null,
      turn: 'player',
      isGameOver: false,
      message: "C'est votre tour !"
    };
  }

  initGame(): void {
    const deck: Card[] = [];
    const suits: ('denarii' | 'spades' | 'clubs' | 'hearts')[] = ['denarii', 'spades', 'clubs', 'hearts'];
    
    const folderMapping: any = {
      1: { folder: 'carte de valeur 1', files: ['Dinari.JPG', 'WhatsApp Image 2026-04-12 at 15.30.28.JPG', 'WhatsApp Image 2026-04-12 at 15.30.36 (5).JPG', 'WhatsApp Image 2026-04-12 at 15.30.36.JPG'] },
      2: { folder: 'carte de valeur 2', files: ['dinari.JPG', 'valeur=2.JPG', 'WhatsApp Image 2026-04-12 at 15.30.34.JPG', 'WhatsApp Image 2026-04-12 at 15.30.35.JPG'] },
      3: { folder: 'Carte de valeur 3', files: ['Dinari.JPG', 'WhatsApp Image 2026-04-12 at 15.30.35 (1).JPG', 'WhatsApp Image 2026-04-12 at 15.30.36 (2).JPG', 'WhatsApp Image 2026-04-12 at 15.30.37 (3).JPG'] },
      4: { folder: 'Carte de valeur 4', files: ['Dinari.JPG', 'WhatsApp Image 2026-04-12 at 15.30.26.JPG', 'WhatsApp Image 2026-04-12 at 15.30.27 (3).JPG', 'WhatsApp Image 2026-04-12 at 15.30.37 (4).JPG'] },
      5: { folder: 'Carte de valeur 5', files: ['Dinari.JPG', 'WhatsApp Image 2026-04-12 at 15.30.27 (1).JPG', 'WhatsApp Image 2026-04-12 at 15.30.28 (2).JPG', 'WhatsApp Image 2026-04-12 at 15.30.37.JPG'] },
      6: { folder: 'Carte de valeur 6', files: ['Dinari.JPG', 'valeur= 6 (2).JPG', 'valeur= 6.JPG', 'WhatsApp Image 2026-04-12 at 15.30.36 (7).JPG'] },
      7: { folder: 'Carte de valeur 7', files: ['aa.JPG', 'Dinari.JPG', 'WhatsApp Image 2026-04-12 at 15.30.34 (4).JPG', 'WhatsApp Image 2026-04-12 at 15.30.35 (3).JPG'] },
      8: { folder: 'Carte de valeur 8', files: ['Dinari.JPG', 'WhatsApp Image 2026-04-12 at 15.30.28 (1).JPG', 'WhatsApp Image 2026-04-12 at 15.30.29.JPG', 'WhatsApp Image 2026-04-12 at 15.30.36 (3).JPG'] },
      9: { folder: 'Carte de valeur 9', files: ['Dinari.JPG', 'WhatsApp Image 2026-04-12 at 15.30.34 (3).JPG', 'WhatsApp Image 2026-04-12 at 15.30.36 (6).JPG', 'WhatsApp Image 2026-04-12 at 15.30.37 (2).JPG'] },
      10: { folder: 'Carte de valeur 10', files: ['Dinari.JPG', 'valeur= ray.JPG', 'WhatsApp Image 2026-04-12 at 15.30.27.JPG', 'WhatsApp Image 2026-04-12 at 15.30.34 (2).JPG'] }
    };

    for (let v = 1; v <= 10; v++) {
      const mapping = folderMapping[v];
      const folderPath = `carte/${mapping.folder}`;
      
      // Dinari always mapped to 'denarii' suit
      const dinariFile = mapping.files.find((f: string) => f.toLowerCase().includes('dinari')) || mapping.files[0];
      const otherFiles = mapping.files.filter((f: string) => f !== dinariFile);

      suits.forEach((suit, index) => {
        let img = '';
        if (suit === 'denarii') {
          img = `${folderPath}/${dinariFile}`;
        } else {
          // Map other suits to remaining files
          img = `${folderPath}/${otherFiles[index - 1] || otherFiles[0]}`;
        }
        
        deck.push({
          id: `${suit}_${v}`,
          suit,
          value: v,
          display: this.getCardDisplay({ value: v } as any),
          image: this.encodeUrl(img)
        });
      });
    }
    
    this.state.deck = this.shuffle(deck);
    this.state.tableCards = this.state.deck.splice(0, 4);
    
    // Check if 3 or 4 of same value on table -> redistribute (rule of Chkobba)
    const counts: any = {};
    this.state.tableCards.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
    if (Object.values(counts).some((v: any) => v >= 3)) {
      this.initGame();
      return;
    }

    this.dealRound();
  }

  dealRound() {
    if (this.state.deck.length === 0 && this.state.playerHand.length === 0) {
      this.endGame();
      return;
    }
    this.state.playerHand = this.state.deck.splice(0, 3);
    this.state.botHand = this.state.deck.splice(0, 3);
  }

  onPlayerCardClick(card: Card) {
    if (this.state.turn !== 'player' || this.state.isGameOver || this.pendingSelection) return;

    const options = this.findPriseOptions(card, this.state.tableCards);
    
    if (options.length === 1) {
      this.executePrise('player', card, options[0]);
    } else if (options.length > 1) {
      // Multiple solutions found: let player choose
      this.pendingSelection = { card, options };
      this.state.message = "Plusieurs combinaisons possibles. Veuillez choisir laquelle collecter !";
      return; // Wait for selection
    } else {
      // No capture possible
      this.state.tableCards.push(card);
      this.state.playerHand = this.state.playerHand.filter(c => c.id !== card.id);
    }

    this.checkNextStep('bot');
  }

  selectPriseOption(option: Card[]) {
    if (!this.pendingSelection) return;
    this.executePrise('player', this.pendingSelection.card, option);
    this.pendingSelection = null;
    this.checkNextStep('bot');
  }

  botTurn() {
    this.state.message = "L'ordinateur réfléchit...";
    setTimeout(() => {
      let bestMove: { card: Card, targets: Card[] } | null = null;
      
      for (const card of this.state.botHand) {
        const options = this.findPriseOptions(card, this.state.tableCards);
        if (options.length > 0) {
          // Bot picks the one with the 7 Dinari, or the one with most cards
          let bestOption = options[0];
          for (const opt of options) {
             const has7D = (c: Card) => c.suit === 'denarii' && c.value === 7;
             if (opt.some(has7D)) {
               bestOption = opt;
               break;
             }
             if (opt.length > bestOption.length) {
               bestOption = opt;
             }
          }
          if (!bestMove || bestOption.length > bestMove.targets.length) {
            bestMove = { card, targets: bestOption };
          }
        }
      }

      if (bestMove) {
        this.executePrise('bot', bestMove.card, bestMove.targets);
      } else {
        const throwCard = this.state.botHand[0];
        this.state.tableCards.push(throwCard);
        this.state.botHand = this.state.botHand.filter(c => c.id !== throwCard.id);
      }

      this.checkNextStep('player');
    }, 1200);
  }

  findPriseOptions(card: Card, table: Card[]): Card[][] {
    // 1. RULE: Direct match takes priority. Sum rule is inactive if direct match exists.
    const direct = table.find(c => c.value === card.value);
    if (direct) return [[direct]];

    // 2. Sum rule: find all subsets
    return this.getSubsets(table, card.value);
  }

  executePrise(who: 'player' | 'bot', card: Card, targets: Card[]) {
    const isChkobba = this.state.tableCards.length === targets.length && this.state.deck.length > 0;
    
    if (who === 'player') {
      this.state.playerGains.push(card, ...targets);
      this.state.playerHand = this.state.playerHand.filter(c => c.id !== card.id);
      this.state.lastTaker = 'player';
      if (isChkobba) {
        this.state.playerChkobbas++;
        this.state.message = "CHKOBBA !! 🌟";
      }
    } else {
      this.state.botGains.push(card, ...targets);
      this.state.botHand = this.state.botHand.filter(c => c.id !== card.id);
      this.state.lastTaker = 'bot';
      if (isChkobba) {
        this.state.botChkobbas++;
        this.state.message = "LE BOT FAIT UN CHKOBBA ! 💀";
      }
    }
    this.state.tableCards = this.state.tableCards.filter(c => !targets.find(t => t.id === c.id));
  }

  checkNextStep(nextTurn: 'player' | 'bot') {
    if (this.state.playerHand.length === 0 && this.state.botHand.length === 0) {
      if (this.state.deck.length === 0) {
        // Last taker collects remaining table cards
        if (this.state.lastTaker === 'player') this.state.playerGains.push(...this.state.tableCards);
        else if (this.state.lastTaker === 'bot') this.state.botGains.push(...this.state.tableCards);
        this.state.tableCards = [];
        this.endGame();
      } else {
        this.dealRound();
        this.state.turn = nextTurn;
        if (nextTurn === 'bot') this.botTurn();
      }
    } else {
      this.state.turn = nextTurn;
      if (nextTurn === 'bot') this.botTurn();
      else this.state.message = "À vous de jouer !";
    }
  }

  endGame() {
    this.calculatePoints();
    this.state.isGameOver = true;
  }

  calculatePoints() {
    const pG = this.state.playerGains;
    const bG = this.state.botGains;

    // 1. Karta (Most cards)
    this.finalPoints.karta = pG.length > bG.length ? 1 : 0;
    
    // 2. 7 Dinari (Borma) - Gives a full point to whoever collects it
    this.finalPoints.dinariResult = pG.some(c => c.suit === 'denarii' && c.value === 7) ? 1 : 0;
    const botBorma = bG.some(c => c.suit === 'denarii' && c.value === 7) ? 1 : 0;

    // 3. Dinari Count (Dinaryet)
    // Rule: if > 5 Dinari cards -> 1 point for player, if < 5 -> 1 point for opponent
    const pDinariCount = pG.filter(c => c.suit === 'denarii').length;
    const bDinariCount = bG.filter(c => c.suit === 'denarii').length;
    
    this.finalPoints.dinaryet = pDinariCount > 5 ? 1 : 0;
    const botDinaryet = bDinariCount > 5 ? 1 : 0;

    // 4. Sabeat (Most 7s)
    const p7 = pG.filter(c => c.value === 7).length;
    const b7 = bG.filter(c => c.value === 7).length;
    this.finalPoints.sabeat = p7 > b7 ? 1 : 0;
    const botSabeat = b7 > p7 ? 1 : 0;

    // Scores
    this.totalScore = this.finalPoints.karta + this.finalPoints.dinariResult + this.finalPoints.dinaryet + this.finalPoints.sabeat + this.state.playerChkobbas;
    this.botScore = (bG.length > pG.length ? 1 : 0) + botBorma + botDinaryet + botSabeat + this.state.botChkobbas;
  }

  getWinnerMessage(): string {
    if (this.totalScore > this.botScore) return "VICTOIRE ! 🥳";
    if (this.totalScore < this.botScore) return "DEFAITE... 😢";
    return "EGALITE ! 🤝";
  }

  resetGame() {
    this.state = this.getInitialState();
    this.initGame();
  }

  private shuffle(array: any[]) {
    return array.sort(() => Math.random() - 0.5);
  }

  private getSubsets(arr: Card[], target: number): Card[][] {
    const result: Card[][] = [];
    const backtrack = (start: number, current: Card[], sum: number) => {
      if (sum === target) {
        result.push([...current]);
        return;
      }
      if (sum > target) return;
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        backtrack(i + 1, current, sum + arr[i].value);
        current.pop();
      }
    };
    backtrack(0, [], 0);
    return result;
  }

  getCardDisplay(card: Card) {
    if (card.value === 1) return 'A';
    if (card.value === 8) return 'J';
    if (card.value === 9) return 'Q';
    if (card.value === 10) return 'K';
    return card.value.toString();
  }

  isSelected(card: Card) { return false; }
}
