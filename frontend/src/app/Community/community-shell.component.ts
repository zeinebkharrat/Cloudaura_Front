import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-community-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './community-shell.component.html',
  styleUrl: './community-shell.component.css',
})
export class CommunityShellComponent {
  readonly authService = inject(AuthService);
}
