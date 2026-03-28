import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LudoCard, LudificationService } from '../core/ludification.service';

type Token = { 
  playerIdx: number; 
  tokenIdx: number; 
  pos: number; 
  name: string; 
  color: string;
  isFinished: boolean;
};

@Component({
  selector: 'app-ludo-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ludo-player.component.html',
  styleUrl: './ludo-player.component.css',
})
export class LudoPlayerComponent implements OnInit {
  readonly trackSize = 51; // Main ring length
  readonly fullPathSize = 57; // Including home path
  
  readonly cards = signal<LudoCard[]>([]);
  readonly eventMessage = signal<string>('Lancez le dé pour commencer !');
  readonly dice = signal<number>(1);
  readonly turn = signal<number>(0); // 0: Carthage, 1: Nabeul, 2: Kairouan, 3: Tozeur
  readonly rolling = signal(false);
  readonly canMove = signal(false);
  readonly finished = signal<string | null>(null);
  
  readonly players = [
    { name: 'Carthage', color: '#2ecc71', city: 'Carthage' },
    { name: 'Nabeul',   color: '#3498db', city: 'Nabeul' },
    { name: 'Kairouan', color: '#f1c40f', city: 'Kairouan' },
    { name: 'Tozeur',   color: '#e74c3c', city: 'Tozeur' },
  ];

  readonly tokens = signal<Token[]>([]);

  constructor(
    private readonly api: LudificationService,
    private readonly router: Router,
  ) {
    this.initTokens();
  }

  ngOnInit(): void {
    this.api.getLudoCards().subscribe((list) => {
      this.cards.set((list ?? []).filter((c) => c.published));
    });
  }

  private initTokens(): void {
    const list: Token[] = [];
    for (let p = 0; p < 4; p++) {
      for (let t = 0; t < 4; t++) {
        list.push({
          playerIdx: p,
          tokenIdx: t,
          pos: -1, // -1 is Base
          name: this.players[p].name,
          color: this.players[p].color,
          isFinished: false
        });
      }
    }
    this.tokens.set(list);
  }

  back(): void {
    this.router.navigate(['/games']);
  }

  roll(): void {
    if (this.rolling() || this.finished() || this.turn() !== 0 || this.canMove()) return;
    
    this.rolling.set(true);
    let count = 0;
    const interval = setInterval(() => {
      this.dice.set(Math.floor(Math.random() * 6) + 1);
      if (++count > 10) {
        clearInterval(interval);
        const val = Math.floor(Math.random() * 6) + 1;
        this.dice.set(val);
        this.rolling.set(false);
        
        // Check if any move is possible
        const possible = this.getValidMoveTokens(0, val);
        if (possible.length === 0) {
          this.eventMessage.set("Aucun mouvement possible !");
          setTimeout(() => this.nextTurn(), 1000);
        } else {
          this.canMove.set(true);
          this.eventMessage.set("Choisissez un pion à déplacer.");
        }
      }
    }, 50);
  }

  onTokenClick(token: Token): void {
    if (!this.canMove() || token.playerIdx !== 0 || token.isFinished) return;
    
    const val = this.dice();
    if (this.isValidMove(token, val)) {
      this.moveToken(token, val);
    }
  }

  private getValidMoveTokens(playerIdx: number, diceVal: number): Token[] {
    return this.tokens().filter(t => t.playerIdx === playerIdx && this.isValidMove(t, diceVal));
  }

  public isValidMove(token: Token, diceVal: number): boolean {
    if (token.isFinished) return false;
    if (token.pos === -1) return diceVal === 6; // Need 6 to exit base
    if (token.pos + diceVal > this.fullPathSize) return false; // Cannot overshoot finish
    return true;
  }

  private async moveToken(token: Token, steps: number): Promise<void> {
    this.canMove.set(false);
    const all = [...this.tokens()];
    const idx = all.findIndex(t => t.playerIdx === token.playerIdx && t.tokenIdx === token.tokenIdx);
    
    // Animate movement step by step
    for (let i = 0; i < steps; i++) {
      const currentToken = all[idx];
      if (currentToken.pos === -1) {
        currentToken.pos = 0; // Exit base to start square
        this.tokens.set([...all]);
        await new Promise(r => setTimeout(r, 200));
        break; // Stop immediately at start square
      } else if (currentToken.pos < this.fullPathSize) {
        currentToken.pos++;
      }
      
      this.tokens.set([...all]);
      await new Promise(r => setTimeout(r, 150)); // Delay per step
      
      if (currentToken.pos === this.fullPathSize) {
        currentToken.isFinished = true;
        break;
      }
    }

    const finalToken = all[idx];
    if (finalToken.isFinished) {
      this.eventMessage.set(`${finalToken.name} a atteint le Grand Tour !`);
    }

    // Capture logic
    this.checkCapture(finalToken, all);

    this.tokens.set([...all]);
    
    // Check win condition
    if (this.checkWin(finalToken.playerIdx)) {
      this.finished.set(this.players[finalToken.playerIdx].name);
      return;
    }

    // Roll again if 6
    if (steps === 6 && !finalToken.isFinished) {
      this.eventMessage.set("Encore un tour !");
      if (this.turn() !== 0) {
        setTimeout(() => this.cpuTurn(), 1000);
      }
    } else {
      this.nextTurn();
    }
  }

  private checkCapture(moved: Token, all: Token[]): void {
    if (moved.pos < 0 || moved.pos >= this.trackSize) return; // Only capture on the ring
    
    const movedCoords = this.getTokenCoords(moved);
    
    all.forEach(other => {
      if (other.playerIdx !== moved.playerIdx && other.pos >= 0 && other.pos < this.trackSize) {
        const otherCoords = this.getTokenCoords(other);
        if (movedCoords.r === otherCoords.r && movedCoords.c === otherCoords.c) {
          // It's a capture! (Standard Ludo rules: no capture on safety spots, but let's keep it simple)
          other.pos = -1; 
          this.eventMessage.set(`${moved.name} a capturé un pion de ${this.players[other.playerIdx].name} !`);
        }
      }
    });
  }

  private nextTurn(): void {
    if (this.finished()) return;
    this.turn.set((this.turn() + 1) % 4);
    if (this.turn() !== 0) {
      this.cpuTurn();
    }
  }

  private cpuTurn(): void {
    const pIdx = this.turn();
    this.eventMessage.set(`Tour de ${this.players[pIdx].name}...`);
    
    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      this.dice.set(val);
      
      const possible = this.getValidMoveTokens(pIdx, val);
      if (possible.length > 0) {
        // Simple AI: prioritize tokens further ahead or exiting base
        const sorted = possible.sort((a, b) => b.pos - a.pos);
        this.moveToken(sorted[0], val);
      } else {
        this.nextTurn();
      }
    }, 1000);
  }

  private checkWin(pIdx: number): boolean {
    return this.tokens().filter(t => t.playerIdx === pIdx && t.isFinished).length === 4;
  }

  reset(): void {
    this.initTokens();
    this.finished.set(null);
    this.turn.set(0);
    this.canMove.set(false);
    this.eventMessage.set('Nouvelle partie Ludo Tour !');
    this.dice.set(1);
  }

  /**
   * Returns r,c coordinates for a token.
   * On the ring, if multiple tokens share the same POS, we add a small jitter.
   */
  getTokenCoords(token: Token): { r: number; c: number } {
    const pos = token.pos;
    const playerIdx = token.playerIdx;

    // Base positions (4 tokens per base)
    if (pos === -1) {
      return this.getTokenBaseCoords(playerIdx, token.tokenIdx);
    }

    // Finished
    if (token.isFinished) {
      return { r: 7, c: 7 };
    }

    // Extended canonical ring for Ludo (52 cells)
    const ring = [
      // Left Up
      {r:6,c:0},{r:6,c:1},{r:6,c:2},{r:6,c:3},{r:6,c:4},{r:6,c:5},
      {r:5,c:6},{r:4,c:6},{r:3,c:6},{r:2,c:6},{r:1,c:6},{r:0,c:6},
      // Top Cross
      {r:0,c:7},
      // Top Down
      {r:0,c:8},{r:1,c:8},{r:2,c:8},{r:3,c:8},{r:4,c:8},{r:5,c:8},
      {r:6,c:9},{r:6,c:10},{r:6,c:11},{r:6,c:12},{r:6,c:13},{r:6,c:14},
      // Right Cross
      {r:7,c:14},
      // Right Left
      {r:8,c:14},{r:8,c:13},{r:8,c:12},{r:8,c:11},{r:8,c:10},{r:8,c:9},
      {r:9,c:8},{r:10,c:8},{r:11,c:8},{r:12,c:8},{r:13,c:8},{r:14,c:8},
      // Bottom Cross
      {r:14,c:7},
      // Bottom Up
      {r:14,c:6},{r:13,c:6},{r:12,c:6},{r:11,c:6},{r:10,c:6},{r:9,c:6},
      {r:8,c:5},{r:8,c:4},{r:8,c:3},{r:8,c:2},{r:8,c:1},{r:8,c:0},
      // Left Cross
      {r:7,c:0}
    ];

    const offsets = [1, 14, 40, 27]; // Green, Blue, Yellow, Red start indices on ring
    const absPos = (offsets[playerIdx] + pos) % ring.length;

    // Home path (Steps 51-57)
    if (pos >= 51) {
      const homeStep = pos - 51;
      const homePaths = [
        [ {r:7,c:1}, {r:7,c:2}, {r:7,c:3}, {r:7,c:4}, {r:7,c:5}, {r:7,c:6}, {r:7,c:7} ], // Green
        [ {r:1,c:7}, {r:2,c:7}, {r:3,c:7}, {r:4,c:7}, {r:5,c:7}, {r:6,c:7}, {r:7,c:7} ], // Blue
        [ {r:13,c:7}, {r:12,c:7}, {r:11,c:7}, {r:10,c:7}, {r:9,c:7}, {r:8,c:7}, {r:7,c:7} ], // Yellow
        [ {r:7,c:13}, {r:7,c:12}, {r:7,c:11}, {r:7,c:10}, {r:7,c:9}, {r:7,c:8}, {r:7,c:7} ], // Red
      ];
      return homePaths[playerIdx][homeStep] || {r:7, c:7};
    }

    return ring[absPos];
  }

  // To draw correctly in the base
  getTokenBaseCoords(playerIdx: number, tokenIdx: number): { r: number; c: number } {
    const baseOrigins = [
      { r: 2, c: 2 },   // Green
      { r: 2, c: 11 },  // Blue
      { r: 11, c: 2 },  // Yellow
      { r: 11, c: 11 }, // Red
    ];
    const origin = baseOrigins[playerIdx];
    const offsets = [{r:0,c:0},{r:0,c:1},{r:1,c:0},{r:1,c:1}];
    return { r: origin.r + offsets[tokenIdx].r, c: origin.c + offsets[tokenIdx].c };
  }
}


