import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-community-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './community-shell.component.html',
  styleUrl: './community-shell.component.css',
})
export class CommunityShellComponent {
  readonly authService = inject(AuthService);
}
