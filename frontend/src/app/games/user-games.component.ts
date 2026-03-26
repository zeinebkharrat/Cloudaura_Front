import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LudificationService, PuzzleImage, RoadmapNode } from '../core/ludification.service';

@Component({
  selector: 'app-user-games',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-games.component.html',
  styleUrl: './user-games.component.css'
})
export class UserGamesComponent implements OnInit {
  roadmapNodes = signal<RoadmapNode[]>([]);
  puzzles = signal<PuzzleImage[]>([]);
  currentNodeIndex = signal<number>(0);

  constructor(private api: LudificationService, private router: Router) {}

  ngOnInit() {
    this.api.getPuzzles().subscribe((list) => {
      this.puzzles.set((list ?? []).filter((p) => p.published));
    });

    this.api.getRoadmap().subscribe({
      next: (nodes: any) => {
        // Gérer le cas où l'API renvoie un objet avec "content" au lieu d'un tableau direct
        let activeNodes: RoadmapNode[] = [];
        if (Array.isArray(nodes)) {
          activeNodes = nodes;
        } else if (nodes && Array.isArray(nodes.content)) {
          activeNodes = nodes.content;
        }
        
        if (activeNodes && activeNodes.length > 0) {
          const normalized = activeNodes.map((node) => ({
            ...node,
            quizId: node.quizId ?? node.quiz?.quizId,
            crosswordId: node.crosswordId ?? node.crossword?.crosswordId,
            puzzleId: node.puzzleId,
          }));
          this.roadmapNodes.set(
            [...normalized].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)),
          );
          // Débloquer tous les niveaux configurés par l'admin pour la démo
          this.currentNodeIndex.set(normalized.length - 1 > 0 ? normalized.length - 1 : 0);
        } else {
          this.loadFallbackFromQuizzes();
        }
      },
      error: (err) => {
        console.warn('Roadmap endpoint failed or empty, falling back to quizzes direct list', err);
        this.loadFallbackFromQuizzes();
      }
    });
  }

  loadFallbackFromQuizzes() {
    this.api.getQuizzes().subscribe({
      next: (quizzes) => {
        let fallbacks: RoadmapNode[] = quizzes.map((q, i) => ({
          nodeId: q.quizId,
          stepOrder: i,
          nodeLabel: q.title || `Niveau ${i+1}`,
          quizId: q.quizId
        }));
        
        if (fallbacks.length === 0) {
           fallbacks = Array.from({length: 6}, (_, i) => ({
             nodeId: i + 100,
             stepOrder: i,
             nodeLabel: `Épreuve secrète ${i+1}`
           }));
        }
        this.roadmapNodes.set(fallbacks);
        
        // Tous les niveaux récupérés depuis la BD sont débloqués par défaut (le max index) pour que l'utilisateur puisse tous les jouer !
        this.currentNodeIndex.set(fallbacks.length > 0 ? fallbacks.length - 1 : 1);
      },
      error: () => {
         const fallbacks = Array.from({length: 6}, (_, i) => ({
           nodeId: i + 100,
           stepOrder: i,
           nodeLabel: `Épreuve réseau ${i+1}`
         }));
         this.roadmapNodes.set(fallbacks);
         this.currentNodeIndex.set(1);
      }
    });
  }

  playNode(node: RoadmapNode, index: number) {
    if (index > this.currentNodeIndex()) {
      alert("Ce niveau est verrouillé ! Terminez les niveaux précédents d'abord.");
      return;
    }
    
    // Si l'utilisateur clique sur le niveau courant ou un niveau débloqué
    const quizId = node.quizId ?? node.quiz?.quizId;
    const crosswordId = node.crosswordId ?? node.crossword?.crosswordId;
    const puzzleId = node.puzzleId;

    if (quizId) {
      this.router.navigate(['/games/quiz', quizId]);
      return;
    }

    if (crosswordId) {
      this.router.navigate(['/games/crossword', crosswordId]);
      return;
    }

    if (puzzleId) {
      this.router.navigate(['/games/puzzle', puzzleId]);
      return;
    }

    // Si aucun jeu réel n'est lié au node, on ne redirige pas vers un faux ID.
    alert("Aucun quiz lié à cette étape pour le moment.");
  }

  playPuzzle(puzzleId: number): void {
    this.router.navigate(['/games/puzzle', puzzleId]);
  }
}
