import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mountElJemVoxelScene } from './el-jem-voxel-scene';

@Component({
  selector: 'app-el-jem-quest-player',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-game-root">
      <!-- Cyber Ambient Background -->
      <div class="max-bg">
        <div class="max-bg-grid"></div>
        <div class="max-bg-glow"></div>
        <div class="max-bg-scrip"></div>
      </div>

      <div class="max-hud">
        <header class="max-header">
          <div class="max-header-left">
            <a routerLink="/games" class="max-btn-exit">
               <span class="max-gate-icon"></span>
               TERMINATE_SESSION
            </a>
          </div>
          <div class="max-header-center">
            <div class="max-glitch-container">
              <h1 class="max-logo-text" data-text="EL-JEM">EL-JEM</h1>
              <span class="max-logo-sub">SECURE_INTERFACE_v4.2</span>
            </div>
          </div>
          <div class="max-header-right">
            <div class="max-timer-node">
              <span class="max-node-label">SESSION_UPTIME</span>
              <span class="max-node-val">{{ formatTime(timer()) }}</span>
              <div class="max-node-pulse"></div>
            </div>
          </div>
        </header>

        <main class="max-main">
          <!-- Left: Intel & Feed -->
          <aside class="max-sidebar max-sidebar-left">
            <div class="max-glass-panel max-panel-logs">
              <div class="max-glass-header">
                <span class="max-header-tag">INTEL_FEED</span>
                <div class="max-header-line"></div>
              </div>
              <div class="max-glass-body">
                <div class="max-intel-list">
                  <div *ngFor="let h of revealedHints(); let i = index" class="max-intel-item">
                    <span class="max-intel-id">LN_{{ i + 1 }}</span>
                    <span class="max-intel-txt">{{ h }}</span>
                  </div>
                  <div *ngIf="revealedHints().length === 0" class="max-intel-placeholder">
                    NO_DATA_STREAM_DETECTED
                  </div>
                </div>
              </div>
              <div class="max-glass-footer">
                <button class="max-btn-cyber" (click)="revealHint()" [disabled]="hintIndex() >= hints.length">
                  DECRYPT_CLUE ({{ hintIndex() }}/{{ hints.length }})
                  <div class="max-btn-glow"></div>
                </button>
              </div>
            </div>
          </aside>

          <!-- Center: Viewport -->
          <div class="max-center-bay">
            <div class="max-viewport-wrap" [class.max-viewport--won]="won()">
               <!-- Tech Overlays -->
               <div class="max-view-corner max-view-corner--tl"></div>
               <div class="max-view-corner max-view-corner--tr"></div>
               <div class="max-view-corner max-view-corner--bl"></div>
               <div class="max-view-corner max-view-corner--br"></div>
               <div class="max-vignette"></div>
               <div class="max-scanline"></div>
               
               <div class="max-damage-fx" [class.max-damage-fx--active]="isHurt()"></div>
               
               <div class="max-3d-host">
                <div #voxelHost class="max-canvas-container"></div>
              </div>

              <!-- In-Game Hotbar -->
              <div class="max-game-hotbar">
                 <div class="max-hotbar-inner">
                    <div class="max-slot" 
                         *ngFor="let type of ['STONE', 'CARREAUX', 'WOOD', 'HERBES']; let i = index"
                         (click)="selectedType.set(type)"
                         [class.max-slot--active]="selectedType() === type">
                      <div class="max-item-icon" [attr.data-type]="type"></div>
                      <span class="max-item-qty">{{ inventory()[type] || 0 }}</span>
                      <span class="max-item-key">{{ i + 1 }}</span>
                    </div>
                 </div>
              </div>

              <!-- Viewport HUD Elements -->
              <div class="max-v-hud">
                <div class="max-v-hud-top">
                  <div class="max-health-grid">
                    <div *ngFor="let h of [1,2,3,4,5]" 
                         class="max-vital-bit" 
                         [class.max-vital-bit--empty]="health() < h"></div>
                  </div>
                  <div class="max-integrity-wrap" *ngIf="currentMissionIdx() >= 0">
                    <div class="max-integrity-label">ARTIFACT_STABILITY</div>
                    <div class="max-integrity-bar">
                      <div class="max-integrity-fill" [style.width.%]="treasureHealth()"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Status & Tech -->
          <aside class="max-sidebar max-sidebar-right">
            <div class="max-glass-panel max-panel-mission">
               <div class="max-glass-header">
                 <span class="max-header-tag">ACTIVE_DIRECTIVE</span>
               </div>
               <div class="max-glass-body">
                 <div class="max-directive-card">
                   <div class="max-directive-status" [class.active]="true">
                     {{ activeMission().label }}
                   </div>
                   <h3 class="max-directive-desc">{{ activeMission().desc }}</h3>
                   
                   <div class="max-timer-alert" *ngIf="timer() < 120">
                     <span class="max-alert-val">{{ 120 - timer() }}s</span>
                     <span class="max-alert-lbl">UNTIL_THREAT_BREACH</span>
                   </div>
                   
                   <div class="max-timer-alert danger" *ngIf="timer() >= 120 && killCount() < 20">
                     <span class="max-alert-val">{{ 20 - killCount() }}</span>
                     <span class="max-alert-lbl">BOGIES_REMAINING</span>
                   </div>
                 </div>
               </div>
            </div>

            <div class="max-glass-panel max-panel-stats">
               <div class="max-glass-header"><span class="max-header-tag">CORE_METRICS</span></div>
               <div class="max-glass-body">
                 <div class="max-metric-row">
                   <div class="max-metric">
                     <span class="max-met-lbl">REWARD_CREDITS</span>
                     <span class="max-met-val">{{ score() }}<small>CR</small></span>
                   </div>
                 </div>
                 <div class="max-metric-row">
                    <div class="max-metric">
                      <span class="max-met-lbl">NEUTRALIZED_UNITS</span>
                      <span class="max-met-val">{{ killCount() }}</span>
                    </div>
                 </div>
               </div>
            </div>

            <div class="max-glass-panel max-panel-keys">
               <div class="max-glass-header"><span class="max-header-tag">INPUT_MAP</span></div>
               <div class="max-glass-body">
                 <div class="max-key-row">
                    <div class="max-key">M</div>
                    <span class="max-key-lbl">OPEN_FORGE_SUBTERMINAL</span>
                 </div>
                 <div class="max-key-row">
                    <div class="max-key">1-4</div>
                    <span class="max-key-lbl">SELECT_RESOURCE</span>
                 </div>
               </div>
            </div>
          </aside>
        </main>

        <!-- Cyber Forge Overlay -->
        <div class="max-cyber-overlay" *ngIf="showCrafting()">
          <div class="max-forge-window">
            <div class="max-forge-header">
              <h2>THERMAL_FORGE_STATION</h2>
              <div class="max-header-decor"></div>
            </div>
            <div class="max-forge-body">
              <div class="max-forge-assembly">
                 <div class="max-asm-slot" (click)="removeSlot(0)">
                   <div class="max-asm-icon" *ngIf="craftingSlots()[0]" [attr.data-type]="craftingSlots()[0]"></div>
                 </div>
                 <div class="max-asm-link">+</div>
                 <div class="max-asm-slot" (click)="removeSlot(1)">
                   <div class="max-asm-icon" *ngIf="craftingSlots()[1]" [attr.data-type]="craftingSlots()[1]"></div>
                 </div>
              </div>
              
              <div class="max-forge-inventory">
                <div class="max-inv-cyber-slot" *ngFor="let item of inventory() | keyvalue" 
                     (click)="addToSlot(item.key)" 
                     [class.disabled]="item.value <= 0 || craftingSlots().length >= 2">
                  <div class="max-inv-cyber-box" [attr.data-type]="item.key"></div>
                  <span class="max-inv-cyber-num">x{{ item.value }}</span>
                </div>
              </div>

              <div class="max-forge-result" *ngIf="predictedWeapon()">
                <div class="max-res-label">STABLE_OUTPUT_PREDICTED:</div>
                <div class="max-res-name">{{ predictedWeapon().name }}</div>
                <div class="max-res-bar">
                   <div class="max-res-stat">ATK: {{ predictedWeapon().damage }}</div>
                   <div class="max-res-stat">KNB: {{ predictedWeapon().knockback }}</div>
                </div>
              </div>
            </div>
            <div class="max-forge-footer">
              <button class="max-btn-init" (click)="forgeWeapon()" [disabled]="craftingSlots().length < 2">INITIATE_MATERIAL_FUSION</button>
              <button class="max-btn-abort" (click)="showCrafting.set(false)">ABORT_MODULE</button>
            </div>
          </div>
        </div>

        <!-- Victory Terminal -->
        <div class="max-terminal-overlay" *ngIf="won()">
          <div class="max-terminal-box">
             <div class="max-terminal-header">MISSION_CRITICAL_SUCCESS</div>
             <div class="max-terminal-body">
                <div class="max-success-glitch">DATA_SECURED</div>
                <div class="max-success-info">
                   <div class="max-info-line"><span>LOCATION:</span> AMPHITHÉÂTRE D'EL JEM</div>
                   <div class="max-info-line"><span>TOTAL_REWARD:</span> {{ score() }} CREDITS</div>
                </div>
             </div>
             <div class="max-terminal-footer">
                <button class="max-btn-cyber" (click)="reset()">RELOAD_SIMULATION</button>
                <a routerLink="/games" class="max-btn-glow-link">SECURE_TERMINATION</a>
             </div>
          </div>
        </div>

        <!-- Failure Terminal -->
        <div class="max-terminal-overlay max-terminal-failure" *ngIf="health() <= 0 || treasureHealth() <= 0">
           <div class="max-terminal-box">
             <div class="max-terminal-header danger">CRITICAL_SYSTEM_FAILURE</div>
             <div class="max-terminal-body">
                <div class="max-fail-txt">BIO_SIGNS_TERMINATED</div>
                <p>The neural link has been severed. Simulation collapsed.</p>
             </div>
             <div class="max-terminal-footer">
                <button class="max-btn-cyber danger" (click)="reset()">REBOOT_SYNC</button>
                <a routerLink="/games" class="max-btn-glow-link">ABORT_RECOVERY</a>
             </div>
           </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Outfit:wght@400;700;900&display=swap');

    :host {
      --c-bg: #020617;
      --c-glass: rgba(15, 23, 42, 0.7);
      --c-primary: #0ea5e9;
      --c-primary-glow: rgba(14, 165, 233, 0.4);
      --c-success: #10b981;
      --c-error: #ef4444;
      --c-accent: #f59e0b;
      --font-mono: 'JetBrains Mono', monospace;
      --font-tech: 'Outfit', sans-serif;
    }

    .max-game-root {
      min-height: 100vh;
      background: var(--c-bg);
      color: #e2e8f0;
      position: relative;
      overflow: hidden;
      font-family: var(--font-tech);
    }

    /* Ambient Background */
    .max-bg { position: fixed; inset: 0; z-index: 0; }
    .max-bg-grid {
      position: absolute; inset: 0;
      background-image: linear-gradient(var(--c-primary-glow) 1px, transparent 1px), linear-gradient(90deg, var(--c-primary-glow) 1px, transparent 1px);
      background-size: 80px 80px;
      opacity: 0.1;
      mask-image: radial-gradient(circle at 50% 50%, black, transparent 90%);
    }
    .max-bg-glow {
      position: absolute; inset: 0;
      background: radial-gradient(circle at 50% 20%, rgba(14, 165, 233, 0.15), transparent 70%);
    }

    .max-hud { position: relative; z-index: 10; height: 100vh; display: flex; flex-direction: column; }

    /* Modern Header - Fixed */
    .max-header {
      position: fixed; top: 0; left: 0; right: 0;
      z-index: 99998;
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 3rem; background: rgba(2, 6, 23, 0.95);
      border-bottom: 2px solid rgba(56, 189, 248, 0.2);
      backdrop-filter: blur(20px);
    }

    .max-btn-exit {
      color: #94a3b8; text-decoration: none; font-family: var(--font-mono); font-size: 0.7rem;
      letter-spacing: 0.1em; display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 4px;
      transition: all 0.3s;
    }
    .max-btn-exit:hover { color: white; border-color: white; background: rgba(255,255,255,0.05); }

    .max-glitch-container { text-align: center; }
    .max-logo-text {
      font-size: 2rem; font-weight: 900; letter-spacing: 0.5em; color: white;
      margin: 0; text-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
    }
    .max-logo-sub { font-family: var(--font-mono); font-size: 0.6rem; color: var(--c-primary); letter-spacing: 0.2em; }

    .max-timer-node {
      background: rgba(14, 165, 233, 0.05); border: 1px solid var(--c-primary-glow);
      padding: 0.5rem 1.5rem; border-radius: 4px; position: relative;
    }
    .max-node-label { font-size: 0.6rem; color: #64748b; font-family: var(--font-mono); display: block; }
    .max-node-val { font-family: var(--font-mono); font-size: 1.6rem; color: var(--c-primary); font-weight: 800; }
    .max-node-pulse { position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; background: var(--c-primary); border-radius: 50%; box-shadow: 0 0 10px var(--c-primary); animation: blink 1.5s infinite; }

    /* Main Grid */
    .max-main { flex: 1; display: grid; grid-template-columns: 340px 1fr 340px; gap: 2rem; padding: 2rem 3rem; overflow: hidden; }

    /* Glass Panels */
    .max-glass-panel {
      background: var(--c-glass); backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 8px;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4); margin-bottom: 2rem;
      transition: transform 0.3s ease;
    }
    .max-glass-panel:hover { transform: translateY(-3px); border-color: var(--c-primary-glow); }
    .max-glass-header { padding: 1rem 1.5rem; display: flex; align-items: center; gap: 1rem; }
    .max-header-tag { font-family: var(--font-mono); font-size: 0.7rem; color: var(--c-primary); font-weight: 800; }
    .max-header-line { flex: 1; height: 1px; background: linear-gradient(90deg, var(--c-primary-glow), transparent); }
    .max-glass-body { padding: 1.5rem; flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--c-primary) transparent; }
    .max-glass-footer { padding: 1rem 1.5rem; background: rgba(0,0,0,0.2); }

    /* Intel List */
    .max-intel-item { margin-bottom: 1rem; border-left: 3px solid var(--c-primary); padding-left: 1rem; animation: slideIn 0.4s ease both; }
    .max-intel-id { font-family: var(--font-mono); font-size: 0.6rem; color: #64748b; display: block; }
    .max-intel-txt { font-size: 0.9rem; color: #f1f5f9; font-weight: 700; }
    .max-intel-placeholder { color: #475569; font-family: var(--font-mono); font-size: 0.75rem; text-align: center; margin-top: 2rem; }

    .max-btn-cyber {
      position: relative; width: 100%; padding: 0.8rem; background: rgba(14, 165, 233, 0.1);
      border: 1px solid var(--c-primary); color: white; font-family: var(--font-mono); 
      font-size: 0.75rem; font-weight: 800; cursor: pointer; overflow: hidden; transition: 0.2s;
    }
    .max-btn-cyber:hover { background: var(--c-primary); color: white; box-shadow: 0 0 20px var(--c-primary-glow); }
    .max-btn-cyber:disabled { opacity: 0.3; cursor: not-allowed; border-color: #334155; }

    /* Center Bay & Viewport */
    .max-center-bay { height: 100%; display: flex; flex-direction: column; min-width: 0; }
    .max-viewport-wrap {
      flex: 1; position: relative; background: #000; border-radius: 12px; overflow: hidden;
      border: 2px solid rgba(56, 189, 248, 0.2); box-shadow: 0 0 60px rgba(14, 165, 233, 0.05);
    }
    .max-viewport--won { border-color: var(--c-success); }
    
    .max-vignette { position: absolute; inset: 0; background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8) 120%); pointer-events: none; z-index: 5; }
    .max-scanline { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%); background-size: 100% 4px; pointer-events: none; z-index: 6; }
    .max-view-corner { position: absolute; width: 30px; height: 30px; border: 3px solid var(--c-primary); z-index: 10; }
    .max-view-corner--tl { top: 20px; left: 20px; border-right: none; border-bottom: none; }
    .max-view-corner--tr { top: 20px; right: 20px; border-left: none; border-bottom: none; }
    .max-view-corner--bl { bottom: 20px; left: 20px; border-right: none; border-top: none; }
    .max-view-corner--br { bottom: 20px; right: 20px; border-left: none; border-top: none; }

    .max-3d-host { width: 100%; height: 100%; }
    .max-canvas-container { width: 100%; height: 100%; position: relative; }

    /* HUD Icons */
    .max-v-hud { position: absolute; inset: 0; padding: 2rem; pointer-events: none; z-index: 20; }
    .max-health-grid { display: flex; gap: 10px; margin-bottom: 1.5rem; }
    .max-vital-bit { width: 30px; height: 8px; background: var(--c-error); border-radius: 2px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }
    .max-vital-bit--empty { background: rgba(255,255,255,0.05); box-shadow: none; border: 1px solid rgba(255,255,255,0.1); }

    .max-integrity-wrap { width: 220px; }
    .max-integrity-label { font-family: var(--font-mono); font-size: 0.6rem; color: var(--c-accent); margin-bottom: 6px; letter-spacing: 0.1em; }
    .max-integrity-bar { height: 8px; background: rgba(0,0,0,0.6); border: 1px solid rgba(245,158,11,0.3); border-radius: 4px; overflow: hidden; }
    .max-integrity-fill { height: 100%; background: var(--c-accent); transition: width 0.3s; box-shadow: 0 0 15px var(--c-accent); }

    /* Directive Card */
    .max-directive-status { font-family: var(--font-mono); font-size: 0.65rem; color: var(--c-accent); margin-bottom: 0.5rem; font-weight: 800; opacity: 0.8; }
    .max-directive-desc { font-size: 1.2rem; font-weight: 900; color: white; line-height: 1.3; margin: 0; }
    .max-timer-alert { margin-top: 1.5rem; display: flex; flex-direction: column; }
    .max-alert-val { font-family: var(--font-mono); font-size: 1.8rem; font-weight: 800; color: var(--c-primary); }
    .max-alert-lbl { font-size: 0.65rem; color: #64748b; font-family: var(--font-mono); }
    .max-timer-alert.danger .max-alert-val { color: var(--c-error); animation: blink 1s infinite; }

    /* Metric Row */
    .max-metric { display: flex; flex-direction: column; gap: 4px; }
    .max-met-lbl { font-size: 0.65rem; color: #64748b; font-family: var(--font-mono); }
    .max-met-val { font-size: 2rem; font-weight: 900; color: white; }
    .max-met-val small { font-size: 0.8rem; color: var(--c-primary); margin-left: 5px; }

    /* Keys */
    .max-key-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .max-key { width: 40px; height: 40px; background: rgba(14, 165, 233, 0.1); border: 2px solid var(--c-primary); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: white; }
    .max-key-lbl { font-size: 0.75rem; color: #94a3b8; font-family: var(--font-mono); }

    /* Augmented Game Hotbar Design */
    .max-game-hotbar { 
      position: absolute; 
      bottom: 24px; 
      left: 50%; 
      transform: translateX(-50%); 
      z-index: 1000; 
      pointer-events: auto;
      perspective: 1000px;
    }
    .max-hotbar-inner { 
      display: flex; 
      gap: 14px; 
      background: linear-gradient(135deg, rgba(2, 6, 23, 0.95), rgba(15, 23, 42, 0.85));
      padding: 10px 18px; 
      border: 1px solid rgba(56, 189, 248, 0.3); 
      border-radius: 16px; 
      backdrop-filter: blur(25px);
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.8),
        inset 0 0 15px rgba(56, 189, 248, 0.1);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      transform: rotateX(10deg);
    }
    .max-slot { 
      width: 68px; 
      height: 68px; 
      background: rgba(255, 255, 255, 0.03); 
      border: 1px solid rgba(148, 163, 184, 0.2); 
      position: relative; 
      cursor: pointer; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
      border-radius: 12px;
      overflow: hidden;
    }
    .max-slot::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.05), transparent);
      pointer-events: none;
    }
    .max-slot:hover { 
      border-color: var(--c-primary); 
      background: rgba(14, 165, 233, 0.08); 
      transform: translateY(-6px) scale(1.05);
      box-shadow: 0 10px 20px rgba(0,0,0,0.4);
    }
    .max-slot--active { 
      border-color: #fff; 
      background: rgba(14, 165, 233, 0.2); 
      box-shadow: 
        0 0 25px var(--c-primary-glow),
        inset 0 0 10px var(--c-primary-glow);
    }
    
    .max-item-icon { 
      width: 40px; 
      height: 40px; 
      border-radius: 6px; 
      position: relative;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      transition: transform 0.3s;
    }
    .max-slot:hover .max-item-icon { transform: scale(1.1); }
    
    .max-item-icon[data-type="STONE"] { 
      background: linear-gradient(135deg, #94a3b8, #475569);
      border: 1px solid #cbd5e1;
    }
    .max-item-icon[data-type="WOOD"] { 
      background: linear-gradient(135deg, #78350f, #451a03); 
      border: 1px solid #b45309;
    }
    .max-item-icon[data-type="HERBES"] { 
      background: linear-gradient(135deg, #22c55e, #14532d); 
      border: 1px solid #4ade80;
    }
    .max-item-icon[data-type="CARREAUX"] { 
      background: linear-gradient(135deg, #0ea5e9, #1e3a8a); 
      border: 1px solid #38bdf8;
    }

    .max-item-qty { 
      position: absolute; 
      bottom: 6px; 
      right: 8px; 
      font-weight: 900; 
      font-size: 1rem; 
      color: white; 
      text-shadow: 0 2px 4px rgba(0,0,0,0.8); 
      font-family: var(--font-mono); 
      pointer-events: none;
    }
    .max-item-key { 
      position: absolute; 
      top: 6px; 
      left: 8px; 
      font-size: 0.7rem; 
      color: var(--c-primary); 
      font-family: var(--font-mono); 
      opacity: 0.9;
      font-weight: 800;
      pointer-events: none;
    }

    /* Forge UI */
    .max-cyber-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(2, 6, 23, 0.95); backdrop-filter: blur(15px); display: flex; align-items: center; justify-content: center; }
    .max-forge-window { width: 550px; background: #0f172a; border: 1px solid var(--c-primary); border-radius: 12px; padding: 2.5rem; box-shadow: 0 0 100px rgba(14, 165, 233, 0.1); }
    .max-forge-header h2 { font-size: 1.5rem; margin: 0; font-weight: 900; letter-spacing: 0.2em; text-align: center; }
    .max-forge-assembly { display: flex; align-items: center; justify-content: center; gap: 2rem; margin: 3rem 0; }
    .max-asm-slot { width: 90px; height: 90px; background: rgba(0,0,0,0.4); border: 2px dashed var(--c-primary-glow); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; }
    .max-asm-slot:hover { border-color: var(--c-primary); }
    .max-asm-icon { width: 48px; height: 48px; }
    .max-asm-icon[data-type="STONE"] { background: #94a3b8; }
    .max-asm-icon[data-type="CARREAUX"] { background: #334155; }
    .max-asm-icon[data-type="HERBES"] { background: #556b2f; }
    .max-asm-icon { width: 100%; height: 100%; border-radius: 4px; }
    .max-asm-icon[data-type="STONE"] { background-color: #7f8c8d; }
    .max-asm-icon[data-type="CARREAUX"] { background-color: #95a5a6; }
    .max-asm-icon[data-type="HERBES"] { background-color: #556b2f; }
    .max-asm-icon[data-type="WOOD"] { background-color: #5d4037; }
    
    /* Augmented Forge Inventory */
    .max-forge-inventory { 
      display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; 
      margin-top: 2rem; max-height: 240px; overflow-y: auto; padding: 12px;
      scrollbar-width: thin; scrollbar-color: var(--c-primary) transparent;
      background: rgba(0,0,0,0.2); border-radius: 12px;
    }
    .max-inv-cyber-slot { text-align: center; cursor: pointer; transition: 0.2s; position: relative; }
    .max-inv-cyber-slot:hover:not(.disabled) { transform: translateY(-3px); }
    .max-inv-cyber-slot.disabled { opacity: 0.2; }
    .max-inv-cyber-box { 
      width: 52px; 
      height: 52px; 
      border-radius: 8px; 
      border: 1px solid rgba(255,255,255,0.1); 
      margin-bottom: 6px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    }
    .max-inv-cyber-box[data-type="STONE"] { background: linear-gradient(135deg, #94a3b8, #475569); }
    .max-inv-cyber-box[data-type="WOOD"] { background: linear-gradient(135deg, #78350f, #451a03); }
    .max-inv-cyber-box[data-type="HERBES"] { background: linear-gradient(135deg, #22c55e, #14532d); }
    .max-inv-cyber-box[data-type="CARREAUX"] { background: linear-gradient(135deg, #0ea5e9, #1e3a8a); }
    .max-inv-cyber-num { font-size: 0.75rem; color: #fff; font-family: var(--font-mono); font-weight: 700; }

    .max-forge-result { margin-top: 3rem; padding: 1.5rem; background: rgba(16, 185, 129, 0.05); border: 1px solid var(--c-success); border-radius: 8px; text-align: center; }
    .max-res-name { font-size: 1.5rem; font-weight: 900; color: white; letter-spacing: 0.2em; }
    .max-res-bar { display: flex; justify-content: center; gap: 2rem; margin-top: 0.5rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--c-success); }

    .max-btn-init { display: block; width: 100%; padding: 1.2rem; background: var(--c-primary); border: none; font-weight: 900; color: white; font-family: var(--font-mono); cursor: pointer; margin-bottom: 1rem; border-radius: 4px; }
    .max-btn-abort { display: block; width: 100%; padding: 0.8rem; background: transparent; border: 1px solid #334155; color: #64748b; font-family: var(--font-mono); cursor: pointer; border-radius: 4px; }

    /* Terminal Overlays */
    .max-terminal-overlay { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(25px); background: rgba(0, 0, 0, 0.8); }
    .max-terminal-box { width: 600px; background: #020617; border: 2px solid var(--c-success); border-radius: 4px; padding: 4rem; text-align: center; }
    .max-terminal-box.danger { border-color: var(--c-error); }
    .max-success-glitch { font-size: 3rem; font-weight: 900; color: white; margin-bottom: 2rem; letter-spacing: 0.1em; animation: glitch 0.3s infinite; }
    .max-info-line { font-family: var(--font-mono); margin-bottom: 0.8rem; font-size: 1rem; color: #94a3b8; }
    .max-info-line span { color: var(--c-success); font-weight: 800; }

    .max-fail-txt { font-size: 2.5rem; font-weight: 900; color: var(--c-error); animation: blink 0.5s infinite; margin-bottom: 1rem; }

    /* Animations */
    @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes glitch { 0% { transform: translate(0); } 20% { transform: translate(-3px, 3px); } 40% { transform: translate(-3px, -3px); } 60% { transform: translate(3px, 3px); } 80% { transform: translate(3px, -3px); } 100% { transform: translate(0); } }

    /* Damage Red Flash */
    .max-damage-fx { position: absolute; inset: 0; pointer-events: none; z-index: 50; transition: background 0.1s; }
    .max-damage-fx--active { background: rgba(239, 68, 68, 0.4); box-shadow: inset 0 0 100px rgba(239, 68, 68, 0.8); }
  `]
})
export class ElJemQuestPlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('voxelHost', { static: false }) voxelHost!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private voxelApi?: { destroy: () => void; resize: () => void; getPlayerPos: () => { x: number; z: number } };

  private timerInterval?: any;
  private missionInterval?: any;

  readonly timer = signal(0);
  readonly won = signal(false);
  readonly health = signal(5);
  readonly treasureHealth = signal(100);
  readonly killCount = signal(0);
  readonly isHurt = signal(false);
  readonly score = signal(0);

  readonly hintIndex = signal(0);
  readonly hints = [
    "LOCATION_TYPE: ANCIENT_ROMAN_MONUMENT",
    "GEOGRAPHIC_SECTOR: SAHEL_REGION_TN",
    "HISTORICAL_ALIAS: THYSDRUS_COLOSSEUM",
    "SCALE_STATUS: WORLD_TOP_3_AMPHITHEATRE"
  ];
  readonly revealedHints = computed(() => this.hints.slice(0, this.hintIndex()));

  readonly showCrafting = signal(false);
  readonly craftingSlots = signal<string[]>([]);
  readonly currentWeapon = signal<any>({ name: 'BASIC_DRILL', damage: 1, knockback: 1, mat: 'WOOD' });
  readonly inventory = signal<Record<string, number>>({ 'STONE': 0, 'CARREAUX': 0, 'WOOD': 0, 'HERBES': 0 });
  readonly blocksBroken = signal(0);
  readonly selectedType = signal<string>('STONE');

  readonly recipes: Record<string, any> = {
    'STONE+WOOD': { name: 'STONE_SWORD', damage: 2, knockback: 1.5, mat: 'STONE' },
    'WOOD+STONE': { name: 'STONE_SWORD', damage: 2, knockback: 1.5, mat: 'STONE' },
    'CARREAUX+WOOD': { name: 'ELITE_BLADE', damage: 4, knockback: 1.0, mat: 'CARREAUX' },
    'WOOD+CARREAUX': { name: 'ELITE_BLADE', damage: 4, knockback: 1.0, mat: 'CARREAUX' },
    'STONE+STONE': { name: 'HEAVY_HAMMER', damage: 3, knockback: 3.0, mat: 'STONE' },
    'WOOD+WOOD': { name: 'REINFORCED_CLUB', damage: 1.5, knockback: 2.5, mat: 'WOOD' },
    'HERBES+WOOD': { name: 'NATURE_SPEAR', damage: 2.5, knockback: 1.2, mat: 'HERBES' },
    'WOOD+HERBES': { name: 'NATURE_SPEAR', damage: 2.5, knockback: 1.2, mat: 'HERBES' },
  };

  readonly predictedWeapon = computed(() => {
    const slots = this.craftingSlots();
    if (slots.length < 2) return null;
    return this.recipes[slots.join('+')] || { name: 'JUNK_SCRAP', damage: 0.5, knockback: 0.5, mat: 'STONE' };
  });

  readonly currentMissionIdx = signal(0);
  readonly missionsList = [
    { id: 'PREP', label: 'PREPARATION', desc: 'Secure the area & erect fortifications', check: () => this.timer() >= 120 },
    { id: 'SURVIVE', label: 'EXTERMINATION', desc: 'Neutralize the 20 hostile entities', check: () => this.killCount() >= 20 },
    { id: 'TREASURE', label: 'COLLECTION', desc: 'Recover the ancient artifact at center', check: () => this.won() },
  ];
  readonly activeMission = computed(() => this.missionsList[this.currentMissionIdx()] || this.missionsList[2]);

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    (window as any)._ej_kill_count = this.killCount();
    (window as any)._ej_spawned_count = 0;
    
    (window as any)._ej_item_collect = (mat: any) => this.zone.run(() => {
        this.blocksBroken.update(b => b + 1);
        const hex = mat.color.getHex();
        let label = 'STONE';
        if (hex === 0x95a5a6) label = 'CARREAUX';
        else if (hex === 0x5d4037) label = 'WOOD';
        else if (hex === 0x556b2f) label = 'HERBES';
        this.inventory.update(inv => ({ ...inv, [label]: (inv[label] || 0) + 1 }));
    });

    (window as any)._ej_get_selected_mat = () => this.inventory()[this.selectedType()] > 0 ? this.selectedType() : null;
    (window as any)._ej_item_use = (t: string) => this.zone.run(() => this.inventory.update(inv => ({ ...inv, [t]: Math.max(0, inv[t]-1) })));
    (window as any)._ej_on_take_damage = () => this.zone.run(() => { if (this.health() > 0) this.health.update(h => h - 1); this.isHurt.set(true); setTimeout(() => this.isHurt.set(false), 300); });
    (window as any)._ej_on_kill = () => this.zone.run(() => {
        this.killCount.update(k => k + 1);
        (window as any)._ej_kill_count = this.killCount();
    });
    (window as any)._ej_on_damage_treasure = () => this.zone.run(() => { if (this.treasureHealth() > 0) this.treasureHealth.update(th => th - 5); });
    (window as any)._ej_on_win = () => this.zone.run(() => { if (this.currentMissionIdx() >= 2 && !this.won()) { this.score.set(this.score() + 500); this.won.set(true); this.stopLoop(); } });

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'm') this.showCrafting.update(s => !s);
      if (k === '1') this.selectedType.set('STONE');
      if (k === '2') this.selectedType.set('CARREAUX');
      if (k === '3') this.selectedType.set('WOOD');
      if (k === '4') this.selectedType.set('HERBES');
    });

    setTimeout(() => {
      if (!this.voxelHost) return;
      this.voxelApi = mountElJemVoxelScene(this.voxelHost.nativeElement, this.zone);
      this.startLoop();
    }, 200);
  }

  ngOnDestroy(): void { this.voxelApi?.destroy(); this.stopLoop(); }

  private startLoop(): void {
    this.stopLoop();
    this.timerInterval = setInterval(() => { if (!this.won() && this.health() > 0 && this.treasureHealth() > 0) this.timer.update(t => t + 1); }, 1000);
    this.missionInterval = setInterval(() => {
      if (this.won() || this.health() <= 0 || this.treasureHealth() <= 0) return;
      if (this.activeMission().check()) this.currentMissionIdx.update(i => i + 1);
    }, 500);
  }

  private stopLoop(): void { clearInterval(this.timerInterval); clearInterval(this.missionInterval); }

  reset(): void {
    this.health.set(5); this.treasureHealth.set(100); this.killCount.set(0); this.blocksBroken.set(0); 
    this.inventory.set({ 'STONE': 0, 'CARREAUX': 0, 'WOOD': 0, 'HERBES': 0 }); this.timer.set(0); this.won.set(false);
    this.currentMissionIdx.set(0); this.score.set(0); 
    (window as any)._ej_spawned_count = 0;
    (window as any)._ej_kill_count = 0;
    if (this.voxelApi) { this.voxelApi.destroy(); this.ngAfterViewInit(); }
  }

  formatTime(s: number): string { return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }
  revealHint(): void { if (this.hintIndex() < this.hints.length) this.hintIndex.update(i => i + 1); }
  addToSlot(m: string): void { if (this.inventory()[m] > 0 && this.craftingSlots().length < 2) { this.inventory.update(inv => ({ ...inv, [m]: inv[m]-1 })); this.craftingSlots.update(s => [...s, m]); } }
  removeSlot(i: number): void { const m = this.craftingSlots()[i]; if (m) { this.inventory.update(inv => ({ ...inv, [m]: inv[m]+1 })); this.craftingSlots.update(s => s.filter((_, idx) => idx !== i)); } }
  forgeWeapon(): void { const res = this.predictedWeapon(); if (res) { this.currentWeapon.set(res); this.craftingSlots.set([]); this.showCrafting.set(false); (window as any)._ej_update_weapon?.(res); } }
}
