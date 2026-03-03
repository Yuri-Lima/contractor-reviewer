import { Component, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { AccordionModule } from 'primeng/accordion';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { rxResource } from '@angular/core/rxjs-interop';
import { EMPTY } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import type { PromptSource } from '@contractai-review/shared';
import {
  PROMPT_LABEL_KEYS,
  PROMPT_SOURCE_LABEL_KEYS,
} from '@contractai-review/shared/constants';
import type { Document } from '@contractai-review/shared';
import type { ListPromptsResponse } from '@contractai-review/shared';

@Component({
  selector: 'app-document-prompts-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Message,
    TooltipModule,
    AccordionModule,
    TextareaModule,
    ToggleSwitchModule,
    TranslatePipe,
  ],
  templateUrl: './document-prompts-editor.html',
})
export class DocumentPromptsEditorComponent {
  workspaceId = input.required<string>();
  documentId = input.required<string>();

  private apiService = inject(ApiService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  savingKey = signal<string | null>(null);
  savingScope = signal(false);
  /** Optimistic override while toggling; cleared after reload or error */
  private pendingIncludeDocument = signal<boolean | null>(null);
  editedContent = signal<Record<string, string>>({});

  private documentParams = computed(() => {
    const wid = this.workspaceId();
    const did = this.documentId();
    return wid && did ? { workspaceId: wid, documentId: did } : null;
  });

  private promptsParams = computed(() => {
    const wid = this.workspaceId();
    const did = this.documentId();
    return wid && did ? { workspaceId: wid, documentId: did } : null;
  });

  readonly documentResource = rxResource({
    params: () => this.documentParams(),
    stream: ({ params }) => {
      if (!params) return EMPTY;
      return this.apiService.getDocument(params.workspaceId, params.documentId);
    },
  });

  readonly promptsResource = rxResource({
    params: () => this.promptsParams(),
    stream: ({ params }) => {
      if (!params) return EMPTY;
      return this.apiService.getDocumentPrompts(
        params.workspaceId,
        params.documentId,
      );
    },
  });

  /** Include document prompts; optimistic during toggle, else from document */
  includeDocument = computed(
    () =>
      this.pendingIncludeDocument() ??
      (this.documentResource.hasValue()
        ? (this.documentResource.value() as Document)?.promptScopeIncludeDocument ??
          true
        : true),
  );

  prompts = computed(
    () =>
      (this.promptsResource.hasValue()
        ? (this.promptsResource.value() as ListPromptsResponse)?.prompts
        : []) ?? [],
  );

  loading = computed(() => this.promptsResource.isLoading());

  constructor() {
    effect(() => {
      const res = this.promptsResource.value();
      if (res && 'prompts' in res) {
        const initial: Record<string, string> = {};
        for (const p of res.prompts) {
          initial[p.key] = p.content;
        }
        this.editedContent.set(initial);
      }
    });
    effect(() => {
      const err = this.promptsResource.error();
      if (err) {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail:
            (err as { error?: { message?: string } })?.error?.message ||
            this.translateService.instant('prompts.loadError'),
        });
      }
    });
  }

  getLabelKey(key: string): string {
    return PROMPT_LABEL_KEYS[key] ?? key;
  }

  getSourceLabel(source: PromptSource): string {
    return this.translateService.instant(PROMPT_SOURCE_LABEL_KEYS[source]);
  }

  onIncludeDocumentToggle(value: boolean): void {
    const wid = this.workspaceId();
    const did = this.documentId();
    if (!wid || !did) return;
    this.pendingIncludeDocument.set(value);
    this.savingScope.set(true);
    this.apiService
      .updateDocument(wid, did, { promptScopeIncludeDocument: value })
      .subscribe({
        next: () => {
          this.documentResource.reload();
          this.pendingIncludeDocument.set(null);
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('prompts.saveSuccess'),
          });
          this.savingScope.set(false);
        },
        error: (err) => {
          this.pendingIncludeDocument.set(null);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail:
              err?.error?.message ||
              this.translateService.instant('prompts.saveError'),
          });
          this.savingScope.set(false);
        },
      });
  }

  onContentChange(key: string, value: string): void {
    this.editedContent.update((prev) => ({ ...prev, [key]: value }));
  }

  getContent(key: string): string {
    return this.editedContent()[key] ?? this.prompts().find((p) => p.key === key)?.content ?? '';
  }

  hasChanges(key: string): boolean {
    const original = this.prompts().find((p) => p.key === key)?.content ?? '';
    return this.getContent(key) !== original;
  }

  onSave(key: string): void {
    const content = this.getContent(key).trim();
    if (!content) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant('common.error'),
        detail: this.translateService.instant('validation.required'),
      });
      return;
    }
    const wid = this.workspaceId();
    const did = this.documentId();
    if (!wid || !did) return;
    this.savingKey.set(key);
    this.apiService.updateDocumentPrompt(wid, did, key, content).subscribe({
      next: () => {
        this.editedContent.update((prev) => ({ ...prev, [key]: content }));
        this.promptsResource.reload();
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('prompts.saveSuccess'),
        });
        this.savingKey.set(null);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err?.error?.message || this.translateService.instant('prompts.saveError'),
        });
        this.savingKey.set(null);
      },
    });
  }

  onReset(key: string): void {
    const item = this.prompts().find((p) => p.key === key);
    if (item?.source !== 'document') return;

    const wid = this.workspaceId();
    const did = this.documentId();
    if (!wid || !did) return;

    this.savingKey.set(key);
    this.apiService.resetDocumentPrompt(wid, did, key).subscribe({
      next: () => {
        this.promptsResource.reload();
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('prompts.resetSuccess'),
        });
        this.savingKey.set(null);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err?.error?.message || this.translateService.instant('prompts.resetError'),
        });
        this.savingKey.set(null);
      },
    });
  }
}
