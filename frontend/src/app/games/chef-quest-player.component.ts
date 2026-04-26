import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LudificationService } from '../core/ludification.service';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { ChefQuestService, CookingIngredient as BackendIngredient, Recipe as BackendRecipe } from './chef-quest.service';

interface Ingredient {
  id: string;
  name: string;
  count: number;
  needed: number;
  added: boolean;
  x: number; // Percent from left
  y: number; // Percent from top
  icon: string;
  isNeeded?: boolean; // If part of current recipe
}

@Component({
  selector: 'app-chef-quest-player',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="chef-game-shell">
      <!-- Header -->
      <div class="chef-header">
        <button class="back-btn" routerLink="/games">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div class="chef-title-group">
          <h1>CLOUD CHEF</h1>
          <span class="subtitle">{{ recipeTitle }}</span>
        </div>
        <div class="chef-stats">
          <div class="stat-item">
            <span class="label">LEVEL</span>
            <span class="value">1</span>
          </div>
          <div class="stat-item">
            <span class="label">POINTS</span>
            <span class="value">{{ points }}</span>
          </div>
        </div>
      </div>

      <!-- Main Game Viewport -->
      <div class="chef-viewport" [class.blur]="gameState !== 'playing'">
        <!-- Background Layer -->
        <div class="bg-layer" [style.backgroundImage]="'url(' + bgUrl + ')'"></div>

        <!-- Working Objects (Mixing Bowl, etc.) -->
        <div class="interactive-area">
          <!-- The Mixing Bowl -->
          <div class="mixing-bowl" 
               [class.active]="currentStep === 'mix'"
               [class.pouring]="isActionOngoing"
               [@bowlShake]="shakeState" 
               (click)="onBowlClick()">
            <div class="bowl-layer back"></div>
            <div class="bowl-content" [class.filled]="addedCount > 0">
              <div class="batter" [style.height.%]="batterHeight" [style.opacity]="batterOpacity"></div>
            </div>
            <div class="bowl-layer front"></div>
          </div>

          <!-- Left Shelf -->
          <div class="ingredients-side-shelf shelf-left">
            <div class="ingredient-item" 
                 *ngFor="let ing of ingredients; let i = index; let count = count"
                 [class.collected]="ing.added"
                 [class.hidden]="i >= count / 2"
                 (click)="useIngredient(ing)">
              <div class="ing-card-mini">
                <img [src]="ing.icon" class="ing-icon-graphic-mini" [alt]="ing.name">
                <span class="ing-name-mini">{{ ing.name }}</span>
              </div>
            </div>
          </div>

          <!-- Right Shelf -->
          <div class="ingredients-side-shelf shelf-right">
            <div class="ingredient-item" 
                 *ngFor="let ing of ingredients; let i = index; let count = count"
                 [class.collected]="ing.added"
                 [class.hidden]="i < count / 2"
                 (click)="useIngredient(ing)">
              <div class="ing-card-mini">
                <img [src]="ing.icon" class="ing-icon-graphic-mini" [alt]="ing.name">
                <span class="ing-name-mini">{{ ing.name }}</span>
              </div>
            </div>
          </div>

          <!-- Interactive Radio -->
          <div class="kitchen-radio" (click)="nextTrack()" [class.active]="isMusicPlaying">
            <div class="radio-body">
              <div class="radio-handle"></div>
              <span class="radio-icon">📻</span>
              <div class="music-notes" *ngIf="isMusicPlaying">
                <span class="note n1">♪</span>
                <span class="note n2">♫</span>
                <span class="note n3">♪</span>
              </div>
            </div>
            <div class="radio-status" [class.on]="isMusicPlaying">
              {{ isMusicPlaying ? 'LOTFI B. ON' : 'RADIO OFF' }}
            </div>
          </div>
          
          <!-- The Stove / Gaz Zone -->
          <div class="stove-zone" 
               [class.highlight]="currentStep === 'bake'"
               [class.pouring]="isActionOngoing"
               (click)="onOvenClick()">
            <div class="flame"></div>
          </div>
        </div>

        <!-- UI Overlays -->
        <div class="current-task" *ngIf="!recipeNotFound">
          <div class="task-icon"><i class="pi pi-info-circle"></i></div>
          <div class="task-text">
            <strong>STEP {{ stepIndex + 1 }}:</strong> 
            <span>{{ stepMessage }}</span>
          </div>
        </div>

        <!-- Recipe Not Found Overlay -->
        <div class="overlay" *ngIf="recipeNotFound" [@fadeIn]>
          <div class="glass-module">
            <div class="victory-crown">🥣🚫</div>
            <h2>Recipe Not Found</h2>
            <p>We couldn't find any recipes in the database. 🎨 Admin needs to create one!</p>
            <button class="primary-btn" routerLink="/games">Back to Games</button>
          </div>
        </div>
      </div>

      <!-- Inventory / Hotbar -->
      <div class="chef-hotbar" *ngIf="!recipeNotFound">
        <div class="inventory-slots">
          <ng-container *ngFor="let ing of ingredients">
            <div class="slot" *ngIf="ing.isNeeded" [class.full]="ing.added">
              <div class="slot-count">{{ ing.added ? '✓' : '0/1' }}</div>
              <img [src]="ing.icon" class="slot-icon" [style.opacity]="ing.added ? 1 : 0.2">
              <span class="slot-label">{{ ing.name }}</span>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Overlays (Start/Win) -->
      <div class="overlay start-overlay" *ngIf="gameState === 'start'">
        <div class="glass-module">
          <h2>CUISINE LIBRE</h2>
          <p>Mélangez les ingrédients de votre choix pour découvrir une recette secrète !</p>
          <button class="primary-btn" (click)="startGame()">COMMENCER</button>
        </div>
      </div>

      <div class="overlay victory-overlay" *ngIf="gameState === 'victory'" [@fadeIn]>
        <div class="glass-module">
          <div class="victory-crown">👑</div>
          <h2 style="color: #00ff7f;">{{ recipeTitle }} REUSSI !</h2>
          
          <div class="final-dish-preview" *ngIf="finalDishUrl">
            <img [src]="finalDishUrl" alt="Final Dish" 
                 style="width: 250px; height: 180px; object-fit: cover; border-radius: 20px; border: 4px solid #00ff7f; margin: 15px 0; box-shadow: 0 10px 30px rgba(0,255,127,0.3);">
          </div>

          <p class="recipe-description" *ngIf="recipeDesc" 
             style="font-style: italic; color: rgba(255,255,255,0.7); margin-bottom: 20px; font-size: 0.9rem; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.4;">
            "{{ recipeDesc }}"
          </p>

          <p>DELICIEUX ! Vous avez gagné {{ points }} Master Points !</p>
          <div class="overlay-actions">
            <button class="primary-btn secondary" (click)="resetGame()">REJOUER</button>
            <button class="primary-btn" routerLink="/games">RETOUR AUX JEUX</button>
          </div>
        </div>
      </div>

      <div class="overlay fail-overlay" *ngIf="gameState === 'fail'" [@fadeIn]>
        <div class="glass-module">
          <div class="victory-crown" style="filter: grayscale(1);">🥣</div>
          <h2>RECETTE INCONNUE</h2>
          <p>Ce mélange ne correspond à aucune recette de notre grimoire...</p>
          <button class="primary-btn" (click)="resetGame()">REESSAYER</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chef-game-shell {
      width: 100%;
      height: 100vh;
      background: #0a0a0e;
      color: white;
      font-family: 'Outfit', sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    /* Header Styles */
    .chef-header {
      height: 70px;
      background: rgba(20, 20, 25, 0.9);
      border-bottom: 2px solid rgba(0, 255, 127, 0.3);
      display: flex;
      align-items: center;
      padding: 0 30px;
      gap: 30px;
      z-index: 100;
    }

    .chef-title-group h1 {
      margin: 0;
      font-size: 1.5rem;
      letter-spacing: 2px;
      background: linear-gradient(90deg, #00ff7f, #00f2ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .chef-title-group .subtitle {
      font-size: 0.7rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 4px;
    }

    .chef-stats {
      margin-left: auto;
      display: flex;
      gap: 20px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .stat-item .label { font-size: 0.6rem; color: #888; }
    .stat-item .value { font-size: 1.2rem; font-weight: bold; color: #00ff7f; }

    /* Viewport */
    .chef-viewport {
      flex: 1;
      position: relative;
      background: #000;
      overflow: hidden;
      transition: filter 0.5s ease;
    }

    .chef-viewport.blur { filter: blur(10px) brightness(0.5); }

    .bg-layer {
      position: absolute;
      inset: 0;
      background-size: 100% 100%; /* Fix 'shape' by fitting to viewport exactly */
      background-position: center;
      opacity: 0.9;
    }

    .interactive-area {
      position: absolute;
      inset: 0;
      z-index: 5;
    }

    /* Side shelves for ingredients */
    .ingredients-side-shelf {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 15px;
      z-index: 50;
      padding: 20px;
    }
    
    .shelf-left { left: 10px; }
    .shelf-right { right: 10px; }

    .ingredient-item {
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    .ingredient-item.hidden { display: none; }
    .ingredient-item:hover { transform: scale(1.1); }
    .ingredient-item.collected { opacity: 0.15; transform: scale(0.8); pointer-events: none; }

    .ing-card-mini {
      background: rgba(15, 15, 25, 0.65);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 10px;
      width: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }

    .ing-icon-graphic-mini {
      width: 55px;
      height: 55px;
      object-fit: contain;
      margin-bottom: 5px;
    }

    .ing-name-mini {
      font-size: 0.6rem;
      text-transform: uppercase;
      font-weight: bold;
      color: #fff;
      text-align: center;
    }

    /* Mixing Bowl Sandwich */
    .mixing-bowl {
      position: absolute;
      left: 50%;
      top: 65%;
      width: 320px;
      height: 200px;
      transform: translate(-50%, -50%);
      cursor: pointer;
      z-index: 10;
      /* No background here, using layers instead */
    }

    .bowl-layer {
      position: absolute;
      inset: 0;
      background: url('/assets/images/bowl.png') no-repeat center;
      background-size: contain;
      /* Remove white background via clip-path (Oval shape) */
      clip-path: ellipse(50% 45% at 50% 50%);
      filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3));
    }

    .bowl-layer.back {
      z-index: 1;
      opacity: 0.9;
    }

    .bowl-layer.front {
      z-index: 3;
      /* Only show the front rim/bottom to overlap the batter */
      clip-path: ellipse(50% 45% at 50% 50%) polygon(0% 45%, 100% 45%, 100% 100%, 0% 100%);
    }

    .bowl-content {
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 2; /* Between layers */
    }

    .batter {
      position: absolute;
      bottom: 20px;
      left: 10%;
      width: 80%;
      background: linear-gradient(180deg, #fff7e6, #ffecb3);
      border-radius: 50% 50% 100px 100px;
      transition: height 0.5s ease;
      box-shadow: inset 0 -10px 20px rgba(0,0,0,0.05);
      border: 2px solid rgba(0,0,0,0.02);
    }

    /* Stove / Gaz Zone */
    .stove-zone {
      position: absolute;
      left: 10%;
      top: 50%;
      width: 250px;
      height: 200px;
      transform: translateY(-50%);
      cursor: pointer;
      z-index: 10;
      background: url('/assets/images/stove.png') no-repeat center;
      background-size: contain;
      clip-path: circle(48% at 50% 50%); /* Remove white corners */
      pointer-events: none;
      transition: all 0.3s;
    }

    .stove-zone.highlight {
      box-shadow: 0 0 40px #00f2ff, inset 0 0 20px #00f2ff;
      pointer-events: auto;
      transform: translateY(-50%) scale(1.05);
    }

    .flame {
      position: absolute;
      top: 30%;
      left: 50%;
      width: 40px;
      height: 40px;
      background: radial-gradient(circle, #00f2ff, transparent);
      border-radius: 50% 50% 20% 20%;
      filter: blur(5px);
      transform: translateX(-50%);
      animation: flicker 0.1s infinite alternate;
      opacity: 0;
    }

    .stove-zone.pouring .flame {
      opacity: 1;
    }

    @keyframes flicker {
      from { transform: translateX(-50%) scale(0.9) translateY(2px); }
      to { transform: translateX(-50%) scale(1.1) translateY(-2px); }
    }

    /* Task Bar */
    .current-task {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20, 20, 25, 0.85);
      backdrop-filter: blur(15px);
      border: 1px solid rgba(0, 255, 127, 0.4);
      padding: 12px 25px;
      border-radius: 50px;
      display: flex;
      align-items: center;
      gap: 15px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }

    .task-icon { color: #00ff7f; font-size: 1.2rem; }
    .task-text strong { color: #00ff7f; margin-right: 10px; }

    /* Hotbar */
    .chef-hotbar {
      height: 100px;
      background: #141419;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* Inventory / Hotbar */
    .chef-hotbar {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      background: rgba(15, 15, 25, 0.7);
      backdrop-filter: blur(15px);
      padding: 10px 30px;
      border-radius: 100px;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }

    .inventory-slots {
      display: flex;
      gap: 20px;
      align-items: center;
    }

    .slot {
      width: 65px;
      height: 65px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .slot.full {
      transform: scale(1.1);
    }

    .slot-icon { 
      width: 45px; 
      height: 45px; 
      object-fit: contain; 
      transition: filter 0.3s, opacity 0.3s;
    }

    .slot.full .slot-icon {
      filter: drop-shadow(0 0 10px #00ff7f);
    }

    .slot-count { 
      font-size: 0.6rem; 
      position: absolute; 
      top: -5px; 
      right: -5px; 
      background: #333;
      color: #fff;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.2);
    }
    
    .slot.full .slot-count {
      background: #00ff7f;
      color: #000;
      border-color: #00ff7f;
    }

    .slot-label { 
      font-size: 0.55rem; 
      text-transform: uppercase; 
      margin-top: 5px; 
      font-weight: bold;
      letter-spacing: 0.5px;
      color: rgba(255,255,255,0.5);
    }
    
    .slot.full .slot-label {
      color: #00ff7f;
    }

    /* Overlays */
    /* Radio Styles */
    .kitchen-radio {
      position: absolute;
      top: 20px;
      right: 120px;
      z-index: 150;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.3s;
    }
    
    .kitchen-radio:hover { transform: scale(1.1); }
    .kitchen-radio:active { transform: scale(0.95); }

    .radio-body {
      background: rgba(40, 40, 60, 0.85);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255,255,255,0.1);
      padding: 10px;
      border-radius: 12px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }
    
    .radio-icon { font-size: 1.8rem; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5)); }

    .radio-status {
      margin-top: 5px;
      font-size: 0.6rem;
      font-weight: 900;
      color: #aaa;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(0,0,0,0.3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .radio-status.on {
      color: #00ff7f;
      text-shadow: 0 0 10px #00ff7f;
    }

    /* Floating Musical Notes Animation */
    @keyframes floatNote {
      0% { transform: translateY(0) scale(0); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: translateY(-40px) translateX(20px) scale(1.5); opacity: 0; }
    }

    .music-notes {
      position: absolute;
      top: -20px;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .note {
      position: absolute;
      font-size: 1rem;
      color: #00ff7f;
      animation: floatNote 2s infinite linear;
      opacity: 0;
    }

    .n1 { animation-delay: 0s; left: 10%; }
    .n2 { animation-delay: 0.7s; left: 50%; }
    .n3 { animation-delay: 1.4s; left: 80%; }

    .overlay {
      position: absolute;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.4);
    }

    .ing-card-mini {
      background: rgba(15, 15, 25, 0.6);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 10px;
      width: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    }

    .ing-icon-graphic-mini {
      width: 50px;
      height: 50px;
      object-fit: contain;
      margin-bottom: 5px;
    }

    .ing-name-mini {
      font-size: 0.6rem;
      text-transform: uppercase;
      font-weight: bold;
      color: #fff;
      text-align: center;
    }

    .glass-module {
      background: rgba(25, 25, 35, 0.85);
      backdrop-filter: blur(25px);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 40px 60px;
      border-radius: 30px;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 30px 60px rgba(0,0,0,0.8);
    }

    .primary-btn {
      background: linear-gradient(90deg, #00ff7f, #00f2ff);
      border: none;
      color: #000;
      padding: 15px 40px;
      border-radius: 50px;
      font-weight: bold;
      font-size: 1.1rem;
      cursor: pointer;
      margin-top: 30px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .primary-btn:hover { transform: scale(1.05); box-shadow: 0 0 20px rgba(0, 255, 127, 0.4); }

    .primary-btn.secondary {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
    }
    .primary-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
    }

    .overlay-actions {
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-top: 30px;
    }

    .overlay-actions .primary-btn { margin-top: 0; }

    .victory-crown { font-size: 4rem; margin-bottom: 20px; }
  `],
  animations: [
    trigger('bowlShake', [
      state('normal', style({ transform: 'translate(-50%, -50%)' })),
      state('shake', style({ transform: 'translate(-50%, -50%)' })),
      transition('normal => shake', [
        animate('0.1s', style({ transform: 'translate(-52%, -50%) rotate(-2deg)' })),
        animate('0.1s', style({ transform: 'translate(-48%, -50%) rotate(2deg)' })),
        animate('0.1s', style({ transform: 'translate(-52%, -50%) rotate(-2deg)' })),
        animate('0.1s', style({ transform: 'translate(-48%, -50%) rotate(2deg)' })),
        animate('0.1s', style({ transform: 'translate(-50%, -50%)' }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class ChefQuestPlayerComponent implements OnInit, OnDestroy {
  private ludification = inject(LudificationService);
  gameState: 'start' | 'playing' | 'victory' | 'fail' = 'start';
  allRecipes: BackendRecipe[] = [];
  selectedIngredients: Set<string> = new Set();
  
  recipeNotFound = false;
  recipeTitle = 'Secret Discovery';
  recipeDesc = '';
  finalDishUrl = '';
  points = 0;
  bgUrl = 'assets/images/chef_bg.png';
  
  ingredients: Ingredient[] = [];
  
  // Radio System
  tracks = [
    'cuisine/Lotfi_Bouchnak.mp3',
    'cuisine/Lotfi_Bouchnak_Nassaya_-.mp3',
    'cuisine/Lotfi_Bouchnak_Ya_lella_Winek.mp3',
    'cuisine/video_1775951991.mp3'
  ];
  currentTrackIndex = -1; // -1 = Off
  audio = new Audio();
  isMusicPlaying = false;

  stepIndex = 0;
  currentStep = 'ingredients';
  isActionOngoing = false;
  shakeState = 'normal';
  
  addedCount = 0;
  batterHeight = 0;
  batterOpacity = 0;

  get neededTotal(): number {
    return this.ingredients.filter(i => i.isNeeded).length;
  }

  ngOnDestroy() {
    console.log('ChefQuestPlayerComponent destroyed');
    this.selectedIngredients.clear();
    this.audio.pause();
    this.audio.src = '';
  }

  nextTrack() {
    this.currentTrackIndex++;
    if (this.currentTrackIndex >= this.tracks.length) {
      this.currentTrackIndex = -1; // Boucle vers "Off"
      this.audio.pause();
      this.isMusicPlaying = false;
    } else {
      this.audio.src = this.tracks[this.currentTrackIndex];
      this.audio.volume = 0.4;
      this.audio.play();
      this.isMusicPlaying = true;
    }
  }

  get stepMessage(): string {
    if (this.currentStep === 'ingredients') {
      return `Ajoutez des ingrédients au bol (${this.addedCount} dans le bol)`;
    }
    if (this.currentStep === 'mix') {
      return 'Cliquez sur le bol pour mélanger votre préparation !';
    }
    if (this.currentStep === 'bake') {
      return 'Votre mélange est prêt. Cliquez sur le réchaud pour cuisiner !';
    }
    return '';
  }

  startGame() {
    this.gameState = 'playing';
    this.nextTrack(); // Lance la musique automatiquement au démarrage
  }

  resetGame() {
    this.gameState = 'playing';
    this.currentStep = 'ingredients';
    this.selectedIngredients.clear();
    this.addedCount = 0;
    this.batterHeight = 0;
    this.batterOpacity = 0;
    this.recipeTitle = 'Secret Discovery';
    this.recipeDesc = '';
    this.finalDishUrl = '';
    this.ingredients.forEach(i => i.added = false);
  }

  constructor(private chefQuestService: ChefQuestService) {
    // We now use the correctly placed assets in the project directory
    this.bgUrl = 'assets/images/chef_bg.png';
  }

  ngOnInit() {
    console.log('ChefQuestPlayerComponent initialized');
    this.loadBackendData();
  }

  loadBackendData() {
    this.chefQuestService.getIngredients().subscribe(allIngs => {
      this.chefQuestService.getRecipes().subscribe(recipes => {
        this.allRecipes = recipes;
        this.ingredients = allIngs.map(ing => ({
          id: ing.name.toLowerCase().trim(),
          name: ing.name,
          added: false, count: 0, needed: 1, x: ing.x, y: ing.y, icon: ing.iconUrl, isNeeded: true
        }));
      });
    });
  }

  useIngredient(ing: Ingredient) {
    if (this.currentStep !== 'ingredients' || ing.added) return;
    
    ing.added = true;
    this.selectedIngredients.add(ing.id);
    this.addedCount++;
    // On augmente la pâte un peu moins à chaque fois pour laisser de la place à beaucoup d'ingrédients
    this.batterHeight = Math.min(150, this.batterHeight + 15);
    this.batterOpacity = Math.min(1, this.batterOpacity + 0.2);
  }

  onBowlClick() {
    // Si on est en train de mettre les ingrédients, cliquer sur le bol lance le mélange
    if (this.currentStep === 'ingredients') {
      if (this.addedCount < 2) {
        console.log("Ajoutez au moins 2 ingrédients pour mélanger !");
        return;
      }
      this.currentStep = 'mix';
    }

    if (this.currentStep !== 'mix') return;
    
    this.shakeState = 'shake';
    setTimeout(() => {
      this.shakeState = 'normal';
      this.currentStep = 'bake';
    }, 600);
  }

  onOvenClick() {
    if (this.currentStep !== 'bake') return;
    this.isActionOngoing = true;
    
    setTimeout(() => {
      this.checkRecipeMatch();
      this.isActionOngoing = false;
    }, 2000);
  }

  private checkRecipeMatch() {
    // On compare les noms normalisés des ingrédients sélectionnés avec ceux des recettes en base
    const matched = this.allRecipes.find(r => {
      const dbIngIds = r.ingredients.map(i => i.name.toLowerCase().trim());
      if (dbIngIds.length !== this.selectedIngredients.size) return false;
      return dbIngIds.every(id => this.selectedIngredients.has(id));
    });

    if (matched) {
      this.recipeTitle = matched.title;
      this.recipeDesc = matched.description || '';
      this.finalDishUrl = matched.finalDishImageUrl;
      this.points = matched.rewardPoints;
      this.gameState = 'victory';
      this.ludification.reportStandaloneGame({
        gameKind: 'CHEF_QUEST',
        gameId: 1,
        score: this.points,
        maxScore: this.points
      }).subscribe();

    } else {
      this.gameState = 'fail';
    }
  }
}
