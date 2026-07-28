import { contextBridge, ipcRenderer } from 'electron';
import { Configuration } from './config/ConfigurationManager';

// Expose APIs to the renderer process via contextBridge.
// Add IPC methods here as the app grows.
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  fetchSteamGame: (appId: string | number) => ipcRenderer.invoke('fetch-steam-game', appId),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config: Configuration) => ipcRenderer.invoke('save-config', config),
  testDiscordNotification: () => ipcRenderer.invoke('discord-test-notification'),
  testSteamLogin: () => ipcRenderer.invoke('test-steam-login'),
});
