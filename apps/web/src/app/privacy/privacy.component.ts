import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputNumber } from 'primeng/inputnumber';
import { Toast } from 'primeng/toast';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ApiService } from '../core/services/api.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslatePipe } from '@ngx-translate/core';

interface NoLogsConfig {
  skipDocumentContent?: boolean;
  skipChatMessages?: boolean;
  skipVersions?: boolean;
  acceleratedPurgeDays?: number;
}

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    Card,
    ToggleSwitchModule,
    InputNumber,
    Toast,
    Message,
    TranslatePipe,
  ],
  providers: [MessageService],
  template: `
    <div class="privacy-container p-6 max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">{{ 'privacy.title' | translate }}</h1>

      <p-message
        severity="info"
        [text]="'privacy.description' | translate"
        class="mb-6"
      ></p-message>

      <!-- No-Logs Mode -->
      <p-card class="mb-6">
        <ng-template pTemplate="header">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{{ 'privacy.noLogsMode' | translate }}</h2>
          </div>
        </ng-template>
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ 'privacy.enableNoLogs' | translate }}
              </label>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ 'privacy.noLogsDescription' | translate }}
              </p>
            </div>
            <p-toggleswitch
              formControlName="noLogsEnabled"
              (onChange)="onNoLogsToggle()"
            ></p-toggleswitch>
          </div>

          <div *ngIf="noLogsForm.value.noLogsEnabled" class="mt-6 space-y-4 pl-4 border-l-4 border-blue-500 dark:border-blue-400">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'privacy.skipDocumentContent' | translate }}
                </label>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ 'privacy.skipDocumentContentDesc' | translate }}
                </p>
              </div>
              <p-toggleswitch formControlName="skipDocumentContent"></p-toggleswitch>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'privacy.skipChatMessages' | translate }}
                </label>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ 'privacy.skipChatMessagesDesc' | translate }}
                </p>
              </div>
              <p-toggleswitch formControlName="skipChatMessages"></p-toggleswitch>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ 'privacy.skipVersions' | translate }}
                </label>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ 'privacy.skipVersionsDesc' | translate }}
                </p>
              </div>
              <p-toggleswitch formControlName="skipVersions"></p-toggleswitch>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'privacy.acceleratedPurge' | translate }}
              </label>
              <p-inputNumber
                formControlName="acceleratedPurgeDays"
                [min]="1"
                [max]="30"
                [showButtons]="true"
                [suffix]="daysSuffix()"
                class="w-full"
              ></p-inputNumber>
              <small class="text-gray-500 dark:text-gray-400 mt-1 block">
                {{ 'privacy.acceleratedPurgeDesc' | translate }}
              </small>
            </div>
          </div>

          <div class="mt-4 flex justify-end">
            <p-button
              [label]="'privacy.saveSettings' | translate"
              icon="pi pi-check"
              (onClick)="saveNoLogsConfig()"
              [loading]="saving()"
              [disabled]="!noLogsForm.value.noLogsEnabled"
            ></p-button>
          </div>
        </div>
      </p-card>

      <!-- Export Data -->
      <p-card>
        <ng-template pTemplate="header">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{{ 'privacy.exportData' | translate }}</h2>
          </div>
        </ng-template>
        <div class="p-4">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {{ 'privacy.exportDescription' | translate }}
          </p>
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {{ 'privacy.whatWillBeExported' | translate }}
            </h3>
            <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>{{ 'privacy.exportItems.chatMessages' | translate }}</li>
              <li>{{ 'privacy.exportItems.versionMetadata' | translate }}</li>
              <li>{{ 'privacy.exportItems.auditLogs' | translate }}</li>
              <li>{{ 'privacy.exportItems.privacySettings' | translate }}</li>
            </ul>
          </div>
          <p-button
            [label]="'privacy.export' | translate"
            icon="pi pi-download"
            (onClick)="exportData()"
            [loading]="exporting()"
          ></p-button>
        </div>
      </p-card>

      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .privacy-container {
      min-height: 400px;
    }
  `],
})
export class PrivacyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  workspaceId = signal('');
  saving = signal(false);
  exporting = signal(false);

  // Computed property for days suffix
  daysSuffix = computed(() => ` ${this.translateService.instant('common.days')}`);

  noLogsForm: FormGroup;

  constructor() {
    this.noLogsForm = this.fb.group({
      noLogsEnabled: [false],
      skipDocumentContent: [false],
      skipChatMessages: [false],
      skipVersions: [false],
      acceleratedPurgeDays: [7],
    });
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadNoLogsConfig();
  }

  loadNoLogsConfig(): void {
    // TODO: Load current no-logs config from API
    // For now, we'll assume it's disabled by default
    // The backend should provide an endpoint to get current config
  }

  onNoLogsToggle(): void {
    // Auto-save when toggling main switch
    if (!this.noLogsForm.value.noLogsEnabled) {
      this.saveNoLogsConfig();
    }
  }

  saveNoLogsConfig(): void {
    if (!this.noLogsForm.value.noLogsEnabled) {
      // If disabled, save with all options off
      this.apiService.toggleNoLogs(this.workspaceId(), false).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('privacy.saveSuccess'),
          });
        },
        error: (err) => {
          console.error('Error saving no-logs config:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: this.translateService.instant('privacy.saveError'),
          });
        },
      });
      return;
    }

    this.saving.set(true);
    const config: NoLogsConfig = {
      skipDocumentContent: this.noLogsForm.value.skipDocumentContent,
      skipChatMessages: this.noLogsForm.value.skipChatMessages,
      skipVersions: this.noLogsForm.value.skipVersions,
      acceleratedPurgeDays: this.noLogsForm.value.acceleratedPurgeDays,
    };

    this.apiService.toggleNoLogs(this.workspaceId(), true, config).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('privacy.saveSuccess'),
        });
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Error saving no-logs config:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('privacy.saveError'),
        });
        this.saving.set(false);
      },
    });
  }

  exportData(): void {
    this.exporting.set(true);
    this.apiService.exportPrivacyData(this.workspaceId()).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `privacy-export-${this.workspaceId()}-${Date.now()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('privacy.exportSuccess'),
        });
        this.exporting.set(false);
      },
      error: (err) => {
        console.error('Error exporting data:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('privacy.exportError'),
        });
        this.exporting.set(false);
      },
    });
  }
}
