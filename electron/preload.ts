import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { Configuration } from './config/ConfigurationManager';
import { UpdateState } from './UpdateManager';

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
  startFullUpdate: () => ipcRenderer.invoke('start-full-update'),
  cancelUpdate: () => ipcRenderer.invoke('cancel-update'),
  forceKillUpdate: () => ipcRenderer.invoke('force-kill-update'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  closeUpdateWindow: () => ipcRenderer.invoke('close-update-window'),
  cancelPostUpdateAction: () => ipcRenderer.invoke('cancel-post-update-action'),
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    const listener = (_event: IpcRendererEvent, state: UpdateState) => callback(state);
    ipcRenderer.on('update-state-changed', listener);
    return () => {
      ipcRenderer.removeListener('update-state-changed', listener);
    };
  },
});
