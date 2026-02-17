import { Component, input, output, signal, effect, viewChild, ElementRef, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

export interface TextSelection {
  text: string;
  pageNumber: number;
  spanId?: string;
}

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule, Button, TooltipModule, TranslatePipe],
  template: `
    <div class="pdf-viewer-container bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="pdf-viewer-controls flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <p-button
            icon="pi pi-chevron-left"
            [text]="true"
            [disabled]="currentPage() <= 1"
            (onClick)="previousPage()"
            severity="secondary"
            [outlined]="true"
            [pTooltip]="'tooltip.prevPage' | translate"
          ></p-button>
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Página {{ currentPage() }} de {{ totalPages() }}
          </span>
          <p-button
            icon="pi pi-chevron-right"
            [text]="true"
            [disabled]="currentPage() >= totalPages()"
            (onClick)="nextPage()"
            severity="secondary"
            [outlined]="true"
            [pTooltip]="'tooltip.nextPage' | translate"
          ></p-button>
        </div>
        <div class="flex items-center gap-2">
          <p-button
            icon="pi pi-minus"
            [text]="true"
            [disabled]="scale() <= 0.5"
            (onClick)="zoomOut()"
            severity="secondary"
            [outlined]="true"
            [pTooltip]="'tooltip.zoomOut' | translate"
          ></p-button>
          <span class="text-sm text-gray-700 dark:text-gray-300 min-w-[60px] text-center">
            {{ Math.round(scale() * 100) }}%
          </span>
          <p-button
            icon="pi pi-plus"
            [text]="true"
            [disabled]="scale() >= 3"
            (onClick)="zoomIn()"
            severity="secondary"
            [outlined]="true"
            [pTooltip]="'tooltip.zoomIn' | translate"
          ></p-button>
          <p-button
            icon="pi pi-refresh"
            [text]="true"
            (onClick)="resetZoom()"
            severity="secondary"
            [outlined]="true"
            [pTooltip]="'tooltip.zoomReset' | translate"
          ></p-button>
        </div>
      </div>
      <div class="pdf-viewer-content overflow-auto bg-gray-100 dark:bg-gray-900 p-4" style="max-height: 70vh;" (mouseup)="onTextSelection()">
        <canvas #canvasRef class="mx-auto shadow-lg"></canvas>
      </div>
      @if (loading()) {
        <div class="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Carregando PDF...
        </div>
      }
      @if (error()) {
        <div class="p-4 text-center text-sm text-red-600 dark:text-red-400">
          {{ error() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .pdf-viewer-container {
      display: flex;
      flex-direction: column;
    }
    .pdf-viewer-content {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    canvas {
      display: block;
      max-width: 100%;
      height: auto;
    }
  `],
})
export class PdfViewerComponent {
  private platformId = inject(PLATFORM_ID);
  private translateService = inject(TranslateService);
  
  // Inputs
  fileUrl = input.required<string>();
  fileName = input<string>('');

  // Outputs
  textSelected = output<TextSelection>();

  // ViewChild
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasRef');

  // State
  currentPage = signal(1);
  totalPages = signal(0);
  scale = signal(1.0);
  loading = signal(false);
  error = signal<string | null>(null);

  // Expose Math to template
  Math = Math;

  private pdfDoc: any = null;
  private pdfjsLib: any = null;

  constructor() {
    effect(() => {
      const url = this.fileUrl();
      if (url && isPlatformBrowser(this.platformId)) {
        this.loadPdf();
      }
    });

    effect(() => {
      const page = this.currentPage();
      const scaleValue = this.scale();
      if (page > 0 && this.pdfDoc) {
        this.renderPage(page, scaleValue);
      }
    });
  }

  async loadPdf(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      this.loading.set(true);
      this.error.set(null);

      // Dynamic import of pdfjs-dist
      if (!this.pdfjsLib) {
        this.pdfjsLib = await import('pdfjs-dist');
        // Set worker
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${this.pdfjsLib.version}/pdf.worker.min.js`;
      }

      const loadingTask = this.pdfjsLib.getDocument(this.fileUrl());
      this.pdfDoc = await loadingTask.promise;
      this.totalPages.set(this.pdfDoc.numPages);
      this.currentPage.set(1);
      this.loading.set(false);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      this.error.set(err.message || this.translateService.instant('documents.loadPdfError'));
      this.loading.set(false);
    }
  }

  async renderPage(pageNum: number, scaleValue: number): Promise<void> {
    if (!this.pdfDoc || !isPlatformBrowser(this.platformId)) return;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: scaleValue });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
      this.error.set(this.translateService.instant('documents.renderPageError'));
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  zoomIn(): void {
    this.scale.update(s => Math.min(s + 0.25, 3));
  }

  zoomOut(): void {
    this.scale.update(s => Math.max(s - 0.25, 0.5));
  }

  resetZoom(): void {
    this.scale.set(1.0);
  }

  onTextSelection(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Emit selection event
    this.textSelected.emit({
      text: selectedText,
      pageNumber: this.currentPage(),
      spanId: undefined, // Can be enhanced later with text layer positioning
    });

    // Clear selection after a short delay
    setTimeout(() => {
      selection.removeAllRanges();
    }, 100);
  }
}
