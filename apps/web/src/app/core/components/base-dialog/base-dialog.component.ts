import {
  Component,
  input,
  output,
  contentChild,
  computed,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import type { DialogFooterButton } from './base-dialog.types';

/**
 * Reusable base dialog wrapping PrimeNG p-dialog with consistent styling.
 *
 * Design: Config-driven default, projection for exceptions.
 * - Primary: Use message + footerButtons for same style everywhere.
 * - Secondary: Use bodyTemplate and/or footerTemplate for specific cases (forms, tabs, custom layout).
 */
@Component({
  selector: 'app-base-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      [header]="header()"
      [modal]="modal()"
      [closable]="closable()"
      [style]="{ width: width(), maxHeight: maxHeight() }"
      [contentStyle]="{ overflow: 'auto' }"
      [baseZIndex]="10000"
      [appendTo]="appendTo() ?? 'body'"
      [ariaLabel]="ariaLabel() || header()"
      (onHide)="onHide()"
    >
      <div [class]="'base-dialog-content p-4 ' + (contentClass() || '')">
        @if (bodyTemplate()) {
          <ng-container *ngTemplateOutlet="bodyTemplate()!"></ng-container>
        } @else {
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ message() }}</p>
        }
      </div>

      @if (showFooter()) {
        <ng-template #footer pTemplate="footer">
          <div class="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 min-h-[52px] items-center">
            @if (footerTemplate()) {
              <ng-container *ngTemplateOutlet="footerTemplate()!"></ng-container>
            } @else {
              @for (btn of footerButtons(); track $index) {
                <p-button
                  [label]="btn.label"
                  [icon]="btn.icon"
                  [severity]="btn.severity"
                  [outlined]="btn.outlined ?? false"
                  [disabled]="btn.disabled ?? false"
                  [loading]="btn.loading ?? false"
                  (onClick)="onFooterButtonClick(btn)"
                ></p-button>
              }
            }
          </div>
        </ng-template>
      }
    </p-dialog>
  `,
  styles: [
    `
      :host ::ng-deep .p-dialog-footer {
        display: flex !important;
        flex-shrink: 0;
      }
      :host ::ng-deep .p-dialog-footer .p-button {
        flex-shrink: 0;
      }
    `,
  ],
})
export class BaseDialogComponent {
  visible = input.required<boolean>();
  header = input<string>('');
  message = input<string>('');
  width = input<string>('min(95vw, 600px)');
  maxHeight = input<string>('85vh');
  closable = input<boolean>(true);
  modal = input<boolean>(true);
  appendTo = input<'body' | null>('body');
  ariaLabel = input<string>('');
  footerButtons = input<DialogFooterButton[]>([]);
  contentClass = input<string>('');

  closed = output<void>();
  buttonClicked = output<{ key: string }>();

  bodyTemplate = contentChild<TemplateRef<unknown>>('bodyTemplate');
  footerTemplate = contentChild<TemplateRef<unknown>>('footerTemplate');

  showFooter = computed(() => {
    const ft = this.footerTemplate();
    const btns = this.footerButtons();
    return !!ft || (Array.isArray(btns) && btns.length > 0);
  });

  onHide(): void {
    this.closed.emit();
  }

  onFooterButtonClick(btn: DialogFooterButton): void {
    if (btn.action === 'close') {
      this.closed.emit();
    } else if (btn.action === 'emit' && btn.emitKey) {
      this.buttonClicked.emit({ key: btn.emitKey });
    }
  }
}
