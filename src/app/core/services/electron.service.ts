import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Configuration } from './configuration-service';

export interface SteamGameFetchResult {
  success: boolean;
  name?: string;
  headerImage?: string;
  error?: string;
}

export interface UpdateState {
  isUpdating: boolean;
  totalGames: number;
  currentIndex: number;
  currentGame: {
    appId: number;
    name: string;
    provider: string;
  } | null;
  logs: string[];
  isCancelled: boolean;
  pendingPostUpdateAction: 'exit' | 'shutdown' | null;
  pendingPostUpdateSecondsRemaining: number;
}

interface ElectronApi {
  ping(): Promise<string>;
  selectDirectory(): Promise<string | null>;
  fetchSteamGame(appId: string | number): Promise<SteamGameFetchResult>;
  loadConfig(): Promise<Configuration | null>;
  saveConfig(config: Configuration): Promise<boolean>;
  testDiscordNotification(): Promise<unknown>;
  testSteamLogin(): Promise<{ success: boolean; error?: string }>;
  startFullUpdate(): Promise<boolean>;
  cancelUpdate(): Promise<boolean>;
  forceKillUpdate(): Promise<boolean>;
  getUpdateState(): Promise<UpdateState>;
  closeUpdateWindow(): Promise<boolean>;
  cancelPostUpdateAction(): Promise<boolean>;
  onUpdateStateChanged(callback: (state: UpdateState) => void): () => void;
}

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private get api(): ElectronApi {
    return (window as unknown as { api: ElectronApi }).api;
  }

  public ping(): Observable<string> {
    return from(this.api.ping() as Promise<string>);
  }

  public selectDirectory(): Observable<string | null> {
    return from(this.api.selectDirectory() as Promise<string | null>);
  }

  public fetchSteamGame(appId: string | number): Observable<SteamGameFetchResult> {
    return from(this.api.fetchSteamGame(appId) as Promise<SteamGameFetchResult>);
  }

  public loadConfig(): Observable<Configuration | null> {
    return from(this.api.loadConfig() as Promise<Configuration | null>);
  }

  public saveConfig(config: Configuration): Observable<boolean> {
    return from(this.api.saveConfig(config) as Promise<boolean>);
  }

  public testDiscordNotification(): Observable<unknown> {
    return from(this.api.testDiscordNotification());
  }

  public testSteamLogin(): Observable<{ success: boolean; error?: string }> {
    return from(this.api.testSteamLogin() as Promise<{ success: boolean; error?: string }>);
  }

  public startFullUpdate(): Observable<boolean> {
    return from(this.api.startFullUpdate() as Promise<boolean>);
  }

  public cancelUpdate(): Observable<boolean> {
    return from(this.api.cancelUpdate() as Promise<boolean>);
  }

  public forceKillUpdate(): Observable<boolean> {
    return from(this.api.forceKillUpdate() as Promise<boolean>);
  }

  public getUpdateState(): Observable<UpdateState> {
    return from(this.api.getUpdateState() as Promise<UpdateState>);
  }

  public closeUpdateWindow(): Observable<boolean> {
    return from(this.api.closeUpdateWindow() as Promise<boolean>);
  }

  public cancelPostUpdateAction(): Observable<boolean> {
    return from(this.api.cancelPostUpdateAction() as Promise<boolean>);
  }

  public onUpdateStateChanged(callback: (state: UpdateState) => void): () => void {
    if (this.api && this.api.onUpdateStateChanged) {
      return this.api.onUpdateStateChanged(callback);
    }
    return () => {};
  }
}
