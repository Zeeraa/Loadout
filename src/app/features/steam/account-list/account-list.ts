import { Component, TemplateRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ConfigurationService, SteamAccount } from '../../../core/services/configuration-service';
import { ToastService } from 'ngx-yet-another-toast-library';
import { ElectronService } from '../../../core/services/electron.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-account-list',
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './account-list.html',
  styleUrl: './account-list.scss',
})
export class AccountList {
  protected readonly configService = inject(ConfigurationService);
  private readonly modalService = inject(NgbModal);
  private readonly toastService = inject(ToastService);
  private readonly electronService = inject(ElectronService);

  // Signal Forms State
  protected readonly username = signal<string>('');
  protected readonly password = signal<string>('');
  protected readonly enabled = signal<boolean>(true);
  protected readonly editingAccount = signal<SteamAccount | null>(null);

  protected openAccountModal(content: TemplateRef<unknown>, account: SteamAccount | null = null): void {
    if (account) {
      this.editingAccount.set(account);
      this.username.set(account.username);
      this.password.set(account.password);
      this.enabled.set(!account.disabled);
    } else {
      this.editingAccount.set(null);
      this.username.set('');
      this.password.set('');
      this.enabled.set(true);
    }

    this.modalService.open(content, { centered: true, backdrop: 'static' });
  }

  protected async onSaveAccount(modal: NgbActiveModal): Promise<void> {
    const userVal = this.username().trim();
    const passVal = this.password().trim();

    if (!userVal || !passVal) {
      this.toastService.warning('Username and Password are required!', 'Form Validation');
      return;
    }

    const current = this.configService.configuration();
    const editing = this.editingAccount();

    if (editing) {
      // Modify
      current.steam.accounts = current.steam.accounts.map(acc => {
        if (acc.uuid === editing.uuid) {
          return {
            ...acc,
            username: userVal,
            password: passVal,
            disabled: !this.enabled(),
          };
        }
        return acc;
      });
      this.toastService.success(`Account details for ${userVal} updated successfully.`, 'Account Updated');
    } else {
      // Add
      const newAcc: SteamAccount = {
        uuid: crypto.randomUUID(),
        username: userVal,
        password: passVal,
        disabled: !this.enabled(),
      };
      current.steam.accounts = [...current.steam.accounts, newAcc];
      this.toastService.success(`Account ${userVal} added successfully.`, 'Account Added');
    }

    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();

    modal.close();
  }

  protected async onDeleteAccount(account: SteamAccount): Promise<void> {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    modalRef.componentInstance.title.set('Remove Account');
    modalRef.componentInstance.message.set(`Are you sure you want to remove the Steam account "${account.username}"?`);
    modalRef.componentInstance.confirmText.set('Remove');
    modalRef.componentInstance.confirmStyle.set('btn-danger');

    const confirmed = await modalRef.result;
    if (confirmed) {
      const current = this.configService.configuration();
      current.steam.accounts = current.steam.accounts.filter(acc => acc.uuid !== account.uuid);
      this.configService.configuration.set({ ...current });
      await this.configService.saveConfiguration();
      this.toastService.success(`Account ${account.username} removed successfully.`, 'Account Deleted');
    }
  }

  protected async toggleAccountStatus(account: SteamAccount): Promise<void> {
    const current = this.configService.configuration();
    current.steam.accounts = current.steam.accounts.map(acc => {
      if (acc.uuid === account.uuid) {
        return { ...acc, disabled: !acc.disabled };
      }
      return acc;
    });
    this.configService.configuration.set({ ...current });
    await this.configService.saveConfiguration();
    const action = !account.disabled ? 'disabled' : 'enabled';
    this.toastService.success(`Account ${account.username} was ${action}.`, 'Status Updated');
  }

  protected async onTestAllLogins(): Promise<void> {
    const activeRaw = this.configService.configuration().steam.accounts.filter(a => !a.disabled);
    if (activeRaw.length === 0) {
      this.toastService.warning('No active/enabled Steam accounts to test!', 'Login Test');
      return;
    }

    this.toastService.info('Launching login tests for all active accounts in a single terminal...', 'Testing Logins');
    try {
      const res = await this.electronService.testSteamLogin().toPromise();
      if (res && res.success) {
        this.toastService.success('Testing terminal spawned. Check the opened window to complete authentication!', 'Testing Started');
      } else {
        this.toastService.error(`Failed to launch test: ${res?.error || 'Unknown error'}`, 'Testing Failed');
      }
    } catch (e) {
      console.error(e);
      this.toastService.error(`Failed to execute test sequence: ${e}`, 'Testing Error');
    }
  }
}
