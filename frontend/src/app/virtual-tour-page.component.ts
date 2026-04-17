import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { VirtualTourComponent } from './virtual-tour.component';

@Component({
  selector: 'app-virtual-tour-page',
  standalone: true,
  imports: [RouterLink, VirtualTourComponent, TranslateModule],
  templateUrl: './virtual-tour-page.component.html',
  styleUrl: './virtual-tour-page.component.css',
})
export class VirtualTourPageComponent {}
