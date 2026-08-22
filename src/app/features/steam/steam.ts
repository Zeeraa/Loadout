import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfigurationService } from '../../core/services/configuration-service';
import { ElectronService } from '../../core/services/electron.service';
import { UpdateService } from '../../core/services/update.service';
import { ToastService } from 'ngx-yet-another-toast-library';
import { AccountList } from './account-list/account-list';
import { GameList } from './game-list/game-list';

@Component({
  selector: 'app-steam',
  imports: [RouterLink, FormsModule, AccountList, GameList],
  templateUrl: './steam.html',
  styleUrl: './steam.scss',
})
export class Steam {
  protected readonly configService = inject(ConfigurationService);
  protected readonly updateService = inject(UpdateService);
  private readonly electronService = inject(ElectronService);
  private readonly toastService = inject(ToastService);

  protected async toggleEnabled(enabled: boolean): Promise<void> {
    const current = this.configService.configuration();
    current.steam.enabled = enabled;
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success(
      `Steam integration has been ${enabled ? 'enabled' : 'disabled'}.`,
      'Config Updated',
    );
  }

  protected async onPickDirectory(): Promise<void> {
    try {
      const selected = await this.electronService.selectDirectory().toPromise();
      if (selected !== null && selected !== undefined) {
        const current = this.configService.configuration();
        current.steam.defaultSteamAppsDir = selected;
        this.configService.configuration.set({ ...current });
        await this.configService.saveConfiguration();
        this.toastService.success(
          `SteamApps directory set to: ${selected}`,
          'Directory Selected',
        );
      }
    } catch (e) {
      console.error('Failed to select directory', e);
      this.toastService.error('Could not select directory', 'Error');
    }
  }
}
