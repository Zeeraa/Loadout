import { Component, HostBinding, inject, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialogComponent {
  public readonly activeModal = inject(NgbActiveModal, { optional: true });

  public readonly title = model.required<string>();
  public readonly message = model.required<string>();
  public readonly confirmStyle = model<string>('btn-danger');
  public readonly cancelStyle = model<string>('btn-outline-secondary');
  public readonly confirmText = model<string>('Confirm');
  public readonly cancelText = model<string>('Cancel');

  public readonly confirmed = output<void>();
  public readonly canceled = output<void>();

  // Prevent HTML's native tooltip on host element when [title] is passed
  @HostBinding('attr.title') get hostTitle() {
    return null;
  }

  protected onConfirm(): void {
    this.confirmed.emit();
    if (this.activeModal) {
      this.activeModal.close(true);
    }
  }

  protected onCancel(): void {
    this.canceled.emit();
    if (this.activeModal) {
      this.activeModal.close(false);
    }
  }
}
