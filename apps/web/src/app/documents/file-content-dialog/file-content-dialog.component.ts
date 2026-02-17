import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { Popover } from 'primeng/popover';
import { ApiService } from '../../core/services/api.service';
import { TranslatePipe } from '@ngx-translate/core';
import { DocumentFile } from '@contractai-review/shared';
import { contentToHtml } from '../../core/utils/content-transformer';


@Component({
  selector: 'app-file-content-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, Button, TooltipModule, MessageModule, Popover, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      [header]="fileName()"
      [modal]="true"
      [style]="{ width: 'min(95vw, 1100px)' }"
      [contentStyle]="{ overflow: 'hidden', maxHeight: '70vh' }"
      [baseZIndex]="10000"
      (onHide)="onClose()"
    >
      <div class="file-content-dialog">
        @if (loading()) {
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            {{ 'documentContent.loading' | translate }}
          </div>
        }
        @if (error()) {
          <p-message
            severity="error"
            [text]="'documentContent.error' | translate"
          ></p-message>
        }
        @if (!loading() && !error() && !hasContent()) {
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            {{ 'documentContent.notProcessed' | translate }}
          </div>
        }
        @if (!loading() && !error() && hasContent()) {
          <div class="dialog-body flex gap-4 min-h-0">
            <div
              class="file-content-rendered flex-1 min-w-0 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-auto max-h-[60vh] text-gray-800 dark:text-gray-200 text-sm leading-relaxed select-text"
              [innerHTML]="renderedHtml()"
              (mouseup)="onContentMouseUp($event)"
            ></div>
            <div class="selections-panel w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 pl-4 overflow-auto max-h-[60vh]">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {{ 'redline.selectionsForRedline' | translate }}
              </h4>
              @if (selections().length === 0) {
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ 'redline.selectionsEmpty' | translate }}
                </p>
              } @else {
                <ul class="space-y-2 list-none p-0 m-0">
                  @for (item of selections(); track $index) {
                    <li class="flex gap-2 items-start p-2 rounded bg-gray-100 dark:bg-gray-800">
                      <span class="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 break-words" [title]="item">
                        {{ truncate(item, 60) }}
                      </span>
                      <p-button
                        icon="pi pi-times"
                        [text]="true"
                        [rounded]="true"
                        severity="secondary"
                        size="small"
                        (onClick)="removeSelection($index)"
                        [attr.aria-label]="'common.delete' | translate"
                      ></p-button>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button
          [label]="'common.close' | translate"
          icon="pi pi-times"
          (onClick)="onClose()"
          [pTooltip]="'tooltip.close' | translate"
        ></p-button>
      </ng-template>
    </p-dialog>

    <p-popover
      #selectionPopover
      [appendTo]="'body'"
      [baseZIndex]="10001"
      (onHide)="selectionForPopover.set(null)"
    >
      @if (selectionForPopover()) {
        <div class="p-3 space-y-3 min-w-[200px] max-w-[320px]">
          <p class="text-sm text-gray-700 dark:text-gray-300 break-words">
            "{{ truncate(selectionForPopover()!, 80) }}"
          </p>
          <p-button
            [label]="'redline.addToSelections' | translate"
            icon="pi pi-plus"
            size="small"
            (onClick)="addSelection()"
            [pTooltip]="'redline.addToSelections' | translate"
          ></p-button>
        </div>
      }
    </p-popover>
  `,
  styles: [
    `
      .file-content-dialog {
        min-height: 120px;
      }
      .dialog-body {
        display: flex;
      }
      .select-text {
        user-select: text;
      }
      :host ::ng-deep .file-content-rendered h1,
      :host ::ng-deep .file-content-rendered h2,
      :host ::ng-deep .file-content-rendered h3 {
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: 600;
      }
      :host ::ng-deep .file-content-rendered p {
        margin-bottom: 0.75em;
        line-height: 1.6;
      }
    `,
  ],
})
export class FileContentDialogComponent {
  private apiService = inject(ApiService);
  private sanitizer = inject(DomSanitizer);

  selectionPopover = viewChild<Popover>('selectionPopover');

  /** The file to show content for. When null, dialog is closed. */
  file = input<DocumentFile | null>(null);
  /** Workspace ID for API calls */
  workspaceId = input.required<string>();
  /** Document ID for API calls */
  documentId = input.required<string>();

  closed = output<void>();
  closedWithSelections = output<string[]>();

  visible = computed(() => this.file() != null);
  fileName = computed(() => this.file()?.fileName ?? '');
  loading = signal(false);
  error = signal(false);
  rawContent = signal<string>('');
  hasContent = computed(() => (this.rawContent() ?? '').trim().length > 0);
  renderedHtml = computed<SafeHtml>(() => {
    const html = contentToHtml(this.rawContent());
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : '';
  });

  selections = signal<string[]>([]);
  selectionForPopover = signal<string | null>(null);

  constructor() {
    effect(() => {
      const f = this.file();
      const wsId = this.workspaceId();
      const docId = this.documentId();
      if (f && wsId && docId) {
        this.selections.set([]);
        this.loadContent(f.id, wsId, docId);
      } else {
        this.rawContent.set('');
        this.selections.set([]);
        this.loading.set(false);
        this.error.set(false);
      }
    });
  }

  private loadContent(fileId: string, workspaceId: string, documentId: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.rawContent.set('');

    this.apiService.getFileContent(workspaceId, documentId, fileId).subscribe({
      next: (data) => {
        this.rawContent.set(data.content ?? '');
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  onContentMouseUp(event: MouseEvent): void {
    const selection = window.getSelection();
    const text = selection?.toString()?.trim();
    if (!text || text.length === 0) return;
    this.selectionForPopover.set(text);
    const popover = this.selectionPopover();
    if (popover) {
      popover.show(event);
    }
  }

  addSelection(): void {
    const text = this.selectionForPopover();
    if (text) {
      this.selections.update((arr) => [...arr, text]);
      this.selectionForPopover.set(null);
      const popover = this.selectionPopover();
      if (popover) {
        popover.hide();
      }
      window.getSelection()?.removeAllRanges();
    }
  }

  removeSelection(index: number): void {
    this.selections.update((arr) => arr.filter((_, i) => i !== index));
  }

  truncate(s: string, maxLen: number): string {
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '...';
  }

  onClose(): void {
    const sel = this.selections();
    if (sel.length > 0) {
      this.closedWithSelections.emit([...sel]);
    }
    this.closed.emit();
  }
}
