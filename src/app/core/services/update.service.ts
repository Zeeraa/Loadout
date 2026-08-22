import { Injectable, inject, signal, OnDestroy } from "@angular/core";
import { ElectronService, UpdateState } from "./electron.service";

@Injectable({
  providedIn: 'root',
})
export class UpdateService implements OnDestroy {
  private readonly electronService = inject(ElectronService);

  public readonly updateState = signal<UpdateState>({
    isUpdating: false,
    totalGames: 0,
    currentIndex: 0,
    currentGame: null,
    logs: [],
    isCancelled: false,
    pendingPostUpdateAction: null,
    pendingPostUpdateSecondsRemaining: 0,
  });

  private removeListener: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Load initial state
    try {
      this.electronService.getUpdateState().subscribe({
        next: (state) => {
          if (state) {
            this.updateState.set(state);
          }
        },
      });
    } catch (e) {
      console.error('Failed to get initial update state:', e);
    }

    // Subscribe to changes
    this.removeListener = this.electronService.onUpdateStateChanged((state) => {
      this.updateState.set(state);
    });
  }

  public startFullUpdate(): void {
    this.electronService.startFullUpdate().subscribe();
  }

  public cancelUpdate(): void {
    this.electronService.cancelUpdate().subscribe();
  }

  public forceKillUpdate(): void {
    this.electronService.forceKillUpdate().subscribe();
  }

  public closeWindow(): void {
    this.electronService.closeUpdateWindow().subscribe();
  }

  public cancelPostUpdateAction(): void {
    this.electronService.cancelPostUpdateAction().subscribe();
  }

  ngOnDestroy(): void {
    if (this.removeListener) {
      this.removeListener();
    }
  }
}
