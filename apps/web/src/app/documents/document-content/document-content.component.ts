import { Component, OnInit, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Button } from 'primeng/button';
import { Toast } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-document-content',
  standalone: true,
  imports: [CommonModule, Button, Toast, MessageModule, TranslatePipe],
  providers: [MessageService],
  template: `
    <div class="document-content-container">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {{ 'documentContent.title' | translate }}
          </h3>
          @if (contentData()) {
            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ 'documentContent.currentVersion' | translate }}: {{ contentData()?.versionNumber || 0 }} • 
              {{ 'documentContent.lastUpdated' | translate }}: {{ formatDate(contentData()?.lastUpdated || '') }}
            </div>
          }
        </div>
        <p-button
          [label]="'documentContent.refresh' | translate"
          icon="pi pi-refresh"
          [loading]="loading()"
          (onClick)="loadContent()"
        ></p-button>
      </div>

      @if (loading()) {
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          {{ 'documentContent.loading' | translate }}
        </div>
      }

      @if (!loading() && error()) {
        <p-message
          severity="error"
          [text]="'documentContent.error' | translate"
        ></p-message>
      }

      @if (!loading() && !error() && contentData()) {
        <div class="content-display">
          <div class="mb-2 text-sm text-gray-600 dark:text-gray-400">
            {{ 'documentContent.selectTextHint' | translate }}
          </div>
          <div
            class="content-textarea p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[600px]"
            [attr.contenteditable]="false"
            (mouseup)="onTextSelection()"
          >
            {{ contentData()?.content }}
          </div>
        </div>
      }

      @if (!loading() && !error() && !contentData()) {
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          {{ 'documentContent.noContent' | translate }}
        </div>
      }

      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .document-content-container {
      max-width: 100%;
    }
    .content-textarea {
      min-height: 200px;
      user-select: text;
      cursor: text;
    }
  `],
})
export class DocumentContentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  workspaceId = signal('');
  documentId = signal('');
  loading = signal(false);
  error = signal(false);
  contentData = signal<{ content: string; versionNumber: number; lastUpdated: string } | null>(null);
  
  textSelected = output<{ text: string; startIndex?: number; endIndex?: number }>();

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    const docId = this.route.snapshot.paramMap.get('documentId') || '';
    this.workspaceId.set(wsId);
    this.documentId.set(docId);

    this.loadContent();
  }

  loadContent(): void {
    this.loading.set(true);
    this.error.set(false);

    this.apiService.getDocumentContent(this.workspaceId(), this.documentId()).subscribe({
      next: (data) => {
        this.contentData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading document content:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: this.translateService.instant(_('documentContent.error')),
        });
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  onTextSelection(): void {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const selectedText = selection.toString().trim();
      
      // Get position information if available
      const range = selection.getRangeAt(0);
      const contentElement = this.getContentElement();
      
      // Calculate start and end indices relative to document content
      let startIndex: number | undefined;
      let endIndex: number | undefined;
      
      if (contentElement && this.contentData()?.content) {
        const fullText = this.contentData()!.content;
        
        // Try to get the text node containing the selection
        const container = range.commonAncestorContainer;
        
        if (container.nodeType === Node.TEXT_NODE) {
          // Selection is within a text node
          const textNode = container as Text;
          const textBefore = fullText.substring(0, fullText.indexOf(textNode.textContent || ''));
          startIndex = textBefore.length + range.startOffset;
          endIndex = startIndex + selectedText.length;
        } else {
          // Fallback: try to find position using range
          try {
            const beforeRange = range.cloneRange();
            beforeRange.selectNodeContents(contentElement);
            beforeRange.setEnd(range.startContainer, range.startOffset);
            const textBefore = beforeRange.toString();
            startIndex = textBefore.length;
            endIndex = startIndex + selectedText.length;
          } catch (e) {
            // If calculation fails, just emit text without position
            console.warn('Could not calculate text position:', e);
          }
        }
      }
      
      this.textSelected.emit({ 
        text: selectedText,
        startIndex: startIndex !== undefined && startIndex >= 0 ? startIndex : undefined,
        endIndex: endIndex !== undefined && endIndex >= 0 ? endIndex : undefined,
      });
    }
  }

  private getContentElement(): HTMLElement | null {
    // Find the content display element
    const container = document.querySelector('.content-textarea');
    return container as HTMLElement | null;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  }
}
