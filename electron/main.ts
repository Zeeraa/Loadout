import { app, dialog } from 'electron';
import * as fs from 'fs';
import { Loadout } from './Loadout';
import { getPlatform, Platform } from './Utils';

const isDev = !app.isPackaged;

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
  const platform = getPlatform();
  if (platform === Platform.Unsupported) {
    dialog.showErrorBox('Unsupported Platform', 'This application only supports Windows and Linux platforms.');
    app.exit(1);
    return;
  }

  new Loadout();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Exit with non-zero so the dev restart loop (while electron .) stops
    // and signals concurrently to shut down the other processes.
    app.exit(1);
  }
});

