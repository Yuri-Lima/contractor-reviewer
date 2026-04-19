import {
  Component,
  input,
  output,
  signal,
  effect,
  inject,
  PLATFORM_ID,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';

export interface TextSelection {
  text: string;
  pageNumber?: number;
  spanId?: string;
}

@Component({
  selector: 'app-docx-viewer',
  standalone: true,
  imports: [CommonModule, TranslatePipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-auto max-h-[70vh] text-gray-800 dark:text-gray-200 text-sm leading-relaxed select-text docx-content"
      (mouseup)="onTextSelection()"
    >
      @if (loading()) {
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          {{ 'documentViewer.loading' | translate }}
        </div>
      }
      @if (error()) {
        <div class="text-center py-8">
          <p class="text-red-600 dark:text-red-400 mb-3">{{ error() | translate }}</p>
          <p-button
            [label]="'common.retry' | translate"
            icon="pi pi-refresh"
            size="small"
            (onClick)="retry()"
          />
        </div>
      }
      @if (!loading() && !error() && renderedHtml()) {
        <div [innerHTML]="renderedHtml()"></div>
      }
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .docx-content h1,
      :host ::ng-deep .docx-content h2,
      :host ::ng-deep .docx-content h3 {
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: 600;
      }
      :host ::ng-deep .docx-content p {
        margin-bottom: 0.75em;
        line-height: 1.6;
      }
    `,
  ],
})
export class DocxViewerComponent {
  private sanitizer = inject(DomSanitizer);
  private platformId = inject(PLATFORM_ID);

  blob = input<Blob | null>(null);
  blobUrl = input<string>('');
  fileName = input<string>('');

  textSelected = output<TextSelection>();

  loading = signal(true);
  error = signal<string | null>(null);
  renderedHtml = signal<SafeHtml | null>(null);

  constructor() {
    effect(() => {
      const blob = this.blob();
      const url = this.blobUrl();
      if (!isPlatformBrowser(this.platformId)) return;
      if (blob || url) {
        this.loadDocx();
      }
    });
  }

  retry(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    void this.loadDocx();
  }

  private async loadDocx(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.renderedHtml.set(null);

    let arrayBuffer: ArrayBuffer;
    try {
      const blob = this.blob();
      if (blob) {
        arrayBuffer = await blob.arrayBuffer();
      } else {
        const url = this.blobUrl();
        if (!url) {
          throw new Error('No document source provided');
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        arrayBuffer = await response.arrayBuffer();
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('docx-viewer: failed to load source', detail);
      this.error.set('documentViewer.docxFetchError');
      this.loading.set(false);
      return;
    }

    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;
      this.renderedHtml.set(
        html ? this.sanitizer.bypassSecurityTrustHtml(html) : null
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('docx-viewer: failed to parse docx', detail);
      this.error.set('documentViewer.docxParseError');
    } finally {
      this.loading.set(false);
    }
  }

  onTextSelection(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString().trim();
    if (!text) return;
    this.textSelected.emit({ text });
    setTimeout(() => selection.removeAllRanges(), 100);
  }
}
