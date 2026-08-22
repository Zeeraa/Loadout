import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-auto-update-countdown',
  standalone: true,
  imports: [],
  templateUrl: './auto-update-countdown.html',
  styleUrl: './auto-update-countdown.scss',
})
export class AutoUpdateCountdown implements OnInit, OnDestroy {
  public readonly activeModal = inject(NgbActiveModal, { optional: true });

  protected readonly secondsRemaining = signal(10);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.timer = setInterval(() => {
      const remaining = this.secondsRemaining() - 1;
      if (remaining <= 0) {
        this.stopTimer();
        this.activeModal?.close(true);
      } else {
        this.secondsRemaining.set(remaining);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  protected onCancel(): void {
    this.activeModal?.close(false);
  }
}
