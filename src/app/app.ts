import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { ConfigurationService, Mode } from './core/services/configuration-service';
import { UpdateService } from './core/services/update.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AutoUpdateCountdown } from './shared/components/auto-update-countdown/auto-update-countdown';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgbModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly configService = inject(ConfigurationService);
  private readonly updateService = inject(UpdateService);
  private readonly modalService = inject(NgbModal);
  protected readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.configService.loadConfiguration();

    // The update-status popup window loads this same app bundle — only the main window should prompt for auto-start.
    if (!this.isUpdateStatusPage() && this.configService.configuration().mode === Mode.Auto) {
      this.startAutoUpdateCountdown();
    }
  }

  private startAutoUpdateCountdown(): void {
    const modalRef = this.modalService.open(AutoUpdateCountdown, { centered: true, backdrop: 'static', keyboard: false });

    modalRef.result.then(
      (proceed: boolean) => {
        if (proceed) {
          this.updateService.startFullUpdate();
        }
      },
      () => {
        // Dismissed (e.g. window closed) — do not start the update
      },
    );
  }

  protected isUpdateStatusPage(): boolean {
    return this.router.url.includes('/update-status');
  }
}

