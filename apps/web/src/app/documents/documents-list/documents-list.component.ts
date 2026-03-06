import { Component, OnInit, signal, computed, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { Toolbar } from 'primeng/toolbar';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ContextMenu } from 'primeng/contextmenu';
import { Toast } from 'primeng/toast';
import { BaseDialogComponent, type DialogFooterButton } from '../../core/components/base-dialog';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { AccordionModule } from 'primeng/accordion';
import { ConfirmationService, MessageService, SharedModule } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { workspaceDocument } from '../../core/routes';
import { DocumentViewTabService } from '../../onboarding/tour/document-view-tab.service';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { Document } from '@contractai-review/shared';
import {
  PROMPT_CATEGORIES,
  getPromptCategoryById,
  PROMPT_KEYS,
  PROMPT_LABEL_KEYS,
  type PromptCategory,
} from '@contractai-review/shared/constants';
import { EditableTitleComponent } from '../../core/components/editable-title/editable-title.component';
import { DevOnlyDirective } from '../../core/directives/dev-only.directive';
import { LocaleDatePipe } from '../../core/pipes/locale-date.pipe';
import { TruncatePipe } from '../../core/pipes/truncate.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { DOCUMENTS_LIST_SERVICE } from './documents-list.service.interface';
import { DocumentsListServiceImpl } from './documents-list.service';

@Component({
  selector: 'app-documents-list',
  standalone: true,
  providers: [
    ConfirmationService,
    MessageService,
    { provide: DOCUMENTS_LIST_SERVICE, useClass: DocumentsListServiceImpl },
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    Button,
    Card,
    Toolbar,
    TooltipModule,
    SharedModule,
    ConfirmDialog,
    Toast,
    ContextMenu,
    BaseDialogComponent,
    TextareaModule,
    SelectModule,
    AccordionModule,
    LocaleDatePipe,
    TruncatePipe,
    TranslatePipe,
    EditableTitleComponent,
    DevOnlyDirective,
  ],
  template: `
    <p-contextMenu #documentContextMenu [model]="documentContextMenuItems()"></p-contextMenu>
    <div class="documents-container p-6 max-w-6xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">{{ 'documents.title' | translate }}</h1>

      <p-toolbar class="documents-toolbar mb-4">
        <ng-template pTemplate="start">
          <div class="flex flex-wrap items-center gap-2">
            <p-button
              data-testid="documents-create-btn"
              data-tour="documents-create-btn"
              [label]="'documents.create' | translate"
              icon="pi pi-plus"
              (onClick)="showCreateForm.set(true)"
              [pTooltip]="'documents.create' | translate"
            ></p-button>
          </div>
        </ng-template>
      </p-toolbar>

      @if (showCreateForm()) {
        <p-card class="mb-6">
          <ng-template pTemplate="header">
            <div class="p-4 pb-0">
              <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100 m-0">{{ 'documents.create' | translate }}</h3>
            </div>
          </ng-template>
          <div class="p-4 pt-2">
            <input 
              data-testid="document-title-input"
              [value]="newDocumentTitle()" 
              (input)="onTitleInput($event)" 
              class="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              [placeholder]="'documents.titlePlaceholder' | translate" 
            />
            <textarea 
              [value]="newDocumentDescription()" 
              (input)="onDescriptionInput($event)" 
              class="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
              [placeholder]="'documents.descriptionPlaceholder' | translate" 
              rows="3"
            ></textarea>
            <div class="mb-4">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                {{ 'documents.promptCategory' | translate }}
              </label>
              <p-select
                [options]="promptCategoryOptions()"
                [ngModel]="selectedPromptCategoryId()"
                (ngModelChange)="selectedPromptCategoryId.set($event)"
                optionLabel="label"
                optionValue="value"
                [filter]="true"
                [filterPlaceholder]="'documents.promptCategoryPlaceholder' | translate"
                [showClear]="true"
                [placeholder]="'documents.promptCategoryPlaceholder' | translate"
                [style]="{ width: '100%' }"
              ></p-select>
              @if (selectedPromptCategoryId()) {
                <div class="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300 p-3 border-b border-gray-200 dark:border-gray-600">
                    {{ 'documents.promptCategoryPreview' | translate }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 px-3 pb-2">
                    {{ 'documents.promptCategoryPreviewDescription' | translate }}
                  </p>
                  <p-accordion [value]="[]" [multiple]="true" [styleClass]="'border-0'">
                    @for (key of promptPreviewKeys; track key) {
                      <p-accordion-panel [value]="key">
                        <p-accordion-header>
                          {{ PROMPT_LABEL_KEYS[key] | translate }}
                        </p-accordion-header>
                        <p-accordion-content>
                          <div class="p-3 text-sm font-mono whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-800 rounded">
                            {{ getPromptPreviewContent(key) }}
                          </div>
                        </p-accordion-content>
                      </p-accordion-panel>
                    }
                  </p-accordion>
                </div>
              }
            </div>
            <div class="mb-4">
              <details class="group">
                <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                  {{ 'documents.addContextTemporary' | translate }}
                </summary>
                <div class="mt-2 space-y-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ 'documents.contextMarkdownHelp' | translate }}</p>
                  <input
                    #contextFileInput
                    type="file"
                    accept=".md"
                    class="hidden"
                    (change)="onContextFileSelected($event)"
                  />
                  <div class="flex gap-2">
                    <p-button
                      [label]="'documents.uploadContext' | translate"
                      icon="pi pi-upload"
                      [outlined]="true"
                      severity="secondary"
                      (onClick)="contextFileInput.click()"
                    ></p-button>
                    @if (contextMarkdown()) {
                      <p-button
                        [label]="'documents.removeContext' | translate"
                        icon="pi pi-times"
                        [outlined]="true"
                        severity="secondary"
                        (onClick)="clearContextMarkdown()"
                      ></p-button>
                    }
                  </div>
                  <textarea
                    pTextarea
                    [ngModel]="contextMarkdown()"
                    (ngModelChange)="onContextMarkdownInput($event)"
                    [placeholder]="'documents.contextMarkdownPlaceholder' | translate"
                    rows="4"
                    class="w-full text-sm"
                  ></textarea>
                </div>
              </details>
            </div>
            @if (error()) {
              <div class="error-message mb-4">
                <p class="text-red-600 dark:text-red-400 text-sm">{{ error() }}</p>
              </div>
            }
            <div class="form-actions flex flex-wrap gap-2">
              <p-button
                [label]="'documents.generateAIPrompt' | translate"
                icon="pi pi-sparkles"
                [outlined]="true"
                [loading]="generatingPrompt()"
                [disabled]="!newDocumentDescription().trim() || contextMarkdownExceeded() || generatingPrompt() || loading()"
                (onClick)="onGeneratePrompt()"
                [pTooltip]="'documents.generateAIPromptDescription' | translate"
              ></p-button>
              <button 
                data-testid="document-create-submit"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                (click)="createDocument()"
                [disabled]="loading()"
              >
                @if (!loading()) {
                  <span>{{ 'common.create' | translate }}</span>
                }
                @if (loading()) {
                  <span>{{ 'documents.creating' | translate }}</span>
                }
              </button>
              <button 
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium"
                (click)="showCreateForm.set(false); error.set(null); contextMarkdown.set(''); selectedPromptCategoryId.set(null); clearPromptDialogState();"
                [disabled]="loading()"
              >
                {{ 'common.cancel' | translate }}
              </button>
            </div>
          </div>
        </p-card>
      }

      @if (documents().length > 0) {
        <p-card class="mt-4">
          <div class="p-4">
        <div class="documents-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-tour="documents-grid">
          @for (doc of documents(); track doc.id) {
            <div
              class="document-card group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-200 relative cursor-pointer"
              [class.ring-2]="selectedDocument()?.id === doc.id"
              [class.ring-blue-500]="selectedDocument()?.id === doc.id"
              [class.dark:ring-blue-400]="selectedDocument()?.id === doc.id"
              (click)="selectDocument(doc)"
              (contextmenu)="onDocumentContextMenu($event, doc)"
            >
              <div
                class="absolute top-3 right-3 z-10 opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-300 ease-out"
                (click)="$event.stopPropagation()"
              >
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [outlined]="true"
                  size="small"
                  [loading]="deletingDocId() === doc.id"
                  [disabled]="deletingDocId() !== null"
                  (onClick)="confirmDelete(doc)"
                  [pTooltip]="'tooltip.deleteDocument' | translate"
                ></p-button>
              </div>
              <a
                [routerLink]="workspaceDocLink(workspaceId(), doc.id)"
                class="block no-underline"
                (click)="$event.stopPropagation()"
              >
                <app-editable-title
                  [value]="doc.title"
                  (valueChange)="onDocumentTitleChange(doc, $event)"
                  [displayTruncate]="true"
                  class="mb-2 block"
                />
                @if (doc.description) {
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-4" [title]="doc.description">{{ doc.description | truncate:150 }}</p>
                }
                <div *appDevOnly class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono" [attr.data-testid]="'document-id-' + doc.id">
                  ID: {{ doc.id }}
                </div>
                <div class="document-meta flex justify-between items-center">
                  <span 
                    class="px-2 py-1 text-xs rounded"
                    [class.bg-green-100]="doc.status === 'available'"
                    [class.text-green-800]="doc.status === 'available'"
                    [class.dark:bg-green-900]="doc.status === 'available'"
                    [class.dark:text-green-200]="doc.status === 'available'"
                    [class.bg-gray-100]="doc.status !== 'available'"
                    [class.text-gray-800]="doc.status !== 'available'"
                    [class.dark:bg-gray-700]="doc.status !== 'available'"
                    [class.dark:text-gray-300]="doc.status !== 'available'"
                  >
                    {{ doc.status }}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ doc.createdAt | localeDate: 'short' }}</span>
                </div>
              </a>
            </div>
          }
        </div>
          </div>
        </p-card>
      } @else {
        <p-card class="mt-4">
          <div class="p-4 text-center">
        <div class="empty-state py-12 px-8" data-testid="documents-empty-state">
          <p class="text-gray-600 dark:text-gray-400">{{ 'documents.noDocumentsFound' | translate }}</p>
        </div>
          </div>
        </p-card>
      }

      <app-base-dialog
        [visible]="promptDialogVisible()"
        [header]="'documents.promptDialogTitle' | translate"
        [width]="'min(95vw, 600px)'"
        [maxHeight]="'70vh'"
        [contentClass]="'overflow-auto'"
        [footerButtons]="promptDialogFooterButtons()"
        (closed)="clearPromptDialogState()"
        (buttonClicked)="onPromptDialogButton($event)"
      >
        <ng-template #bodyTemplate>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ 'documents.promptDialogDescription' | translate }}</p>
          <textarea
            pTextarea
            [ngModel]="editedGeneratedPrompt()"
            (ngModelChange)="editedGeneratedPrompt.set($event)"
            rows="12"
            class="w-full font-mono text-sm mb-4"
          ></textarea>
        </ng-template>
      </app-base-dialog>

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .documents-container { max-width: 1200px; margin: 0 auto; }
    :host ::ng-deep .documents-toolbar.p-toolbar {
      padding: 1rem 1.25rem;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    :host ::ng-deep .documents-toolbar .p-toolbar-start {
      display: flex;
      gap: 0.5rem;
    }
  `],
})
export class DocumentsListComponent implements OnInit {
  readonly workspaceDocLink = workspaceDocument;
  readonly PROMPT_LABEL_KEYS = PROMPT_LABEL_KEYS;
  readonly promptPreviewKeys = PROMPT_KEYS;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private documentsService = inject(DOCUMENTS_LIST_SERVICE);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private documentViewTabService = inject(DocumentViewTabService);

  documentContextMenuRef = viewChild<ContextMenu>('documentContextMenu');

  /** Trigger recomputation of category options when language changes */
  private langSignal = signal(this.translateService.currentLang ?? 'en');

  workspaceId = signal('');
  documents = signal<Document[]>([]);
  showCreateForm = signal(false);
  newDocumentTitle = signal('');
  newDocumentDescription = signal('');
  contextMarkdown = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  deletingDocId = signal<string | null>(null);
  selectedDocument = signal<Document | null>(null);

  selectedPromptCategoryId = signal<string | null>(null);

  promptCategoryOptions = computed(() => {
    this.langSignal(); // dependency on lang
    const t = (key: string) => this.translateService.instant(key);
    const noneOption = {
      label: t('documents.promptCategoryNone'),
      value: null as string | null,
    };
    const categoryOptions = PROMPT_CATEGORIES.map((c: PromptCategory) => ({
      label: t(c.nameKey),
      value: c.id,
    }));
    return [noneOption, ...categoryOptions];
  });

  generatingPrompt = signal(false);
  promptDialogVisible = signal(false);
  generatedPrompt = signal('');
  editedGeneratedPrompt = signal('');

  contextMarkdownExceeded = computed(() =>
    this.documentsService.isContextMarkdownExceeded(this.contextMarkdown()),
  );

  selectedDocForContext = signal<Document | null>(null);
  documentContextMenuItems = computed<MenuItem[]>(() =>
    this.buildDocumentMenu(this.selectedDocForContext())
  );


  getPromptPreviewContent(key: string): string {
    const cat = getPromptCategoryById(this.selectedPromptCategoryId());
    if (!cat) return '';
    return cat.prompts[key as (typeof PROMPT_KEYS)[number]] ?? '';
  }

  selectDocument(doc: Document): void {
    this.selectedDocument.set(this.selectedDocument()?.id === doc.id ? null : doc);
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadDocuments();
    this.translateService.onLangChange.subscribe(() => {
      this.langSignal.set(this.translateService.currentLang ?? 'en');
    });
  }

  loadDocuments(): void {
    this.documentsService.loadDocuments(this.workspaceId()).subscribe({
      next: (docs) => this.documents.set(docs),
      error: (err) => console.error('Error loading documents:', err),
    });
  }

  onDocumentTitleChange(doc: Document, newTitle: string): void {
    const wsId = this.workspaceId();
    if (!wsId) return;
    this.documentsService.updateDocumentTitle(wsId, doc.id, newTitle).subscribe({
      next: (updated) => {
        this.documents.update((docs) =>
          docs.map((d) => (d.id === doc.id ? { ...d, title: updated.title } : d)),
        );
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('documents.updateSuccess')),
        });
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message ?? this.translateService.instant(_('documents.updateError')),
        });
      },
    });
  }

  onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.newDocumentTitle.set(target.value);
    }
  }

  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      this.newDocumentDescription.set(target.value);
    }
  }

  onContextMarkdownInput(value: string): void {
    this.contextMarkdown.set(value);
    if (this.documentsService.isContextMarkdownExceeded(value)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant(_('common.warning')),
        detail: this.translateService.instant(_('documents.contextMarkdownSizeExceeded')),
      });
    }
  }

  async onContextFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      const content = await this.documentsService.readFileAsText(file);
      this.contextMarkdown.set(content);
      if (this.documentsService.isContextMarkdownExceeded(content)) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translateService.instant(_('common.warning')),
          detail: this.translateService.instant(_('documents.contextMarkdownSizeExceeded')),
        });
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant(_('common.error')),
        detail: this.translateService.instant(_('documents.contextMarkdownReadError')),
      });
    }
    input.value = '';
  }

  clearContextMarkdown(): void {
    this.contextMarkdown.set('');
  }

  promptDialogFooterButtons = computed<DialogFooterButton[]>(() => [
    {
      label: this.translateService.instant(_('documents.approveAndCreate')),
      icon: 'pi pi-check',
      action: 'emit',
      emitKey: 'approve',
    },
    {
      label: this.translateService.instant(_('documents.rejectAndCreate')),
      icon: 'pi pi-times',
      severity: 'secondary',
      outlined: true,
      action: 'emit',
      emitKey: 'reject',
    },
    {
      label: this.translateService.instant(_('documents.recreatePrompt')),
      icon: 'pi pi-refresh',
      severity: 'secondary',
      outlined: true,
      loading: this.generatingPrompt(),
      disabled: this.generatingPrompt(),
      action: 'emit',
      emitKey: 'recreate',
    },
  ]);

  onPromptDialogButton(e: { key: string }): void {
    if (e.key === 'approve') {
      this.onApproveAndCreate();
    } else if (e.key === 'reject') {
      this.onRejectAndCreate();
    } else if (e.key === 'recreate') {
      this.onRecreatePrompt();
    }
  }

  clearPromptDialogState(): void {
    this.promptDialogVisible.set(false);
    this.generatedPrompt.set('');
    this.editedGeneratedPrompt.set('');
  }

  onGeneratePrompt(): void {
    const description = this.newDocumentDescription().trim();
    if (!description) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant(_('common.warning')),
        detail: this.translateService.instant(_('documents.descriptionRequiredForGenerate')),
      });
      return;
    }
    if (this.contextMarkdownExceeded()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant(_('common.warning')),
        detail: this.translateService.instant(_('documents.contextMarkdownSizeExceeded')),
      });
      return;
    }
    const workspaceId = this.workspaceId();
    if (!workspaceId) return;
    this.generatingPrompt.set(true);
    const ctx = this.contextMarkdown().trim() || undefined;
    this.documentsService
      .generatePrompt(
        workspaceId,
        this.newDocumentTitle().trim(),
        description,
        ctx,
      )
      .subscribe({
        next: (res) => {
          this.generatedPrompt.set(res.generatedPrompt);
          this.editedGeneratedPrompt.set(res.generatedPrompt);
          this.promptDialogVisible.set(true);
          this.generatingPrompt.set(false);
        },
        error: (err) => {
          this.generatingPrompt.set(false);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant(_('common.error')),
            detail:
              err?.error?.message ??
              this.translateService.instant(_('documents.generatePromptError')),
          });
        },
      });
  }

  onApproveAndCreate(): void {
    const content = this.editedGeneratedPrompt().trim();
    if (!content) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translateService.instant(_('common.warning')),
        detail: this.translateService.instant(_('validation.required')),
      });
      return;
    }
    this.confirmationService.confirm({
      message: this.translateService.instant(_('documents.confirmApprove')),
      header: this.translateService.instant(_('documents.approveAndCreate')),
      icon: 'pi pi-check-circle',
      acceptLabel: this.translateService.instant(_('common.yes')),
      rejectLabel: this.translateService.instant(_('common.no')),
      accept: () => this.doCreateDocument(content),
    });
  }

  onRejectAndCreate(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('documents.confirmReject')),
      header: this.translateService.instant(_('documents.rejectAndCreate')),
      icon: 'pi pi-question-circle',
      acceptLabel: this.translateService.instant(_('common.yes')),
      rejectLabel: this.translateService.instant(_('common.no')),
      accept: () => this.doCreateDocument(),
    });
  }

  onRecreatePrompt(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('documents.confirmRecreate')),
      header: this.translateService.instant(_('documents.recreatePrompt')),
      icon: 'pi pi-refresh',
      acceptLabel: this.translateService.instant(_('common.yes')),
      rejectLabel: this.translateService.instant(_('common.no')),
      accept: () => {
        this.promptDialogVisible.set(false);
        this.onGeneratePrompt();
      },
    });
  }

  private doCreateDocument(documentChatSystemPrompt?: string): void {
    const title = this.newDocumentTitle().trim();
    const description = this.newDocumentDescription().trim();
    const workspaceId = this.workspaceId();
    if (!title || !workspaceId) return;
    this.promptDialogVisible.set(false);
    this.loading.set(true);
    this.error.set(null);
    this.documentsService
      .createDocument(workspaceId, {
        title,
        description: description || undefined,
        documentChatSystemPrompt: documentChatSystemPrompt || undefined,
        promptCategoryId: documentChatSystemPrompt ? undefined : (this.selectedPromptCategoryId() ?? undefined),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.showCreateForm.set(false);
          this.newDocumentTitle.set('');
          this.newDocumentDescription.set('');
          this.contextMarkdown.set('');
          this.selectedPromptCategoryId.set(null);
          this.clearPromptDialogState();
          this.error.set(null);
          this.loadDocuments();
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant(_('common.success')),
            detail: this.translateService.instant(_('documents.updateSuccess')),
          });
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(
            err?.error?.message ??
              this.translateService.instant(_('documents.createError')),
          );
        },
      });
  }

  createDocument(): void {
    const title = this.newDocumentTitle().trim();
    if (!title) {
      this.error.set(this.translateService.instant(_('documents.titleRequired')));
      return;
    }

    const workspaceId = this.workspaceId();
    if (!workspaceId) {
      this.error.set(this.translateService.instant(_('documents.workspaceIdNotFound')));
      console.error('Workspace ID is missing');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.documentsService
      .createDocument(workspaceId, {
        title,
        description: this.newDocumentDescription() || undefined,
        promptCategoryId: this.selectedPromptCategoryId() ?? undefined,
      })
      .subscribe({
      next: () => {
        this.loading.set(false);
        this.showCreateForm.set(false);
        this.newDocumentTitle.set('');
        this.newDocumentDescription.set('');
        this.selectedPromptCategoryId.set(null);
        this.error.set(null);
        this.loadDocuments();
      },
      error: (err) => {
        this.loading.set(false);
        const errorMessage = err.error?.message || err.message || this.translateService.instant(_('documents.createError'));
        this.error.set(errorMessage);
      },
    });
  }

  confirmDelete(doc: Document): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('documents.confirmDeleteMessage'), { title: doc.title }),
      header: this.translateService.instant(_('documents.confirmDelete')),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant(_('common.delete')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.deleteDocument(doc.id);
      },
    });
  }

  deleteDocument(docId: string): void {
    this.deletingDocId.set(docId);
    this.documentsService.deleteDocument(this.workspaceId(), docId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('documents.deleteSuccess')),
        });
        this.deletingDocId.set(null);
        this.selectedDocument.set(null);
        this.loadDocuments();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('documents.deleteError')),
        });
        this.deletingDocId.set(null);
      },
    });
  }

  onDocumentContextMenu(event: MouseEvent, doc: Document): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedDocForContext.set(doc);
    this.documentContextMenuRef()?.show(event);
  }

  private buildDocumentMenu(doc: Document | null): MenuItem[] {
    if (!doc) return [];
    const wsId = this.workspaceId();
    if (!wsId) return [];
    const t = (key: string) => this.translateService.instant(_(key));
    return [
      {
        label: t('contextMenu.documents.open'),
        icon: 'pi pi-folder-open',
        command: () => {
          this.router.navigate(workspaceDocument(wsId, doc.id));
        },
      },
      {
        label: t('contextMenu.documents.chat'),
        icon: 'pi pi-comments',
        command: () => {
          this.documentViewTabService.requestTab('2');
          this.router.navigate(workspaceDocument(wsId, doc.id));
        },
      },
      {
        label: t('contextMenu.documents.redline'),
        icon: 'pi pi-file-edit',
        command: () => {
          this.documentViewTabService.requestTab('1');
          this.router.navigate(workspaceDocument(wsId, doc.id));
        },
      },
      { separator: true },
      {
        label: t('contextMenu.documents.delete'),
        icon: 'pi pi-trash',
        command: () => {
          this.confirmDelete(doc);
        },
      },
    ];
  }
}
