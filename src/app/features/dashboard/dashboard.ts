import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigurationService } from '../../core/services/configuration-service';
import { UpdateService } from '../../core/services/update.service';
import { ToastService } from 'ngx-yet-another-toast-library';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly configService = inject(ConfigurationService);
  protected readonly updateService = inject(UpdateService);
  private readonly toastService = inject(ToastService);

  protected onStartFullUpdate(): void {
    const config = this.configService.configuration();
    const hasEnabledGames = config.steam.enabled && config.steam.games.some(g => !g.disabled);

    if (!hasEnabledGames) {
      this.toastService.warning('No active/enabled games found to update. Please configure Steam integrated games first.', 'Update Terminated');
      return;
    }

    this.updateService.startFullUpdate();
    this.toastService.success('Update sequence started! Opening progress window...', 'Updater Active');
  }

  protected async toggleKeepUiOpen(doneValue: boolean): Promise<void> {
    const current = this.configService.configuration();
    current.keepUpdateUiOpen = doneValue;
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success(
      `Update popup persistence ${doneValue ? 'enabled (will stay open)' : 'disabled (will auto-close)'}.`,
      'Config Saved'
    );
  }
}
