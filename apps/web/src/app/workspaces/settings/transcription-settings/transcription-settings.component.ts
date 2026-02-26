import { Component, input, effect, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  isTranscriptionProviderId,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  type TranscriptionProviderId,
} from '@contractai-review/shared';

@Component({
  selector: 'app-transcription-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Card,
    TooltipModule,
    Message,
    Password,
    SelectModule,
    TranslatePipe,
  ],
  templateUrl: './transcription-settings.html',
})
export class TranscriptionSettingsComponent {
  workspaceId = input.required<string>();
  /** When false, API key inputs are disabled (only OWNER/ADMIN can edit). */
  canEditApiKeys = input<boolean>(true);

  private apiService = inject(ApiService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  loading = signal(false);
  savingKey = signal<string | null>(null);
  savingPreferred = signal(false);
  apiKeyInputs = signal<Record<string, string>>({});
  configuredProviders = signal<Record<string, boolean>>({});
  preferredProvider = signal<TranscriptionProviderId | '' | null>(null);

  /** Handles ESM/CommonJS interop when shared package may export differently. */
  readonly providers: { id: TranscriptionProviderId; labelKey: string }[] = Array.isArray(
    TRANSCRIPTION_PROVIDER_OPTIONS,
  )
    ? [...TRANSCRIPTION_PROVIDER_OPTIONS]
    : [
        { id: 'huggingface', labelKey: 'transcription.huggingface' },
        { id: 'openai', labelKey: 'transcription.openai' },
      ];

  constructor() {
    effect(() => {
      const wsId = this.workspaceId();
      if (wsId) this.load(wsId);
    });
  }

  providerOptions(): Array<{ id: TranscriptionProviderId | ''; labelKey: string }> {
    const opts = [...this.providers.map((p) => ({ id: p.id, labelKey: p.labelKey }))];
    return [{ id: '', labelKey: 'transcription.preferredProviderAuto' }, ...opts];
  }

  load(workspaceId: string): void {
    this.loading.set(true);
    this.apiService.getWorkspaceSettings(workspaceId).subscribe({
      next: (config) => {
        this.configuredProviders.set(
          config.transcriptionProviderApiKeys ?? {},
        );
        this.preferredProvider.set(
          config.preferredTranscriptionProvider ?? '',
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail:
            err?.error?.message ??
            this.translateService.instant('transcription.loadError'),
        });
        this.loading.set(false);
      },
    });
  }

  saveApiKey(providerId: TranscriptionProviderId): void {
    if (!isTranscriptionProviderId(providerId)) return;
    const value = this.apiKeyInputs()[providerId]?.trim() ?? '';
    this.savingKey.set(providerId);
    const payload: Record<string, string | boolean> = {};
    if (value) {
      payload[providerId] = value;
    } else {
      payload[providerId] = false;
    }
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        transcriptionProviderApiKeys: payload,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant(
              'transcription.apiKeySaved',
            ),
          });
          this.apiKeyInputs.update((prev) => {
            const next = { ...prev };
            delete next[providerId];
            return next;
          });
          this.load(this.workspaceId());
          this.savingKey.set(null);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail:
              err?.error?.message ??
              this.translateService.instant('transcription.saveError'),
          });
          this.savingKey.set(null);
        },
      });
  }

  getApiKeyInput(providerId: string): string {
    return this.apiKeyInputs()[providerId] ?? '';
  }

  onApiKeyInputChange(providerId: string, value: string): void {
    this.apiKeyInputs.update((prev) => ({ ...prev, [providerId]: value }));
  }

  isConfigured(providerId: string): boolean {
    return !!this.configuredProviders()[providerId];
  }

  getProviderLabelKey(providerId: string): string {
    return this.providers.find((p) => p.id === providerId)?.labelKey ?? providerId;
  }

  onPreferredProviderChange(value: TranscriptionProviderId | ''): void {
    this.preferredProvider.set(value);
    this.savingPreferred.set(true);
    const payload = value === '' ? null : value;
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        preferredTranscriptionProvider: payload,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('transcription.preferredProviderSaved'),
          });
          this.savingPreferred.set(false);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail:
              err?.error?.message ??
              this.translateService.instant('transcription.saveError'),
          });
          this.savingPreferred.set(false);
        },
      });
  }
}
