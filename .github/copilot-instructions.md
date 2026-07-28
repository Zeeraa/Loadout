# Loadout
Loadout is a tool that allows the user to automatically install and update games on multiple platforms such as Steam and Epic Games for use in internet cafes, gaming centers, and other similar environments. It allows the user to provide the logins for the platfors and to configure what games should be installed and updated. It also allows the user to specify how the program should behave, for example the program can run in the background and automatically update on a schedule, it can also run as a executable on a usb drive so emplayees can manually run it or it can be configured to automatically run on startup, update the games and then shutdown the host.

## Tech stack
- **Electron** — desktop shell, main process
- **Angular** — UI framework (renderer process, loaded via Electron)
- **TypeScript** — used for both Electron and Angular code
- **electron-builder** — packaging into distributable binaries
- **ng-bootstrap** — Bootstrap components for Angular (no jQuery)

## UI design guidelines
- Use **Bootstrap** utility classes and `ng-bootstrap` components for all UI work.
- Keep the design **minimalistic** — avoid decorative chrome, unnecessary padding, and visual noise.
- The app may run on VMs or small displays, so layouts must work well at **low resolutions**. Prefer compact components, avoid fixed large widths, and use Bootstrap's responsive grid (`col-*`) throughout.
- Prefer `container-fluid` over fixed-width `container` to make full use of whatever screen space is available.
- Interactive controls (buttons, inputs) should be clearly labelled and easy to hit — consider `btn-sm` / `form-control-sm` to keep forms compact without sacrificing usability.

## Directory structure
```
electron/          Electron main-process source (TypeScript)
  main.ts          Entry point: app lifecycle, dev file watcher, instantiates Loadout
  Loadout.ts       Loadout class — Main application class, owns the primary BrowserWindow and IPC handlers
  preload.ts       Context bridge — exposes safe IPC APIs to the renderer via window.api

src/               Angular application source
  main.ts          Angular bootstrap
  app/             Root component and routing

dist/              Compiled output (git-ignored)
  electron/        Compiled Electron JS (tsc output)
  angular/         Compiled Angular app (ng build output)

release/           Packaged distributable binaries (git-ignored)

tsconfig.json          Base TypeScript config (shared)
tsconfig.app.json      Angular-specific TypeScript config
tsconfig.electron.json Electron-specific TypeScript config (module: commonjs, outDir: dist/electron)
angular.json           Angular CLI config (outputPath: dist/angular)
package.json           npm scripts and electron-builder config
```

## npm commands
| Command | Description |
|---|---|
| `npm start` | Dev mode: compiles Electron once, then runs `ng serve`, `tsc --watch`, and Electron concurrently with hot reload |
| `npm run build` | Compile Angular and Electron TypeScript to `dist/` |
| `npm run package` | Full production build + package into `release/` via electron-builder |
| `npm test` | Run unit tests |

## Electron architecture
The Electron code follows an object-oriented style.

- **`main.ts`** is the entry point only. It sets up the dev file watcher (watches `dist/electron/` for JS changes and calls `app.exit(0)` so the dev restart loop respawns a fresh instance), then instantiates `Loadout` once the app is ready.
- **`Loadout`** (`electron/Loadout.ts`) is the central application class. It owns:
  - `public readonly window: BrowserWindow` — the main application window
  - `private registerIpcHandlers()` — all `ipcMain` handler registrations go here
- **`preload.ts`** exposes IPC methods to Angular via `contextBridge.exposeInMainWorld('api', { ... })`. Every new IPC channel needs a corresponding entry here.

When adding new IPC channels:
1. Add an `ipcMain.handle('channel-name', ...)` call inside `registerIpcHandlers()` in `Loadout.ts`
2. Expose it in `preload.ts` via `ipcRenderer.invoke('channel-name', ...)`
3. Call it in Angular as `(window as any).api.channelName()`

## Dev mode hot reload behaviour
- **Angular changes** — hot-reloaded automatically by the Angular dev server (`ng serve`)
- **Electron changes** — `tsc --watch` recompiles to `dist/electron/`; a `fs.watch` inside the main process detects the updated JS files and calls `app.exit(0)`; the `while electron .` shell loop in the start script restarts a single fresh Electron instance

## Packaging (electron-builder)
- App ID: `net.zeeraa.loadout`
- Windows target: `portable` (single `.exe`, no installer)
- Linux target: `AppImage`
- Output directory: `release/`

## Update strategies
### Steam
* Create a temp directory for the update process.
* Download and extract SteamCMD to the temp directory.
* Create a symbolinc link from the real games steamapps directory to the temp directory.
* Use SteamCMD to log in to the user's Steam account.
* Use SteamCMD to update the games specified by the user. If we enabled verify then also verify the integrity of the game files.
* Remove the symbolic link.
* Repeate the process from the create symbolic link step for each game that needs to be updated.
* When all games have been updated, remove the temp directory.

