import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KaraokeService, KaraokeSong } from '../core/karaoke.service';

@Component({
  selector: 'app-admin-karaoke',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-container">
      <div class="header">
        <h1>Gestion du Karaoké 🛠️</h1>
        <button class="btn-primary" (click)="openCreateForm()">+ Ajouter une chanson</button>
      </div>

      @if (showForm) {
        <div class="modal">
          <div class="modal-content">
            <h2>{{ currentSong.id ? 'Modifier' : 'Ajouter' }} une chanson</h2>
            <div class="form-group">
              <label>Titre</label>
              <input [(ngModel)]="currentSong.title" placeholder="Ex: Sidi Mansour">
            </div>
            <div class="form-group">
              <label>Artiste</label>
              <input [(ngModel)]="currentSong.artist" placeholder="Ex: Saber Rebaï">
            </div>
            <div class="form-group">
              <label>URL Audio (MP3)</label>
              <input [(ngModel)]="currentSong.audioUrl" placeholder="URL du fichier audio">
            </div>
            
            <div class="ai-section">
              <button class="btn-ai" (click)="generateWithAI()" [disabled]="isGenerating">
                {{ isGenerating ? 'Génération en cours...' : '✨ Générer Paroles avec AI (Groq)' }}
              </button>
              <p class="hint">L'IA va tenter de créer les paroles synchronisées basées sur le titre et l'artiste.</p>
            </div>

            <div class="form-group">
              <label>JSON des Paroles</label>
              <textarea [(ngModel)]="currentSong.lyricsJson" rows="10"></textarea>
            </div>

            <div class="publish-toggle-row">
              <div class="publish-info">
                <span class="publish-label">📢 Publier la chanson</span>
                <span class="publish-sub">Rendre visible aux utilisateurs</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="currentSong.published" id="published">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
              </label>
            </div>

            <div class="modal-actions">
              <button class="btn-secondary" (click)="showForm = false">Annuler</button>
              <button class="btn-primary" (click)="save()">Enregistrer</button>
            </div>
          </div>
        </div>
      }

      <div class="songs-list">
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Artiste</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (song of songs(); track song.id) {
              <tr>
                <td>{{ song.title }}</td>
                <td>{{ song.artist }}</td>
                <td>
                  <span class="badge" [class.published]="song.published">
                    {{ song.published ? 'Publié' : 'Brouillon' }}
                  </span>
                </td>
                <td>
                  <button class="btn-icon" (click)="edit(song)">✏️</button>
                  <button class="btn-icon delete" (click)="delete(song.id!)">🗑️</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .admin-container { padding: 2rem; max-width: 1000px; margin: 0 auto; color: #1e293b; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    
    .modal {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-content {
      background: white; padding: 2rem; border-radius: 1rem; width: 600px; max-height: 90vh; overflow-y: auto;
    }

    .form-group { margin-bottom: 1rem; display: flex; flex-direction: column; }
    .form-group label { font-weight: 600; margin-bottom: 0.5rem; }
    .form-group input, .form-group textarea {
      padding: 0.8rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-family: inherit;
    }

    .ai-section {
      background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px dashed #6366f1;
    }
    .btn-ai {
      width: 100%; background: #6366f1; color: white; border: none; padding: 0.8rem; border-radius: 0.5rem;
      cursor: pointer; font-weight: 600;
    }
    .btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }
    .hint { font-size: 0.8rem; color: #64748b; margin-top: 0.5rem; }

    /* ── Publish Toggle ── */
    .publish-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.2rem;
      background: #f0fdf4;
      border: 2px solid #10b981;
      border-radius: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .publish-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .publish-label {
      font-weight: 700;
      font-size: 1rem;
      color: #064e3b;
    }

    .publish-sub {
      font-size: 0.78rem;
      color: #059669;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      cursor: pointer;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }

    .toggle-track {
      display: block;
      width: 52px;
      height: 28px;
      background: #cbd5e1;
      border-radius: 999px;
      transition: background 0.3s;
      position: relative;
    }

    .toggle-thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 22px;
      height: 22px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      transition: transform 0.3s;
    }

    .toggle-switch input:checked ~ .toggle-track {
      background: #10b981;
    }

    .toggle-switch input:checked ~ .toggle-track .toggle-thumb {
      transform: translateX(24px);
    }
    /* ───────────────────── */

    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }
    
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 1rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #f1f5f9; }
    th { background: #f8fafc; font-weight: 600; }
    
    .badge { padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.8rem; background: #e2e8f0; }
    .badge.published { background: #dcfce7; color: #166534; }
    
    .btn-primary { background: #6366f1; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 0.5rem; cursor: pointer; }
    .btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 0.6rem 1.2rem; border-radius: 0.5rem; cursor: pointer; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 1.2rem; }
    .btn-icon.delete { filter: grayscale(1); }
    .btn-icon.delete:hover { filter: none; }
  `]
})
export class AdminKaraokeComponent implements OnInit {
  private service = inject(KaraokeService);
  
  songs = signal<KaraokeSong[]>([]);
  showForm = false;
  isGenerating = false;

  currentSong: KaraokeSong = this.resetSong();

  ngOnInit() {
    this.loadSongs();
  }

  loadSongs() {
    this.service.getAllSongs().subscribe(songs => this.songs.set(songs));
  }

  resetSong(): KaraokeSong {
    return { title: '', artist: '', audioUrl: '', lyricsJson: '[]', published: true };
  }

  openCreateForm() {
    this.currentSong = this.resetSong();
    this.showForm = true;
  }

  generateWithAI() {
    if (!this.currentSong.title || !this.currentSong.artist) return;
    this.isGenerating = true;
    this.service.generateLyrics(this.currentSong.title, this.currentSong.artist).subscribe({
      next: (res) => {
        try {
          const content = res.lyrics;
          this.currentSong.lyricsJson = content;
          this.isGenerating = false;
        } catch (e) {
          console.error('Failed to parse AI lyrics', e);
          this.isGenerating = false;
        }
      },
      error: () => this.isGenerating = false
    });
  }

  save() {
    this.service.saveSong(this.currentSong).subscribe(() => {
      this.loadSongs();
      this.showForm = false;
      this.currentSong = this.resetSong();
    });
  }

  edit(song: KaraokeSong) {
    this.currentSong = { ...song, published: song.published ?? true };
    this.showForm = true;
  }

  delete(id: number) {
    if (confirm('Supprimer cette chanson ?')) {
      this.service.deleteSong(id).subscribe(() => this.loadSongs());
    }
  }
}