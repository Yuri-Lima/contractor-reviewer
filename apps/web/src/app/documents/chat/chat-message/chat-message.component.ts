import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ChatMessageWithAudio } from '../chat.types';
import type { ChatResponseMode } from '@contractai-review/shared';
import { IncremarkWrapperComponent } from '../incremark-wrapper';
import { LegalAnswerComponent } from '../legal-answer/legal-answer.component';
import { WebSocketService } from '../../../core/services/websocket.service';


const TRUNCATE_LENGTH = 80;

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, Button, TooltipModule, TranslatePipe, IncremarkWrapperComponent, LegalAnswerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="chat-message-block rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200"
      [class.bg-white]="!collapsed()"
      [class.dark:bg-gray-800]="!collapsed()"
      [class.bg-gray-50]="collapsed()"
      [class.dark:bg-gray-800/70]="collapsed()"
    >
      <!-- Collapsed header: clickable to expand -->
      <button
        type="button"
        class="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer border-0 bg-transparent"
        [class.border-b]="collapsed() && hasAnswer()"
        [class.border-gray-200]="collapsed() && hasAnswer()"
        [class.dark:border-gray-700]="collapsed() && hasAnswer()"
        (click)="toggleExpand()"
        [attr.aria-expanded]="expanded()"
        [attr.aria-label]="(expanded() ? ('chat.collapseMessage' | translate) : ('chat.expandMessage' | translate))"
      >
        <i
          [class]="expanded() ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
          class="flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform"
        ></i>
        <span class="truncate flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200">
          {{ collapsed() ? truncatedQuestion() : '' }}
        </span>
      </button>

      @if (expanded()) {
        <div class="p-4 pt-2 space-y-4 flex flex-col">
          <!-- You: right-aligned bubble -->
          <div class="message-question flex flex-col items-end text-right max-w-[85%] ml-auto px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50">
            <strong class="text-blue-600 dark:text-blue-400">{{ 'documents.you' | translate }}:</strong>
            <p class="text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-wrap">{{ message().question }}</p>
          </div>

          @if (message().streaming && message().statusPhase && !hasAnswer()) {
            <!-- Status phase indicator: shown during RAG prep before first chunk -->
            <div class="message-answer flex flex-col items-start text-left max-w-[85%] mr-auto px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <strong class="text-green-600 dark:text-green-400">{{ 'documents.assistant' | translate }}:</strong>
              <div class="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <i class="pi pi-spin pi-spinner"></i>
                <span>{{ statusPhaseLabel() }}</span>
              </div>
            </div>
          }
          @if (hasAnswer()) {
            <!-- Assistant: left-aligned bubble -->
            <div class="message-answer flex flex-col items-start text-left max-w-[85%] mr-auto px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <div class="flex items-center gap-2 w-full">
                <strong class="text-green-600 dark:text-green-400">{{ 'documents.assistant' | translate }}:</strong>
                @if (canShowRawToggle() && chatResponseMode() !== 'audio_only') {
                  <p-button
                    [icon]="showRawMarkdown() ? 'pi pi-eye' : 'pi pi-code'"
                    [rounded]="true"
                    [text]="true"
                    size="small"
                    severity="secondary"
                    (onClick)="toggleRawMarkdown()"
                    [pTooltip]="(showRawMarkdown() ? ('chat.showRenderedMarkdown' | translate) : ('chat.showRawMarkdown' | translate))"
                    [attr.aria-label]="(showRawMarkdown() ? ('chat.showRenderedMarkdown' | translate) : ('chat.showRawMarkdown' | translate))"
                  ></p-button>
                }
              </div>
              @if (notFoundBannerKey()) {
                <div
                  class="not-found-banner mt-2 mb-2 w-full px-3 py-2 rounded border text-sm flex items-start gap-2"
                  [class.border-amber-300]="notFoundReasonCode() !== 'below_floor'"
                  [class.bg-amber-50]="notFoundReasonCode() !== 'below_floor'"
                  [class.text-amber-900]="notFoundReasonCode() !== 'below_floor'"
                  [class.dark:bg-amber-900/20]="notFoundReasonCode() !== 'below_floor'"
                  [class.dark:text-amber-200]="notFoundReasonCode() !== 'below_floor'"
                  [class.dark:border-amber-700]="notFoundReasonCode() !== 'below_floor'"
                  [class.border-slate-300]="notFoundReasonCode() === 'below_floor'"
                  [class.bg-slate-50]="notFoundReasonCode() === 'below_floor'"
                  [class.text-slate-800]="notFoundReasonCode() === 'below_floor'"
                  [class.dark:bg-slate-800/40]="notFoundReasonCode() === 'below_floor'"
                  [class.dark:text-slate-200]="notFoundReasonCode() === 'below_floor'"
                  [class.dark:border-slate-700]="notFoundReasonCode() === 'below_floor'"
                  role="status"
                >
                  <i class="pi pi-info-circle mt-0.5 flex-shrink-0"></i>
                  <span>{{ notFoundBannerKey()! | translate }}</span>
                </div>
              }
              @if (chatResponseMode() !== 'audio_only') {
                @if (message().legalAnswer && !showRawMarkdown()) {
                  <div class="mt-1 mb-2 w-full">
                    <app-legal-answer
                      [answer]="message().legalAnswer!"
                      (jumpToClause)="jumpToClause.emit($event)"
                    />
                  </div>
                } @else if (showRawMarkdown()) {
                  <pre class="text-gray-800 dark:text-gray-200 mt-1 mb-2 whitespace-pre-wrap font-sans text-sm">{{ message().answerText }}</pre>
                } @else {
                  <div class="mt-1 mb-2 w-full">
                    <app-incremark-wrapper
                      [content]="message().answerText ?? ''"
                      [isFinished]="!message().streaming"
                    />
                  </div>
                }
              }
              @if ((chatResponseMode() === 'audio_only' || chatResponseMode() === 'audio_and_text') && message().audioState === 'synthesizing') {
                <p class="text-sm text-gray-500 dark:text-gray-400 italic mb-2">{{ 'chat.synthesizing' | translate }}</p>
              }
              @if ((chatResponseMode() === 'audio_only' || chatResponseMode() === 'audio_and_text') && (message().audioState === 'ready' || message().audioState === 'playing') && message().audioUrl) {
                <div class="flex items-center gap-2 mb-2">
                  @if (isPlaying()) {
                    <p-button
                      icon="pi pi-pause"
                      [outlined]="true"
                      size="small"
                      (onClick)="pauseAudio.emit(index())"
                      [pTooltip]="'chat.pauseAudio' | translate"
                    ></p-button>
                  } @else {
                    <p-button
                      icon="pi pi-play"
                      [outlined]="true"
                      size="small"
                      (onClick)="playAudio.emit()"
                      [pTooltip]="'chat.playAudio' | translate"
                    ></p-button>
                  }
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.playAudio' | translate }}</span>
                </div>
              }
              @if (chatResponseMode() === 'audio_only' && message().answerText) {
                <p class="text-gray-800 dark:text-gray-200 mt-1 mb-2 sr-only whitespace-pre-wrap">{{ message().answerText }}</p>
              }
              @if (message().fromCache) {
                <span class="inline-block px-2 py-1 rounded text-xs font-medium mb-2 mr-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {{ 'chat.fromCache' | translate }}
                </span>
                <p-button
                  icon="pi pi-refresh"
                  [outlined]="true"
                  size="small"
                  severity="secondary"
                  (onClick)="getFreshResponse.emit(index())"
                  [pTooltip]="'chat.getFreshResponse' | translate"
                  [label]="'chat.getFreshResponse' | translate"
                  class="mb-2"
                ></p-button>
              }
              <div
                class="confidence-badge inline-block px-2 py-1 rounded text-xs font-semibold mb-2"
                [class.bg-green-100]="message().confidence === 'high'"
                [class.text-green-800]="message().confidence === 'high'"
                [class.dark:bg-green-900]="message().confidence === 'high'"
                [class.dark:text-green-200]="message().confidence === 'high'"
                [class.bg-yellow-100]="message().confidence === 'medium'"
                [class.text-yellow-800]="message().confidence === 'medium'"
                [class.dark:bg-yellow-900]="message().confidence === 'medium'"
                [class.dark:text-yellow-200]="message().confidence === 'medium'"
                [class.bg-red-100]="message().confidence === 'low'"
                [class.text-red-800]="message().confidence === 'low'"
                [class.dark:bg-red-900]="message().confidence === 'low'"
                [class.dark:text-red-200]="message().confidence === 'low'"
              >
                {{ 'documents.confidence' | translate }}: {{ confidenceLabel() }}
              </div>
              @if (message().citations && message().citations!.length > 0) {
                <div class="citations mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ 'documents.citations' | translate }}:</h4>
                  @for (citation of message().citations; track $index) {
                    @if (citation.type === 'web') {
                      <div class="citation citation-web text-sm text-gray-600 dark:text-gray-400 mb-2 p-2 bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 rounded">
                        <div class="flex items-start gap-2">
                          <i class="pi pi-globe text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" [attr.aria-label]="'chat.notFoundReason.webSourceLabel' | translate"></i>
                          <div class="flex-1 min-w-0">
                            <a
                              [href]="citation.url"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="font-medium text-sky-700 dark:text-sky-300 hover:underline break-words"
                            >{{ citation.title || citation.url }}</a>
                            @if (citation.snippet) {
                              <div class="mt-1 italic text-xs">"{{ citation.snippet }}"</div>
                            }
                            <div class="mt-1 text-[11px] uppercase tracking-wide text-sky-700/70 dark:text-sky-400/70">
                              {{ 'chat.notFoundReason.webSourceLabel' | translate }}
                            </div>
                          </div>
                        </div>
                      </div>
                    } @else {
                      <div class="citation text-sm text-gray-600 dark:text-gray-400 mb-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                        @if (citation.fileName) {
                          <span class="font-medium">{{ citation.fileName }}</span>
                        }
                        @if (citation.pageNumber) {
                          <span> - {{ 'documents.page' | translate }} {{ citation.pageNumber }}</span>
                        }
                        @if (citation.quoteSnippet) {
                          <div class="mt-1 italic text-xs">"{{ citation.quoteSnippet }}"</div>
                        }
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        margin-bottom: 0.125rem;
      }
      :host:last-child {
        margin-bottom: 0;
      }
    `,
  ],
})
export class ChatMessageComponent {
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly webSocketService = inject(WebSocketService, { optional: true });

  message = input.required<ChatMessageWithAudio>();
  index = input.required<number>();
  chatResponseMode = input.required<ChatResponseMode>();
  playingMessageIndex = input<number | null>(null);
  defaultExpanded = input<boolean>(true);
  /** Optional: when set, component listens for job-progress WS events for this document. */
  workspaceId = input<string | null>(null);
  documentId = input<string | null>(null);

  playAudio = output<void>();
  pauseAudio = output<number>();
  getFreshResponse = output<number>();
  expandedChange = output<boolean>();
  /** Forwarded from LegalAnswerComponent: clauseRef the user wants to scroll to in the document viewer. */
  jumpToClause = output<string>();

  private expandedSignal = signal(true);
  private showRawMarkdownSignal = signal(false);
  /** Latest job-progress stamp observed via WebSocket (dev/diagnostics). */
  private lastJobProgressAt = signal<number | null>(null);

  expanded = computed(() => this.expandedSignal());
  showRawMarkdown = computed(() => this.showRawMarkdownSignal());

  /** Toggle is only available when the full response has finished (not streaming). */
  canShowRawToggle = computed(() => !this.message().streaming);

  toggleRawMarkdown(): void {
    this.showRawMarkdownSignal.update((v) => !v);
  }
  collapsed = computed(() => !this.expandedSignal());

  hasAnswer = computed(() => {
    const m = this.message();
    return !!(m.answerText || m.audioState === 'synthesizing');
  });

  truncatedQuestion = computed(() => {
    const q = this.message().question;
    if (!q) return '';
    if (q.length <= TRUNCATE_LENGTH) return q;
    return q.slice(0, TRUNCATE_LENGTH).trim() + '…';
  });

  confidenceLabel = computed(() => {
    const c = this.message().confidence || '';
    if (!c) return '';
    return this.translateService.instant(`chat.confidence.${c}`) || c;
  });

  isPlaying = computed(() => this.playingMessageIndex() === this.index());

  statusPhaseLabel = computed(() => {
    const phase = this.message().statusPhase;
    if (!phase) return '';
    return this.translateService.instant(`chat.statusPhase.${phase}`) || phase;
  });

  /** Code form of the notFoundReason, used for styling switches. */
  notFoundReasonCode = computed(() => {
    const m = this.message();
    if (!m.notFound) return null;
    return m.notFoundReason ?? 'below_floor';
  });

  /**
   * Translation key for the notFound banner. Returns null when the message
   * is a normal answer (no banner shown). We deliberately fall back to the
   * generic key when the reason is missing so older cached responses still
   * render something sensible.
   */
  notFoundBannerKey = computed(() => {
    const m = this.message();
    if (!m.notFound) return null;
    const reason = m.notFoundReason;
    switch (reason) {
      case 'no_chunks':
        return 'chat.notFoundReason.noChunks';
      case 'embeddings_pending':
        return 'chat.notFoundReason.embeddingsPending';
      case 'below_floor':
        return 'chat.notFoundReason.belowFloor';
      default:
        return 'chat.notFoundReason.generic';
    }
  });

  constructor() {
    effect(() => {
      this.expandedSignal.set(this.defaultExpanded());
    });

    // Re-compute translated labels when the active language changes.
    // takeUntilDestroyed auto-unsubscribes when the component is destroyed —
    // critical because long chat histories instantiate one component per message.
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Touch signals so OnPush re-evaluates confidence/status labels
        this.expandedSignal.update((v) => v);
      });

    // Optional document job-progress stream. Previously this subscription was
    // opened in ngOnInit without teardown → memory leak per message instance
    // when scrolling a long conversation. DestroyRef + takeUntilDestroyed fixes it.
    effect((onCleanup) => {
      const wsId = this.workspaceId();
      const docId = this.documentId();
      const ws = this.webSocketService;
      if (!ws || !wsId || !docId) return;

      const sub = ws
        .subscribeDocument(wsId, docId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.lastJobProgressAt.set(Date.now()),
          error: () => {
            /* parent view handles reconnect / polling fallback */
          },
        });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** Test seam: last observed job-progress timestamp (ms), or null. */
  getLastJobProgressAt(): number | null {
    return this.lastJobProgressAt();
  }

  toggleExpand(): void {
    const next = !this.expandedSignal();
    this.expandedSignal.set(next);
    this.expandedChange.emit(next);
  }
}
