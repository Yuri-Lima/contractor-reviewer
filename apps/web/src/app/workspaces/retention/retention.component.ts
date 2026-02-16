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
import { RetentionConfig } from '@contractai-review/shared';

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
  templateUrl: './retention.html',
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
