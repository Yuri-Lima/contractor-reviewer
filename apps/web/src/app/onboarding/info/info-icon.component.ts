import { Component, Input, inject, viewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Popover } from 'primeng/popover';
import { Dialog } from 'primeng/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { INFO_REGISTRY } from './info.registry';

@Component({
  selector: 'app-info-icon',
  standalone: true,
  imports: [CommonModule, RouterModule, Popover, Dialog, TranslatePipe],
  template: `
    <button
      type="button"
      [attr.data-testid]="'onboarding-info-icon-' + infoKey"
      class="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      (click)="togglePopover($event)"
      [attr.aria-label]="ariaLabel()"
    >
      <i class="pi pi-info-circle text-xs"></i>
    </button>
    <p-popover
      #popover
      [appendTo]="'body'"
      (onHide)="onPopoverHide()"
    >
      <div data-testid="onboarding-info-popover" class="p-2 max-w-xs">
        <h4 class="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-2">
          {{ entry()?.titleKey | translate }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">
          {{ entry()?.shortKey | translate }}
        </p>
        @if (entry()?.links && entry()!.links!.length > 0) {
          <button
            type="button"
            data-testid="onboarding-info-learn-more"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            (click)="openLearnMore()"
          >
            {{ entry()!.links![0].labelKey | translate }}
          </button>
        }
      </div>
    </p-popover>
    <p-dialog
      [header]="entry()?.titleKey | translate"
      [visible]="showPanel()"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '400px' }"
      (onHide)="closePanel()"
      [draggable]="false"
      [resizable]="false"
      styleClass="onboarding-info-dialog"
    >
      <div data-testid="onboarding-info-dialog-content">
      @if (entry()?.longKeys && entry()!.longKeys!.length > 0) {
        <div class="space-y-2">
          @for (key of entry()!.longKeys; track key) {
            <p class="text-sm text-gray-700 dark:text-gray-300">{{ key | translate }}</p>
          }
        </div>
      } @else {
        <p class="text-sm text-gray-700 dark:text-gray-300">{{ entry()?.shortKey | translate }}</p>
      }
      @if (entry()?.links && entry()!.links!.length > 0) {
        <div class="mt-4">
          @for (link of entry()!.links; track link.labelKey) {
            @if (link.route) {
              <a
                [routerLink]="link.route"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                (click)="closePanel()"
              >
                {{ link.labelKey | translate }}
              </a>
            }
          }
        </div>
      }
      </div>
    </p-dialog>
  `,
})
export class InfoIconComponent {
  private router = inject(Router);
  private translate = inject(TranslateService);

  @Input({ required: true }) infoKey!: string;

  popover = viewChild<Popover>('popover');
  showPanel = signal(false);

  entry = computed(() => {
    const key = this.infoKey;
    return key ? INFO_REGISTRY[key] ?? null : null;
  });

  ariaLabel = computed(() => {
    const e = this.entry();
    if (!e) return this.translate.instant('onboarding.info.ariaLabelGeneric');
    const title = this.translate.instant(e.titleKey);
    return this.translate.instant('onboarding.info.ariaLabel', { title });
  });

  togglePopover(event: Event): void {
    const p = this.popover();
    if (p) {
      p.toggle(event);
    }
  }

  onPopoverHide(): void {
    // Popover closed
  }

  openLearnMore(): void {
    const p = this.popover();
    if (p) {
      p.hide();
    }
    this.showPanel.set(true);
  }

  closePanel(): void {
    this.showPanel.set(false);
  }
}
