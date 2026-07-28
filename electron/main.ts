import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { Loadout } from './Loadout';

const isDev = !app.isPackaged;

let loadout: Loadout | null = null;

if (isDev) {
  // Watch compiled output dir for changes from tsc --watch.
  // Only call app.exit(0) — no relaunch — so the while loop in the
  // start script spawns a single fresh instance.
  let debounce: ReturnType<typeof setTimeout> | null = null;
  fs.watch(__dirname, { recursive: true }, (_, filename) => {
    if (!filename?.endsWith('.js')) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => app.exit(0), 500);
  });
}

app.whenReady().then(() => {
  loadout = new Loadout();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      loadout = new Loadout();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Exit with non-zero so the dev restart loop (while electron .) stops
    // and signals concurrently to shut down the other processes.
    app.exit(1);
  }
});

