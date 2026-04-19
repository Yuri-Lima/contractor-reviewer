import {
  Component,
  input,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  effect,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IncremarkContent } from '@incremark/react';
import { normalizeCitationMarkdown } from '../../../core/utils/citation-markdown';

@Component({
  selector: 'app-incremark-wrapper',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="incremark-host"></div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .incremark-host {
        width: 100%;
      }
      .incremark-host h1,
      .incremark-host h2,
      .incremark-host h3 {
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: 600;
      }
      .incremark-host p {
        margin-bottom: 0.75em;
        line-height: 1.6;
      }
    `,
  ],
})
export class IncremarkWrapperComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  content = input.required<string>();
  isFinished = input<boolean>(false);

  private readonly platformId = inject(PLATFORM_ID);
  private reactRoot: Root | null = null;

  constructor() {
    effect(() => {
      const c = this.content();
      const f = this.isFinished();
      if (this.reactRoot) {
        this.render(c, f);
      }
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.mountReactRoot();
  }

  ngOnDestroy(): void {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }

  private mountReactRoot(): void {
    if (!this.hostRef?.nativeElement) return;

    this.reactRoot = createRoot(this.hostRef.nativeElement);
    this.render(this.content(), this.isFinished());
  }

  private render(content: string, isFinished: boolean): void {
    if (!this.reactRoot) return;

    const normalized = normalizeCitationMarkdown(content ?? '');
    const element = createElement(IncremarkContent, {
      content: normalized,
      isFinished,
    });

    this.reactRoot.render(element);
  }
}
