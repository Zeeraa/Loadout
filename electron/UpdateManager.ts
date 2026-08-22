import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import { exec } from 'child_process';
import { Loadout } from './Loadout';
import { AfterUpdateAction, Mode, SteamGame } from './config/ConfigurationManager';

const isDev = !app.isPackaged;

export interface UpdateState {
  isUpdating: boolean;
  totalGames: number;
  currentIndex: number; // 1-based index (e.g. 1 out of 5)
  currentGame: {
    appId: number;
    name: string;
    provider: string;
  } | null;
  logs: string[];
  isCancelled: boolean;
  /** Set while counting down to an Exit/Shutdown that will happen after the update finished */
  pendingPostUpdateAction: 'exit' | 'shutdown' | null;
  pendingPostUpdateSecondsRemaining: number;
}

export class UpdateManager {
  protected readonly loadout: Loadout;
  public updateWindow: BrowserWindow | null = null;

  private state: UpdateState = {
    isUpdating: false,
    totalGames: 0,
    currentIndex: 0,
    currentGame: null,
    logs: [],
    isCancelled: false,
    pendingPostUpdateAction: null,
    pendingPostUpdateSecondsRemaining: 0,
  };

  // Tracks the calendar day (YYYY-MM-DD) a scheduled update last ran on, so it only fires once per day
  private lastScheduledRunDate: string | null = null;
  private postUpdateActionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(loadout: Loadout) {
    this.loadout = loadout;
    this.registerIpcHandlers();
    this.startScheduleWatcher();
  }

  /** Polls once a minute for a matching Scheduled-mode time so daily updates run in the background. */
  private startScheduleWatcher(): void {
    setInterval(() => this.checkSchedule(), 60_000);
  }

  private checkSchedule(): void {
    const config = this.loadout.configurationManager.getConfig();
    if (config.mode !== Mode.Scheduled || !config.scheduledTime || this.state.isUpdating) {
      return;
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (this.lastScheduledRunDate === today) {
      return;
    }

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (currentTime === config.scheduledTime) {
      this.lastScheduledRunDate = today;
      console.log(`Scheduled update time (${config.scheduledTime}) reached, starting full update.`);
      this.startFullUpdate();
    }
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('start-full-update', async () => {
      this.startFullUpdate();
      return true;
    });

    ipcMain.handle('cancel-update', async () => {
      this.cancelUpdate();
      return true;
    });

    ipcMain.handle('force-kill-update', async () => {
      this.forceKillUpdate();
      return true;
    });

    ipcMain.handle('get-update-state', async () => {
      return this.state;
    });

    ipcMain.handle('close-update-window', async () => {
      if (this.updateWindow) {
        this.updateWindow.close();
      }
      return true;
    });

    ipcMain.handle('cancel-post-update-action', async () => {
      this.cancelPendingPostUpdateAction();
      return true;
    });
  }

  public getUpdateState(): UpdateState {
    return this.state;
  }

  private broadcastStateChange(): void {
    const safeState = { ...this.state };
    // Broadcast to primary window
    if (this.loadout.window && !this.loadout.window.isDestroyed()) {
      this.loadout.window.webContents.send('update-state-changed', safeState);
    }
    // Broadcast to update popup window
    if (this.updateWindow && !this.updateWindow.isDestroyed()) {
      this.updateWindow.webContents.send('update-state-changed', safeState);
    }
  }

  public addLog(message: string): void {
    const cleanMsg = message.trim();
    if (!cleanMsg) return;

    // Split multi-line logs if any
    const lines = cleanMsg.split(/\r?\n/);
    this.state.logs.push(...lines);

    // Limit log array to size of last 1000 lines
    if (this.state.logs.length > 1000) {
      this.state.logs = this.state.logs.slice(this.state.logs.length - 1000);
    }

    this.broadcastStateChange();
  }

  public openUpdateWindow(): void {
    if (this.updateWindow && !this.updateWindow.isDestroyed()) {
      this.updateWindow.focus();
      return;
    }

    this.updateWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'Updating Loadout Games',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.updateWindow.setMenu(null);

    // Prevent closing the update status window while updates are actively running or a post-update action is pending
    this.updateWindow.on('close', (e) => {
      if (this.state.isUpdating) {
        e.preventDefault();
        this.addLog('[System] Prevented close of the status panel! Updates are currently active. Please use "Cancel Process" or "Force Kill" to safely terminate first.');
      } else if (this.state.pendingPostUpdateAction) {
        e.preventDefault();
        this.addLog('[System] Prevented close of the status panel! Use the "Cancel" button to stop the pending post-update action first.');
      }
    });

    if (isDev) {
      this.updateWindow.loadURL('http://localhost:4200/#/update-status');
    } else {
      const filePath = path.join(__dirname, '..', 'angular', 'browser', 'index.html');
      this.updateWindow.loadFile(filePath, { hash: '/update-status' });
    }

    // Allow pressing F12 to toggle developer tools instead of always showing them
    this.updateWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12' && this.updateWindow) {
        if (this.updateWindow.webContents.isDevToolsOpened()) {
          this.updateWindow.webContents.closeDevTools();
        } else {
          this.updateWindow.webContents.openDevTools();
        }
        event.preventDefault();
      }
    });

    this.updateWindow.on('closed', () => {
      this.updateWindow = null;
    });
  }

  public async startFullUpdate(): Promise<void> {
    if (this.state.isUpdating) {
      console.warn('An update process is already running.');
      return;
    }

    const config = this.loadout.configurationManager.getConfig();
    const gamesToUpdate: { game: SteamGame; provider: string }[] = [];

    // Gather Steam games
    if (config.steam.enabled) {
      const activeGames = config.steam.games.filter(g => !g.disabled);
      for (const game of activeGames) {
        gamesToUpdate.push({ game, provider: 'Steam' });
      }
    }

    if (gamesToUpdate.length === 0) {
      console.log('No enabled games found to update.');
      this.addLog('No enabled games configuration found to update.');
      return;
    }

    // Reset update state
    this.state = {
      isUpdating: true,
      totalGames: gamesToUpdate.length,
      currentIndex: 0,
      currentGame: null,
      logs: [],
      isCancelled: false,
      pendingPostUpdateAction: null,
      pendingPostUpdateSecondsRemaining: 0,
    };

    // Open popup window to show status
    this.openUpdateWindow();
    this.addLog(`Starting full update of ${this.state.totalGames} active games...`);
    this.broadcastStateChange();

    // Trigger Telegram/Discord Start notification if configured
    try {
      await this.loadout.discordManager.sendUpdateStartNofication(this.state.totalGames);
    } catch (e) {
      console.error('Failed to dispatch update-start Discord notification', e);
    }

    let successCount = 0;
    let failCount = 0;

    // Iterate sequentially
    for (let i = 0; i < gamesToUpdate.length; i++) {
      if (this.state.isCancelled) {
        this.addLog('Update sequence cancelled by client requirement.');
        break;
      }

      const item = gamesToUpdate[i];
      this.state.currentIndex = i + 1;
      this.state.currentGame = {
        appId: item.game.appId,
        name: item.game.name,
        provider: item.provider,
      };
      this.broadcastStateChange();

      this.addLog(`[${this.state.currentIndex}/${this.state.totalGames}] Updating ${item.game.name} (App ID: ${item.game.appId}) via ${item.provider}...`);

      try {
        let success = false;
        if (item.provider === 'Steam') {
          success = await this.loadout.steamManager.updateGame(item.game);
        }

        if (success) {
          successCount++;
          this.addLog(`Successfully completed update for ${item.game.name}.`);
        } else {
          failCount++;
          this.addLog(`Failed to update ${item.game.name}. See earlier error traces.`);
        }
      } catch (err) {
        failCount++;
        console.error(`Error updating ${item.game.name}:`, err);
        this.addLog(`Exception during update of ${item.game.name}: ${String(err)}`);
      }
    }

    this.state.isUpdating = false;
    this.state.currentGame = null;
    this.addLog('Update loop sequence finalized.');
    this.broadcastStateChange();

    // Trigger Discord Finish notification
    try {
      await this.loadout.discordManager.sendUpdateFinishNofication(
        this.state.totalGames,
        successCount,
        failCount,
      );
    } catch (e) {
      console.error('Failed to dispatch update-finish Discord notification', e);
    }

    // If configured to close/shut down after the update, count down (with a cancel option) instead of acting instantly.
    if (config.afterUpdateAction === AfterUpdateAction.Exit) {
      this.schedulePostUpdateAction('exit');
    } else if (config.afterUpdateAction === AfterUpdateAction.Shutdown) {
      this.schedulePostUpdateAction('shutdown');
    } else if (!config.keepUpdateUiOpen && this.updateWindow && !this.updateWindow.isDestroyed()) {
      // If configured to close the window automatically when done, do so.
      // Delay slightly so user has a chance to notice it finished
      setTimeout(() => {
        if (this.updateWindow && !this.updateWindow.isDestroyed()) {
          this.updateWindow.close();
        }
      }, 3000);
    }
  }

  /** Counts down 10s (broadcasting each tick so the UI can show a Cancel button) before exiting or shutting down. */
  private schedulePostUpdateAction(action: 'exit' | 'shutdown'): void {
    this.addLog(`[System] Configured to ${action === 'exit' ? 'close the application' : 'shut down the system'} after update completion. Starting 10 second countdown...`);

    this.state.pendingPostUpdateAction = action;
    this.state.pendingPostUpdateSecondsRemaining = 10;
    this.broadcastStateChange();

    this.postUpdateActionTimer = setInterval(() => {
      const remaining = this.state.pendingPostUpdateSecondsRemaining - 1;

      if (remaining <= 0) {
        this.clearPostUpdateActionTimer();
        this.state.pendingPostUpdateAction = null;
        this.state.pendingPostUpdateSecondsRemaining = 0;
        this.broadcastStateChange();

        if (action === 'exit') {
          app.exit(0);
        } else {
          this.shutdownSystem();
        }
      } else {
        this.state.pendingPostUpdateSecondsRemaining = remaining;
        this.broadcastStateChange();
      }
    }, 1000);
  }

  public cancelPendingPostUpdateAction(): void {
    if (!this.state.pendingPostUpdateAction) return;
    this.addLog(`[System] Post-update ${this.state.pendingPostUpdateAction} cancelled by user.`);
    this.clearPostUpdateActionTimer();
    this.state.pendingPostUpdateAction = null;
    this.state.pendingPostUpdateSecondsRemaining = 0;
    this.broadcastStateChange();
  }

  private clearPostUpdateActionTimer(): void {
    if (this.postUpdateActionTimer) {
      clearInterval(this.postUpdateActionTimer);
      this.postUpdateActionTimer = null;
    }
  }

  public cancelUpdate(): void {
    if (!this.state.isUpdating) return;
    this.state.isCancelled = true;
    this.addLog('Cancellation requested! Closing down after the pending game update finishes...');
    this.broadcastStateChange();
  }

  public forceKillUpdate(): void {
    if (!this.state.isUpdating) return;
    this.state.isCancelled = true;
    this.addLog('[System] FORCE KILL REQUESTED! Terminating the active installer process immediately...');
    const killed = this.loadout.steamManager.killActiveProcess();
    if (killed) {
      this.addLog('[System] Successfully terminated running active process.');
    } else {
      this.addLog('[System] No active process was registered as running, or termination query returned false.');
    }
  }

  private shutdownSystem(): void {
    const command = process.platform === 'win32' ? 'shutdown /s /t 0' : 'shutdown -h now';
    exec(command, (error) => {
      if (error) {
        console.error('Failed to execute system shutdown command:', error);
        this.addLog(`[System] Failed to shut down the system: ${String(error)}`);
      }
    });
  }
}
