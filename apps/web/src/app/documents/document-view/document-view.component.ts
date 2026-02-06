import { Component, OnInit, OnDestroy, signal, computed, effect, inject, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { ProgressBar } from 'primeng/progressbar';
import { ApiService } from '../../core/services/api.service';
import { TranslateService } from '@ngx-translate/core';
import { Document, DocumentFile, DocumentJob, JobStatus } from '../../core/models/document.model';
import { ChatResponse, Citation } from '../../core/models/chat.model';
import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';
import { RedlineComponent } from '../redline/redline.component';

@Component({
  selector: 'app-document-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    Button,
    ConfirmDialog,
    Toast,
    TabsModule,
    ProgressBar,
    PdfViewerComponent,
    RedlineComponent,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="document-view-container p-6 max-w-7xl mx-auto">
      <div class="document-header flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">{{ document()?.title }}</h1>
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Status: 
              <span class="font-semibold" [class.text-green-600]="document()?.status === 'available'"
                    [class.text-yellow-600]="document()?.status === 'processing'"
                    [class.text-red-600]="document()?.status === 'error'">
                {{ document()?.status }}
              </span>
            </span>
            <span *ngIf="document()?.resolvedJurisdiction">
              Jurisdição: {{ document()?.resolvedJurisdiction }}
              <span class="text-xs">({{ document()?.jurisdictionStatus }})</span>
            </span>
          </div>
        </div>
        <div class="document-actions flex gap-2">
          <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf,.docx,.txt,.png,.jpg" style="display: none" />
          <p-button
            label="Upload Arquivo"
            icon="pi pi-upload"
            [outlined]="true"
            (onClick)="triggerFileInput()"
          ></p-button>
          <p-button
            *ngIf="canDelete()"
            label="Deletar"
            icon="pi pi-trash"
            severity="danger"
            [outlined]="true"
            (onClick)="confirmDelete()"
          ></p-button>
        </div>
      </div>

      <!-- Job Progress Indicator -->
      <div *ngIf="hasActiveJobs()" class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">Processamento em andamento</h3>
        <div class="space-y-3">
          <div *ngFor="let job of activeJobs()" class="job-progress-item">
            <div class="flex justify-between items-center mb-1">
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ getJobTypeLabel(job.type) }}</span>
              <span class="text-xs text-gray-600 dark:text-gray-400">{{ job.progress }}%</span>
            </div>
            <p-progressBar [value]="job.progress" [showValue]="false"></p-progressBar>
            <span class="text-xs text-gray-500 dark:text-gray-400 mt-1 block">{{ getJobStatusLabel(job.status) }}</span>
          </div>
        </div>
      </div>

      <p-tabs value="0">
        <p-tablist>
          <p-tab value="0">Arquivos</p-tab>
          <p-tab value="1">Redline</p-tab>
          <p-tab value="2">Chat</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="0">
            <div class="files-section mt-4">
              <div *ngIf="files().length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum arquivo enviado. Faça upload de um arquivo para começar.
              </div>
              <div *ngIf="files().length > 0" class="space-y-4">
                <div *ngFor="let file of files()" class="file-item p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center">
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-gray-100">{{ file.fileName }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {{ formatFileSize(file.sizeBytes) }} • {{ file.mimeType }}
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <p-button
                      label="Visualizar"
                      icon="pi pi-eye"
                      [outlined]="true"
                      (onClick)="viewFile(file)"
                      *ngIf="file.status === 'available'"
                    ></p-button>
                    <p-button 
                      label="Download" 
                      icon="pi pi-download" 
                      [outlined]="true" 
                      severity="secondary"
                      (onClick)="downloadFile(file)"
                    ></p-button>
                  </div>
                </div>
              </div>
            </div>
          </p-tabpanel>

          <p-tabpanel value="1">
            <app-redline></app-redline>
          </p-tabpanel>

          <p-tabpanel value="2">
            <div class="chat-section mt-4">
              <div class="chat-messages space-y-4 mb-4 max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div *ngFor="let msg of chatMessages()" class="chat-message p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div class="message-question mb-3">
                    <strong class="text-blue-600 dark:text-blue-400">Você:</strong>
                    <p class="text-gray-800 dark:text-gray-200 mt-1">{{ msg.question }}</p>
                  </div>
                  <div class="message-answer" *ngIf="msg.answerText">
                    <strong class="text-green-600 dark:text-green-400">Assistente:</strong>
                    <p class="text-gray-800 dark:text-gray-200 mt-1 mb-2">{{ msg.answerText }}</p>
                    <div class="confidence-badge inline-block px-2 py-1 rounded text-xs font-semibold mb-2"
                         [class.bg-green-100]="msg.confidence === 'high'"
                         [class.text-green-800]="msg.confidence === 'high'"
                         [class.dark:bg-green-900]="msg.confidence === 'high'"
                         [class.dark:text-green-200]="msg.confidence === 'high'"
                         [class.bg-yellow-100]="msg.confidence === 'medium'"
                         [class.text-yellow-800]="msg.confidence === 'medium'"
                         [class.dark:bg-yellow-900]="msg.confidence === 'medium'"
                         [class.dark:text-yellow-200]="msg.confidence === 'medium'"
                         [class.bg-red-100]="msg.confidence === 'low'"
                         [class.text-red-800]="msg.confidence === 'low'"
                         [class.dark:bg-red-900]="msg.confidence === 'low'"
                         [class.dark:text-red-200]="msg.confidence === 'low'">
                      Confiança: {{ msg.confidence }}
                    </div>
                    <div class="citations mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" *ngIf="msg.citations && msg.citations.length > 0">
                      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Citações:</h4>
                      <div *ngFor="let citation of msg.citations" class="citation text-sm text-gray-600 dark:text-gray-400 mb-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                        <span *ngIf="citation.fileName" class="font-medium">{{ citation.fileName }}</span>
                        <span *ngIf="citation.pageNumber"> - Página {{ citation.pageNumber }}</span>
                        <div *ngIf="citation.quoteSnippet" class="mt-1 italic text-xs">"{{ citation.quoteSnippet }}"</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="chat-input flex gap-2">
                <input
                  [value]="question()"
                  (input)="onQuestionInput($event)"
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Faça uma pergunta sobre o contrato..."
                  (keyup.enter)="sendQuestion()"
                />
                <p-button
                  label="Enviar"
                  icon="pi pi-send"
                  [disabled]="!question().trim() || loading()"
                  [loading]="loading()"
                  (onClick)="sendQuestion()"
                ></p-button>
              </div>
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>

      <!-- File Viewer Modal -->
      <div *ngIf="selectedFile()" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" (click)="closeFileViewer()">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto" (click)="$event.stopPropagation()">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedFile()?.fileName }}</h3>
            <p-button icon="pi pi-times" [text]="true" (onClick)="closeFileViewer()" severity="secondary"></p-button>
          </div>
          <div class="p-4">
            <app-pdf-viewer
              *ngIf="isPdfFile(selectedFile()!)"
              [fileUrl]="getFileObjectUrl(selectedFile()!.id)"
              [fileName]="selectedFile()!.fileName"
            ></app-pdf-viewer>
            <div *ngIf="isImageFile(selectedFile()!)" class="flex justify-center">
              <img [src]="getFileObjectUrl(selectedFile()!.id)" [alt]="selectedFile()!.fileName" class="max-w-full h-auto" />
            </div>
            <div *ngIf="isTextFile(selectedFile()!)" class="p-4 bg-gray-50 dark:bg-gray-900 rounded">
              <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ textFileContent() }}</pre>
            </div>
          </div>
        </div>
      </div>

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .job-progress-item {
      margin-bottom: 0.5rem;
    }
  `],
})
export class DocumentViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  // ViewChild como signal
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  workspaceId = signal('');
  documentId = signal('');
  document = signal<Document | null>(null);
  question = signal('');
  loading = signal(false);
  chatMessages = signal<Array<{ question: string; answerText?: string; confidence?: string; citations?: Citation[] }>>([]);
  selectedFile = signal<DocumentFile | null>(null);
  textFileContent = signal<string>('');
  fileObjectUrls = signal<Map<string, string>>(new Map());
  jobs = signal<DocumentJob[]>([]);
  jobsPollingInterval: any = null;

  files = computed(() => this.document()?.files || []);
  activeJobs = computed(() => this.jobs().filter(j => j.status === 'pending' || j.status === 'processing'));
  hasActiveJobs = computed(() => this.activeJobs().length > 0);
  
  canDelete = computed(() => {
    // TODO: Check user role (ADMIN/OWNER)
    return true; // Placeholder - implementar verificação de role
  });

  constructor() {
    // Effect para recarregar documento quando IDs mudarem
    effect(() => {
      const wsId = this.workspaceId();
      const docId = this.documentId();
      if (wsId && docId) {
        this.loadDocument();
        this.loadJobs();
        this.startJobsPolling();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.jobsPollingInterval) {
      clearInterval(this.jobsPollingInterval);
    }
    // Clean up object URLs to prevent memory leaks
    this.fileObjectUrls().forEach(url => URL.revokeObjectURL(url));
    this.fileObjectUrls.set(new Map());
  }

  ngOnInit(): void {
    this.workspaceId.set(this.route.snapshot.paramMap.get('workspaceId') || '');
    this.documentId.set(this.route.snapshot.paramMap.get('documentId') || '');
  }

  loadDocument(): void {
    this.apiService.getDocument(this.workspaceId(), this.documentId()).subscribe({
      next: (doc) => {
        this.document.set(doc);
        if (doc.jobs) {
          this.jobs.set(doc.jobs);
        }
      },
      error: (err) => console.error('Error loading document:', err),
    });
  }

  loadJobs(): void {
    this.apiService.getDocumentJobs(this.workspaceId(), this.documentId()).subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        // Stop polling if all jobs are completed or failed
        if (!this.hasActiveJobs()) {
          this.stopJobsPolling();
        }
      },
      error: (err) => console.error('Error loading jobs:', err),
    });
  }

  startJobsPolling(): void {
    this.stopJobsPolling();
    this.jobsPollingInterval = setInterval(() => {
      if (this.hasActiveJobs()) {
        this.loadJobs();
      }
    }, 2000); // Poll every 2 seconds
  }

  stopJobsPolling(): void {
    if (this.jobsPollingInterval) {
      clearInterval(this.jobsPollingInterval);
      this.jobsPollingInterval = null;
    }
  }

  getJobTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'ocr': 'OCR',
      'parsing': 'Parsing',
      'chunking': 'Chunking',
      'embedding': 'Embeddings',
      'embeddings': 'Embeddings', // Backward compatibility
    };
    return labels[type] || type;
  }

  getJobStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'Aguardando',
      'processing': 'Processando',
      'completed': 'Concluído',
      'failed': 'Falhou',
    };
    return labels[status] || status;
  }

  triggerFileInput(): void {
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.click();
    }
  }

  onQuestionInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.question.set(target.value);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.apiService.uploadFile(this.workspaceId(), this.documentId(), input.files[0]).subscribe({
        next: () => this.loadDocument(),
        error: (err) => console.error('Error uploading file:', err),
      });
    }
  }

  sendQuestion(): void {
    const questionText = this.question().trim();
    if (!questionText) return;
    
    this.loading.set(true);
    this.question.set('');
    
    this.apiService.chat(this.workspaceId(), this.documentId(), { question: questionText }).subscribe({
      next: (response: ChatResponse) => {
        this.chatMessages.update((messages) => [
          ...messages,
          {
            question: questionText,
            answerText: response.answerText,
            confidence: response.confidence,
            citations: response.citations,
          },
        ]);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error sending question:', err);
        this.loading.set(false);
      },
    });
  }

  getDownloadUrl(fileId: string): string {
    return this.apiService.downloadFile(this.workspaceId(), this.documentId(), fileId);
  }

  getFileObjectUrl(fileId: string): string {
    // Check if we already have an object URL for this file
    const existingUrl = this.fileObjectUrls().get(fileId);
    if (existingUrl) {
      return existingUrl;
    }

    // Create a placeholder URL - will be replaced when file is loaded
    return '';
  }

  loadFileAsBlob(file: DocumentFile): void {
    const existingUrl = this.fileObjectUrls().get(file.id);
    if (existingUrl) {
      return; // Already loaded
    }

    this.apiService.downloadFileAsBlob(this.workspaceId(), this.documentId(), file.id).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.fileObjectUrls.update(urls => {
          const newMap = new Map(urls);
          newMap.set(file.id, objectUrl);
          return newMap;
        });
      },
      error: (err) => {
        console.error('Error loading file:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('documents.loadFileError'),
        });
      },
    });
  }

  viewFile(file: DocumentFile): void {
    this.selectedFile.set(file);
    
    if (this.isTextFile(file)) {
      // Load text content using HttpClient with authentication
      this.apiService.downloadFileAsBlob(this.workspaceId(), this.documentId(), file.id).subscribe({
        next: (blob) => {
          blob.text().then(text => {
            this.textFileContent.set(text);
          }).catch(err => {
            console.error('Error reading text file:', err);
            this.textFileContent.set(this.translateService.instant('documents.loadFileError'));
          });
        },
        error: (err) => {
          console.error('Error loading text file:', err);
          this.textFileContent.set(this.translateService.instant('documents.loadFileError'));
        },
      });
    } else {
      // For PDFs and images, ensure blob is loaded before displaying
      const existingUrl = this.fileObjectUrls().get(file.id);
      if (!existingUrl) {
        // Load blob and create object URL
        this.apiService.downloadFileAsBlob(this.workspaceId(), this.documentId(), file.id).subscribe({
          next: (blob) => {
            const objectUrl = URL.createObjectURL(blob);
            this.fileObjectUrls.update(urls => {
              const newMap = new Map(urls);
              newMap.set(file.id, objectUrl);
              return newMap;
            });
          },
          error: (err) => {
            console.error('Error loading file:', err);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('common.error'),
              detail: this.translateService.instant('documents.loadFileError'),
            });
          },
        });
      }
    }
  }

  closeFileViewer(): void {
    this.selectedFile.set(null);
    this.textFileContent.set('');
  }

  downloadFile(file: DocumentFile): void {
    this.apiService.downloadFileAsBlob(this.workspaceId(), this.documentId(), file.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading file:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('documents.downloadError'),
        });
      },
    });
  }

  isPdfFile(file: DocumentFile): boolean {
    return file.mimeType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');
  }

  isImageFile(file: DocumentFile): boolean {
    return file.mimeType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.fileName);
  }

  isTextFile(file: DocumentFile): boolean {
    return file.mimeType === 'text/plain' || file.fileName.toLowerCase().endsWith('.txt');
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant('documents.confirmDeleteMessage', { title: this.document()?.title || '' }),
      header: this.translateService.instant('documents.confirmDelete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant('common.delete'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => {
        this.deleteDocument();
      },
    });
  }

  deleteDocument(): void {
    this.apiService.deleteDocument(this.workspaceId(), this.documentId()).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('documents.deleteSuccess'),
        });
        this.router.navigate(['/workspaces', this.workspaceId(), 'documents']);
      },
      error: (err) => {
        console.error('Error deleting document:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('documents.deleteError'),
        });
      },
    });
  }
}
