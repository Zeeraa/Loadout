import { app } from "electron";

export function getDataDirectory(): string {
  return app.getPath('userData');
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
