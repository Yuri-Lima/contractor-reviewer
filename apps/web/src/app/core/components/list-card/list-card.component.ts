import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { Toolbar } from 'primeng/toolbar';
import { Button } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import type { ListToolbarConfig } from './list-card.config';

/**
 * Reusable wrapper for list content with consistent card styling.
 * Provides p-card + div.p-4 structure used across workspace-members, audit, and document-view.
 * Optionally renders Add/Delete toolbar buttons when toolbarConfig is provided.
 */
@Component({
  selector: 'app-list-card',
  standalone: true,
  imports: [CommonModule, Card, Toolbar, Button, TranslatePipe],
  template: `
    <p-card
      [class]="cardClass()"
      [attr.data-tour]="dataTour() ?? undefined"
    >
      <div class="p-4">
        @if (toolbarConfig()) {
          <p-toolbar class="mb-4">
            <ng-template pTemplate="start">
              <div class="flex gap-2">
                @if (toolbarConfig()?.showAddButton) {
                  <p-button
                    [attr.data-tour]="toolbarConfig()?.addButtonDataTour ?? undefined"
                    [label]="(toolbarConfig()?.addButtonLabelKey || 'common.add') | translate"
                    [icon]="toolbarConfig()?.addButtonIcon || 'pi pi-plus'"
                    (onClick)="toolbarConfig()?.onAdd?.()"
                  ></p-button>
                }
                @if (toolbarConfig()?.showDeleteButton) {
                  <p-button
                    [label]="(toolbarConfig()?.deleteButtonLabelKey || 'common.delete') | translate"
                    [icon]="toolbarConfig()?.deleteButtonIcon || 'pi pi-trash'"
                    severity="danger"
                    [disabled]="toolbarConfig()?.isDeleteDisabled?.() ?? true"
                    (onClick)="toolbarConfig()?.onDelete?.()"
                  ></p-button>
                }
              </div>
            </ng-template>
          </p-toolbar>
        }
        <ng-content></ng-content>
      </div>
    </p-card>
  `,
})
export class ListCardComponent {
  /** CSS classes for the p-card (default: mt-4) */
  cardClass = input<string>('mt-4');

  /** Optional data-tour attribute for guided tours */
  dataTour = input<string | undefined>(undefined);

  /** Optional toolbar config: show Add/Delete buttons with handlers */
  toolbarConfig = input<ListToolbarConfig | undefined>(undefined);
}
