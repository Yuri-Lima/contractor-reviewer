import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { AccordionModule } from 'primeng/accordion';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { PromptListItem } from '@contractai-review/shared';

/** Maps prompt key to i18n label key */
const PROMPT_LABEL_KEYS: Record<string, string> = {
  'chat.system': 'prompts.chatSystem',
  'chat.user': 'prompts.chatUser',
  'redline.system': 'prompts.redlineSystem',
  'redline.user': 'prompts.redlineUser',
  'redline.playbook.balanced': 'prompts.playbookBalanced',
  'redline.playbook.conservative': 'prompts.playbookConservative',
  'redline.playbook.client-friendly': 'prompts.playbookClientFriendly',
};

@Component({
  selector: 'app-prompts-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Message,
    AccordionModule,
    TextareaModule,
    TranslatePipe,
  ],
  templateUrl: './prompts-editor.html',
})
export class PromptsEditorComponent implements OnInit {
  @Input({ required: true }) workspaceId!: string;

  private apiService = inject(ApiService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  prompts = signal<PromptListItem[]>([]);
  loading = signal(false);
  savingKey = signal<string | null>(null);
  editedContent = signal<Record<string, string>>({});

  getLabelKey(key: string): string {
    return PROMPT_LABEL_KEYS[key] ?? key;
  }

  ngOnInit(): void {
    this.loadPrompts();
  }

  loadPrompts(): void {
    if (!this.workspaceId) return;
    this.loading.set(true);
    this.apiService.getPrompts(this.workspaceId).subscribe({
      next: (res) => {
        this.prompts.set(res.prompts);
        const initial: Record<string, string> = {};
        for (const p of res.prompts) {
          initial[p.key] = p.content;
        }
        this.editedContent.set(initial);
        this.loading.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err?.error?.message || this.translateService.instant('prompts.loadError'),
        });
        this.loading.set(false);
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
    this.savingKey.set(key);
    this.apiService.updatePrompt(this.workspaceId, key, content).subscribe({
      next: (res) => {
        this.prompts.update((list) =>
          list.map((p) => (p.key === key ? { ...p, content: res.content, source: 'workspace' as const } : p)),
        );
        this.editedContent.update((prev) => ({ ...prev, [key]: res.content }));
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
    if (item?.source !== 'workspace') return;

    this.savingKey.set(key);
    this.apiService.resetPrompt(this.workspaceId, key).subscribe({
      next: () => {
        this.loadPrompts();
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
