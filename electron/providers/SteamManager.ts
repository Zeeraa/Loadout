import { ipcMain } from 'electron';
import axios from 'axios';
import { Loadout } from '../Loadout';
import { SteamGame } from '../config/ConfigurationManager';
import { getExecutableDirectory, getPlatform, Platform, SteamCMDDownloads } from '../Utils';
import path from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync, symlinkSync, unlinkSync, rmdirSync, lstatSync } from 'node:fs';
import { exec, execSync, spawn } from 'node:child_process';

export class SteamManager {
  protected readonly loadout: Loadout;
  public readonly steamCmdFolderPath: string;
  private activeProcess: import('node:child_process').ChildProcess | null = null;

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

  public async updateGame(game: SteamGame): Promise<boolean> {
    const executablePath = await this.installAndGetSteamCmdExecutable();
    const config = this.loadout.configurationManager.getConfig();

    const steamappsPath = path.join(this.steamCmdFolderPath, 'steamapps');

    // 1. delete the steamapps folder for the steamcmd install if it exists.
    if (existsSync(steamappsPath) || (() => { try { lstatSync(steamappsPath); return true; } catch { return false; } })()) {
      try {
        const stats = lstatSync(steamappsPath);
        if (stats.isSymbolicLink()) {
          unlinkSync(steamappsPath);
        } else {
          try {
            unlinkSync(steamappsPath);
          } catch {
            try {
              rmdirSync(steamappsPath);
            } catch {
              rmSync(steamappsPath, { recursive: true, force: true });
            }
          }
        }
      } catch (err) {
        console.error('Failed to clean up existing steamapps path:', err);
      }
    }

    // 2. symlink the games steamapp folder if defined or else use the global default. if none of these are available cancel the update.
    let targetDir: string | null = null;
    if (game.overrideInstallDir && game.overrideInstallDir.trim() !== '') {
      targetDir = game.overrideInstallDir.trim();
    } else if (config.steam.defaultSteamAppsDir && config.steam.defaultSteamAppsDir.trim() !== '') {
      targetDir = config.steam.defaultSteamAppsDir.trim();
    }

    if (!targetDir) {
      const errorMsg = 'No install directory or global default steamapps directory is defined.';
      console.error(`Cannot update game ${game.name}: ${errorMsg}`);
      await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(game.appId, game.name, errorMsg);
      return false;
    }

    // Ensure the target directory exists
    if (!existsSync(targetDir)) {
      try {
        mkdirSync(targetDir, { recursive: true });
      } catch (err) {
        const errorMsg = `Failed to create target directory: ${targetDir}`;
        console.error(errorMsg, err);
        await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(game.appId, game.name, `${errorMsg} (${String(err)})`);
        return false;
      }
    }

    // Create symbolic link (folder junction on Windows, symlink on Linux)
    const platform = getPlatform();
    try {
      if (platform === Platform.Windows) {
        symlinkSync(targetDir, steamappsPath, 'junction');
      } else if (platform === Platform.Linux) {
        symlinkSync(targetDir, steamappsPath);
      } else {
        const errorMsg = `Unsupported platform for symlinking: ${platform}`;
        console.error(errorMsg);
        await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(game.appId, game.name, errorMsg);
        return false;
      }
    } catch (err) {
      const errorMsg = `Failed to create symlink from ${targetDir} to ${steamappsPath}`;
      console.error(errorMsg, err);
      await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(game.appId, game.name, `${errorMsg} (${String(err)})`);
      return false;
    }

    // 3. start steamcmd, log in with the provided account, install and if configured verify the integrity.
    const account = config.steam.accounts.find(acc => acc.uuid === game.accountId);
    const args: string[] = [];

    if (account) {
      if (account.disabled) {
        const errorMsg = `The account with username ${account.username} is disabled.`;
        console.error(`Cannot update game: ${errorMsg}`);
        await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(game.appId, game.name, errorMsg);
        return false;
      }
      args.push('+login', account.username, account.password);
    } else {
      args.push('+login', 'anonymous');
    }

    const cleanupLink = () => {
      if (existsSync(steamappsPath) || (() => { try { lstatSync(steamappsPath); return true; } catch { return false; } })()) {
        try {
          const stats = lstatSync(steamappsPath);
          if (stats.isSymbolicLink()) {
            unlinkSync(steamappsPath);
          } else {
            try {
              unlinkSync(steamappsPath);
            } catch {
              try {
                rmdirSync(steamappsPath);
              } catch {
                rmSync(steamappsPath, { recursive: true, force: true });
              }
            }
          }
          console.log('Successfully cleaned up SteamCMD steamapps link.');
        } catch (err) {
          console.error('Failed to clean up steamapps link in finally/completion block:', err);
        }
      }
    };

    // Preliminary login test (Precheck) - prevents long hangs on SteamGuard or bad credentials
    const testArgs: string[] = [];
    if (account) {
      testArgs.push('+login', account.username, account.password);
    } else {
      testArgs.push('+login', 'anonymous');
    }
    testArgs.push('+logout', '+quit');

    this.loadout.updateManager.addLog(`[SteamCMD Precheck] Running preliminary login check for account...`);
    console.log(`[SteamCMD Precheck] Starting check with arguments...`);

    const loginSuccess = await new Promise<boolean>((resolve) => {
      let isSettled = false;
      const testChild = spawn(executablePath, testArgs, { cwd: this.steamCmdFolderPath });
      this.activeProcess = testChild;

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.loadout.updateManager.addLog(`[SteamCMD Precheck Error] Preliminary login test timed out after 60 seconds! The account may have Steam Guard enabled, or needs fresh 2FA authorizing. Failing update.`);
          console.error(`[SteamCMD Precheck Error] Login test timed out.`);
          try {
            testChild.kill('SIGKILL');
          } catch (e) {}
          this.activeProcess = null;
          resolve(false);
        }
      }, 60000); // 1 minute hard limit for login pre-verification

      testChild.stdout.on('data', (data) => {
        const text = data.toString().trim();
        console.log(`[SteamCMD Precheck] ${text}`);
        this.loadout.updateManager.addLog(`[SteamCMD Precheck] ${text}`);

        // Fail fast if Steam Guard / 2FA prompt is visible in logs
        if (
          text.includes('Steam Guard') ||
          text.includes('Enter your Steam Guard') ||
          text.includes('two-factor') ||
          text.includes('2FA code') ||
          text.includes('SteamGuard')
        ) {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            this.loadout.updateManager.addLog(`[SteamCMD Precheck Error] Steam Guard prompt detected! Interactive 2FA input is not supported in automated updater loops. Please login manually first in a standard terminal window.`);
            try {
              testChild.kill('SIGKILL');
            } catch (e) {}
            this.activeProcess = null;
            resolve(false);
          }
        }
      });

      testChild.stderr.on('data', (data) => {
        const text = data.toString().trim();
        console.error(`[SteamCMD Precheck Error] ${text}`);
        this.loadout.updateManager.addLog(`[SteamCMD Precheck Error] ${text}`);
      });

      testChild.on('close', (code) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          this.activeProcess = null;
          if (code === 0) {
            this.loadout.updateManager.addLog(`[SteamCMD Precheck] Preliminary login test succeeded.`);
            resolve(true);
          } else {
            this.loadout.updateManager.addLog(`[SteamCMD Precheck Error] Preliminary login test exited with non-zero code: ${code}`);
            resolve(false);
          }
        }
      });

      testChild.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          this.activeProcess = null;
          this.loadout.updateManager.addLog(`[SteamCMD Precheck Error] Preliminary login test failed to spawn: ${String(err)}`);
          resolve(false);
        }
      });
    });

    if (!loginSuccess) {
      cleanupLink();
      const loginErrorMsg = `Steam credentials check failed (timed out, wrong credentials, or requires Steam Guard).`;
      await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(game.appId, game.name, loginErrorMsg);
      return false;
    }

    // Login test succeeded, we can proceed with actual game app_update command
    if (game.validate) {
      args.push('+app_update', String(game.appId), 'validate');
    } else {
      args.push('+app_update', String(game.appId));
    }

    // 4. log out.
    args.push('+logout', '+quit');

    console.log(`Starting SteamCMD with arguments: ${args.map((a, i) => i === 2 && account ? '********' : a).join(' ')}`);

    // Notify Discord that the update has started
    await this.loadout.discordManager.sendSteamGameUpdateBeginNotification(game.appId, game.name);

    return new Promise<boolean>((resolve) => {
      const child = spawn(executablePath, args, { cwd: this.steamCmdFolderPath });
      this.activeProcess = child;

      child.stdout.on('data', (data) => {
        const text = data.toString().trim();
        console.log(`[SteamCMD] ${text}`);
        this.loadout.updateManager.addLog(`[SteamCMD] ${text}`);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString().trim();
        console.error(`[SteamCMD Error] ${text}`);
        this.loadout.updateManager.addLog(`[SteamCMD Error] ${text}`);
      });

      child.on('close', async (code) => {
        console.log(`SteamCMD exited with code ${code}`);
        this.activeProcess = null;
        cleanupLink();
        if (code === 0) {
          await this.loadout.discordManager.sendSteamGameUpdateConpletedNotification(game.appId, game.name);
          resolve(true);
        } else {
          await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(
            game.appId,
            game.name,
            `SteamCMD exited with non-zero status code: ${code}`
          );
          resolve(false);
        }
      });

      child.on('error', async (err) => {
        console.error('Failed to spawn SteamCMD:', err);
        this.activeProcess = null;
        cleanupLink();
        await this.loadout.discordManager.sendSteamGameUpdateFailedNotification(
          game.appId,
          game.name,
          `Failed to spawn SteamCMD executable: ${String(err)}`
        );
        resolve(false);
      });
    });
  }

  public killActiveProcess(): boolean {
    if (this.activeProcess) {
      try {
        console.log('[SteamCMD] Killing running instance...');
        this.activeProcess.kill('SIGKILL');
        this.activeProcess = null;
        return true;
      } catch (err) {
        console.error('Failed to kill active SteamCMD process:', err);
      }
    }
    return false;
  }
}
