import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { SteamManager } from './providers/SteamManager';
import { DiscordManager } from './notifications/DiscordManager';
import { ConfigurationManager } from './config/ConfigurationManager';

const isDev = !app.isPackaged;

export class Loadout {
  public readonly window: BrowserWindow;
  public readonly steamManager: SteamManager;
  public readonly discordManager: DiscordManager;
  public readonly configurationManager: ConfigurationManager;

  constructor() {
    Menu.setApplicationMenu(null);

    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.steamManager = new SteamManager(this);
    this.discordManager = new DiscordManager(this);
    this.configurationManager = new ConfigurationManager(this);

    if (isDev) {
      this.window.loadURL('http://localhost:4200');
      this.window.webContents.openDevTools();
    } else {
      this.window.loadFile(path.join(__dirname, '..', 'angular', 'browser', 'index.html'));
    }

    this.registerIpcHandlers();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('ping', () => 'pong');
    ipcMain.handle('select-directory', async () => {
      const result = await dialog.showOpenDialog(this.window, {
        properties: ['openDirectory'],
      });
      return result.canceled ? null : result.filePaths[0];
    });
  }
}
