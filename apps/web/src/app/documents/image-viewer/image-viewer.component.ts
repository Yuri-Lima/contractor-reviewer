import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex justify-center p-4">
      <img
        [src]="blobUrl()"
        [alt]="fileName()"
        class="max-w-full h-auto object-contain rounded-lg shadow"
        style="max-height: 70vh;"
      />
    </div>
  `,
})
export class ImageViewerComponent {
  blobUrl = input.required<string>();
  fileName = input<string>('');
}
