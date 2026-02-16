import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { Message } from 'primeng/message';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    InputText,
    Card,
    ConfirmDialog,
    Toast,
    Message,
    TranslatePipe,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './account-settings.html',
  styles: [`
    .account-settings-container {
      min-height: 400px;
    }
  `],
})
export class AccountSettingsComponent implements OnInit {
  private router = inject(Router);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  currentUser = signal(this.authService.currentUser());
  deleting = signal(false);

  deleteForm: FormGroup;

  constructor() {
    this.deleteForm = this.fb.group({
      confirmText: ['', [Validators.required, this.validateDeleteText]],
      confirmCheckbox: [false, [Validators.requiredTrue]],
    });
  }

  ngOnInit(): void {
    // Component initialized
  }

  validateDeleteText(control: any) {
    if (control.value !== 'DELETE') {
      return { invalidDeleteText: true };
    }
    return null;
  }

  confirmDeleteAccount(): void {
    if (this.deleteForm.invalid) {
      return;
    }

    this.confirmationService.confirm({
      message: this.translateService.instant('settings.finalConfirmDelete'),
      header: this.translateService.instant('settings.finalConfirmDeleteHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant('settings.yesDeleteAccount'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => {
        this.deleteAccount();
      },
    });
  }

  deleteAccount(): void {
    this.deleting.set(true);
    this.apiService.deleteAccount().subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('settings.accountDeleted'),
          detail: this.translateService.instant('settings.accountDeletedSuccess'),
        });
        // Logout and redirect to login
        this.authService.logout();
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        console.error('Error deleting account:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('settings.deleteAccountError'),
        });
        this.deleting.set(false);
      },
    });
  }
}
