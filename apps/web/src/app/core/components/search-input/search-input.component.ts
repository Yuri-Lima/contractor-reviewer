import {
  Component,
  input,
  output,
  signal,
  inject,
  effect,
  ChangeDetectionStrategy,
  DestroyRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InputText } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { TranslatePipe } from '@ngx-translate/core';

export interface SearchScopeOption {
  value: string;
  labelKey: string;
}

export interface SearchModeOption {
  value: 'fuzzy' | 'contains';
  labelKey: string;
}

/**
 * Reusable search input with debouncing, optional scope selector, and clear button.
 * Production-grade: accessibility, i18n, OnPush, proper cleanup.
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, InputText, SelectModule, SliderModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [attr.role]="'search'"
      [class]="'search-input-wrapper flex flex-wrap items-center gap-3 ' + (class())"
      [attr.data-tour]="dataTour() ?? undefined"
    >
      <!-- Group A: Primary search - Scope + Input + Clear -->
      @if (showScopeSelector() && scopeOptions().length > 0) {
        <p-select
          [options]="scopeOptions()"
          [ngModel]="scope()"
          (ngModelChange)="onScopeChange($event)"
          optionLabel="labelKey"
          optionValue="value"
          [placeholder]="'common.search' | translate"
          [style]="{ minWidth: '140px' }"
          styleClass="search-input-select"
          [disabled]="disabled()"
        >
          <ng-template let-opt pTemplate="item">
            {{ opt.labelKey | translate }}
          </ng-template>
          <ng-template let-selected pTemplate="selectedItem">
            @if (selected) {
              {{ selected.labelKey | translate }}
            }
          </ng-template>
        </p-select>
      }
      <span class="search-input-field p-input-icon-left flex-1 min-w-[180px] max-w-md">
        <i [class]="icon()" class="search-input-icon"></i>
        <input
          pInputText
          type="text"
          [value]="internalValue()"
          (input)="onInput($event)"
          [placeholder]="placeholderKey() | translate"
          [attr.aria-label]="ariaLabelKey() | translate"
          class="w-full"
          [disabled]="disabled()"
        />
      </span>
      @if (showClearButton() && internalValue()) {
        <button
          type="button"
          class="search-input-clear p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 inline-flex items-center justify-center min-h-[2.5rem]"
          [attr.aria-label]="'common.clearSearch' | translate"
          (click)="clear()"
          [disabled]="disabled()"
        >
          <i class="pi pi-times text-gray-600 dark:text-gray-400"></i>
        </button>
      }
      <!-- Group B: Options - Mode + Similarity (with divider) -->
      @if ((showSearchModeSelector() && searchModeOptions().length > 0) || (showSimilaritySlider() && searchMode() === 'fuzzy')) {
        <div class="flex flex-wrap items-center gap-3 border-l border-gray-200 dark:border-gray-600 pl-3 ml-1 flex-shrink-0">
          @if (showSearchModeSelector() && searchModeOptions().length > 0) {
            <p-select
              [options]="searchModeOptions()"
              [ngModel]="searchMode()"
              (ngModelChange)="onSearchModeChange($event)"
              optionLabel="labelKey"
              optionValue="value"
              [style]="{ minWidth: '120px' }"
              styleClass="search-input-select"
              [disabled]="disabled()"
            >
              <ng-template let-opt pTemplate="item">
                {{ opt.labelKey | translate }}
              </ng-template>
              <ng-template let-selected pTemplate="selectedItem">
                @if (selected) {
                  {{ selected.labelKey | translate }}
                }
              </ng-template>
            </p-select>
          }
          @if (showSimilaritySlider() && searchMode() === 'fuzzy') {
            <div class="flex items-center gap-2 flex-shrink-0 min-w-[140px]">
              <span class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap" [attr.aria-label]="'documents.similarityThreshold' | translate">
                {{ 'documents.similarityThreshold' | translate }}: {{ (similarityValue() * 100) | number:'1.0-0' }}%
              </span>
              <p-slider
                [ngModel]="similarityValue()"
                (ngModelChange)="onSimilarityChange($event)"
                [min]="0"
                [max]="1"
                [step]="similarityStep()"
                [style]="{ width: '80px' }"
                [disabled]="disabled()"
              />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .search-input-wrapper {
      min-height: 2.5rem;
    }
    .search-input-select {
      flex-shrink: 0;
    }
    .search-input-field {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .search-input-field.p-input-icon-left .search-input-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      margin: 0;
      pointer-events: none;
    }
    .search-input-field.p-input-icon-left input {
      padding-left: 2.25rem;
    }
  `],
})
export class SearchInputComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private searchSubject = new Subject<string>();

  value = input<string>('');
  placeholderKey = input<string>('common.search');
  debounceMs = input<number>(300);
  showClearButton = input<boolean>(true);
  showSearchModeSelector = input<boolean>(false);
  searchModeOptions = input<SearchModeOption[]>([]);
  searchMode = input<'fuzzy' | 'contains'>('contains');
  showSimilaritySlider = input<boolean>(false);
  similarityThreshold = input<number>(0.2);
  similarityStep = input<number>(0.05);
  showScopeSelector = input<boolean>(false);
  scopeOptions = input<SearchScopeOption[]>([]);
  scope = input<string>('all');
  disabled = input<boolean>(false);
  ariaLabelKey = input<string>('common.search');
  dataTour = input<string | undefined>(undefined);
  size = input<'sm' | 'md' | 'lg'>('md');
  icon = input<string>('pi pi-search');
  class = input<string>('');

  valueChange = output<string>();
  searchModeChange = output<'fuzzy' | 'contains'>();
  scopeChange = output<string>();
  similarityThresholdChange = output<number>();

  internalValue = signal<string>('');
  similarityValue = signal<number>(0.2);

  constructor() {
    effect(() => {
      this.internalValue.set(this.value());
    });
    effect(() => {
      this.similarityValue.set(this.similarityThreshold());
    });
  }

  ngOnInit(): void {
    this.searchSubject
      .pipe(
        debounceTime(this.debounceMs()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((v: string) => this.valueChange.emit(v));
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const v = target?.value?.trim() ?? '';
    this.internalValue.set(target?.value ?? '');
    this.searchSubject.next(v);
  }

  protected onSearchModeChange(value: string): void {
    if (value === 'fuzzy' || value === 'contains') {
      this.searchModeChange.emit(value);
    }
  }

  protected onScopeChange(value: string): void {
    this.scopeChange.emit(value);
  }

  protected onSimilarityChange(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.similarityValue.set(clamped);
    this.similarityThresholdChange.emit(clamped);
  }

  protected clear(): void {
    this.internalValue.set('');
    this.valueChange.emit('');
  }
}
