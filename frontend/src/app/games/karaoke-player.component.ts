import { Component, OnInit, OnDestroy, signal, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KaraokeService, KaraokeSong } from '../core/karaoke.service';
import { LudificationService } from '../core/ludification.service';
import { trigger, transition, style, animate } from '@angular/animations';

interface SyncLyric {
  text: string;
  start: number;
  end: number;
}

@Component({
  selector: 'app-karaoke-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="karaoke-container">
      <div class="glass-header">
        <button class="btn-back" (click)="goBack()">←</button>
        <h1>Yalla Karaoke 🎤</h1>
        <div class="mic-indicator" [class.active]="isMicActive()">
          <span class="mic-dot" [style.transform]="'scale(' + (1 + micLevel() * 2) + ')'"></span>
          {{ isMicActive() ? 'Micro Actif' : 'Micro Désactivé' }}
        </div>
      </div>

      @if (!selectedSong()) {
        <div class="song-selection">
          <h2>Choisissez une chanson</h2>
          <div class="songs-grid">
            @for (song of songs(); track song.id) {
              <div class="song-card" (click)="selectSong(song)">
                <div class="song-info">
                  <h3>{{ song.title }}</h3>
                  <p>{{ song.artist }}</p>
                </div>
                <span class="play-icon">▶</span>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="playing-view">
          <div class="song-header">
            <h2>{{ selectedSong()?.title }}</h2>
            <p>{{ selectedSong()?.artist }}</p>
          </div>

          <div class="lyrics-display">
            <div class="lyrics-wrapper" [style.transform]="'translateY(' + scrollOffset() + 'px)'">
              @for (lyric of parsedLyrics(); track $index) {
                <div 
                  class="lyric-line" 
                  [class.active]="isActive($index)"
                  [class.passed]="isPassed($index)"
                  [class.singing]="isActive($index) && isUserSinging()"
                  [class.silent]="isActive($index) && !isUserSinging()">
                  {{ lyric.text }}
                </div>
              }
            </div>
          </div>

          <div class="player-controls">
            <audio #audioPlayer [src]="selectedSong()?.instrumentalUrl || selectedSong()?.audioUrl" (timeupdate)="onTimeUpdate()" (ended)="onEnded()"></audio>
            
            <div class="progress-container" (click)="seek($event)">
              <div class="progress-bar" [style.width.%]="progress()"></div>
            </div>

            <div class="buttons">
              <button class="btn-ctrl" (click)="togglePlay()">
                {{ isPlaying() ? '⏸ Pause' : '▶ Jouer' }}
              </button>
              <button class="btn-ctrl secondary" (click)="stop()">⏹ Arrêter</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .karaoke-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: white;
      padding: 2rem;
      font-family: 'Outfit', sans-serif;
    }

    .glass-header {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      border-radius: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-back {
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .mic-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .mic-dot {
      width: 10px;
      height: 10px;
      background: #4ade80;
      border-radius: 50%;
      box-shadow: 0 0 10px #4ade80;
      transition: transform 0.1s;
    }

    .song-selection {
      max-width: 800px;
      margin: 0 auto;
    }

    .songs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }

    .song-card {
      background: rgba(255, 255, 255, 0.05);
      padding: 1.5rem;
      border-radius: 1rem;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .song-card:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-5px);
      border-color: #6366f1;
    }

    .song-info h3 { margin: 0; font-size: 1.2rem; }
    .song-info p { margin: 0.3rem 0 0; opacity: 0.6; font-size: 0.9rem; }

    .playing-view {
      max-width: 900px;
      margin: 0 auto;
      text-align: center;
    }

    .lyrics-display {
      height: 400px;
      overflow: hidden;
      margin: 2rem 0;
      position: relative;
      mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
    }

    .lyrics-wrapper {
      transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .lyric-line {
      font-size: 2rem;
      font-weight: 700;
      opacity: 0.2;
      transition: all 0.3s;
      padding: 0 1rem;
    }

    .lyric-line.active {
      opacity: 1;
      transform: scale(1.1);
      color: #fff;
    }

    .lyric-line.singing {
      color: #4ade80 !important;
      text-shadow: 0 0 15px rgba(74, 222, 128, 0.5);
    }

    .lyric-line.silent {
      color: #f87171 !important;
      text-shadow: 0 0 15px rgba(248, 113, 113, 0.5);
    }

    .lyric-line.passed {
      opacity: 0.4;
    }

    .player-controls {
      background: rgba(0, 0, 0, 0.3);
      padding: 2rem;
      border-radius: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .progress-container {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      margin-bottom: 1.5rem;
      cursor: pointer;
    }

    .progress-bar {
      height: 100%;
      background: #6366f1;
      border-radius: 4px;
      transition: width 0.1s;
    }

    .buttons {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }

    .btn-ctrl {
      background: #6366f1;
      color: white;
      border: none;
      padding: 0.8rem 2rem;
      border-radius: 3rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-ctrl:hover { background: #4f46e5; transform: scale(1.05); }
    .btn-ctrl.secondary { background: rgba(255, 255, 255, 0.1); }
  `]
})
export class KaraokePlayerComponent implements OnInit, OnDestroy {
  private service = inject(KaraokeService);
  private ludification = inject(LudificationService);
  
  songs = signal<KaraokeSong[]>([]);
  selectedSong = signal<KaraokeSong | null>(null);
  parsedLyrics = signal<SyncLyric[]>([]);
  
  currentTime = signal<number>(0);
  isPlaying = signal<boolean>(false);
  currentIndex = signal<number>(-1);
  progress = signal<number>(0);
  scrollOffset = signal<number>(150);

  // Microphone signals
  isMicActive = signal<boolean>(false);
  micLevel = signal<number>(0);
  isUserSinging = signal<boolean>(false);

  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private micStream?: MediaStream;
  private animationFrame?: number;

  @ViewChild('audioPlayer') audioPlayer!: ElementRef<HTMLAudioElement>;

  ngOnInit() {
    this.service.getPublishedSongs().subscribe(songs => this.songs.set(songs));
    this.initMicrophone();
  }

  ngOnDestroy() {
    this.stopMicrophone();
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
  }

  async initMicrophone() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.micStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.isMicActive.set(true);
      this.monitorMicrophone();
    } catch (e) {
      console.warn('Microphone access denied', e);
      this.isMicActive.set(false);
    }
  }

  monitorMicrophone() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const check = () => {
      this.analyser!.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const average = sum / dataArray.length;
      const normalized = average / 128;
      this.micLevel.set(normalized);
      
      // Threshold for "singing" detection
      this.isUserSinging.set(normalized > 0.15);
      
      this.animationFrame = requestAnimationFrame(check);
    };
    check();
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  selectSong(song: KaraokeSong) {
    this.selectedSong.set(song);
    try {
      const lyrics = JSON.parse(song.lyricsJson);
      this.parsedLyrics.set(Array.isArray(lyrics) ? lyrics : []);
    } catch (e) {
      this.parsedLyrics.set([]);
    }
    this.currentIndex.set(-1);
    this.progress.set(0);
  }

  togglePlay() {
    const audio = this.audioPlayer.nativeElement;
    if (this.isPlaying()) {
      audio.pause();
    } else {
      audio.play();
    }
    this.isPlaying.set(!this.isPlaying());
  }

  stop() {
    this.selectedSong.set(null);
    this.isPlaying.set(false);
  }

  onTimeUpdate() {
    const audio = this.audioPlayer.nativeElement;
    const time = audio.currentTime;
    this.currentTime.set(time);
    this.progress.set((time / audio.duration) * 100);

    const lyrics = this.parsedLyrics();
    const index = lyrics.findIndex(l => time >= l.start && time <= l.end);
    
    if (index !== -1 && index !== this.currentIndex()) {
      this.currentIndex.set(index);
      this.scrollOffset.set(150 - (index * 50)); // Adjust scroll
    }
  }

  onEnded() {
    this.isPlaying.set(false);
    const song = this.selectedSong();
    if (song && song.id) {
      this.ludification.reportStandaloneGame({
        gameKind: 'KARAOKE',
        gameId: song.id,
        score: 100,
        maxScore: 100
      }).subscribe();
    }
  }

  isActive(index: number) { return this.currentIndex() === index; }
  isPassed(index: number) { return index < this.currentIndex(); }

  seek(event: MouseEvent) {
    const audio = this.audioPlayer.nativeElement;
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
  }

  goBack() {
    if (this.selectedSong()) {
      this.stop();
    } else {
      window.history.back();
    }
  }
}
