import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigurationService, Mode, AfterUpdateAction } from '../../core/services/configuration-service';
import { UpdateService } from '../../core/services/update.service';
import { ToastService } from 'ngx-yet-another-toast-library';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  protected readonly configService = inject(ConfigurationService);
  protected readonly updateService = inject(UpdateService);
  private readonly toastService = inject(ToastService);

  protected readonly Mode = Mode;
  protected readonly AfterUpdateAction = AfterUpdateAction;

  protected async onModeChange(mode: Mode): Promise<void> {
    const current = this.configService.configuration();
    current.mode = mode;
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success('Update start behavior updated.', 'Config Saved');
  }

  protected async onScheduledTimeChange(time: string): Promise<void> {
    const current = this.configService.configuration();
    current.scheduledTime = time || '03:00';
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success(`Scheduled daily update time set to ${current.scheduledTime}.`, 'Config Saved');
  }

  protected async onAfterUpdateActionChange(action: AfterUpdateAction): Promise<void> {
    const current = this.configService.configuration();
    current.afterUpdateAction = action;
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success('Post-update behavior updated.', 'Config Saved');
  }
}
