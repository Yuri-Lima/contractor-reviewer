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
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { Document, DocumentFile, DocumentJob, JobStatus } from '../../core/models/document.model';
import { ChatResponse, Citation } from '../../core/models/chat.model';
import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';
import { RedlineComponent } from '../redline/redline.component';
import { VersionsComponent } from '../versions/versions.component';
import { DocumentContentComponent } from '../document-content/document-content.component';

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
    VersionsComponent,
    DocumentContentComponent,
    TranslatePipe,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="document-view-container p-6 max-w-7xl mx-auto">
      <div class="document-header flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">{{ document()?.title }}</h1>
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>{{ 'documents.status' | translate }}: 
              <span class="font-semibold" [class.text-green-600]="document()?.status === 'available'"
                    [class.text-yellow-600]="document()?.status === 'processing'"
                    [class.text-red-600]="document()?.status === 'error'">
                {{ getStatusLabel(document()?.status || '') }}
              </span>
            </span>
            @if (document()?.resolvedJurisdiction) {
              <span>
                {{ 'documents.jurisdiction' | translate }}: {{ document()?.resolvedJurisdiction }}
                <span class="text-xs">({{ document()?.jurisdictionStatus }})</span>
              </span>
            }
          </div>
        </div>
        <div class="document-actions flex gap-2">
          <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf,.docx,.txt,.png,.jpg" style="display: none" />
          <p-button
            [label]="'documents.uploadFile' | translate"
            icon="pi pi-upload"
            [outlined]="true"
            (onClick)="triggerFileInput()"
          ></p-button>
          @if (canDelete()) {
            <p-button
              [label]="'common.delete' | translate"
              icon="pi pi-trash"
              severity="danger"
              [outlined]="true"
              (onClick)="confirmDelete()"
            ></p-button>
          }
        </div>
      </div>

      <!-- Job Progress Indicator -->
      @if (hasActiveJobs()) {
        <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">{{ 'documents.processing' | translate }}</h3>
          <div class="space-y-3">
            @for (job of activeJobs(); track job.id) {
              <div class="job-progress-item">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{ getJobTypeLabel(job.type) }}</span>
                  <span class="text-xs text-gray-600 dark:text-gray-400">{{ getJobProgress(job) }}%</span>
                </div>
                <p-progressBar [value]="getJobProgress(job)" [showValue]="false"></p-progressBar>
                <span class="text-xs text-gray-500 dark:text-gray-400 mt-1 block">{{ getJobStatusLabel(job.status) }}</span>
              </div>
            }
          </div>
        </div>
      }

      <p-tabs value="0">
        <p-tablist>
          <p-tab value="0">{{ 'documents.files' | translate }}</p-tab>
          <p-tab value="1">{{ 'documentContent.title' | translate }}</p-tab>
          <p-tab value="2">{{ 'documents.redline' | translate }}</p-tab>
          <p-tab value="3">{{ 'documents.chat' | translate }}</p-tab>
          <p-tab value="4">{{ 'versions.title' | translate }}</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="0">
            <div class="files-section mt-4">
              @if (files().length === 0) {
                <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                  {{ 'documents.noFiles' | translate }}
                </div>
              }
              @if (files().length > 0) {
                <div class="space-y-4">
                  @for (file of files(); track file.id) {
                    <div class="file-item p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center">
                      <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-gray-100">{{ file.fileName }}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {{ formatFileSize(file.sizeBytes) }} • {{ file.mimeType }}
                        </div>
                      </div>
                      <div class="flex gap-2">
                        @if (file.status === 'available') {
                          <p-button
                            [label]="'documents.viewFile' | translate"
                            icon="pi pi-eye"
                            [outlined]="true"
                            (onClick)="viewFile(file)"
                          ></p-button>
                        }
                        <p-button 
                          [label]="'common.download' | translate" 
                          icon="pi pi-download" 
                          [outlined]="true" 
                          severity="secondary"
                          (onClick)="downloadFile(file)"
                        ></p-button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </p-tabpanel>

          <p-tabpanel value="1">
            <app-document-content (textSelected)="onContentTextSelected($event)"></app-document-content>
          </p-tabpanel>

          <p-tabpanel value="2">
            <app-redline #redlineComponent></app-redline>
          </p-tabpanel>

          <p-tabpanel value="3">
            <div class="chat-section mt-4">
              <div class="chat-messages space-y-4 mb-4 max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                @for (msg of chatMessages(); track $index) {
                  <div class="chat-message p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div class="message-question mb-3">
                      <strong class="text-blue-600 dark:text-blue-400">{{ 'documents.you' | translate }}:</strong>
                      <p class="text-gray-800 dark:text-gray-200 mt-1">{{ msg.question }}</p>
                    </div>
                    @if (msg.answerText) {
                      <div class="message-answer">
                        <strong class="text-green-600 dark:text-green-400">{{ 'documents.assistant' | translate }}:</strong>
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
                          {{ 'documents.confidence' | translate }}: {{ getConfidenceLabel(msg.confidence || '') }}
                        </div>
                        @if (msg.citations && msg.citations.length > 0) {
                          <div class="citations mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ 'documents.citations' | translate }}:</h4>
                            @for (citation of msg.citations; track $index) {
                              <div class="citation text-sm text-gray-600 dark:text-gray-400 mb-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                @if (citation.fileName) {
                                  <span class="font-medium">{{ citation.fileName }}</span>
                                }
                                @if (citation.pageNumber) {
                                  <span> - {{ 'documents.page' | translate }} {{ citation.pageNumber }}</span>
                                }
                                @if (citation.quoteSnippet) {
                                  <div class="mt-1 italic text-xs">"{{ citation.quoteSnippet }}"</div>
                                }
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
              <div class="chat-input flex gap-2">
                <input
                  [value]="question()"
                  (input)="onQuestionInput($event)"
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  [placeholder]="'documents.askQuestion' | translate"
                  (keyup.enter)="sendQuestion()"
                />
                <p-button
                  [label]="'documents.send' | translate"
                  icon="pi pi-send"
                  [disabled]="!question().trim() || loading()"
                  [loading]="loading()"
                  (onClick)="sendQuestion()"
                ></p-button>
              </div>
            </div>
          </p-tabpanel>

          <p-tabpanel value="4">
            <app-versions></app-versions>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>

      <!-- File Viewer Modal -->
      @if (selectedFile()) {
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" (click)="closeFileViewer()">
          <div class="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto" (click)="$event.stopPropagation()">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ selectedFile()?.fileName }}</h3>
              <p-button icon="pi pi-times" [text]="true" (onClick)="closeFileViewer()" severity="secondary"></p-button>
            </div>
            <div class="p-4">
              @if (isPdfFile(selectedFile()!)) {
                <app-pdf-viewer
                  [fileUrl]="getFileObjectUrl(selectedFile()!.id)"
                  [fileName]="selectedFile()!.fileName"
                ></app-pdf-viewer>
              }
              @if (isImageFile(selectedFile()!)) {
                <div class="flex justify-center">
                  <img [src]="getFileObjectUrl(selectedFile()!.id)" [alt]="selectedFile()!.fileName" class="max-w-full h-auto" />
                </div>
              }
              @if (isTextFile(selectedFile()!)) {
                <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded">
                  <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ textFileContent() }}</pre>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .job-progress-item {
      margin-bottom: 0.5rem;
    }
    .job-error-item {
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
  redlineComponent = viewChild<RedlineComponent>('redlineComponent');

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
  private destroy$ = new Subject<void>();
  private destroyAggressive$ = new Subject<void>();
  private isLoadingJobs = false; // Prevent concurrent loadJobs() calls

  files = computed(() => this.document()?.files || []);
  // Computed signals that automatically update when jobs signal changes
  activeJobs = computed(() => {
    const jobs = this.jobs();
    const active = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
    // Log when active jobs change for debugging (throttled to avoid spam)
    if (active.length > 0) {
      const now = Date.now();
      if (!this.lastActiveJobsLog || (now - this.lastActiveJobsLog) > 1000) {
        console.log('[DEBUG] Active jobs computed:', active.map(j => ({id: j.id, type: j.type, status: j.status, progress: j.progress})));
        this.lastActiveJobsLog = now;
      }
    }
    return active;
  });
  private lastActiveJobsLog = 0;
  failedJobs = computed(() => this.jobs().filter(j => j.status === 'failed'));
  hasActiveJobs = computed(() => this.activeJobs().length > 0);
  hasFailedJobs = computed(() => this.failedJobs().length > 0);
  
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
        // Load cached jobs immediately for instant UI display
        const cachedJobs = this.getJobs(docId);
        if (cachedJobs.length > 0) {
          console.log('[DEBUG] Found cached jobs in localStorage:', cachedJobs.length);
          this.jobs.set(cachedJobs);
          
          // Check if we should resume aggressive polling
          const hasActiveJobs = cachedJobs.some(j => 
            j.status === 'pending' || j.status === 'processing'
          );
          if (hasActiveJobs) {
            this.startAggressivePolling();
          }
        }
        
        this.loadDocument();
        this.loadJobs(); // This will fetch fresh data and merge
        this.startJobsPolling();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAggressivePolling();
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
        // Don't overwrite jobs here - loadJobs() handles job management with proper merge logic
        // The document entity's jobs relation might be stale or incomplete
      },
      error: (err) => console.error('Error loading document:', err),
    });
  }

  loadJobs(): void {
    // Prevent concurrent calls
    if (this.isLoadingJobs) {
      console.log('[DEBUG] loadJobs already in progress, skipping');
      return;
    }
    
    const documentId = this.documentId();
    if (!documentId) {
      return;
    }
    
    this.isLoadingJobs = true;
    
    // Load cached jobs from localStorage for immediate display (only if signal is empty)
    const currentJobs = this.jobs();
    if (currentJobs.length === 0) {
      const cachedJobs = this.getJobs(documentId);
      if (cachedJobs.length > 0) {
        console.log('[DEBUG] Loaded cached jobs from localStorage:', cachedJobs.length);
        this.jobs.set(cachedJobs);
      }
    }
    
    // Fetch fresh jobs from API - API data always takes precedence
    this.apiService.getDocumentJobs(this.workspaceId(), documentId).subscribe({
      next: (apiJobs) => {
        console.log('[DEBUG] loadJobs received from API:', apiJobs.length, 'jobs');
        console.log('[DEBUG] API jobs progress:', apiJobs.map(j => ({id: j.id, type: j.type, status: j.status, progress: j.progress})));
        
        // API jobs are the source of truth - use them directly
        // Only merge in cached jobs that aren't in API response (for edge cases)
        const apiJobsMap = new Map(apiJobs.map(j => [j.id, j]));
        const cachedJobs = this.getJobs(documentId);
        const mergedJobs: DocumentJob[] = [...apiJobs];
        
        // Include cached jobs that aren't in API response (edge case handling)
        cachedJobs.forEach(cachedJob => {
          if (!apiJobsMap.has(cachedJob.id)) {
            mergedJobs.push(cachedJob);
          }
        });
        
        // Detect progress changes before updating signal
        const currentJobsMap = new Map(currentJobs.map(j => [j.id, j]));
        const progressChanges: Array<{id: string, type: string, oldProgress: number, newProgress: number}> = [];
        
        mergedJobs.forEach(newJob => {
          const oldJob = currentJobsMap.get(newJob.id);
          if (oldJob && oldJob.progress !== newJob.progress) {
            progressChanges.push({
              id: newJob.id,
              type: newJob.type,
              oldProgress: oldJob.progress,
              newProgress: newJob.progress
            });
          }
        });
        
        if (progressChanges.length > 0) {
          console.log('[DEBUG] Progress changes detected:', progressChanges);
        }
        
        // Update signal with merged result - API data always wins
        this.jobs.set(mergedJobs);
        
        // Save API jobs to localStorage (they're the source of truth)
        this.saveJobs(documentId, apiJobs);
        
        // Check if we should stop aggressive polling
        const pendingJobIds = mergedJobs
          .filter(j => j.status === 'pending' || j.status === 'processing')
          .map(j => j.id);
        
        if (pendingJobIds.length === 0) {
          this.stopAggressivePolling();
        }
        
        console.log('[DEBUG] Jobs signal updated. Total:', mergedJobs.length, 'Pending:', pendingJobIds.length, 'Progress changes:', progressChanges.length);
        this.isLoadingJobs = false;
      },
      error: (err) => {
        console.error('Error loading jobs:', err);
        // On error, keep cached jobs if available
        this.isLoadingJobs = false;
      },
    });
  }

  startJobsPolling(): void {
    this.stopJobsPolling(); // Ensure cleanup first
    console.log('[DEBUG] Starting jobs polling');
    let consecutiveNoActiveJobs = 0;
    
    interval(500)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Always load jobs to get latest updates
        this.loadJobs();
        // Check after loading if we should stop
        const currentJobs = this.jobs();
        const hasPendingOrProcessing = currentJobs.some(
          (j) => j.status === 'pending' || j.status === 'processing',
        );
        console.log('[DEBUG] Polling check - hasPendingOrProcessing:', hasPendingOrProcessing, 'jobs.length:', currentJobs.length, 'jobs:', currentJobs.map(j => ({id: j.id, type: j.type, status: j.status, progress: j.progress})));
        if (!hasPendingOrProcessing && currentJobs.length > 0) {
          consecutiveNoActiveJobs++;
          // Stop polling after 3 consecutive checks with no active jobs (1.5 seconds)
          if (consecutiveNoActiveJobs >= 3) {
            console.log('[DEBUG] Stopping polling - no active jobs for 3 consecutive checks');
            this.stopJobsPolling();
          }
        } else {
          consecutiveNoActiveJobs = 0; // Reset counter if we have active jobs
        }
      });
  }

  stopJobsPolling(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Create new Subject for next polling session
    this.destroy$ = new Subject<void>();
  }

  // LocalStorage helper methods for tracking jobs
  private saveJobs(documentId: string, jobs: DocumentJob[]): void {
    try {
      const key = `jobs_${documentId}`;
      localStorage.setItem(key, JSON.stringify(jobs));
      console.log('[DEBUG] Saved jobs to localStorage:', jobs.length, 'jobs');
    } catch (e) {
      console.error('[DEBUG] Failed to save jobs to localStorage:', e);
    }
  }

  private getJobs(documentId: string): DocumentJob[] {
    try {
      const key = `jobs_${documentId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as DocumentJob[];
      }
    } catch (e) {
      console.error('[DEBUG] Failed to get jobs from localStorage:', e);
    }
    return [];
  }

  private clearJobs(documentId: string): void {
    try {
      const key = `jobs_${documentId}`;
      localStorage.removeItem(key);
      console.log('[DEBUG] Cleared jobs from localStorage');
    } catch (e) {
      console.error('[DEBUG] Failed to clear jobs from localStorage:', e);
    }
  }

  startAggressivePolling(): void {
    this.stopAggressivePolling();
    
    const currentJobs = this.jobs();
    const pendingJobIds = currentJobs
      .filter(j => j.status === 'pending' || j.status === 'processing')
      .map(j => j.id);
      
    if (pendingJobIds.length === 0) {
      return; // No jobs to track
    }
    
    console.log('[DEBUG] Starting aggressive polling for jobs:', pendingJobIds);
    
    interval(200) // Poll every 200ms
      .pipe(takeUntil(this.destroyAggressive$))
      .subscribe(() => {
        this.loadJobs(); // This updates localStorage automatically
        
        const currentJobsAfterLoad = this.jobs();
        const stillActive = currentJobsAfterLoad.filter(j => 
          j.status === 'pending' || j.status === 'processing'
        );
        
        if (stillActive.length === 0) {
          // All tracked jobs completed
          console.log('[DEBUG] All tracked jobs completed, stopping aggressive polling');
          this.stopAggressivePolling();
        }
      });
  }

  stopAggressivePolling(): void {
    this.destroyAggressive$.next();
    this.destroyAggressive$.complete();
    this.destroyAggressive$ = new Subject<void>();
  }

  getJobTypeLabel(type: string): string {
    return this.translateService.instant(`documents.jobType.${type}`) || type;
  }

  getJobStatusLabel(status: string): string {
    return this.translateService.instant(`documents.jobStatus.${status}`) || status;
  }

  getJobProgress(job: DocumentJob): number {
    // Ensure progress is a number between 0 and 100
    const progress = typeof job.progress === 'number' ? job.progress : parseInt(String(job.progress || 0), 10);
    return Math.max(0, Math.min(100, progress || 0));
  }

  getStatusLabel(status: string): string {
    return this.translateService.instant(`documents.statusLabels.${status}`) || status;
  }

  getConfidenceLabel(confidence: string): string {
    if (!confidence) return '';
    return this.translateService.instant(`redline.confidence.${confidence}`) || confidence;
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
        next: () => {
          // loadJobs() now handles localStorage automatically
          this.loadJobs();
          // After a short delay, check for pending jobs and start aggressive polling
          setTimeout(() => {
            const currentJobs = this.jobs();
            const pendingJobIds = currentJobs
              .filter(j => j.status === 'pending' || j.status === 'processing')
              .map(j => j.id);
            if (pendingJobIds.length > 0) {
              this.startAggressivePolling();
            }
          }, 100);
          this.loadDocument();
        },
        error: (err) => console.error('Error uploading file:', err),
      });
    }
  }

  sendQuestion(): void {
    const questionText = this.question().trim();
    if (!questionText) return;
    
    this.loading.set(true);
    this.question.set('');
    
    // Get current user language
    const currentLang = this.translateService.currentLang || 'en';
    
    this.apiService.chat(this.workspaceId(), this.documentId(), { 
      question: questionText,
      language: currentLang // Add language to request
    }).subscribe({
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
    if (bytes === 0) return `0 ${this.translateService.instant('documents.fileSize.bytes')}`;
    const k = 1024;
    const sizes = ['bytes', 'kb', 'mb', 'gb'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeLabel = this.translateService.instant(`documents.fileSize.${sizes[i]}`);
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizeLabel;
  }

  onContentTextSelected(event: { text: string; startIndex?: number; endIndex?: number }): void {
    // Switch to Redline tab and set selected text
    const redline = this.redlineComponent();
    if (redline) {
      // Set the selected text and position in the redline component
      redline.onTextSelectedFromContent(event);
      // Optionally switch to redline tab (value="2")
      // This would require managing tab state, which is complex with PrimeNG tabs
      // For now, just set the text and let user manually switch to redline tab
      this.messageService.add({
        severity: 'info',
        summary: this.translateService.instant('common.success'),
        detail: this.translateService.instant('documentContent.selectTextHint'),
      });
    }
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
