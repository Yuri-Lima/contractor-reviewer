import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../../core/services/api.service';
import { TranslatePipe } from '@ngx-translate/core';
import { DocumentFile } from '@contractai-review/shared';
import { contentToHtml } from '../../core/utils/content-transformer';


@Component({
  selector: 'app-file-content-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, Button, TooltipModule, MessageModule, TranslatePipe],
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
          <div
            class="file-content-rendered p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-auto max-h-[60vh] text-gray-800 dark:text-gray-200 text-sm leading-relaxed select-text"
            [innerHTML]="renderedHtml()"
          ></div>
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
  `,
  styles: [
    `
      .file-content-dialog {
        min-height: 120px;
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

  /** The file to show content for. When null, dialog is closed. */
  file = input<DocumentFile | null>(null);
  /** Workspace ID for API calls */
  workspaceId = input.required<string>();
  /** Document ID for API calls */
  documentId = input.required<string>();

  closed = output<void>();

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

  constructor() {
    effect(() => {
      const f = this.file();
      const wsId = this.workspaceId();
      const docId = this.documentId();
      if (f && wsId && docId) {
        this.loadContent(f.id, wsId, docId);
      } else {
        this.rawContent.set('');
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

  onClose(): void {
    this.closed.emit();
  }
}
