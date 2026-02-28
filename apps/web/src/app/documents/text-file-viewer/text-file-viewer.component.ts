import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { contentToHtml } from '../../core/utils/content-transformer';

export interface TextSelection {
  text: string;
  pageNumber?: number;
  spanId?: string;
}

@Component({
  selector: 'app-text-file-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-auto max-h-[70vh] text-gray-800 dark:text-gray-200 text-sm leading-relaxed select-text"
      (mouseup)="onTextSelection()"
    >
      @if (isMarkdown()) {
        <div
          class="rendered-content"
          [innerHTML]="renderedHtml()"
        ></div>
      } @else {
        <pre class="whitespace-pre-wrap font-sans">{{ content() }}</pre>
      }
    </div>
  `,
  styles: [
    `
      .rendered-content h1,
      .rendered-content h2,
      .rendered-content h3 {
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: 600;
      }
      .rendered-content p {
        margin-bottom: 0.75em;
        line-height: 1.6;
      }
    `,
  ],
})
export class TextFileViewerComponent {
  private sanitizer = inject(DomSanitizer);
  private platformId = inject(PLATFORM_ID);

  content = input.required<string>();
  fileName = input<string>('');

  textSelected = output<TextSelection>();

  isMarkdown = () => /\.(md|markdown)$/i.test(this.fileName());

  renderedHtml = (): SafeHtml => {
    const html = contentToHtml(this.content());
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : '';
  };

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
