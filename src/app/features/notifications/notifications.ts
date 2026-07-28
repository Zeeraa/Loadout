import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigurationService, DiscordNotifyEvents } from '../../core/services/configuration-service';
import { ElectronService } from '../../core/services/electron.service';
import { ToastService } from 'ngx-yet-another-toast-library';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  protected readonly configService = inject(ConfigurationService);
  private readonly electronService = inject(ElectronService);
  private readonly toastService = inject(ToastService);

  // Expose enum to template
  protected readonly DiscordNotifyEvents = DiscordNotifyEvents;

  protected readonly isTesting = signal<boolean>(false);

  protected async toggleDiscordEnabled(enabled: boolean): Promise<void> {
    const current = this.configService.configuration();
    current.discord.enabled = enabled;
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success(
      `Discord Webhook notifications have been ${enabled ? 'enabled' : 'disabled'}.`,
      'Config Saved'
    );
  }

  protected async onWebhookUrlChange(url: string): Promise<void> {
    const current = this.configService.configuration();
    current.discord.webhookUrl = url.trim() || null;
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
  }

  protected isEventChecked(event: DiscordNotifyEvents): boolean {
    const events = this.configService.configuration().discord.notificationEvents || [];
    return events.includes(event);
  }

  protected async toggleEvent(event: DiscordNotifyEvents, checked: boolean): Promise<void> {
    const current = this.configService.configuration();
    let events = current.discord.notificationEvents || [];

    if (checked) {
      if (!events.includes(event)) {
        events = [...events, event];
      }
    } else {
      events = events.filter(e => e !== event);
    }

    current.discord.notificationEvents = events;
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success('Notification events preference upgraded.', 'Config Saved');
  }

  protected async onTestNotification(): Promise<void> {
    this.isTesting.set(true);
    try {
      const res = await this.electronService.testDiscordNotification().toPromise();
      if (res === true) {
        this.toastService.success('Test notification triggered successfully!', 'Test Triggered');
      } else {
        this.toastService.error('Failed to trigger test notification.', 'Error');
      }
    } catch (e) {
      console.error(e);
      this.toastService.error('Error contacting backend to test notification.', 'Trigger Failed');
    } finally {
      this.isTesting.set(false);
    }
  }
}
