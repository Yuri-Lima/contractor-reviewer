import {
  Component,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable inline-editable title component.
 * Pencil icon appears on hover; click the pencil to edit.
 * Save on blur or Enter; cancel on Escape.
 */
@Component({
  selector: 'app-editable-title',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing()) {
      <input
        #editInput
        type="text"
        [value]="editValue()"
        (input)="onEditInput($event)"
        (blur)="save()"
        (keydown.enter)="save(); $event.preventDefault()"
        (keydown.escape)="cancel(); $event.preventDefault()"
        [class]="inputClass()"
      />
    } @else {
      <div
        class="editable-title-wrapper group inline-flex items-center gap-2 w-full min-w-0"
      >
        <h3
          [class]="displayClass()"
          [title]="value()"
        >
          {{ value() }}
        </h3>
        @if (canEdit()) {
          <i
            class="pi pi-pencil text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex-shrink-0 cursor-pointer"
            aria-hidden="true"
            (click)="startEdit(); $event.stopPropagation(); $event.preventDefault()"
          ></i>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      input {
        width: 100%;
        background: rgb(var(--p-surface-0));
        border: 1px solid rgb(var(--p-primary-500));
        border-radius: 0.375rem;
        padding: 0.25rem 0.5rem;
        font-size: inherit;
        font-weight: inherit;
        outline: none;
        box-shadow: 0 0 0 2px rgb(var(--p-primary-200) / 0.5);
      }
      input:focus {
        box-shadow: 0 0 0 2px rgb(var(--p-primary-500));
      }
    `,
  ],
})
export class EditableTitleComponent {
  private editInputRef = viewChild<ElementRef<HTMLInputElement>>('editInput');

  value = input.required<string>();
  canEdit = input<boolean>(true);
  placeholder = input<string>('');
  size = input<'sm' | 'md' | 'lg'>('md');
  displayTruncate = input<boolean>(true);

  valueChange = output<string>();

  editing = signal(false);
  editValue = signal('');

  inputClass = () =>
    'w-full text-lg font-semibold bg-white dark:bg-gray-800 border border-blue-500 rounded px-2 py-1 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  private sizeClass = () => {
    const s = this.size();
    return s === 'sm' ? 'text-base' : s === 'lg' ? 'text-3xl' : 'text-lg';
  };

  displayClass = () =>
    `${this.sizeClass()} font-semibold text-gray-800 dark:text-gray-100 mb-1 transition-colors min-w-0 ${this.displayTruncate() ? 'truncate' : ''}`;

  constructor() {
    effect(() => {
      if (this.editing()) {
        queueMicrotask(() => this.editInputRef()?.nativeElement?.focus());
      }
    });
  }

  startEdit(): void {
    this.editValue.set(this.value());
    this.editing.set(true);
  }

  onEditInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) this.editValue.set(target.value);
  }

  save(): void {
    const trimmed = this.editValue().trim();
    this.editing.set(false);
    if (!trimmed) return;
    if (trimmed !== this.value()) {
      this.valueChange.emit(trimmed);
    }
  }

  cancel(): void {
    this.editing.set(false);
    this.editValue.set('');
  }
}
