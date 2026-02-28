import {
  Component,
  input,
  output,
  signal,
  effect,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import { getViewerFormat, type ViewerFormat } from '@contractai-review/shared';
import type { DocumentFile } from '@contractai-review/shared';
import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';

export interface DocumentViewerTextSelection {
  text: string;
  pageNumber?: number;
  spanId?: string;
}
import { ImageViewerComponent } from '../image-viewer/image-viewer.component';
import { TextFileViewerComponent } from '../text-file-viewer/text-file-viewer.component';
import { DocxViewerComponent } from '../docx-viewer/docx-viewer.component';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [
    CommonModule,
    Button,
    TranslatePipe,
    PdfViewerComponent,
    ImageViewerComponent,
    TextFileViewerComponent,
    DocxViewerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="p-4 text-center text-gray-500 dark:text-gray-400">
        {{ 'documentViewer.loading' | translate }}
      </div>
    } @else if (format() === 'pdf' && blobUrl()) {
      <app-pdf-viewer
        [fileUrl]="blobUrl()!"
        [fileName]="file()?.fileName ?? ''"
        (textSelected)="textSelected.emit($event)"
      />
    } @else if (format() === 'image' && blobUrl()) {
      <app-image-viewer
        [blobUrl]="blobUrl()!"
        [fileName]="file()?.fileName ?? ''"
      />
    } @else if (format() === 'text' && textContent() !== null) {
      <app-text-file-viewer
        [content]="textContent() ?? ''"
        [fileName]="file()?.fileName ?? ''"
        (textSelected)="textSelected.emit($event)"
      />
    } @else if (format() === 'docx' && blobUrl()) {
      <app-docx-viewer
        [blobUrl]="blobUrl()!"
        [fileName]="file()?.fileName ?? ''"
        (textSelected)="textSelected.emit($event)"
      />
    } @else if (format() === 'doc' || format() === 'audio' || format() === 'unsupported') {
      <div class="p-4 text-center">
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {{ 'documentViewer.previewNotAvailable' | translate }}
          {{ 'documentViewer.downloadToView' | translate }}
        </p>
        <p-button
          [label]="'common.download' | translate"
          icon="pi pi-download"
          (onClick)="downloadRequested.emit()"
        />
      </div>
    }
  `,
})
export class DocumentViewerComponent {
  file = input<DocumentFile | null>(null);
  blobUrl = input<string | null>(null);
  textContent = input<string | null>(null);
  loading = input(false);

  textSelected = output<DocumentViewerTextSelection>();
  downloadRequested = output<void>();

  private detectedFormat = signal<ViewerFormat | null>(null);

  format = computed(() => {
    const f = this.detectedFormat();
    if (f) return f;
    const meta = this.file();
    if (!meta) return 'unsupported' as ViewerFormat;
    const detected =
      meta.detectedExt && meta.detectedMime
        ? { ext: meta.detectedExt, mime: meta.detectedMime }
        : undefined;
    return getViewerFormat(detected, {
      fileName: meta.fileName,
      mimeType: meta.mimeType,
    });
  });

  constructor() {
    effect(() => {
      const fileMeta = this.file();
      if (!fileMeta) {
        this.detectedFormat.set(null);
        return;
      }
      const meta = { fileName: fileMeta.fileName, mimeType: fileMeta.mimeType };
      const detected =
        fileMeta.detectedExt && fileMeta.detectedMime
          ? { ext: fileMeta.detectedExt, mime: fileMeta.detectedMime }
          : undefined;
      this.detectedFormat.set(getViewerFormat(detected, meta));
    });
  }
}
