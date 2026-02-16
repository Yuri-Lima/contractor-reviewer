import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { TranslatePipe } from '@ngx-translate/core';
import { OnboardingService } from '../onboarding.service';
import { TourService } from '../tour/tour.service';
import { CHECKLIST_CONFIG } from './checklist-config';

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule, ProgressBar, TranslatePipe],
  template: `
    <div
      data-testid="onboarding-checklist"
      class="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl transition-all duration-200"
    >
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="font-semibold text-gray-800 dark:text-gray-100">
          {{ 'onboarding.checklistTitle' | translate }}
        </h3>
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-testid="onboarding-checklist-start-tour-btn"
            class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            (click)="startTour()"
            [attr.aria-label]="'onboarding.startTour' | translate"
          >
            <i class="pi pi-play text-sm"></i>
          </button>
          <button
            type="button"
            data-testid="onboarding-checklist-dismiss-btn"
            class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            (click)="dismiss()"
            [attr.aria-label]="'onboarding.dismiss' | translate"
          >
            <i class="pi pi-times text-sm"></i>
          </button>
        </div>
      </div>
      <div class="p-4" data-testid="onboarding-checklist-progress">
        <p-progressBar [value]="progress()" [showValue]="false" styleClass="mb-4" />
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {{ 'onboarding.progress' | translate : { current: completedCount(), total: totalCount() } }}
        </p>
        <ul class="space-y-2" data-testid="onboarding-checklist-items">
          @for (item of CHECKLIST_CONFIG; track item.key) {
            <li class="flex items-center gap-3 text-sm" [attr.data-testid]="'onboarding-checklist-item-' + item.key">
              @if (isCompleted(item.key)) {
                <i class="pi pi-check-circle text-green-500 dark:text-green-400 shrink-0"></i>
              } @else {
                <i class="pi pi-circle text-gray-300 dark:text-gray-600 shrink-0"></i>
              }
              <span
                [class.text-gray-400]="isCompleted(item.key)"
                [class.dark:text-gray-500]="isCompleted(item.key)"
                [class.line-through]="isCompleted(item.key)"
                class="text-gray-800 dark:text-gray-200"
              >
                {{ item.titleKey | translate }}
              </span>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class ChecklistComponent {
  private onboardingService = inject(OnboardingService);
  private tourService = inject(TourService);
  private router = inject(Router);

  readonly CHECKLIST_CONFIG = CHECKLIST_CONFIG;

  progress = this.onboardingService.progress;
  state = this.onboardingService.state;

  completedCount = computed(() => {
    const s = this.state();
    if (!s?.checklist) return 0;
    return CHECKLIST_CONFIG.filter((c) => s.checklist[c.key]).length;
  });

  totalCount = computed(() => CHECKLIST_CONFIG.length);

  isCompleted(key: string): boolean {
    return !!this.state()?.checklist?.[key];
  }

  startTour(): void {
    this.onboardingService.hideChecklist();
    this.tourService.startTour('primary');
  }

  dismiss(): void {
    this.onboardingService.dismissOnboarding();
    this.onboardingService.hideChecklist();
  }
}
