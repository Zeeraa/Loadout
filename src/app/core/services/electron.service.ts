import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Configuration } from './configuration-service';

export interface SteamGameFetchResult {
  success: boolean;
  name?: string;
  headerImage?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  private get api() {
    return (window as any).api;
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

  public testDiscordNotification(): Observable<any> {
    return from(this.api.testDiscordNotification() as Promise<any>);
  }

  public testSteamLogin(): Observable<{ success: boolean; error?: string }> {
    return from(this.api.testSteamLogin() as Promise<{ success: boolean; error?: string }>);
  }
}
