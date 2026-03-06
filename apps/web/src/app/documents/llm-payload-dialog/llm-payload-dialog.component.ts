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
import { TranslatePipe } from '@ngx-translate/core';
import type { ChatPreparePayload } from '@contractai-review/shared';

@Component({
  selector: 'app-llm-payload-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, Button, TabsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      [header]="'chat.llmPayloadDialogTitle' | translate"
      [modal]="true"
      [closable]="true"
      [style]="{ width: 'min(95vw, 900px)', maxHeight: '85vh' }"
      [contentStyle]="{ overflow: 'auto', maxHeight: '55vh' }"
      [baseZIndex]="10000"
      [appendTo]="'body'"
      [ariaLabel]="'chat.llmPayloadDialogTitle' | translate"
      (onHide)="onCancel()"
    >
      @if (payload()) {
        <p-tabs [value]="activeTab()" (valueChange)="setActiveTab($event)">
          <p-tablist>
            <p-tab value="0">{{ 'chat.questionTab' | translate }}</p-tab>
            <p-tab value="1">{{ 'chat.systemPrompt' | translate }}</p-tab>
            <p-tab value="2">{{ 'chat.userPrompt' | translate }}</p-tab>
            <p-tab value="3">{{ 'chat.documentChunks' | translate }}</p-tab>
            <p-tab value="4">{{ 'chat.legalChunks' | translate }}</p-tab>
            <p-tab value="5">{{ 'chat.modelParams' | translate }}</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="0">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ payload()!.question }}</pre>
              </div>
            </p-tabpanel>
            <p-tabpanel value="1">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ payload()!.systemPrompt }}</pre>
              </div>
            </p-tabpanel>
            <p-tabpanel value="2">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ payload()!.userPrompt }}</pre>
              </div>
            </p-tabpanel>
            <p-tabpanel value="3">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 space-y-3">
                @for (chunk of payload()!.documentChunks; track $index) {
                  <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ 'chat.documentChunks' | translate }} #{{ $index + 1 }}
                      · {{ 'chat.similarity' | translate }}: {{ chunk.similarity | number:'1.2-2' }}
                      @if (chunk.pageNumber) { · p.{{ chunk.pageNumber }} }
                      @if (chunk.paragraphId) { · {{ chunk.paragraphId }} }
                    </p>
                    <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ chunk.text }}</pre>
                  </div>
                }
                @if (payload()!.documentChunks.length === 0) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.noChunks' | translate }}</p>
                }
              </div>
            </p-tabpanel>
            <p-tabpanel value="4">
              <div class="payload-content overflow-auto max-h-[50vh] p-4 space-y-3">
                @for (chunk of payload()!.legalChunks; track $index) {
                  <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {{ chunk.sourceName || 'Legal' }} · {{ 'chat.similarity' | translate }}: {{ chunk.similarity | number:'1.2-2' }}
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
            <p-tabpanel value="5">
              <div class="payload-content p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <dl class="space-y-2 text-sm text-gray-800 dark:text-gray-200">
                  <dt class="font-medium">model</dt>
                  <dd class="ml-4">{{ payload()!.model }}</dd>
                  <dt class="font-medium">temperature</dt>
                  <dd class="ml-4">{{ payload()!.temperature }}</dd>
                  <dt class="font-medium">max_tokens</dt>
                  <dd class="ml-4">{{ payload()!.maxTokens }}</dd>
                </dl>
              </div>
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
