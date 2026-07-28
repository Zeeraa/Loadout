import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ConfigurationService } from './core/services/configuration-service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgbModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly configService = inject(ConfigurationService);
  protected readonly title = signal('loadout');

  ngOnInit(): void {
    this.configService.loadConfiguration();
  }
}
