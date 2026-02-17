import { Component, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Toast } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  WorkspaceSettingsConfig,
  ChunkingStrategy,
} from '@contractai-review/shared';
import { PromptsEditorComponent } from './prompts-editor/prompts-editor.component';
import { ParserSettingsComponent } from './parser-settings/parser-settings.component';
import { WorkspaceSettingsTabService } from '../../onboarding/tour/workspace-settings-tab.service';

interface ChunkingOption {
  value: string;
  label: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    Button,
    InputNumber,
    TooltipModule,
    Card,
    Message,
    Toast,
    TabsModule,
    SelectModule,
    TranslatePipe,
    PromptsEditorComponent,
    ParserSettingsComponent,
  ],
  providers: [MessageService],
  templateUrl: './workspace-settings.html',
})
export class WorkspaceSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private wsTabService = inject(WorkspaceSettingsTabService);

  workspaceId = signal('');
  saving = signal(false);
  savingChunking = signal(false);
  loading = signal(false);
  activeTab = signal<string>('general');

  retentionForm: FormGroup;
  chunkingStrategy = signal<string>(ChunkingStrategy.PARAGRAPH);

  chunkingOptions: ChunkingOption[] = [
    { value: ChunkingStrategy.PARAGRAPH, label: 'chunking.paragraph' },
    { value: ChunkingStrategy.SENTENCE, label: 'chunking.sentence' },
    { value: ChunkingStrategy.FIXED_SIZE, label: 'chunking.fixedSize' },
    {
      value: ChunkingStrategy.SEMANTIC,
      label: 'chunking.semantic',
      disabled: true,
      comingSoon: true,
    },
    {
      value: ChunkingStrategy.AGENTIC,
      label: 'chunking.agentic',
      disabled: true,
      comingSoon: true,
    },
  ];

  enabledChunkingOptions = this.chunkingOptions.filter(
    (o) => !o.disabled,
  );

  constructor() {
    effect(() => {
      const tab = this.wsTabService.requestedTab();
      if (tab != null && this.workspaceId()) {
        this.activeTab.set(tab);
        this.wsTabService.clearRequest();
      }
    });
    this.retentionForm = this.fb.group({
      defaultFileRetentionDays: [
        30,
        [Validators.required, Validators.min(1), Validators.max(365)],
      ],
      defaultTextEmbeddingsRetentionDays: [
        90,
        [Validators.required, Validators.min(1), Validators.max(730)],
      ],
      fuzzyMatchThreshold: [
        70,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
    });
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.apiService.getWorkspaceSettings(this.workspaceId()).subscribe({
      next: (config) => {
        this.retentionForm.patchValue({
          defaultFileRetentionDays: config.retention.defaultFileRetentionDays,
          defaultTextEmbeddingsRetentionDays:
            config.retention.defaultTextEmbeddingsRetentionDays,
          fuzzyMatchThreshold: config.retention.fuzzyMatchThreshold ?? 70,
        });
        this.chunkingStrategy.set(
          config.documentProcessing.chunkingStrategy || ChunkingStrategy.PARAGRAPH,
        );
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading workspace settings:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('workspaceSettings.loadError'),
        });
        this.loading.set(false);
      },
    });
  }

  onSaveRetention(): void {
    if (this.retentionForm.invalid) return;
    this.saving.set(true);
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        retention: {
          defaultFileRetentionDays: this.retentionForm.value
            .defaultFileRetentionDays,
          defaultTextEmbeddingsRetentionDays: this.retentionForm.value
            .defaultTextEmbeddingsRetentionDays,
          fuzzyMatchThreshold: this.retentionForm.value.fuzzyMatchThreshold,
        },
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('retention.saveSuccess'),
          });
          this.saving.set(false);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail:
              err.error?.message ||
              this.translateService.instant('retention.saveError'),
          });
          this.saving.set(false);
        },
      });
  }

  onSaveChunking(): void {
    this.savingChunking.set(true);
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        documentProcessing: {
          chunkingStrategy: this.chunkingStrategy(),
        },
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('chunking.saveSuccess'),
          });
          this.savingChunking.set(false);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail:
              err.error?.message ||
              this.translateService.instant('chunking.saveError'),
          });
          this.savingChunking.set(false);
        },
      });
  }

  onChunkingStrategyChange(value: string): void {
    const option = this.chunkingOptions.find((o) => o.value === value);
    if (option?.disabled) return;
    this.chunkingStrategy.set(value);
  }

  setActiveTab(tab: string | number | undefined): void {
    if (tab != null) this.activeTab.set(String(tab));
  }
}
