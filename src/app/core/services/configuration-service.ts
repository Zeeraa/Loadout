import { Injectable, inject, signal } from "@angular/core";
import { ElectronService } from "./electron.service";
import { firstValueFrom } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {
  private readonly electronService = inject(ElectronService);
  public readonly configuration = signal<Configuration>(blankConfiguration());

  /**
   * Load config from electron main process and update the configuration signal.
   */
  public async loadConfiguration() {
    try {
      const config = await firstValueFrom(this.electronService.loadConfig());
      if (config) {
        // Ensure default values exist
        const merged: Configuration = {
          discord: {
            enabled: !!config?.discord?.enabled,
            webhookUrl: config?.discord?.webhookUrl || null,
            notificationEvents: config?.discord?.notificationEvents || [],
          },
          steam: {
            enabled: !!config?.steam?.enabled,
            defaultSteamAppsDir: config?.steam?.defaultSteamAppsDir || '',
            accounts: config?.steam?.accounts || [],
            games: config?.steam?.games || [],
          },
          mode: config?.mode || Mode.Manual,
          afterUpdateAction: config?.afterUpdateAction || AfterUpdateAction.None,
          keepUpdateUiOpen: config?.keepUpdateUiOpen !== false,
        };
        this.configuration.set(merged);
      } else {
        this.configuration.set(blankConfiguration());
      }
    } catch (e) {
      console.error("Error loading configuration:", e);
      this.configuration.set(blankConfiguration());
    }
  }

  /**
   * Save the current configuration signal to the electron main process.
   */
  public async saveConfiguration() {
    try {
      const current = this.configuration();
      await firstValueFrom(this.electronService.saveConfig(current));
    } catch (e) {
      console.error("Error saving configuration:", e);
    }
  }
}

export interface Configuration {
  discord: DiscordConfig;
  steam: SteamConfig;
  mode: Mode;
  afterUpdateAction: AfterUpdateAction;
  keepUpdateUiOpen: boolean;
}

export enum Mode {
  Manual = 'manual',
  Auto = 'auto',
  Scheduled = 'scheduled',
}

export enum AfterUpdateAction {
  None = 'none',
  Exit = 'exit',
  Reboot = 'reboot',
}

export interface DiscordConfig {
  enabled: boolean;
  webhookUrl: string | null;
  notificationEvents: DiscordNotifyEvents[];
}

export enum DiscordNotifyEvents {
  NotifyStart = 'notifyStart',
  NotifyFinish = 'notifyFinish',
  NotifyGameUpdateStart = 'notifyGameUpdateStart',
  NotifyGameUpdateFinish = 'notifyGameUpdateFinish',
}

export interface SteamConfig {
  enabled: boolean;
  accounts: SteamAccount[];
  games: SteamGame[];
  defaultSteamAppsDir: string;
}

export interface SteamAccount {
  uuid: string;
  username: string;
  password: string;
  disabled: boolean;
}

export interface SteamGame {
  accountId: string | null;
  appId: number;
  name: string;
  disabled: boolean;
  validate: boolean;
  overrideInstallDir: string | null;
}

export function blankConfiguration(): Configuration {
  return {
    discord: {
      enabled: false,
      webhookUrl: null,
      notificationEvents: [],
    },
    steam: {
      enabled: false,
      accounts: [],
      games: [],
      defaultSteamAppsDir: ''
    },
    mode: Mode.Manual,
    afterUpdateAction: AfterUpdateAction.None,
    keepUpdateUiOpen: true,
  }
}
