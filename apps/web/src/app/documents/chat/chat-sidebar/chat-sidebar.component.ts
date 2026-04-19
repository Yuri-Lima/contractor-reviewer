import {
  Component,
  input,
  output,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { I18nService } from '../../../core/services/i18n.service';
import type { ChatThreadInfo } from '../chat.types';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, Button, TooltipModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="chat-sidebar w-60 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <p-button
        [label]="'chat.newThread' | translate"
        icon="pi pi-plus"
        [outlined]="true"
        size="small"
        (onClick)="newThread.emit()"
        [pTooltip]="'chat.newThread' | translate"
        class="m-2"
      ></p-button>
      <div class="flex-1 overflow-y-auto min-h-0">
        @if (loading()) {
          <div class="px-3 py-4 text-center">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'common.loading' | translate }}</span>
          </div>
        } @else if (threads().length === 0) {
          <div class="px-3 py-4 text-center">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.noConversations' | translate }}</span>
          </div>
        } @else {
          @for (thread of threads(); track thread.id) {
            <div
              class="chat-thread-item group flex items-center gap-2 px-3 py-2.5 cursor-pointer text-left border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              [class.bg-blue-50]="activeThreadId() === thread.id"
              [class.dark:bg-blue-900/20]="activeThreadId() === thread.id"
              (click)="selectThread.emit(thread)"
            >
              <span
                class="truncate flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200"
                [title]="getThreadLabel(thread)"
              >
                {{ getThreadLabel(thread) }}
              </span>
              <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <p-button
                  icon="pi pi-download"
                  [text]="true"
                  size="small"
                  severity="secondary"
                  (onClick)="exportThread.emit(thread); $event.stopPropagation()"
                  [pTooltip]="'chat.exportThread' | translate"
                ></p-button>
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  size="small"
                  severity="danger"
                  (onClick)="deleteThread.emit(thread); $event.stopPropagation()"
                  [pTooltip]="'chat.deleteThread' | translate"
                ></p-button>
              </div>
            </div>
          }
        }
      </div>
    </aside>
  `,
})
export class ChatSidebarComponent {
  private readonly i18nService = inject(I18nService);

  threads = input.required<ChatThreadInfo[]>();
  activeThreadId = input<string | null>(null);
  loading = input<boolean>(false);

  newThread = output<void>();
  selectThread = output<ChatThreadInfo>();
  exportThread = output<ChatThreadInfo>();
  deleteThread = output<ChatThreadInfo>();

  getThreadLabel(thread: ChatThreadInfo): string {
    const title = thread.title || this.i18nService.translate('chat.threadTitle');
    const date = thread.updatedAt
      ? new Date(thread.updatedAt).toLocaleDateString(undefined, { dateStyle: 'short' })
      : '';
    return date ? `${title} (${date})` : title;
  }
}
