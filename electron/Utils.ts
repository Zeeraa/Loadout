import { app } from "electron";
import * as path from "path";

export function getExecutableDirectory(): string {
  if (!app.isPackaged) {
    return app.getAppPath();
  }

  // The Windows "portable" build self-extracts to a throwaway temp folder before launching, so
  // app.getPath('exe') would point there instead of where the user actually placed the .exe (e.g. a USB drive).
  // electron-builder exposes the real launch location via this env var in that case.
  return process.env.PORTABLE_EXECUTABLE_DIR ?? path.dirname(app.getPath('exe'));
}

export function getPlatform(): Platform {
  const platform = process.platform;
  switch (platform) {
    case 'win32':
      return Platform.Windows;
    case 'linux':
      return Platform.Linux;
    default:
      return Platform.Unsupported;
  }
}

export enum Platform {
  Windows = "windows",
  Linux = "linux",
  Unsupported = "unsupported",
}

export const SteamCMDDownloads = {
  Windows: "https://client-update.steamstatic.com/installer/steamcmd.zip",
  Linux: "https://client-update.steamstatic.com/installer/steamcmd_linux.tar.gz",
}
