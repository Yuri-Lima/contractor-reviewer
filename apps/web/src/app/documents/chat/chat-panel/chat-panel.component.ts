import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import type { ChatMessageWithAudio, ChatThreadInfo } from '../chat.types';
import type { ChatResponseMode } from '@contractai-review/shared';
import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { ChatInputComponent } from '../chat-input/chat-input.component';
import { ChatSidebarComponent } from '../chat-sidebar/chat-sidebar.component';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [
    CommonModule,
    Button,
    Dialog,
    TooltipModule,
    TranslatePipe,
    ChatMessageComponent,
    ChatInputComponent,
    ChatSidebarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!fullscreenMode()) {
      <div class="chat-section flex flex-col h-[calc(100vh-12rem)] min-h-[400px] mt-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div class="chat-toolbar flex justify-end items-center px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <p-button
            icon="pi pi-window-maximize"
            [rounded]="true"
            [text]="true"
            severity="secondary"
            (onClick)="openFullscreen()"
            [pTooltip]="'chat.expandChat' | translate"
            [attr.aria-label]="'chat.expandChat' | translate"
          ></p-button>
        </div>
        <div class="chat-body flex flex-1 min-h-0">
          <app-chat-sidebar
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            [loading]="threadsLoading()"
            (newThread)="newThread.emit()"
            (selectThread)="selectThread.emit($event)"
            (exportThread)="exportThread.emit($event)"
            (deleteThread)="deleteThread.emit($event)"
          />
          <div class="chat-main flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900">
            <div class="chat-messages flex flex-col flex-1 overflow-y-auto px-4 pb-4 pt-1 min-h-0">
              @for (msg of messages(); track $index) {
                <app-chat-message
                  [message]="msg"
                  [index]="$index"
                  [chatResponseMode]="chatResponseMode()"
                  [playingMessageIndex]="playingMessageIndex()"
                  [defaultExpanded]="$index === messages().length - 1"
                  (playAudio)="playAudio.emit($index)"
                  (pauseAudio)="pauseAudio.emit($event)"
                  (getFreshResponse)="getFreshResponse.emit($index)"
                  (jumpToClause)="jumpToClause.emit($event)"
                />
              }
            </div>
            <div class="chat-input-area p-4 flex-shrink-0" data-tour="chat-input">
              <app-chat-input
                [value]="question()"
                [placeholderKey]="'chat.askAnything'"
                [disabled]="loading()"
                [loading]="loading()"
                [voiceAvailable]="voiceAvailable()"
                [voiceRecording]="voiceRecording()"
                [voiceTranscribing]="voiceTranscribing()"
                (valueChange)="questionChange.emit($event)"
                (send)="send.emit()"
                (voiceToggle)="voiceToggle.emit()"
                (attachClick)="attachClick.emit()"
              />
            </div>
          </div>
        </div>
      </div>
    }

    <p-dialog
      [visible]="fullscreenMode()"
      [header]="'chat.title' | translate"
      [draggable]="true"
      [maximizable]="true"
      [resizable]="true"
      [modal]="true"
      [dismissableMask]="false"
      [closable]="true"
      [style]="{ width: '90vw', height: '85vh' }"
      [contentStyle]="{ overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0' }"
      [baseZIndex]="10000"
      [appendTo]="'body'"
      (onHide)="closeFullscreen()"
      [ariaLabel]="'chat.title' | translate"
    >
        <div class="chat-section-dialog flex flex-row h-full min-h-0">
          <app-chat-sidebar
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            [loading]="threadsLoading()"
            (newThread)="newThread.emit()"
            (selectThread)="selectThread.emit($event)"
            (exportThread)="exportThread.emit($event)"
            (deleteThread)="deleteThread.emit($event)"
          />
          <div class="chat-main flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 min-h-0">
            <div class="chat-messages flex flex-col flex-1 overflow-y-auto px-4 pb-4 pt-1 min-h-0">
              @for (msg of messages(); track $index) {
                <app-chat-message
                  [message]="msg"
                  [index]="$index"
                  [chatResponseMode]="chatResponseMode()"
                  [playingMessageIndex]="playingMessageIndex()"
                  [defaultExpanded]="$index === messages().length - 1"
                  (playAudio)="playAudio.emit($index)"
                  (pauseAudio)="pauseAudio.emit($event)"
                  (getFreshResponse)="getFreshResponse.emit($index)"
                  (jumpToClause)="jumpToClause.emit($event)"
                />
              }
            </div>
            <div class="chat-input-area p-4 flex-shrink-0">
              <app-chat-input
                [value]="question()"
                [placeholderKey]="'chat.askAnything'"
                [disabled]="loading()"
                [loading]="loading()"
                [voiceAvailable]="voiceAvailable()"
                [voiceRecording]="voiceRecording()"
                [voiceTranscribing]="voiceTranscribing()"
                (valueChange)="questionChange.emit($event)"
                (send)="send.emit()"
                (voiceToggle)="voiceToggle.emit()"
                (attachClick)="attachClick.emit()"
              />
            </div>
          </div>
        </div>
    </p-dialog>
  `,
  styles: [
    `
      .chat-section-dialog {
        display: flex;
        flex-direction: row;
        height: 100%;
        min-height: 0;
      }
      .chat-section-dialog app-chat-sidebar {
        flex-shrink: 0;
      }
      .chat-messages {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-top: 0.125rem; /* minimal - match gap so first item has same spacing as between items */
      }
    `,
  ],
})
export class ChatPanelComponent {
  messages = input.required<ChatMessageWithAudio[]>();
  threads = input.required<ChatThreadInfo[]>();
  activeThreadId = input<string | null>(null);
  question = input.required<string>();
  loading = input<boolean>(false);
  chatResponseMode = input<ChatResponseMode>('text_only');
  voiceAvailable = input<boolean>(false);
  voiceRecording = input<boolean>(false);
  voiceTranscribing = input<boolean>(false);
  playingMessageIndex = input<number | null>(null);
  threadsLoading = input<boolean>(false);

  questionChange = output<string>();
  send = output<void>();
  voiceToggle = output<void>();
  newThread = output<void>();
  selectThread = output<ChatThreadInfo>();
  exportThread = output<ChatThreadInfo>();
  deleteThread = output<ChatThreadInfo>();
  playAudio = output<number>();
  pauseAudio = output<number>();
  getFreshResponse = output<number>();
  attachClick = output<void>();
  /** Forwarded from LegalAnswerComponent: clauseRef the user wants to scroll to in the document viewer. */
  jumpToClause = output<string>();

  fullscreenMode = signal(false);

  openFullscreen(): void {
    this.fullscreenMode.set(true);
  }

  closeFullscreen(): void {
    // Defer to avoid PrimeNG Dialog race conditions and click-through when closing
    setTimeout(() => this.fullscreenMode.set(false), 0);
  }
}
