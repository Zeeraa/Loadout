import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

export class Loadout {
  public readonly window: BrowserWindow;

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
  }
}
