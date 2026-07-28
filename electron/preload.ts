import { contextBridge, ipcRenderer } from 'electron';

// Expose APIs to the renderer process via contextBridge.
// Add IPC methods here as the app grows.
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
});
