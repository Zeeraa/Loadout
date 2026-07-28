import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfigurationService } from '../../core/services/configuration-service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly configService = inject(ConfigurationService);
}
