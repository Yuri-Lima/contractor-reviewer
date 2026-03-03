import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { AccordionModule } from 'primeng/accordion';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import type { PromptListItem } from '@contractai-review/shared';
import { PROMPT_LABEL_KEYS } from '@contractai-review/shared/constants';

@Component({
  selector: 'app-prompts-editor',
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
  savingScope = signal(false);
  editedContent = signal<Record<string, string>>({});
  /** Scope toggles from workspace settings (default true when not loaded) */
  includeGlobal = signal(true);
  includeWorkspace = signal(true);

  getLabelKey(key: string): string {
    return PROMPT_LABEL_KEYS[key] ?? key;
  }

  ngOnInit(): void {
    this.loadPrompts();
    this.loadScopeSettings();
  }

  loadScopeSettings(): void {
    if (!this.workspaceId) return;
    this.apiService.getWorkspaceSettings(this.workspaceId).subscribe({
      next: (config) => {
        this.includeGlobal.set(config.promptScopeIncludeGlobal ?? true);
        this.includeWorkspace.set(config.promptScopeIncludeWorkspace ?? true);
      },
      error: () => {
        // Keep defaults on error
      },
    });
  }

  onScopeToggle(field: 'includeGlobal' | 'includeWorkspace', value: boolean): void {
    if (!this.workspaceId) return;
    const prevGlobal = this.includeGlobal();
    const prevWorkspace = this.includeWorkspace();
    if (field === 'includeGlobal') this.includeGlobal.set(value);
    else this.includeWorkspace.set(value);
    this.savingScope.set(true);
    const payload = field === 'includeGlobal'
      ? { promptScopeIncludeGlobal: value }
      : { promptScopeIncludeWorkspace: value };
    this.apiService.updateWorkspaceSettings(this.workspaceId, payload).subscribe({
      next: (config) => {
        this.includeGlobal.set(config.promptScopeIncludeGlobal ?? true);
        this.includeWorkspace.set(config.promptScopeIncludeWorkspace ?? true);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('prompts.saveSuccess'),
        });
        this.savingScope.set(false);
      },
      error: (err) => {
        this.includeGlobal.set(prevGlobal);
        this.includeWorkspace.set(prevWorkspace);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err?.error?.message || this.translateService.instant('prompts.saveError'),
        });
        this.savingScope.set(false);
      },
    });
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
