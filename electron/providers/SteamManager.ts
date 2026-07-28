import { ipcMain } from 'electron';
import axios from 'axios';
import { Loadout } from '../Loadout';
import { getExecutableDirectory, getPlatform, Platform, SteamCMDDownloads } from '../Utils';
import path from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { exec, execSync } from 'node:child_process';

export class SteamManager {
  protected readonly loadout: Loadout;
  public readonly steamCmdFolderPath: string;

  constructor(loadout: Loadout) {
    this.loadout = loadout;
    this.registerIpcHandlers();
    this.steamCmdFolderPath = path.join(getExecutableDirectory(), 'steamcmd');

    if(!existsSync(this.steamCmdFolderPath)) {
      mkdirSync(this.steamCmdFolderPath, { recursive: true });
    }
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('fetch-steam-game', async (_, appId: string | number) => {
      try {
        const res = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
        const json = res.data;
        const idStr = String(appId).trim();
        if (json && json[idStr] && json[idStr].success) {
          const data = json[idStr].data;
          return {
            success: true,
            name: data.name,
            headerImage: data.header_image,
          };
        }
        return { success: false };
      } catch (error) {
        console.error('Error fetching steam game:', error);
        return { success: false, error: String(error) };
      }
    });

    ipcMain.handle('test-steam-login', async () => {
      try {
        await this.testLogin();
        return { success: true };
      } catch (error) {
        console.error('Error in test-steam-login:', error);
        return { success: false, error: String(error) };
      }
    });
  }

  public async installAndGetSteamCmdExecutable() {
    const platform = getPlatform();
    let targetExecutable = "";
    if (platform === Platform.Windows) {
      targetExecutable = path.join(this.steamCmdFolderPath, 'steamcmd.exe');
    } else if (platform === Platform.Linux) {
      targetExecutable = path.join(this.steamCmdFolderPath, 'steamcmd.sh');
    }

    if(!existsSync(targetExecutable)) {
      console.log(`SteamCMD executable not found for platform: ${platform}. Downloading...`);
      if(platform === Platform.Windows) {
        await this.downloadWindows();
      } else if(platform === Platform.Linux) {
        await this.downloadLinux();
      }
      if(!existsSync(targetExecutable)) {
        throw new Error(`Failed to download SteamCMD for platform: ${platform}`);
      }
    }

    return targetExecutable;
  }

  private async downloadWindows() {
    const url = SteamCMDDownloads.Windows;
    const tempFile = path.join(this.steamCmdFolderPath, 'steamcmd.zip');

    if (existsSync(tempFile)) {
      rmSync(tempFile, { force: true });
    }

    try {
      console.log('Downloading SteamCMD for Windows from:', url);
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      writeFileSync(tempFile, Buffer.from(response.data));
      console.log('Successfully downloaded Windows SteamCMD to temp file, starting extraction...');

      // Extract ZIP using tar or PowerShell Expand-Archive as fallback
      try {
        execSync(`tar -xf "${tempFile}" -C "${this.steamCmdFolderPath}"`);
      } catch (tarError) {
        console.warn('tar extraction failed, attempting PowerShell fallback...', tarError);
        execSync(`powershell -command "Expand-Archive -Path '${tempFile}' -DestinationPath '${this.steamCmdFolderPath}' -Force"`);
      }
      console.log('Successfully completed Windows SteamCMD extraction!');
    } catch (error) {
      console.error('Error during Windows SteamCMD download or extraction:', error);
      throw error;
    } finally {
      if (existsSync(tempFile)) {
        rmSync(tempFile, { force: true });
      }
    }
  }

  private async downloadLinux() {
    const url = SteamCMDDownloads.Linux;
    const tempFile = path.join(this.steamCmdFolderPath, 'steamcmd_linux.tar.gz');

    if (existsSync(tempFile)) {
      rmSync(tempFile, { force: true });
    }

    try {
      console.log('Downloading SteamCMD for Linux from:', url);
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      writeFileSync(tempFile, Buffer.from(response.data));
      console.log('Successfully downloaded Linux SteamCMD to temp file, starting extraction...');

      // Extract tar.gz using tar
      execSync(`tar -xzf "${tempFile}" -C "${this.steamCmdFolderPath}"`);
      console.log('Successfully completed Linux SteamCMD extraction!');
    } catch (error) {
      console.error('Error during Linux SteamCMD download or extraction:', error);
      throw error;
    } finally {
      if (existsSync(tempFile)) {
        rmSync(tempFile, { force: true });
      }
    }
  }

  public async testLogin(): Promise<void> {
    const executablePath = await this.installAndGetSteamCmdExecutable();
    const platform = getPlatform();

    const config = this.loadout.configurationManager.getConfig();
    const activeAccounts = config.steam.accounts.filter(acc => !acc.disabled);
    if (activeAccounts.length === 0) {
      throw new Error('No enabled/active Steam accounts to test.');
    }

    return new Promise<void>((resolve, reject) => {
      if (platform === Platform.Windows) {
        // Construct a single command sequence for all accounts in one window
        let commandParts: string[] = [`Set-Location -Path '${this.steamCmdFolderPath}'`];
        for (const account of activeAccounts) {
          const escapedUser = account.username.replace(/'/g, "''");
          const escapedPass = account.password.replace(/'/g, "''");
          commandParts.push(`Write-Host '--------------------------------------------------'`);
          commandParts.push(`Write-Host 'Testing login for active account: ${escapedUser}...'`);
          commandParts.push(`.\\steamcmd.exe +login ${escapedUser} '${escapedPass}' +quit`);
        }
        commandParts.push(`Write-Host '--------------------------------------------------'`);
        commandParts.push(`Write-Host 'All login tests finished!'`);
        commandParts.push(`Read-Host 'Press Enter to close'`);
        commandParts.push(`exit`);

        const psCommand = commandParts.join('; ');
        const finalCommand = `start powershell.exe -NoExit -Command "& { ${psCommand} }"`;

        exec(finalCommand, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        // Resolve immediately after spawning, since start powershell runs asynchronously in Windows shell anyway
        resolve();
      } else if (platform === Platform.Linux) {
        // Multi-account bash inner command chain
        let scriptParts: string[] = [`cd "${this.steamCmdFolderPath}"`];
        for (const account of activeAccounts) {
          const escapedUser = account.username.replace(/'/g, "'\\''");
          const escapedPass = account.password.replace(/'/g, "'\\''");
          scriptParts.push(`echo "--------------------------------------------------"`);
          scriptParts.push(`echo "Testing login for active account: ${escapedUser}..."`);
          scriptParts.push(`./steamcmd.sh +login ${escapedUser} ${escapedPass} +quit`);
        }
        scriptParts.push(`echo "--------------------------------------------------"`);
        scriptParts.push(`echo "All login tests finished!"`);
        scriptParts.push(`echo "Press Enter to exit..."`);
        scriptParts.push(`read`);
        scriptParts.push(`exit`);

        const innerCommand = scriptParts.join(' && ');
        this.runVisibleTerminalLinux(executablePath, innerCommand)
          .then(() => resolve())
          .catch(reject);
        
        // Resolve immediately after spawning on Linux
        resolve();
      } else {
        reject(new Error(`Unsupported platform: ${platform}`));
      }
    });
  }

  private async runVisibleTerminalLinux(executablePath: string, innerCommand: string): Promise<void> {
    const terminalCommands = [
      { cmd: 'x-terminal-emulator', args: (cmd: string) => ['-e', `bash -c '${cmd}'`] },
      { cmd: 'gnome-terminal', args: (cmd: string) => ['--', 'bash', '-c', cmd] },
      { cmd: 'konsole', args: (cmd: string) => ['-e', 'bash', '-c', cmd] },
      { cmd: 'xfce4-terminal', args: (cmd: string) => ['-e', `bash -c "${cmd.replace(/"/g, '\\"')}"`] },
      { cmd: 'lxterminal', args: (cmd: string) => ['-e', 'bash', '-c', cmd] },
      { cmd: 'xterm', args: (cmd: string) => ['-e', 'bash', '-c', cmd] }
    ];

    for (const term of terminalCommands) {
      try {
        execSync(`which ${term.cmd}`, { stdio: 'ignore' });
        
        const formattedArgs = term.args(innerCommand).map(arg => {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }).join(' ');

        const runCmd = `${term.cmd} ${formattedArgs}`;
        console.log(`Running Unix terminal: ${runCmd}`);
        exec(runCmd);
        return;
      } catch (e) {
        // Move to next terminal
      }
    }
    throw new Error('Could not find any terminal emulator to run SteamCMD login.');
  }
}
