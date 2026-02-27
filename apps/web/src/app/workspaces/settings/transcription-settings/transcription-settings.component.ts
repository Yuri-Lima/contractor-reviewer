import { Component, input, effect, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  isTranscriptionProviderId,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  type TranscriptionProviderId,
  TtsProviderIdValues,
  type TtsProviderId,
  type TtsProviderConfig,
  ELEVENLABS_PLANS,
  ChatResponseModeValues,
  type ChatResponseMode,
  CHAT_RESPONSE_MODES,
} from '@contractai-review/shared';

/** Explicit TTS provider list for UI - avoids shared package export/bundling issues. */
const TTS_PROVIDERS_UI: { id: TtsProviderId; labelKey: string }[] = [
  { id: TtsProviderIdValues.ReplicateXtts, labelKey: 'tts.replicateXtts' },
  { id: TtsProviderIdValues.Huggingface, labelKey: 'tts.huggingface' },
  { id: TtsProviderIdValues.OpenAI, labelKey: 'tts.openai' },
  { id: TtsProviderIdValues.ElevenLabs, labelKey: 'tts.elevenlabs' },
];

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
    CheckboxModule,
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
  savingTtsKey = signal<string | null>(null);
  savingPreferredTts = signal(false);
  savingTtsConfig = signal<string | null>(null);
  savingChatMode = signal(false);
  savingVoiceAutoSend = signal(false);
  apiKeyInputs = signal<Record<string, string>>({});
  configuredProviders = signal<Record<string, boolean>>({});
  preferredProvider = signal<TranscriptionProviderId | '' | null>(null);
  ttsApiKeyInputs = signal<Record<string, string>>({});
  configuredTtsProviders = signal<Record<string, boolean>>({});
  preferredTtsProvider = signal<TtsProviderId | '' | null>(null);
  ttsProviderConfig = signal<Record<string, TtsProviderConfig>>({});
  chatResponseMode = signal<ChatResponseMode>(ChatResponseModeValues.TextOnly);
  voiceAutoSend = signal(false);

  /** Handles ESM/CommonJS interop when shared package may export differently. */
  readonly providers: { id: TranscriptionProviderId; labelKey: string }[] = Array.isArray(
    TRANSCRIPTION_PROVIDER_OPTIONS,
  )
    ? [...TRANSCRIPTION_PROVIDER_OPTIONS]
    : [
        { id: 'huggingface', labelKey: 'transcription.huggingface' },
        { id: 'openai', labelKey: 'transcription.openai' },
      ];

  readonly ttsProviders: { id: TtsProviderId; labelKey: string }[] = TTS_PROVIDERS_UI;

  readonly chatResponseModeOptions: { value: ChatResponseMode; labelKey: string }[] =
    CHAT_RESPONSE_MODES.map((m) => ({
      value: m,
      labelKey: `chat.responseMode.${m}`,
    }));

  readonly elevenlabsPlanOptions: { value: string; labelKey: string }[] =
    (Array.isArray(ELEVENLABS_PLANS) ? ELEVENLABS_PLANS : ['free', 'starter', 'pro', 'scale', 'business']).map(
      (plan) => ({
        value: plan,
        labelKey: `tts.elevenlabsPlan${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
      }),
    );

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
        this.configuredTtsProviders.set(config.ttsProviderApiKeys ?? {});
        this.preferredTtsProvider.set(config.preferredTtsProvider ?? '');
        this.ttsProviderConfig.set((config.ttsProviderConfig as Record<string, TtsProviderConfig>) ?? {});
        this.chatResponseMode.set(config.chatResponseMode ?? ChatResponseModeValues.TextOnly);
        this.voiceAutoSend.set(config.voiceAutoSend ?? false);
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

  ttsProviderOptions(): Array<{ id: TtsProviderId | ''; labelKey: string }> {
    const opts = [...this.ttsProviders.map((p) => ({ id: p.id, labelKey: p.labelKey }))];
    return [{ id: '', labelKey: 'tts.preferredProviderAuto' }, ...opts];
  }

  saveTtsApiKey(providerId: TtsProviderId): void {
    if (!this.ttsProviders.some((p) => p.id === providerId)) return;
    const value = this.ttsApiKeyInputs()[providerId]?.trim() ?? '';
    this.savingTtsKey.set(providerId);
    const payload: Record<string, string | boolean> = {};
    if (value) {
      payload[providerId] = value;
    } else {
      payload[providerId] = false;
    }
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        ttsProviderApiKeys: payload,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('tts.apiKeySaved'),
          });
          this.ttsApiKeyInputs.update((prev) => {
            const next = { ...prev };
            delete next[providerId];
            return next;
          });
          this.load(this.workspaceId());
          this.savingTtsKey.set(null);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: err?.error?.message ?? this.translateService.instant('tts.saveError'),
          });
          this.savingTtsKey.set(null);
        },
      });
  }

  getTtsApiKeyInput(providerId: string): string {
    return this.ttsApiKeyInputs()[providerId] ?? '';
  }

  onTtsApiKeyInputChange(providerId: string, value: string): void {
    this.ttsApiKeyInputs.update((prev) => ({ ...prev, [providerId]: value }));
  }

  isTtsConfigured(providerId: string): boolean {
    return !!this.configuredTtsProviders()[providerId];
  }

  getTtsProviderLabelKey(providerId: string): string {
    return this.ttsProviders.find((p) => p.id === providerId)?.labelKey ?? providerId;
  }

  getTtsProviderPlan(providerId: string): string {
    return this.ttsProviderConfig()[providerId]?.plan ?? 'free';
  }

  onTtsProviderPlanChange(providerId: TtsProviderId, plan: string): void {
    this.savingTtsConfig.set(providerId);
    const planValue = plan || 'free';
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        ttsProviderConfig: { [providerId]: { plan: planValue } },
      })
      .subscribe({
        next: (config) => {
          this.ttsProviderConfig.set(
            (config.ttsProviderConfig as Record<string, TtsProviderConfig>) ?? {},
          );
          this.savingTtsConfig.set(null);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: err?.error?.message ?? this.translateService.instant('tts.saveError'),
          });
          this.savingTtsConfig.set(null);
        },
      });
  }

  onPreferredTtsProviderChange(value: TtsProviderId | ''): void {
    this.preferredTtsProvider.set(value);
    this.savingPreferredTts.set(true);
    const payload = value === '' ? null : value;
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        preferredTtsProvider: payload,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('tts.preferredProviderSaved'),
          });
          this.savingPreferredTts.set(false);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: err?.error?.message ?? this.translateService.instant('tts.saveError'),
          });
          this.savingPreferredTts.set(false);
        },
      });
  }

  onChatResponseModeChange(value: ChatResponseMode): void {
    this.chatResponseMode.set(value);
    this.savingChatMode.set(true);
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), { chatResponseMode: value })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('chat.responseModeSaved'),
          });
          this.savingChatMode.set(false);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: err?.error?.message ?? this.translateService.instant('tts.saveError'),
          });
          this.savingChatMode.set(false);
        },
      });
  }

  onVoiceAutoSendChange(checked: boolean): void {
    this.voiceAutoSend.set(checked);
    this.savingVoiceAutoSend.set(true);
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), { voiceAutoSend: checked })
      .subscribe({
        next: () => {
          this.savingVoiceAutoSend.set(false);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: err?.error?.message ?? this.translateService.instant('tts.saveError'),
          });
          this.savingVoiceAutoSend.set(false);
        },
      });
  }
}
