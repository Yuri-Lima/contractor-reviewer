import {
  Component,
  input,
  output,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

const MIN_ROWS = 1;
const MAX_ROWS = 8;
const LINE_HEIGHT = 24;

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, TooltipModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="chat-input-wrapper flex flex-col gap-2 px-4 py-3 rounded-2xl border transition-colors focus-within:border-[var(--primary-color)] focus-within:ring-1 focus-within:ring-[var(--primary-color)]"
      [class.opacity-60]="disabled()"
      style="border-color: var(--border); background-color: var(--surface);"
    >
      <!-- Textarea (Ask anything) -->
      <textarea
        #textareaRef
        [ngModel]="value()"
        (ngModelChange)="onValueChange($event)"
        (keydown)="onKeydown($event)"
        (input)="autoGrow()"
        class="chat-input-textarea w-full resize-none bg-transparent border-0 outline-none py-2 text-base leading-6"
        style="color: var(--text-primary);"
        [placeholder]="placeholderKey() | translate"
        [disabled]="disabled()"
        [attr.aria-label]="placeholderKey() | translate"
        rows="1"
        data-tour="chat-input"
      ></textarea>

      <!-- Icons row under Ask anything -->
      <div class="flex items-center justify-between gap-1 flex-shrink-0">
        <div class="flex items-center gap-0.5">
          <p-button
            icon="pi pi-plus"
            [rounded]="true"
            [text]="true"
            severity="secondary"
            (onClick)="onAttachClick()"
            [pTooltip]="'chat.attachFile' | translate"
            [attr.aria-label]="'chat.attachFile' | translate"
            styleClass="chat-toolbar-btn"
          ></p-button>
          <p-button
            icon="pi pi-globe"
            [rounded]="true"
            [text]="true"
            severity="secondary"
            [pTooltip]="'chat.language' | translate"
            [attr.aria-label]="'chat.language' | translate"
            styleClass="chat-toolbar-btn"
          ></p-button>
          <p-button
            icon="pi pi-file"
            [rounded]="true"
            [text]="true"
            severity="secondary"
            [pTooltip]="'chat.documents' | translate"
            [attr.aria-label]="'chat.documents' | translate"
            styleClass="chat-toolbar-btn"
          ></p-button>
          <p-button
            icon="pi pi-align-left"
            [rounded]="true"
            [text]="true"
            severity="secondary"
            [pTooltip]="'chat.auto' | translate"
            [attr.aria-label]="'chat.auto' | translate"
            styleClass="chat-toolbar-btn"
          >
            <span class="text-xs ml-1">{{ 'chat.auto' | translate }}</span>
          </p-button>
        </div>
        <div class="flex items-center gap-1">
          @if (voiceAvailable()) {
            <p-button
              [icon]="voiceRecording() ? 'pi pi-stop' : 'pi pi-microphone'"
              [severity]="voiceRecording() ? 'danger' : 'secondary'"
              [rounded]="true"
              [text]="true"
              [disabled]="disabled() || loading()"
              [loading]="voiceTranscribing()"
              (onClick)="voiceToggle.emit()"
              [pTooltip]="voiceRecording() ? ('chat.stopListening' | translate) : ('chat.voiceInput' | translate)"
              [attr.aria-label]="voiceRecording() ? ('chat.stopListening' | translate) : ('chat.voiceInput' | translate)"
            ></p-button>
          }
          <p-button
            icon="pi pi-arrow-up"
            [rounded]="true"
            severity="primary"
            [disabled]="!canSend()"
            [loading]="loading()"
            (onClick)="send.emit()"
            [pTooltip]="'documents.send' | translate"
            [attr.aria-label]="'documents.send' | translate"
            styleClass="chat-send-btn"
          ></p-button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .chat-input-textarea {
        max-height: 200px;
      }
      .chat-input-textarea::placeholder {
        color: var(--text-muted);
      }
      :host ::ng-deep .chat-toolbar-btn.p-button {
        color: var(--text-secondary);
      }
      :host ::ng-deep .chat-toolbar-btn.p-button:hover {
        color: var(--text-primary);
        background-color: color-mix(in srgb, var(--text-primary) 8%, var(--surface-hover));
      }
      :host ::ng-deep .chat-send-btn.p-button {
        background-color: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
      }
      :host ::ng-deep .chat-send-btn.p-button:hover:not(:disabled) {
        background-color: var(--primary-dark);
        border-color: var(--primary-dark);
      }
    `,
  ],
})
export class ChatInputComponent {
  textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textareaRef');

  value = input.required<string>();
  placeholderKey = input<string>('chat.askAnything');
  disabled = input<boolean>(false);
  loading = input<boolean>(false);
  voiceAvailable = input<boolean>(false);
  voiceRecording = input<boolean>(false);
  voiceTranscribing = input<boolean>(false);

  valueChange = output<string>();
  send = output<void>();
  voiceToggle = output<void>();
  attachClick = output<void>();

  canSend(): boolean {
    return !!this.value()?.trim() && !this.loading();
  }

  onValueChange(v: string): void {
    this.valueChange.emit(v);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.canSend()) {
        this.send.emit();
      }
    }
  }

  autoGrow(): void {
    const el = this.textareaRef()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    const lineCount = Math.min(
      Math.max(el.value.split('\n').length, MIN_ROWS),
      MAX_ROWS
    );
    el.style.height = `${lineCount * LINE_HEIGHT}px`;
  }

  onAttachClick(): void {
    this.attachClick.emit();
  }
}
