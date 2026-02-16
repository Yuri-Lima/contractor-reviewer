import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { TranslateService } from '@ngx-translate/core';
import { Document } from '@contractai-review/shared';
import { LocaleDatePipe } from '../../core/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [CommonModule, RouterModule, Button, ConfirmDialog, Toast, LocaleDatePipe, TranslatePipe],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="documents-container p-6">
      <div class="documents-header mb-8">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100">{{ 'documents.title' | translate }}</h1>
        <button 
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          (click)="showCreateForm.set(true)"
        >
          {{ 'documents.create' | translate }}
        </button>
      </div>

      @if (showCreateForm()) {
        <div class="create-form mb-8">
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">{{ 'documents.create' | translate }}</h3>
            <input 
              [value]="newDocumentTitle()" 
              (input)="onTitleInput($event)" 
              class="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              [placeholder]="'documents.titlePlaceholder' | translate" 
            />
            <textarea 
              [value]="newDocumentDescription()" 
              (input)="onDescriptionInput($event)" 
              class="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
              [placeholder]="'documents.descriptionPlaceholder' | translate" 
              rows="3"
            ></textarea>
            @if (error()) {
              <div class="error-message mb-4">
                <p class="text-red-600 dark:text-red-400 text-sm">{{ error() }}</p>
              </div>
            }
            <div class="form-actions flex gap-3">
              <button 
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                (click)="createDocument()"
                [disabled]="loading()"
              >
                @if (!loading()) {
                  <span>{{ 'common.create' | translate }}</span>
                }
                @if (loading()) {
                  <span>{{ 'documents.creating' | translate }}</span>
                }
              </button>
              <button 
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium"
                (click)="showCreateForm.set(false); error.set(null);"
                [disabled]="loading()"
              >
                {{ 'common.cancel' | translate }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (documents().length > 0) {
        <div class="documents-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (doc of documents(); track doc.id) {
            <div
              class="document-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-200 relative group"
            >
              <a
                [routerLink]="['/workspaces', workspaceId(), 'documents', doc.id]"
                class="block no-underline"
              >
                <h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">{{ doc.title }}</h3>
                @if (doc.description) {
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ doc.description }}</p>
                }
                <div class="document-meta flex justify-between items-center">
                  <span 
                    class="px-2 py-1 text-xs rounded"
                    [class.bg-green-100]="doc.status === 'available'"
                    [class.text-green-800]="doc.status === 'available'"
                    [class.dark:bg-green-900]="doc.status === 'available'"
                    [class.dark:text-green-200]="doc.status === 'available'"
                    [class.bg-gray-100]="doc.status !== 'available'"
                    [class.text-gray-800]="doc.status !== 'available'"
                    [class.dark:bg-gray-700]="doc.status !== 'available'"
                    [class.dark:text-gray-300]="doc.status !== 'available'"
                  >
                    {{ doc.status }}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ doc.createdAt | localeDate: 'short' }}</span>
                </div>
              </a>
              <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  severity="danger"
                  [rounded]="true"
                  (onClick)="confirmDelete(doc)"
                  [disabled]="deletingDocId() === doc.id"
                  class="hover:bg-red-50 dark:hover:bg-red-900/20"
                ></p-button>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state text-center py-12 px-8">
          <p class="text-gray-600 dark:text-gray-400">{{ 'documents.noDocumentsFound' | translate }}</p>
        </div>
      }

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .documents-container { max-width: 1200px; margin: 0 auto; }
  `],
})
export class DocumentsListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  workspaceId = signal('');
  documents = signal<Document[]>([]);
  showCreateForm = signal(false);
  newDocumentTitle = signal('');
  newDocumentDescription = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  deletingDocId = signal<string | null>(null);

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.apiService.getDocuments(this.workspaceId()).subscribe({
      next: (docs) => this.documents.set(docs),
      error: (err) => console.error('Error loading documents:', err),
    });
  }

  onTitleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.newDocumentTitle.set(target.value);
    }
  }

  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      this.newDocumentDescription.set(target.value);
    }
  }

  createDocument(): void {
    const title = this.newDocumentTitle().trim();
    if (!title) {
      this.error.set(this.translateService.instant('documents.titleRequired'));
      return;
    }

    const workspaceId = this.workspaceId();
    if (!workspaceId) {
      this.error.set(this.translateService.instant('documents.workspaceIdNotFound'));
      console.error('Workspace ID is missing');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    console.log('Creating document:', { workspaceId, title, description: this.newDocumentDescription() });

    this.apiService.createDocument(workspaceId, {
      title: title,
      description: this.newDocumentDescription() || undefined,
    }).subscribe({
      next: (document) => {
        console.log('Document created successfully:', document);
        this.loading.set(false);
        this.showCreateForm.set(false);
        this.newDocumentTitle.set('');
        this.newDocumentDescription.set('');
        this.error.set(null);
        // Reload documents list
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Error creating document:', err);
        console.error('Error details:', {
          status: err.status,
          statusText: err.statusText,
          message: err.message,
          error: err.error,
          url: err.url,
        });
        this.loading.set(false);
        const errorMessage = err.error?.message || err.message || this.translateService.instant('documents.createError');
        this.error.set(errorMessage);
      },
    });
  }

  confirmDelete(doc: Document): void {
    this.confirmationService.confirm({
      message: this.translateService.instant('documents.confirmDeleteMessage', { title: doc.title }),
      header: this.translateService.instant('documents.confirmDelete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant('common.delete'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => {
        this.deleteDocument(doc.id);
      },
    });
  }

  deleteDocument(docId: string): void {
    this.deletingDocId.set(docId);
    this.apiService.deleteDocument(this.workspaceId(), docId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('documents.deleteSuccess'),
        });
        this.deletingDocId.set(null);
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Error deleting document:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('documents.deleteError'),
        });
        this.deletingDocId.set(null);
      },
    });
  }
}
