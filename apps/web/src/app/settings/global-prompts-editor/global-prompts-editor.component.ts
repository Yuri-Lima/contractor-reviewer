import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { GLOBAL_PROMPT_KEY } from '@contractai-review/shared';
import { PROMPT_LABEL_KEYS } from '@contractai-review/shared/constants';

/** Global prompt item with optional hasOverride from API */
interface GlobalPromptItem {
  key: string;
  content: string;
  source: string;
  hasOverride?: boolean;
  description?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-global-prompts-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Message,
    TooltipModule,
    TextareaModule,
    TranslatePipe,
  ],
  templateUrl: './global-prompts-editor.html',
})
export class GlobalPromptsEditorComponent implements OnInit {
  private apiService = inject(ApiService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  prompt = signal<GlobalPromptItem | null>(null);
  loading = signal(false);
  saving = signal(false);
  editedContent = signal('');

  readonly key = GLOBAL_PROMPT_KEY;
  readonly labelKey = PROMPT_LABEL_KEYS[GLOBAL_PROMPT_KEY] ?? GLOBAL_PROMPT_KEY;

  ngOnInit(): void {
    this.loadPrompts();
  }

  loadPrompts(): void {
    this.loading.set(true);
    this.apiService.getAccountPrompts().subscribe({
      next: (res) => {
        const items = (res.prompts ?? []) as GlobalPromptItem[];
        const item = items[0] ?? null;
        this.prompt.set(item);
        this.editedContent.set(item?.content ?? '');
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

  onContentChange(value: string): void {
    this.editedContent.set(value);
  }

  hasChanges(): boolean {
    const original = this.prompt()?.content ?? '';
    return this.editedContent() !== original;
  }

  onSave(): void {
    const content = this.editedContent().trim();
    if (!content) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant('common.error'),
        detail: this.translateService.instant('validation.required'),
      });
      return;
    }
    this.saving.set(true);
    this.apiService.updateAccountPrompt(this.key, content).subscribe({
      next: (res) => {
        this.prompt.update((p) => (p ? { ...p, content: res.content, hasOverride: true } : p));
        this.editedContent.set(res.content);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('prompts.saveSuccess'),
        });
        this.saving.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err?.error?.message || this.translateService.instant('prompts.saveError'),
        });
        this.saving.set(false);
      },
    });
  }

  onReset(): void {
    if (!this.prompt()?.hasOverride) return;
    this.saving.set(true);
    this.apiService.resetAccountPrompt(this.key).subscribe({
      next: () => {
        this.loadPrompts();
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('prompts.resetSuccess'),
        });
        this.saving.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err?.error?.message || this.translateService.instant('prompts.resetError'),
        });
        this.saving.set(false);
      },
    });
  }
}
