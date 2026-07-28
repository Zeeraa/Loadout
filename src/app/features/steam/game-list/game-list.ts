import { Component, TemplateRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ConfigurationService, SteamGame } from '../../../core/services/configuration-service';
import { ElectronService } from '../../../core/services/electron.service';
import { ToastService } from 'ngx-yet-another-toast-library';

@Component({
  selector: 'app-game-list',
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './game-list.html',
  styleUrl: './game-list.scss',
})
export class GameList {
  protected readonly configService = inject(ConfigurationService);
  private readonly electronService = inject(ElectronService);
  private readonly modalService = inject(NgbModal);
  private readonly toastService = inject(ToastService);

  // Signal Forms State
  protected readonly appIdSignal = signal<string>('');
  protected readonly nameSignal = signal<string>('');
  protected readonly accountIdSignal = signal<string>('');
  protected readonly enabledSignal = signal<boolean>(true);
  protected readonly validateSignal = signal<boolean>(false);
  protected readonly overrideDirSignal = signal<string>('');
  protected readonly headerImageSignal = signal<string>('');
  protected readonly isLoadingDetails = signal<boolean>(false);
  protected readonly editingGame = signal<SteamGame | null>(null);

  protected openGameModal(content: TemplateRef<any>, game: SteamGame | null = null): void {
    this.isLoadingDetails.set(false);

    if (game) {
      this.editingGame.set(game);
      this.appIdSignal.set(String(game.appId));
      this.nameSignal.set(game.name);
      this.accountIdSignal.set(game.accountId || '');
      this.enabledSignal.set(!game.disabled);
      this.validateSignal.set(game.validate);
      this.overrideDirSignal.set(game.overrideInstallDir || '');
      this.headerImageSignal.set(''); // Clear until search is triggered, or we fetch it

      // Auto trigger search to fetch banner if we edit
      this.searchGameDetails(false);
    } else {
      this.editingGame.set(null);
      this.appIdSignal.set('');
      this.nameSignal.set('');
      this.accountIdSignal.set('');
      this.enabledSignal.set(true);
      this.validateSignal.set(false);
      this.overrideDirSignal.set('');
      this.headerImageSignal.set('');
    }

    this.modalService.open(content, { centered: true, size: 'md', backdrop: 'static' });
  }

  protected async searchGameDetails(showToasts = true): Promise<void> {
    const idVal = this.appIdSignal().trim();
    if (!idVal) {
      if (showToasts) {
        this.toastService.warning('Please enter a Steam App ID before searching!', 'Search Validator');
      }
      return;
    }

    const appId = parseInt(idVal, 10);
    if (isNaN(appId)) {
      if (showToasts) {
        this.toastService.error('The App ID must be a numeric value.', 'Invalid ID');
      }
      return;
    }

    this.isLoadingDetails.set(true);
    try {
      const res = await this.electronService.fetchSteamGame(appId).toPromise();
      if (res && res.success) {
        this.nameSignal.set(res.name || '');
        this.headerImageSignal.set(res.headerImage || '');
        if (showToasts) {
          this.toastService.success(`Found game details: ${res.name}`, 'Game Found');
        }
      } else {
        if (showToasts) {
          this.toastService.error(`Could not locate Steam details for App ID: ${appId}`, 'Game Not Found');
        }
      }
    } catch (e) {
      console.error(e);
      if (showToasts) {
        this.toastService.error('Error fetching data from Steam Web API.', 'Query Failed');
      }
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  protected async pickOverrideDir(): Promise<void> {
    try {
      const path = await this.electronService.selectDirectory().toPromise();
      if (path !== null && path !== undefined) {
        this.overrideDirSignal.set(path);
      }
    } catch (e) {
      console.error(e);
      this.toastService.error('Failed to choose directory', 'Error');
    }
  }

  protected async onSaveGame(modal: any): Promise<void> {
    const idVal = this.appIdSignal().trim();
    const nameVal = this.nameSignal().trim();

    if (!idVal || !nameVal) {
      this.toastService.warning('Both App ID and Game Name are required fields!', 'Validation');
      return;
    }

    const appIdNum = parseInt(idVal, 10);
    if (isNaN(appIdNum)) {
      this.toastService.error('App ID must be a valid integer!', 'Validation');
      return;
    }

    const current = this.configService.configuration();
    const editing = this.editingGame();

    const saveObj: SteamGame = {
      accountId: this.accountIdSignal() || null,
      appId: appIdNum,
      name: nameVal,
      disabled: !this.enabledSignal(),
      validate: this.validateSignal(),
      overrideInstallDir: this.overrideDirSignal().trim() || null,
    };

    if (editing) {
      // Modify existing
      // If the app identifier matches, or find via previous appId context
      current.steam.games = current.steam.games.map(g => {
        if (g.appId === editing.appId) {
          return saveObj;
        }
        return g;
      });
      this.toastService.success(`Game "${nameVal}" has been updated.`, 'Game Saved');
    } else {
      // Prevent duplicates
      if (current.steam.games.some(g => g.appId === appIdNum)) {
        this.toastService.warning(`Game with App ID ${appIdNum} alreadyexists inside your list!`, 'Duplicate Found');
        return;
      }
      current.steam.games = [...current.steam.games, saveObj];
      this.toastService.success(`Game "${nameVal}" successfully added to registry!`, 'Game Added');
    }

    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();

    modal.close();
  }

  protected async onDeleteGame(game: SteamGame): Promise<void> {
    if (confirm(`Are you sure you want to remove the game "${game.name}" (ID ${game.appId})?`)) {
      const current = this.configService.configuration();
      current.steam.games = current.steam.games.filter(g => g.appId !== game.appId);
      this.configService.configuration.set({ ...current });
      await this.configService.saveConfiguration();
      this.toastService.success(`Game ${game.name} removed successfully from registry.`, 'Game Deleted');
    }
  }

  protected async toggleGameEnabled(game: SteamGame): Promise<void> {
    const current = this.configService.configuration();
    current.steam.games = current.steam.games.map(g => {
      if (g.appId === game.appId) {
        return { ...g, disabled: !g.disabled };
      }
      return g;
    });
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    const verb = !game.disabled ? 'disabled' : 'enabled';
    this.toastService.success(`Game "${game.name}" was ${verb}.`, 'Status Updated');
  }

  protected async toggleGameVerify(game: SteamGame): Promise<void> {
    const current = this.configService.configuration();
    current.steam.games = current.steam.games.map(g => {
      if (g.appId === game.appId) {
        return { ...g, validate: !g.validate };
      }
      return g;
    });
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    this.toastService.success(`Verification state for "${game.name}" toggled.`, 'Status Updated');
  }

  protected getAccountName(uuid: string | null): string {
    if (!uuid) return 'None';
    const accs = this.configService.configuration().steam.accounts;
    const found = accs.find(a => accs && a.uuid === uuid);
    return found ? found.username : 'Unknown Account';
  }
}
