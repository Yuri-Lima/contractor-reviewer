import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChatPreparePayload, ChatPrepareDocumentChunk } from '@contractai-review/shared';

@Component({
  selector: 'app-llm-payload-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, Button, TabsModule, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      [header]="'chat.llmPayloadDialogTitle' | translate"
      [modal]="true"
      [closable]="true"
      [style]="{ width: 'min(95vw, 960px)', maxHeight: '90vh' }"
      [contentStyle]="{ overflow: 'auto', maxHeight: '65vh' }"
      [baseZIndex]="10000"
      [appendTo]="'body'"
      [ariaLabel]="'chat.llmPayloadDialogTitle' | translate"
      (onHide)="onCancel()"
    >
      @if (payload()) {
        <!-- Status bar: mode badge + cache badge -->
        <div class="flex flex-wrap items-center gap-2 mb-3">
          @if (payload()!.legalReviewMode) {
            <p-tag severity="warn" [value]="'chat.legalReviewModeOn' | translate"></p-tag>
          } @else {
            <p-tag severity="info" [value]="'chat.legalReviewModeOff' | translate"></p-tag>
          }
          @if (payload()!.cacheStatus) {
            @if (payload()!.cacheStatus!.wouldHitCache) {
              <p-tag severity="success" [value]="('chat.cacheWouldHit' | translate) + ' (' + payload()!.cacheStatus!.cacheSimilarityThreshold + ')'"></p-tag>
            } @else {
              <p-tag severity="secondary" [value]="'chat.cacheMiss' | translate"></p-tag>
            }
          }
          @if (payload()!.retrievalStats?.preflightReason) {
            <p-tag severity="danger" [value]="'chat.preflightReason' | translate | uppercase" [style]="{ fontSize: '0.7rem' }">
            </p-tag>
            <span class="text-xs font-mono text-red-600 dark:text-red-400">{{ payload()!.retrievalStats!.preflightReason }}</span>
          }
        </div>

        <p-tabs [value]="activeTab()" (valueChange)="setActiveTab($event)">
          <p-tablist>
            <p-tab value="0">{{ 'chat.questionTab' | translate }}</p-tab>
            <p-tab value="1">{{ 'chat.systemPrompt' | translate }}</p-tab>
            <p-tab value="2">{{ 'chat.userPrompt' | translate }}</p-tab>
            <p-tab value="3">{{ 'chat.documentChunks' | translate }} ({{ payload()!.documentChunks.length }})</p-tab>
            <p-tab value="4">{{ 'chat.legalChunks' | translate }} ({{ payload()!.legalChunks.length }})</p-tab>
            <p-tab value="5">{{ 'chat.webSources' | translate }} ({{ payload()!.webSearchResults?.length || 0 }})</p-tab>
            <p-tab value="6">{{ 'chat.memoryContext' | translate }}</p-tab>
            <p-tab value="7">{{ 'chat.retrievalStats' | translate }}</p-tab>
            <p-tab value="8">{{ 'chat.modelParams' | translate }}</p-tab>
            <p-tab value="9">{{ 'chat.timings' | translate }}</p-tab>
          </p-tablist>
          <p-tabpanels>
            <!-- Question -->
            <p-tabpanel value="0">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ payload()!.question }}</pre>
              </div>
            </p-tabpanel>

            <!-- System Prompt -->
            <p-tabpanel value="1">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ payload()!.systemPrompt }}</pre>
              </div>
            </p-tabpanel>

            <!-- User Prompt -->
            <p-tabpanel value="2">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ payload()!.userPrompt }}</pre>
              </div>
            </p-tabpanel>

            <!-- Document Chunks -->
            <p-tabpanel value="3">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 space-y-3">
                @for (chunk of payload()!.documentChunks; track $index) {
                  <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ 'chat.documentChunks' | translate }} #{{ $index + 1 }}
                      · {{ 'chat.similarity' | translate }}:
                      <span [class]="similarityClass(chunk.similarity)">{{ chunk.similarity | number:'1.3-3' }}</span>
                      @if (chunk.pageNumber) { · p.{{ chunk.pageNumber }} }
                      @if (chunk.paragraphId) { · {{ chunk.paragraphId }} }
                      @if (chunk.clauseNumber) { · {{ 'chat.clause' | translate }} {{ chunk.clauseNumber }} }
                    </p>
                    @if (chunk.headingPath?.length) {
                      <p class="text-xs text-blue-600 dark:text-blue-400 mb-1 font-mono">
                        {{ chunk.headingPath!.join(' > ') }}
                      </p>
                    }
                    <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ chunk.text }}</pre>
                  </div>
                }
                @if (payload()!.documentChunks.length === 0) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.noChunks' | translate }}</p>
                }
              </div>
            </p-tabpanel>

            <!-- Legal Chunks -->
            <p-tabpanel value="4">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 space-y-3">
                @for (chunk of payload()!.legalChunks; track $index) {
                  <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ chunk.sourceName || 'Legal' }}
                      · {{ 'chat.similarity' | translate }}:
                      <span [class]="similarityClass(chunk.similarity)">{{ chunk.similarity | number:'1.3-3' }}</span>
                      @if (chunk.section) { · {{ chunk.section }} }
                      @if (chunk.url) { · <a [href]="chunk.url" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400">url</a> }
                    </p>
                    <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ chunk.text }}</pre>
                  </div>
                }
                @if (payload()!.legalChunks.length === 0) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.noChunks' | translate }}</p>
                }
              </div>
            </p-tabpanel>

            <!-- Web Sources -->
            <p-tabpanel value="5">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 space-y-3">
                @for (result of payload()!.webSearchResults || []; track $index) {
                  <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                      {{ result.title }}
                    </p>
                    <a [href]="result.url" target="_blank" rel="noopener" class="text-xs text-blue-600 dark:text-blue-400 break-all">{{ result.url }}</a>
                    @if (result.snippet) {
                      <pre class="whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400 mt-1">{{ result.snippet }}</pre>
                    }
                  </div>
                }
                @if (!payload()!.webSearchResults?.length) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.noWebResults' | translate }}</p>
                }
              </div>
            </p-tabpanel>

            <!-- Memory -->
            <p-tabpanel value="6">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                @if (payload()!.memoryContext) {
                  <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ payload()!.memoryContext }}</pre>
                } @else {
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.noMemory' | translate }}</p>
                }
              </div>
            </p-tabpanel>

            <!-- Retrieval Stats -->
            <p-tabpanel value="7">
              @if (payload()!.retrievalStats; as stats) {
                <div class="payload-content p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-800 dark:text-gray-200">
                    <dt class="font-medium">{{ 'chat.documentChunks' | translate }} {{ 'chat.retrieved' | translate }}</dt>
                    <dd class="font-mono">{{ stats.documentChunksRetrieved }}</dd>
                    <dt class="font-medium">{{ 'chat.documentChunks' | translate }} {{ 'chat.kept' | translate }}</dt>
                    <dd class="font-mono">{{ stats.documentChunksKept }}</dd>
                    <dt class="font-medium">{{ 'chat.legalChunks' | translate }} {{ 'chat.retrieved' | translate }}</dt>
                    <dd class="font-mono">{{ stats.legalChunksRetrieved }}</dd>
                    <dt class="font-medium">{{ 'chat.legalChunks' | translate }} {{ 'chat.kept' | translate }}</dt>
                    <dd class="font-mono">{{ stats.legalChunksKept }}</dd>
                    <dt class="font-medium">{{ 'chat.floor' | translate }}</dt>
                    <dd class="font-mono">{{ stats.similarityFloor }}</dd>
                    <dt class="font-medium">{{ 'chat.floorFallback' | translate }}</dt>
                    <dd class="font-mono">{{ stats.similarityFloorFallback }}</dd>
                    <dt class="font-medium">{{ 'chat.fallbackUsed' | translate }}</dt>
                    <dd class="font-mono">{{ stats.fallbackUsed ? ('chat.on' | translate | uppercase) : ('chat.off' | translate | uppercase) }}</dd>
                    <dt class="font-medium">{{ 'chat.topK' | translate }} (doc / legal)</dt>
                    <dd class="font-mono">{{ stats.topKDocument }} / {{ stats.topKLegal }}</dd>
                    <dt class="font-medium">{{ 'chat.webTrigger' | translate }}</dt>
                    <dd class="font-mono">{{ stats.webSearchTrigger }}</dd>
                    <dt class="font-medium">{{ 'chat.webResultsCount' | translate }}</dt>
                    <dd class="font-mono">{{ stats.webResultsCount }}</dd>
                    <dt class="font-medium">{{ 'chat.embeddingModel' | translate }}</dt>
                    <dd class="font-mono">{{ stats.embeddingModel }}</dd>
                  </dl>
                </div>
              }
            </p-tabpanel>

            <!-- Model Params -->
            <p-tabpanel value="8">
              <div class="payload-content p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <dl class="space-y-2 text-sm text-gray-800 dark:text-gray-200">
                  @if (payload()!.provider) {
                    <dt class="font-medium">{{ 'chat.provider' | translate }}</dt>
                    <dd class="ml-4 font-mono">{{ payload()!.provider }}</dd>
                  }
                  <dt class="font-medium">model</dt>
                  <dd class="ml-4 font-mono">{{ payload()!.model || '(adapter default)' }}</dd>
                  <dt class="font-medium">temperature</dt>
                  <dd class="ml-4 font-mono">{{ payload()!.temperature }}</dd>
                  <dt class="font-medium">max_tokens</dt>
                  <dd class="ml-4 font-mono">{{ payload()!.maxTokens }}</dd>
                </dl>
                @if (payload()!.scopeFlags) {
                  <hr class="my-3 border-gray-200 dark:border-gray-700" />
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Prompt Scopes</p>
                  <div class="flex gap-3 text-xs">
                    <span [class]="payload()!.scopeFlags!.includeGlobal ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
                      {{ 'chat.scopeGlobal' | translate }}: {{ payload()!.scopeFlags!.includeGlobal ? ('chat.on' | translate | uppercase) : ('chat.off' | translate | uppercase) }}
                    </span>
                    <span [class]="payload()!.scopeFlags!.includeWorkspace ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
                      {{ 'chat.scopeWorkspace' | translate }}: {{ payload()!.scopeFlags!.includeWorkspace ? ('chat.on' | translate | uppercase) : ('chat.off' | translate | uppercase) }}
                    </span>
                    <span [class]="payload()!.scopeFlags!.includeDocument ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
                      {{ 'chat.scopeDocument' | translate }}: {{ payload()!.scopeFlags!.includeDocument ? ('chat.on' | translate | uppercase) : ('chat.off' | translate | uppercase) }}
                    </span>
                  </div>
                }
              </div>
            </p-tabpanel>

            <!-- Timings -->
            <p-tabpanel value="9">
              @if (payload()!.timings; as t) {
                <div class="payload-content p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div class="space-y-2 text-sm text-gray-800 dark:text-gray-200">
                    @for (entry of timingEntries(); track entry.label) {
                      <div class="flex items-center gap-3">
                        <span class="w-40 text-xs font-medium">{{ entry.label }}</span>
                        <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative overflow-hidden">
                          <div class="h-full rounded-full"
                            [style.width.%]="entry.pct"
                            [style.backgroundColor]="entry.color">
                          </div>
                        </div>
                        <span class="w-16 text-right font-mono text-xs">{{ entry.ms }}ms</span>
                      </div>
                    }
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2 text-right">Total: {{ t.totalMs }}ms</p>
                  </div>
                </div>
              }
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      }
      <ng-template #footer>
        <div class="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700" data-testid="llm-payload-dialog-footer">
          <p-button
            [label]="'common.cancel' | translate"
            severity="secondary"
            [outlined]="true"
            (onClick)="onCancel()"
            [attr.aria-label]="'common.cancel' | translate"
            data-testid="llm-payload-dialog-cancel"
          ></p-button>
          <p-button
            [label]="'chat.approveAndSend' | translate"
            icon="pi pi-check"
            (onClick)="onApprove()"
            [attr.aria-label]="'chat.approveAndSend' | translate"
            data-testid="llm-payload-dialog-approve"
          ></p-button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class LlmPayloadDialogComponent {
  payload = input.required<ChatPreparePayload | null>();
  requestId = input.required<string>();

  approved = output<string>();
  cancelled = output<void>();

  activeTab = signal<string>('0');

  visible = computed(() => this.payload() != null);

  timingEntries = computed(() => {
    const t = this.payload()?.timings;
    if (!t) return [];
    const total = t.totalMs || 1;
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1'];
    const entries: { label: string; ms: number; pct: number; color: string }[] = [
      { label: 'Embedding', ms: t.embeddingMs, pct: (t.embeddingMs / total) * 100, color: colors[0] },
      { label: 'Doc search', ms: t.documentSearchMs, pct: (t.documentSearchMs / total) * 100, color: colors[1] },
      { label: 'Legal search', ms: t.legalSearchMs, pct: (t.legalSearchMs / total) * 100, color: colors[2] },
    ];
    if (t.webSearchMs != null) {
      entries.push({ label: 'Web search', ms: t.webSearchMs, pct: (t.webSearchMs / total) * 100, color: colors[3] });
    }
    entries.push({ label: 'Prompt assembly', ms: t.promptAssemblyMs, pct: (t.promptAssemblyMs / total) * 100, color: colors[4] });
    return entries;
  });

  similarityClass(score: number): string {
    const stats = this.payload()?.retrievalStats;
    const floor = stats?.similarityFloor ?? 0.5;
    const fallback = stats?.similarityFloorFallback ?? 0.3;
    if (score >= floor) return 'font-mono font-semibold text-green-600 dark:text-green-400';
    if (score >= fallback) return 'font-mono font-semibold text-amber-600 dark:text-amber-400';
    return 'font-mono font-semibold text-red-600 dark:text-red-400';
  }

  setActiveTab(value: string | number | undefined): void {
    this.activeTab.set(value != null ? String(value) : '0');
  }

  onApprove(): void {
    this.approved.emit(this.requestId());
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
