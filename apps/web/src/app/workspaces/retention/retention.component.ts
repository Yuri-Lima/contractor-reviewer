import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { RetentionConfig } from '../../core/models/retention.model';

@Component({
  selector: 'app-retention',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    InputNumber,
    Card,
    Message,
    Toast,
    TranslatePipe,
  ],
  providers: [MessageService],
  template: `
    <div class="retention-container p-6 max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">{{ 'retention.title' | translate }}</h1>

      <p-message
        severity="info"
        [text]="'retention.description' | translate"
        class="mb-6"
      ></p-message>

      <form [formGroup]="retentionForm" (ngSubmit)="onSave()" class="space-y-6">
        <p-card>
          <ng-template pTemplate="header">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{{ 'retention.fileRetention' | translate }}</h2>
            </div>
          </ng-template>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'retention.defaultFileRetentionDays' | translate }}
              </label>
              <p-inputNumber
                formControlName="defaultFileRetentionDays"
                [min]="1"
                [max]="365"
                [showButtons]="true"
                [suffix]="' ' + ('common.days' | translate)"
                class="w-full"
              ></p-inputNumber>
              <small class="text-gray-500 dark:text-gray-400 mt-1 block">
                {{ 'retention.fileRetentionDescription' | translate }}
              </small>
              @if (retentionForm.get('defaultFileRetentionDays')?.invalid && retentionForm.get('defaultFileRetentionDays')?.touched) {
                <small class="p-error block mt-1">
                  {{ 'retention.mustBeBetween' | translate }}
                </small>
              }
            </div>
          </div>
        </p-card>

        <p-card>
          <ng-template pTemplate="header">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{{ 'retention.textEmbeddingsRetention' | translate }}</h2>
            </div>
          </ng-template>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'retention.defaultTextEmbeddingsRetentionDays' | translate }}
              </label>
              <p-inputNumber
                formControlName="defaultTextEmbeddingsRetentionDays"
                [min]="1"
                [max]="730"
                [showButtons]="true"
                [suffix]="' ' + ('common.days' | translate)"
                class="w-full"
              ></p-inputNumber>
              <small class="text-gray-500 dark:text-gray-400 mt-1 block">
                {{ 'retention.textEmbeddingsRetentionDescription' | translate }}
              </small>
              @if (retentionForm.get('defaultTextEmbeddingsRetentionDays')?.invalid && retentionForm.get('defaultTextEmbeddingsRetentionDays')?.touched) {
                <small class="p-error block mt-1">
                  {{ 'retention.mustBeBetweenText' | translate }}
                </small>
              }
            </div>
          </div>
        </p-card>

        <p-card>
          <ng-template pTemplate="header">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{{ 'retention.fuzzyMatchSettings' | translate }}</h2>
            </div>
          </ng-template>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'retention.fuzzyMatchThreshold' | translate }}
              </label>
              <p-inputNumber
                formControlName="fuzzyMatchThreshold"
                [min]="0"
                [max]="100"
                [showButtons]="true"
                [suffix]="'%'"
                class="w-full"
              ></p-inputNumber>
              <small class="text-gray-500 dark:text-gray-400 mt-1 block">
                {{ 'retention.fuzzyMatchThresholdDescription' | translate }}
              </small>
              @if (retentionForm.get('fuzzyMatchThreshold')?.invalid && retentionForm.get('fuzzyMatchThreshold')?.touched) {
                <small class="p-error block mt-1">
                  {{ 'retention.mustBeBetween0And100' | translate }}
                </small>
              }
            </div>
          </div>
        </p-card>

        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 class="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            <i class="pi pi-exclamation-triangle mr-2"></i>
            {{ 'retention.important' | translate }}
          </h3>
          <ul class="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
            <li>{{ 'retention.importantItems.permanent' | translate }}</li>
            <li>{{ 'retention.importantItems.calculated' | translate }}</li>
            <li>{{ 'retention.importantItems.daily' | translate }}</li>
            <li>{{ 'retention.importantItems.cannotUndo' | translate }}</li>
          </ul>
        </div>

        <div class="flex gap-2 justify-end">
          <p-button
            [label]="'common.cancel' | translate"
            icon="pi pi-times"
            severity="secondary"
            [outlined]="true"
            (onClick)="loadConfig()"
            [disabled]="saving()"
          ></p-button>
          <p-button
            type="submit"
            [label]="'retention.saveSettings' | translate"
            icon="pi pi-check"
            [disabled]="retentionForm.invalid || saving()"
            [loading]="saving()"
          ></p-button>
        </div>
      </form>

      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .retention-container {
      min-height: 400px;
    }
  `],
})
export class RetentionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  workspaceId = signal('');
  saving = signal(false);
  loading = signal(false);

  retentionForm: FormGroup;

  constructor() {
    this.retentionForm = this.fb.group({
      defaultFileRetentionDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
      defaultTextEmbeddingsRetentionDays: [90, [Validators.required, Validators.min(1), Validators.max(730)]],
      fuzzyMatchThreshold: [70, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadConfig();
  }

  loadConfig(): void {
    this.loading.set(true);
    this.apiService.getRetentionConfig(this.workspaceId()).subscribe({
      next: (config) => {
        this.retentionForm.patchValue({
          defaultFileRetentionDays: config.defaultFileRetentionDays,
          defaultTextEmbeddingsRetentionDays: config.defaultTextEmbeddingsRetentionDays,
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading retention config:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('retention.loadError'),
        });
        this.loading.set(false);
      },
    });
  }

  onSave(): void {
    if (this.retentionForm.invalid) {
      return;
    }

    this.saving.set(true);
    const config: Partial<RetentionConfig> = {
      defaultFileRetentionDays: this.retentionForm.value.defaultFileRetentionDays,
      defaultTextEmbeddingsRetentionDays: this.retentionForm.value.defaultTextEmbeddingsRetentionDays,
      fuzzyMatchThreshold: this.retentionForm.value.fuzzyMatchThreshold,
    };

    this.apiService.updateRetentionConfig(this.workspaceId(), config).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('retention.saveSuccess'),
        });
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Error saving retention config:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('retention.saveError'),
        });
        this.saving.set(false);
      },
    });
  }
}
