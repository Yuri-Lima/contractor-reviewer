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
  template: `
    <div class="account-settings-container p-6 max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">{{ 'settings.title' | translate }}</h1>

      <p-card class="mb-6">
        <ng-template pTemplate="header">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{{ 'settings.accountInfo' | translate }}</h2>
          </div>
        </ng-template>
        <div class="p-4">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ 'settings.name' | translate }}</label>
              <p class="text-gray-800 dark:text-gray-200">{{ currentUser()?.name || ('common.notAvailable' | translate) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ 'settings.email' | translate }}</label>
              <p class="text-gray-800 dark:text-gray-200">{{ currentUser()?.email || ('common.notAvailable' | translate) }}</p>
            </div>
          </div>
        </div>
      </p-card>

      <!-- Danger Zone -->
      <p-card>
        <ng-template pTemplate="header">
          <div class="p-4 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <h2 class="text-xl font-semibold text-red-900 dark:text-red-100">{{ 'settings.dangerZone' | translate }}</h2>
          </div>
        </ng-template>
        <div class="p-4">
          <p-message
            severity="warn"
            [text]="'settings.dangerZoneDescription' | translate"
            class="mb-4"
          ></p-message>

          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <h3 class="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
              <i class="pi pi-exclamation-triangle mr-2"></i>
              {{ 'settings.deleteAccount' | translate }}
            </h3>
            <p class="text-sm text-red-800 dark:text-red-200 mb-4">
              {{ 'settings.deleteAccountDescription' | translate }}
            </p>
            <ul class="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside mb-4">
              <li>{{ 'settings.deleteAccountItems.userAccount' | translate }}</li>
              <li>{{ 'settings.deleteAccountItems.ownedWorkspaces' | translate }}</li>
              <li>{{ 'settings.deleteAccountItems.documents' | translate }}</li>
              <li>{{ 'settings.deleteAccountItems.chatHistory' | translate }}</li>
              <li>{{ 'settings.deleteAccountItems.auditLogs' | translate }}</li>
            </ul>
            <p class="text-sm font-semibold text-red-900 dark:text-red-100">
              {{ 'settings.cannotBeUndone' | translate }}
            </p>
          </div>

          <form [formGroup]="deleteForm" (ngSubmit)="confirmDeleteAccount()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'settings.confirmDelete' | translate }}
              </label>
              <input
                pInputText
                formControlName="confirmText"
                [placeholder]="'settings.confirmDeletePlaceholder' | translate"
                class="w-full"
                [class.ng-invalid]="deleteForm.get('confirmText')?.invalid && deleteForm.get('confirmText')?.touched"
              />
              <small class="p-error block mt-1" *ngIf="deleteForm.get('confirmText')?.invalid && deleteForm.get('confirmText')?.touched">
                {{ 'settings.mustTypeDelete' | translate }}
              </small>
            </div>
            <div class="flex items-center">
              <input
                type="checkbox"
                id="confirmCheckbox"
                formControlName="confirmCheckbox"
                class="mr-2"
              />
              <label for="confirmCheckbox" class="text-sm text-gray-700 dark:text-gray-300">
                {{ 'settings.understandPermanent' | translate }}
              </label>
            </div>
            <div>
              <p-button
                type="submit"
                [label]="'settings.deleteAccount' | translate"
                icon="pi pi-trash"
                severity="danger"
                [disabled]="deleteForm.invalid || deleting()"
                [loading]="deleting()"
              ></p-button>
            </div>
          </form>
        </div>
      </p-card>

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>
    </div>
  `,
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
