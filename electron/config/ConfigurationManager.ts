import * as path from 'path';
import * as fs from 'fs';
import { ipcMain } from 'electron';
import { Loadout } from '../Loadout';
import { getDataDirectory } from '../Utils';

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

export interface SteamConfig {
  enabled: boolean;
  accounts: SteamAccount[];
  games: SteamGame[];
  defaultSteamAppsDir: string;
}

export interface Configuration {
  discord: DiscordConfig;
  steam: SteamConfig;
  mode: Mode;
  afterUpdateAction: AfterUpdateAction;
  keepUpdateUiOpen: boolean;
  /** Time of day (HH:mm, 24h) the update should run when mode is Scheduled */
  scheduledTime: string;
}

export enum Mode {
  /** User has to manually press the start button (Default) */
  Manual = 'manual',

  /** Automatically start the update process when the app is launched. There will be a 10 second countdown before the update starts */
  Auto = 'auto',

  /** Scheduled start of the update process at a specified time */
  Scheduled = 'scheduled',
}

export enum AfterUpdateAction {
  /** Do nothing after the update process is complete (Default) */
  None = 'none',

  /** Exit the application after the update process is complete */
  Exit = 'exit',

  /** Reboot the system after the update process is complete */
  Reboot = 'reboot',

  /** Shut down the system after the update process is complete */
  Shutdown = 'shutdown',
}

/**
 * Configuration for discord webhook notifications.
 */
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
      defaultSteamAppsDir: '',
    },
    mode: Mode.Manual,
    afterUpdateAction: AfterUpdateAction.None,
    keepUpdateUiOpen: true,
    scheduledTime: '03:00',
  };
}

export class ConfigurationManager {
  protected readonly loadout: Loadout
  private readonly configPath: string;
  private currentConfig: Configuration;

  constructor(loadout: Loadout) {
    this.loadout = loadout;
    this.configPath = path.join(getDataDirectory(), 'config.json');

    this.currentConfig = blankConfiguration();
    this.loadOnStartup();
    this.registerIpcHandlers();
  }

  private loadOnStartup(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.currentConfig = this.normalizeConfig(JSON.parse(content));
        console.log('Configuration successfully loaded from startup:', this.configPath);
      } catch (e) {
        console.error('Failed to parse config file on startup', e);
        this.currentConfig = blankConfiguration();
      }
    } else {
      this.currentConfig = blankConfiguration();
      console.log('No configuration found on startup, using blank template.');
    }
  }

  /** Fills in any fields missing from an older config.json with defaults so new settings don't come back as undefined. */
  private normalizeConfig(parsed: Partial<Configuration> | null | undefined): Configuration {
    const blank = blankConfiguration();
    if (!parsed) {
      return blank;
    }

    return {
      discord: { ...blank.discord, ...parsed.discord },
      steam: { ...blank.steam, ...parsed.steam },
      mode: parsed.mode ?? blank.mode,
      afterUpdateAction: parsed.afterUpdateAction ?? blank.afterUpdateAction,
      keepUpdateUiOpen: parsed.keepUpdateUiOpen ?? blank.keepUpdateUiOpen,
      scheduledTime: parsed.scheduledTime ?? blank.scheduledTime,
    };
  }

  public getConfig(): Configuration {
    return this.currentConfig;
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('load-config', async () => {
      return this.currentConfig;
    });

    ipcMain.handle('save-config', async (_, config: Configuration) => {
      try {
        this.currentConfig = this.normalizeConfig(config);
        fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
        fs.writeFileSync(this.configPath, JSON.stringify(this.currentConfig, null, 2), 'utf-8');
        console.log('Configuration successfully saved to:', this.configPath);
        return true;
      } catch (e) {
        console.error('Failed to save config file', e);
        return false;
      }
    });
  }
}
