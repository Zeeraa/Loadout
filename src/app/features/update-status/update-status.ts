import { Component, inject, signal, effect, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdateService } from '../../core/services/update.service';

@Component({
  selector: 'app-update-status',
  imports: [CommonModule],
  templateUrl: './update-status.html',
  styleUrl: './update-status.scss',
})
export class UpdateStatus implements AfterViewChecked {
  protected readonly updateService = inject(UpdateService);
  private lastLogCount = 0;

  @ViewChild('logWindow') private logWindow!: ElementRef<HTMLDivElement>;

  constructor() {
    // Auto scroll when logs change
    effect(() => {
      const logs = this.updateService.updateState().logs;
      if (logs.length !== this.lastLogCount) {
        this.lastLogCount = logs.length;
        this.scrollToBottom();
      }
    });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  protected getProgressPercent(): number {
    const state = this.updateService.updateState();
    if (state.totalGames === 0) return 0;
    if (!state.isUpdating) return 100;
    // For progress bar: represent progress as completed games.
    // While game N is actively updating, we have fully completed N-1 games.
    return Math.round(((state.currentIndex - 1) / state.totalGames) * 100);
  }

  protected getHeaderUrl(): string | null {
    const state = this.updateService.updateState();
    if (state.currentGame && state.currentGame.provider === 'Steam') {
      return `https://cdn.akamai.steamstatic.com/steam/apps/${state.currentGame.appId}/header.jpg`;
    }
    return null;
  }

  protected getLogClass(log: string): string {
    const text = log.toLowerCase();
    if (
      text.includes('error') ||
      text.includes('fail') ||
      text.includes('exception') ||
      text.includes('prevented close')
    ) {
      return 'log-error';
    }
    if (
      text.includes('successfully') ||
      text.includes('succeeded') ||
      text.includes('completed') ||
      text.includes('finalized')
    ) {
      return 'log-success';
    }
    if (
      log.startsWith('[SteamCMD]') ||
      log.startsWith('[SteamCMD Precheck]') ||
      text.includes('steamcmd')
    ) {
      return 'log-steam';
    }
    return 'log-info';
  }

  protected onCancel(): void {
    this.updateService.cancelUpdate();
  }

  protected onForceKill(): void {
    this.updateService.forceKillUpdate();
  }

  protected onClose(): void {
    this.updateService.closeWindow();
  }

  private scrollToBottom(): void {
    try {
      if (this.logWindow) {
        this.logWindow.nativeElement.scrollTop = this.logWindow.nativeElement.scrollHeight;
      }
    } catch (err) {
      // Ignore
    }
  }
}
