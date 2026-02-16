import { Component, input, effect, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { Password } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { ParserInfo } from '@contractai-review/shared';

/** Maps parser id to i18n key for display name. Uses string literals to avoid CJS/ESM enum interop issues. */
const PARSER_NAME_KEYS: Record<string, string> = {
  dpt2: 'parsers.dpt2',
  docling: 'parsers.docling',
  llamaparse: 'parsers.llamaparse',
  unstructured: 'parsers.unstructured',
  pdfplumber: 'parsers.pdfplumber',
};

@Component({
  selector: 'app-parser-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Card,
    Message,
    SelectModule,
    Password,
    TranslatePipe,
  ],
  templateUrl: './parser-settings.html',
})
export class ParserSettingsComponent {
  workspaceId = input.required<string>();

  private apiService = inject(ApiService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  parsers = signal<ParserInfo[]>([]);
  defaultParser = signal<string>('docling');
  loading = signal(false);
  savingDefault = signal(false);
  savingKey = signal<string | null>(null);
  apiKeyInputs = signal<Record<string, string>>({});

  constructor() {
    effect(
      () => {
        const wsId = this.workspaceId();
        if (wsId) this.load(wsId);
      },
      { allowSignalWrites: true },
    );
  }

  getParserNameKey(p: ParserInfo): string {
    return PARSER_NAME_KEYS[p.id] ?? p.name;
  }

  load(workspaceId: string): void {
    this.loading.set(true);
    this.apiService.getDocumentParsers(workspaceId).subscribe({
      next: (list) => {
        this.parsers.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err?.error?.message ?? this.translateService.instant('parsers.parseError'),
        });
        this.loading.set(false);
      },
    });

    this.apiService.getWorkspaceSettings(workspaceId).subscribe({
      next: (config) => {
        this.defaultParser.set(
          config.documentProcessing?.defaultDocumentParser ?? 'docling',
        );
      },
      error: () => {},
    });
  }

  onDefaultParserChange(value: string): void {
    this.defaultParser.set(value);
    this.savingDefault.set(true);
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        documentProcessing: {
          defaultDocumentParser: value,
        },
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('parsers.defaultParserSaved'),
          });
          this.savingDefault.set(false);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: err?.error?.message ?? this.translateService.instant('parsers.parseError'),
          });
          this.savingDefault.set(false);
        },
      });
  }

  saveApiKey(parserId: string): void {
    const value = this.apiKeyInputs()[parserId]?.trim() ?? '';
    this.savingKey.set(parserId);
    const payload: Record<string, string | boolean> = {};
    if (value) {
      payload[parserId] = value;
    } else {
      payload[parserId] = false;
    }
    this.apiService
      .updateWorkspaceSettings(this.workspaceId(), {
        documentProcessing: {
          parserApiKeys: payload,
        },
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('parsers.apiKeySaved'),
          });
          this.apiKeyInputs.update((prev) => {
            const next = { ...prev };
            delete next[parserId];
            return next;
          });
          this.load(this.workspaceId());
          this.savingKey.set(null);
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: err?.error?.message ?? this.translateService.instant('parsers.parseError'),
          });
          this.savingKey.set(null);
        },
      });
  }

  getApiKeyInput(parserId: string): string {
    return this.apiKeyInputs()[parserId] ?? '';
  }

  onApiKeyInputChange(parserId: string, value: string): void {
    this.apiKeyInputs.update((prev) => ({ ...prev, [parserId]: value }));
  }

  parsersRequiringApiKey(): ParserInfo[] {
    return this.parsers().filter((p) => p.requiresApiKey);
  }

  parserOptions(): Array<{ id: string; labelKey: string }> {
    return this.parsers().map((p) => ({
      id: p.id,
      labelKey: this.getParserNameKey(p),
    }));
  }
}
