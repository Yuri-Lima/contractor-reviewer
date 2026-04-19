import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { WORKSPACE_PROMPT_KEY } from '@contractai-review/shared';
import { PROMPT_LABEL_KEYS } from '@contractai-review/shared/constants';

/** Workspace prompt item from API */
interface WorkspacePromptItem {
  key: string;
  content: string;
  source: string;
  hasOverride?: boolean;
  description?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-prompts-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Message,
    TooltipModule,
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

  prompt = signal<WorkspacePromptItem | null>(null);
  loading = signal(false);
  saving = signal(false);
  savingScope = signal(false);
  editedContent = signal('');
  /** Scope toggles from workspace settings (default true when not loaded) */
  includeGlobal = signal(true);
  includeWorkspace = signal(true);

  readonly key = WORKSPACE_PROMPT_KEY;
  readonly labelKey = PROMPT_LABEL_KEYS[WORKSPACE_PROMPT_KEY] ?? WORKSPACE_PROMPT_KEY;

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
        const items = res.prompts ?? [];
        const item = items[0] ?? null;
        this.prompt.set(item as WorkspacePromptItem | null);
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
    this.apiService.updatePrompt(this.workspaceId, this.key, content).subscribe({
      next: (res) => {
        this.prompt.update((p) => (p ? { ...p, content: res.content, source: 'workspace' } : p));
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
    if (this.prompt()?.source !== 'workspace') return;
    this.saving.set(true);
    this.apiService.resetPrompt(this.workspaceId, this.key).subscribe({
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
