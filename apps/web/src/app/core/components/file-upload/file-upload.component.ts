import {
  Component,
  input,
  output,
  viewChild,
  ElementRef,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ButtonSeverity } from 'primeng/button';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

export type FileUploadTrigger = 'button' | 'area';
export type FileUploadSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<FileUploadSize, string> = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

/**
 * Reusable file upload component supporting button or clickable-area triggers.
 * Emits fileSelected(File) for single file; filesSelected(File[]) when multiple=true.
 * Parent handles upload logic.
 */
@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, Button, TooltipModule, TranslatePipe],
  template: `
    <input
      #fileInputRef
      type="file"
      [attr.accept]="accept()"
      [attr.multiple]="multiple() ? '' : null"
      class="hidden"
      (change)="onFileChange($event)"
    />
    @if (trigger() === 'button') {
      <div class="flex gap-2">
        <p-button
          [attr.data-tour]="dataTour() ?? undefined"
          [label]="labelKey() ? (labelKey() | translate) : undefined"
          [icon]="icon() ?? 'pi pi-upload'"
          [severity]="buttonSeverity()"
          [outlined]="buttonOutlined()"
          [size]="buttonSize()"
          [loading]="loading()"
          [disabled]="disabled()"
          (onClick)="triggerFileInput()"
          [pTooltip]="tooltipKey() ? (tooltipKey() | translate) : undefined"
        />
        @if (showRemove()) {
          <p-button
            [label]="removeLabelKey() ? (removeLabelKey() | translate) : undefined"
            [icon]="removeIcon() ?? 'pi pi-user-minus'"
            [outlined]="true"
            severity="secondary"
            [loading]="loadingRemove()"
            [disabled]="loadingRemove()"
            (onClick)="removeClicked.emit()"
            [pTooltip]="removeTooltipKey() ? (removeTooltipKey() | translate) : undefined"
          />
        }
      </div>
    }
    @if (trigger() === 'area') {
      <div
        class="file-upload-area flex-shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors overflow-hidden relative"
        [class]="sizeClasses()"
        [class.cursor-pointer]="!loading() && !disabled()"
        [class.cursor-not-allowed]="loading() || disabled()"
        [class.pointer-events-none]="loading() || disabled()"
        [class.opacity-60]="loading()"
        (click)="triggerFileInput(); $event.stopPropagation()"
        [pTooltip]="tooltipKey() ? (tooltipKey() | translate) : undefined"
      >
        @if (loading()) {
          <i class="pi pi-spin pi-spinner text-xl text-blue-600 dark:text-blue-400"></i>
        } @else if (imageUrl()) {
          <img
            [src]="imageUrl()"
            alt=""
            class="w-full h-full object-cover rounded-lg"
          />
        } @else {
          <i
            class="text-xl text-blue-600 dark:text-blue-400"
            [class]="placeholderIcon() ?? 'pi pi-image'"
          ></i>
        }
        @if (!loading()) {
          <div
            class="file-upload-overlay absolute inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <i class="pi pi-upload text-white text-lg"></i>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .file-upload-area {
        position: relative;
      }
    `,
  ],
})
export class FileUploadComponent {
  private fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInputRef');

  /** UI style: button or clickable area */
  trigger = input<FileUploadTrigger>('button');

  /** HTML accept attribute (e.g. IMAGE_ASSET_INPUT_ACCEPT, FILE_INPUT_ACCEPT) */
  accept = input<string>('');

  /** i18n key for button label (when trigger='button') */
  labelKey = input<string | undefined>(undefined);

  /** Button icon class */
  icon = input<string | undefined>(undefined);

  /** i18n key for tooltip */
  tooltipKey = input<string | undefined>(undefined);

  /** Loading state for upload button */
  loading = input<boolean>(false);

  /** Disabled state */
  disabled = input<boolean>(false);

  /** Show remove button (button mode only) */
  showRemove = input<boolean>(false);

  /** Loading state for remove button */
  loadingRemove = input<boolean>(false);

  /** i18n key for remove button label */
  removeLabelKey = input<string | undefined>(undefined);

  /** Remove button icon */
  removeIcon = input<string | undefined>(undefined);

  /** i18n key for remove button tooltip */
  removeTooltipKey = input<string | undefined>(undefined);

  /** Button severity (when trigger='button') */
  buttonSeverity = input<ButtonSeverity>('secondary');

  /** Button outlined style */
  buttonOutlined = input<boolean>(false);

  /** Button size */
  buttonSize = input<'small' | 'large' | undefined>(undefined);

  /** Optional data-tour attribute */
  dataTour = input<string | undefined>(undefined);

  /** For trigger='area': preview image URL */
  imageUrl = input<string | null | undefined>(undefined);

  /** For trigger='area': placeholder icon when no image */
  placeholderIcon = input<string | undefined>(undefined);

  /** For trigger='area': size variant */
  size = input<FileUploadSize>('md');

  /** Enable multi-file selection; when true, filesSelected is used instead of fileSelected */
  multiple = input<boolean>(false);

  fileSelected = output<File>();
  filesSelected = output<File[]>();
  removeClicked = output<void>();

  protected sizeClasses = computed(() => SIZE_CLASSES[this.size()]);

  protected triggerFileInput(): void {
    this.fileInputRef().nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    const fileList = Array.from(files);
    input.value = '';
    if (this.multiple()) {
      this.filesSelected.emit(fileList);
    } else {
      this.fileSelected.emit(fileList[0]!);
    }
  }
}
