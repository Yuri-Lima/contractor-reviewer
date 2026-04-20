import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { AccordionModule } from 'primeng/accordion';
import {
  type LegalAnswer,
  type LegalIssue,
  type IssueSeverity,
  ISSUE_SEVERITY_RANK,
  sortIssuesBySeverity,
} from '@contractai-review/shared';

/**
 * Renders a structured `LegalAnswer` produced by the legal-review-v2 prompt
 * variant. Discriminator: the parent (chat-message) decides which renderer
 * to use based on `message.legalAnswer != null`.
 *
 * Layout (top-to-bottom):
 *   1. Confidence badge (high/medium/low)
 *   2. Compliant elements (collapsed by default)
 *   3. Issues (sorted by severity desc; expanded by default)
 *   4. Recommendations
 *   5. Legislation referenced (footer)
 *
 * Each clauseRef is rendered as a clickable chip that emits `jumpToClause`
 * — the parent wires this to the document viewer scroll target.
 */
@Component({
  selector: 'app-legal-answer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe, CardModule, TagModule, AccordionModule],
  template: `
    <p-card styleClass="legal-answer-card border border-gray-200 dark:border-gray-700 shadow-none">
      <!-- Header: confidence badge -->
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 m-0">
          {{ 'legalAnswer.title' | translate }}
        </h3>
        <p-tag
          [value]="confidenceLabel() | translate"
          [severity]="confidenceSeverity()"
          [rounded]="true"
        ></p-tag>
      </div>

      <!-- Compliant elements -->
      @if (answer().compliantElements.length > 0) {
        <p-accordion [multiple]="true" styleClass="mb-3">
          <p-accordion-panel value="compliant">
            <p-accordion-header>
              <span class="text-sm font-medium text-green-700 dark:text-green-400">
                <i class="pi pi-check-circle mr-2"></i>
                {{ 'legalAnswer.compliant' | translate }} ({{ answer().compliantElements.length }})
              </span>
            </p-accordion-header>
            <p-accordion-content>
              <ul class="list-none p-0 m-0 space-y-2">
                @for (item of answer().compliantElements; track $index) {
                  <li class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    @if (item.clauseRef) {
                      <button
                        type="button"
                        class="inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 text-xs font-medium hover:underline cursor-pointer border-0"
                        (click)="onJumpToClause(item.clauseRef)"
                      >
                        {{ 'legalAnswer.clausePrefix' | translate }} {{ item.clauseRef }}
                      </button>
                    }
                    <span>{{ item.rationale }}</span>
                  </li>
                }
              </ul>
            </p-accordion-content>
          </p-accordion-panel>
        </p-accordion>
      }

      <!-- Issues (sorted by severity desc) -->
      @if (sortedIssues().length > 0) {
        <p-accordion [value]="['issues']" [multiple]="true" styleClass="mb-3">
          <p-accordion-panel value="issues">
            <p-accordion-header>
              <span class="text-sm font-medium text-red-700 dark:text-red-400">
                <i class="pi pi-exclamation-triangle mr-2"></i>
                {{ 'legalAnswer.issues' | translate }} ({{ sortedIssues().length }})
              </span>
            </p-accordion-header>
            <p-accordion-content>
              <ul class="list-none p-0 m-0 space-y-3">
                @for (issue of sortedIssues(); track $index) {
                  <li class="border-l-4 pl-3 py-1" [ngClass]="severityBorderClass(issue.severity)">
                    <div class="flex items-center flex-wrap gap-2 mb-1">
                      <p-tag
                        [value]="severityLabel(issue.severity) | translate"
                        [severity]="severityToPrimeSeverity(issue.severity)"
                        [rounded]="true"
                      ></p-tag>
                      <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {{ categoryLabel(issue.category) | translate }}
                      </span>
                      @if (issue.clauseRef) {
                        <button
                          type="button"
                          class="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-medium hover:underline cursor-pointer border-0"
                          (click)="onJumpToClause(issue.clauseRef)"
                        >
                          {{ 'legalAnswer.clausePrefix' | translate }} {{ issue.clauseRef }}
                        </button>
                      }
                    </div>
                    <p class="text-sm text-gray-800 dark:text-gray-200 m-0 mb-1">{{ issue.message }}</p>
                    @if (issue.legislationRef) {
                      <p class="text-xs italic text-gray-600 dark:text-gray-400 m-0 mb-1">
                        <i class="pi pi-book mr-1"></i>{{ issue.legislationRef }}
                      </p>
                    }
                    @if (issue.suggestion) {
                      <p class="text-xs text-gray-700 dark:text-gray-300 m-0">
                        <strong>{{ 'legalAnswer.suggestion' | translate }}:</strong>
                        {{ issue.suggestion }}
                      </p>
                    }
                  </li>
                }
              </ul>
            </p-accordion-content>
          </p-accordion-panel>
        </p-accordion>
      }

      <!-- Recommendations -->
      @if (answer().recommendations.length > 0) {
        <div class="mb-3">
          <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <i class="pi pi-lightbulb mr-2"></i>{{ 'legalAnswer.recommendations' | translate }}
          </h4>
          <ul class="list-disc pl-5 m-0 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            @for (rec of answer().recommendations; track $index) {
              <li>{{ rec }}</li>
            }
          </ul>
        </div>
      }

      <!-- Legislation referenced -->
      @if (answer().legislationReferenced.length > 0) {
        <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
          <h4 class="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-2">
            {{ 'legalAnswer.legislationReferenced' | translate }}
          </h4>
          <ul class="list-none p-0 m-0 space-y-1 text-xs text-gray-700 dark:text-gray-300">
            @for (l of answer().legislationReferenced; track $index) {
              <li>
                <i class="pi pi-book mr-1"></i>
                <span class="font-medium">{{ l.name }}</span>
                @if (l.year) {
                  <span> {{ l.year }}</span>
                }
                @if (l.section) {
                  <span>, {{ l.section }}</span>
                }
              </li>
            }
          </ul>
        </div>
      }

      <!-- Free-text fallback / model summary -->
      @if (answer().freeText) {
        <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p class="text-sm italic text-gray-600 dark:text-gray-400 whitespace-pre-wrap m-0">
            {{ answer().freeText }}
          </p>
        </div>
      }
    </p-card>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
    `,
  ],
})
export class LegalAnswerComponent {
  answer = input.required<LegalAnswer>();

  /**
   * Emitted when the user clicks a clause-ref chip. Parent should scroll the
   * document viewer to the matching clause (Phase 2 wires this to chunk
   * clauseNumber metadata).
   */
  jumpToClause = output<string>();

  sortedIssues = computed<LegalIssue[]>(() => sortIssuesBySeverity(this.answer().issues));

  confidenceLabel = computed(() => `legalAnswer.confidence.${this.answer().confidence}`);

  /** Map LegalAnswer.confidence to PrimeNG p-tag severity colour. */
  confidenceSeverity = computed<'success' | 'warn' | 'danger'>(() => {
    const c = this.answer().confidence;
    if (c === 'high') return 'success';
    if (c === 'medium') return 'warn';
    return 'danger';
  });

  severityLabel(severity: IssueSeverity): string {
    return `legalAnswer.severity.${severity}`;
  }

  categoryLabel(category: string): string {
    return `legalAnswer.category.${category}`;
  }

  severityToPrimeSeverity(severity: IssueSeverity): 'danger' | 'warn' | 'info' | 'secondary' {
    if (severity === 'blocker' || severity === 'high') return 'danger';
    if (severity === 'medium') return 'warn';
    if (severity === 'low') return 'info';
    return 'secondary';
  }

  severityBorderClass(severity: IssueSeverity): string {
    const rank = ISSUE_SEVERITY_RANK[severity];
    if (rank >= 3) return 'border-red-500';
    if (rank === 2) return 'border-yellow-500';
    if (rank === 1) return 'border-blue-400';
    return 'border-gray-300 dark:border-gray-600';
  }

  onJumpToClause(clauseRef: string | undefined): void {
    if (clauseRef) {
      this.jumpToClause.emit(clauseRef);
    }
  }
}
