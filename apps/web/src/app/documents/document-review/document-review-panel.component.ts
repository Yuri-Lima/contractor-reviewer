import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { AccordionModule } from 'primeng/accordion';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import {
  type DocumentReview,
  type LegalIssue,
  type IssueSeverity,
  ISSUE_SEVERITIES,
  ISSUE_SEVERITY_RANK,
  sortIssuesBySeverity,
} from '@contractai-review/shared';
import { ApiService } from '../../core/services/api.service';

/**
 * Phase 4 panel: shows the persistent DocumentReview as a workspace document
 * tab. Issues are grouped by severity (blocker first) inside an accordion;
 * each clauseRef is a clickable chip that emits `jumpToClause` so the parent
 * can scroll the document viewer.
 *
 * Empty/loading/error states are rendered inline — the parent only needs to
 * hand over `(workspaceId, documentId)` and listen for `jumpToClause`.
 */
@Component({
  selector: 'app-document-review-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CardModule,
    TagModule,
    AccordionModule,
    MessageModule,
    ProgressSpinnerModule,
  ],
  template: `
    <p-card styleClass="document-review-panel">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="text-base font-semibold m-0">
            {{ 'legalReview.title' | translate }}
          </h3>
          @if (review()) {
            <p class="text-xs text-gray-500 dark:text-gray-400 m-0 mt-1">
              {{ 'legalReview.lastRun' | translate }}:
              {{ review()!.updatedAt | date: 'medium' }}
              @if (review()!.llmModel) {
                · {{ review()!.llmModel }}
              }
              · {{ 'legalReview.rules' | translate }} {{ review()!.rulesVersion }}
            </p>
          }
        </div>
        <p-button
          [label]="rerunning() ? ('legalReview.rerunning' | translate) : ('legalReview.rerun' | translate)"
          icon="pi pi-refresh"
          [outlined]="true"
          [loading]="rerunning()"
          [disabled]="loading() || rerunning()"
          (onClick)="onRerunClicked()"
        ></p-button>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center p-6">
          <p-progress-spinner styleClass="w-8 h-8"></p-progress-spinner>
          <span class="ml-3 text-sm text-gray-600 dark:text-gray-400">
            {{ 'legalReview.loading' | translate }}
          </span>
        </div>
      } @else if (loadError()) {
        <p-message severity="error" [text]="loadError()!" styleClass="w-full"></p-message>
      } @else if (!review()) {
        <p-message
          severity="info"
          [text]="'legalReview.empty' | translate"
          styleClass="w-full"
        ></p-message>
      } @else {
        <!-- Severity counts header -->
        <div class="flex flex-wrap gap-2 mb-4">
          @for (sev of severityOrder; track sev) {
            @if (countFor(sev) > 0) {
              <p-tag
                [value]="('legalAnswer.severity.' + sev | translate) + ' (' + countFor(sev) + ')'"
                [severity]="severityToPrimeSeverity(sev)"
                [rounded]="true"
              ></p-tag>
            }
          }
          @if (totalIssues() === 0) {
            <p-tag
              [value]="'legalReview.noIssues' | translate"
              severity="success"
              [rounded]="true"
            ></p-tag>
          }
        </div>

        @if (review()!.status === 'degraded') {
          <p-message
            severity="warn"
            [text]="('legalReview.degraded' | translate) + (review()!.errorMessage ? ': ' + review()!.errorMessage : '')"
            styleClass="w-full mb-3"
          ></p-message>
        }

        <!-- Severity-grouped accordion -->
        @if (totalIssues() > 0) {
          <p-accordion [value]="['blocker', 'high']" [multiple]="true">
            @for (sev of severityOrder; track sev) {
              @if (issuesBySeverity()[sev].length > 0) {
                <p-accordion-panel [value]="sev">
                  <p-accordion-header>
                    <span class="text-sm font-medium">
                      <p-tag
                        [value]="'legalAnswer.severity.' + sev | translate"
                        [severity]="severityToPrimeSeverity(sev)"
                        [rounded]="true"
                      ></p-tag>
                      <span class="ml-2">({{ issuesBySeverity()[sev].length }})</span>
                    </span>
                  </p-accordion-header>
                  <p-accordion-content>
                    <ul class="list-none p-0 m-0 space-y-3">
                      @for (issue of issuesBySeverity()[sev]; track $index) {
                        <li class="border-l-4 pl-3 py-1" [ngClass]="severityBorderClass(issue.severity)">
                          <div class="flex flex-wrap items-center gap-2 mb-1">
                            <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              {{ 'legalAnswer.category.' + issue.category | translate }}
                            </span>
                            @if (issue.clauseRef) {
                              <button
                                type="button"
                                class="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-medium hover:underline cursor-pointer border-0"
                                (click)="onJumpToClause(issue.clauseRef!)"
                              >
                                {{ 'legalAnswer.clausePrefix' | translate }} {{ issue.clauseRef }}
                              </button>
                            }
                          </div>
                          <p class="text-sm text-gray-800 dark:text-gray-200 m-0 mb-1">
                            {{ issue.message }}
                          </p>
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
              }
            }
          </p-accordion>
        }

        @if (review()!.recommendations.length > 0) {
          <div class="mt-4">
            <h4 class="text-sm font-semibold mb-2">
              <i class="pi pi-lightbulb mr-2"></i>{{ 'legalAnswer.recommendations' | translate }}
            </h4>
            <ul class="list-disc pl-5 m-0 space-y-1 text-sm">
              @for (rec of review()!.recommendations; track $index) {
                <li>{{ rec }}</li>
              }
            </ul>
          </div>
        }
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
export class DocumentReviewPanelComponent {
  private api = inject(ApiService);

  workspaceId = input.required<string>();
  documentId = input.required<string>();

  /** Emitted when the user clicks a clause-ref chip. */
  jumpToClause = output<string>();

  readonly severityOrder: IssueSeverity[] = [...ISSUE_SEVERITIES];

  protected readonly review = signal<DocumentReview | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly rerunning = signal<boolean>(false);
  protected readonly loadError = signal<string | null>(null);

  /** Load on first activation; called by parent's tab-change handler. */
  load(): void {
    if (!this.workspaceId() || !this.documentId()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getDocumentReview(this.workspaceId(), this.documentId()).subscribe({
      next: (review) => {
        this.review.set(review);
        this.loading.set(false);
      },
      error: (err: { message?: string }) => {
        this.loadError.set(err?.message ?? 'Failed to load review');
        this.loading.set(false);
      },
    });
  }

  protected onRerunClicked(): void {
    if (this.rerunning()) return;
    this.rerunning.set(true);
    this.api.rerunDocumentReview(this.workspaceId(), this.documentId()).subscribe({
      next: () => {
        // The job runs async on the worker. Poll once after a short delay so
        // the user sees the new review surface without manually refreshing.
        setTimeout(() => {
          this.rerunning.set(false);
          this.load();
        }, 4000);
      },
      error: (err: { message?: string }) => {
        this.loadError.set(err?.message ?? 'Failed to enqueue review');
        this.rerunning.set(false);
      },
    });
  }

  protected onJumpToClause(clauseRef: string): void {
    if (clauseRef) this.jumpToClause.emit(clauseRef);
  }

  protected issuesBySeverity = computed<Record<IssueSeverity, LegalIssue[]>>(() => {
    const out: Record<IssueSeverity, LegalIssue[]> = {
      blocker: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };
    const r = this.review();
    if (!r) return out;
    for (const issue of sortIssuesBySeverity(r.issues)) {
      out[issue.severity].push(issue);
    }
    return out;
  });

  protected totalIssues = computed(() => this.review()?.issues.length ?? 0);

  protected countFor(sev: IssueSeverity): number {
    return this.review()?.issueCounts[sev] ?? 0;
  }

  protected severityToPrimeSeverity(
    severity: IssueSeverity,
  ): 'danger' | 'warn' | 'info' | 'secondary' | 'success' {
    if (severity === 'blocker' || severity === 'high') return 'danger';
    if (severity === 'medium') return 'warn';
    if (severity === 'low') return 'info';
    return 'secondary';
  }

  protected severityBorderClass(severity: IssueSeverity): string {
    const rank = ISSUE_SEVERITY_RANK[severity];
    if (rank >= 3) return 'border-red-500';
    if (rank === 2) return 'border-yellow-500';
    if (rank === 1) return 'border-blue-400';
    return 'border-gray-300 dark:border-gray-600';
  }
}
