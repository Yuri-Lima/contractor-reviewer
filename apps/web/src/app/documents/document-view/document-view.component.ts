import { Component, OnInit, OnDestroy, signal, computed, effect, inject, viewChild, ElementRef, DestroyRef, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { interval, Subject } from 'rxjs';
import { takeUntil, timeout } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { Document, DocumentFile, DocumentJob, JobStatus, ChatResponse, Citation } from '@contractai-review/shared';
import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';
import { RedlineComponent } from '../redline/redline.component';
import { VersionsComponent } from '../versions/versions.component';
import { DocumentContentComponent } from '../document-content/document-content.component';
import { BaseListComponent } from '../../core/components/base-list/base-list.component';
import { BaseListConfig } from '../../core/components/base-list/base-list.config';
import { LazyLoadEvent } from 'primeng/api';
import { PaginationService } from '../../core/services/pagination.service';
import { LocaleDatePipe } from '../../core/pipes/locale-date.pipe';
import { takeUntilDestroyed, rxResource } from '@angular/core/rxjs-interop';

/** API request params for getDocumentFiles (pagination, sort, filters) */
interface FilesRequestParams {
  offset: number;
  limit: number;
  sortField?: string;
  sortOrder?: number;
  fileName?: string;
  mimeType?: string;
  status?: string;
  sizeBytes?: number;
  startDate?: string;
  endDate?: string;
}

/** Params passed to the files resource loader (workspace + document + request) */
interface FilesResourceParams extends FilesRequestParams {
  workspaceId: string;
  documentId: string;
}

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
    TableModule,
    Tag,
    PdfViewerComponent,
    RedlineComponent,
    VersionsComponent,
    DocumentContentComponent,
    BaseListComponent,
    LocaleDatePipe,
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
              <app-base-list [data]="files()" [config]="filesTableConfig()">
                <!-- Header template with sorting and filtering -->
                <ng-template #headerTemplate>
                  <tr>
                    <th pSortableColumn="fileName" pColumnFilter field="fileName" filterMatchMode="contains" filterType="text">
                      {{ 'documents.fileName' | translate }}
                    </th>
                    <th pSortableColumn="mimeType" pColumnFilter field="mimeType" filterMatchMode="equals" filterType="text">
                      {{ 'documents.fileType' | translate }}
                    </th>
                    <th pSortableColumn="sizeBytes" pColumnFilter field="sizeBytes" filterMatchMode="gte" filterType="numeric">
                      {{ 'documents.fileSize' | translate }}
                    </th>
                    <th pSortableColumn="status" pColumnFilter field="status" filterMatchMode="equals" filterType="text">
                      {{ 'documents.status' | translate }}
                    </th>
                    <th pSortableColumn="createdAt" pColumnFilter field="createdAt" filterMatchMode="dateIs" filterType="date">
                      {{ 'documents.createdAt' | translate }}
                    </th>
                    <th>{{ 'common.actions' | translate }}</th>
                  </tr>
                </ng-template>
                
                <!-- Body template -->
                <ng-template #bodyTemplate let-file>
                  <tr>
                    <td>{{ file.fileName }}</td>
                    <td>{{ file.mimeType }}</td>
                    <td>{{ formatFileSize(file.sizeBytes) }}</td>
                    <td>
                      <p-tag [value]="getFileStatusLabel(file.status)" [severity]="getFileStatusSeverity(file.status)"></p-tag>
                    </td>
                    <td>{{ file.createdAt | localeDate: 'short' }}</td>
                    <td>
                      <div class="flex gap-2">
                        @if (file.status === 'available') {
                          <p-button
                            [label]="'documents.viewFile' | translate"
                            icon="pi pi-eye"
                            [outlined]="true"
                            size="small"
                            (onClick)="viewFile(file)"
                          ></p-button>
                        }
                        <p-button 
                          [label]="'common.download' | translate" 
                          icon="pi pi-download" 
                          [outlined]="true" 
                          severity="secondary"
                          size="small"
                          (onClick)="downloadFile(file)"
                        ></p-button>
                      </div>
                    </td>
                  </tr>
                </ng-template>
                
                <!-- Empty template -->
                <ng-template #emptyTemplate let-colspan>
                  <tr>
                    <td [attr.colspan]="colspan" class="text-center py-8 text-gray-500 dark:text-gray-400">
                      {{ 'documents.noFiles' | translate }}
                    </td>
                  </tr>
                </ng-template>
              </app-base-list>
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
  private paginationService = inject(PaginationService);
  private destroyRef = inject(DestroyRef);

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
  private destroyAggressive$ = new Subject<void>();
  private isLoadingJobs = false; // Prevent concurrent loadJobs() calls
  private pollingSubscription: any = null; // Track polling subscription to prevent multiple instances
  private aggressivePollingSubscription: any = null; // Track aggressive polling subscription

  // Files: stable request drives rxResource (observable-based, no firstValueFrom wrapper)
  private filesParams = signal<FilesRequestParams>({ offset: 0, limit: 25 });
  private filesRequest = signal<FilesResourceParams | undefined>(undefined);
  readonly filesResource = rxResource({
    params: () => this.filesRequest(),
    stream: ({ params }) => {
      // Only send defined params so backend never receives "undefined" or invalid sortField
      const apiParams: Record<string, number | string> = {
        offset: params.offset,
        limit: params.limit,
      };
      if (params['sortField'] != null && params['sortField'] !== '') {
        apiParams['sortField'] = params['sortField'];
        if (params['sortOrder'] != null) apiParams['sortOrder'] = params['sortOrder'];
      }
      if (params['fileName'] != null && params['fileName'] !== '') apiParams['fileName'] = params['fileName'];
      if (params['mimeType'] != null && params['mimeType'] !== '') apiParams['mimeType'] = params['mimeType'];
      if (params['status'] != null && params['status'] !== '') apiParams['status'] = params['status'];
      if (params['sizeBytes'] != null) apiParams['sizeBytes'] = params['sizeBytes'];
      if (params['startDate'] != null && params['startDate'] !== '') apiParams['startDate'] = params['startDate'];
      if (params['endDate'] != null && params['endDate'] !== '') apiParams['endDate'] = params['endDate'];
      return this.apiService
        .getDocumentFiles(params.workspaceId, params.documentId, apiParams)
        .pipe(timeout(30000));
    },
  });

  // Derived from resource for template and config compatibility
  files = computed(() =>
    this.filesResource.hasValue() ? this.filesResource.value().files : []
  );
  filesTotal = computed(() =>
    this.filesResource.hasValue() ? this.filesResource.value().total : 0
  );

  // Computed signals that automatically update when jobs signal changes
  activeJobs = computed(() => {
    const jobs = this.jobs();
    return jobs.filter(j => j.status === 'pending' || j.status === 'processing');
  });
  failedJobs = computed(() => this.jobs().filter(j => j.status === 'failed'));
  hasActiveJobs = computed(() => this.activeJobs().length > 0);
  hasFailedJobs = computed(() => this.failedJobs().length > 0);
  
  canDelete = computed(() => {
    // TODO: Check user role (ADMIN/OWNER)
    return true; // Placeholder - implementar verificação de role
  });

  // Default: Table configuration for files list with lazy loading and column filtering
  filesTableConfig = computed<BaseListConfig>(() => ({
    data: this.files(),
    loading: this.filesResource.isLoading,
    lazy: true,
    totalRecords: this.filesTotal(),
    rows: this.paginationService.pageSize(),
    rowsPerPageOptions: [10, 25, 50, 100],
    showCurrentPageReport: true,
    currentPageReportTemplate: (this.translateService.instant('common.showing') || 'Showing') + ' {first} ' + (this.translateService.instant('common.to') || 'to') + ' {last} ' + (this.translateService.instant('common.of') || 'of') + ' {totalRecords} ' + (this.translateService.instant('documents.files') || 'files'),
    sortMode: 'multiple',
    striped: true,
    emptyMessageKey: 'documents.noFiles',
    colspan: 6,
    filters: {},
    onLazyLoad: (event: LazyLoadEvent) => this.updateFilesParamsFromLazyEvent(event),
  }));

  constructor() {
    // Effect: reacts ONLY to workspaceId / documentId changes
    // All other signal reads are wrapped in untracked() so they don't
    // become dependencies that would re-trigger the effect and restart the resource.
    effect(() => {
      const wsId = this.workspaceId();
      const docId = this.documentId();
      if (wsId && docId) {
        untracked(() => {
          // Load cached jobs immediately for instant UI display
          const cachedJobs = this.getJobs(docId);
          if (cachedJobs.length > 0) {
            this.jobs.set(cachedJobs);

            const hasActiveJobs = cachedJobs.some(j =>
              j.status === 'pending' || j.status === 'processing'
            );
            if (hasActiveJobs) {
              this.startAggressivePolling();
            }
          }

          this.loadDocument();
          this.loadJobs();
          this.startJobsPolling();

          // Read pagination from URL — untracked so these signals
          // don't become effect dependencies
          this.paginationService.initializeFromQueryParams();
          const initialParams: FilesRequestParams = {
            offset: this.paginationService.getOffset(
              this.paginationService.currentPage(),
              this.paginationService.pageSize()
            ),
            limit: this.paginationService.pageSize(),
            sortField: this.paginationService.sortField(),
            sortOrder: this.paginationService.sortOrder(),
          };
          this.filesParams.set(initialParams);
          this.filesRequest.set({ workspaceId: wsId, documentId: docId, ...initialParams });
        });
      }
    });

    // Show toast when files resource fails (skip 404 / timeout)
    effect(() => {
      const err = this.filesResource.error();
      if (!err) return;
      const status = (err as { status?: number }).status;
      const name = (err as { name?: string }).name;
      if (status === 404 || name === 'TimeoutError') return;
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant('common.error'),
        detail:
          this.translateService.instant('documents.loadFilesError') ||
          'Error loading files',
      });
    });
  }

  ngOnDestroy(): void {
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
        // Files are now loaded separately via pagination, so we don't use doc.files
      },
      error: (err) => console.error('Error loading document:', err),
    });
  }

  /** Map PrimeNG LazyLoadEvent to API request params; resource reacts to filesParams change */
  private lazyEventToApiParams(event: LazyLoadEvent): FilesRequestParams {
    const offset = event.first ?? 0;
    const limit = event.rows ?? 25;
    const params: FilesRequestParams = { offset, limit };

    if (event.filters) {
      if (event.filters['fileName']?.value) {
        params.fileName = event.filters['fileName'].value;
      }
      if (event.filters['mimeType']?.value) {
        params.mimeType = event.filters['mimeType'].value;
      }
      if (event.filters['status']?.value) {
        params.status = event.filters['status'].value;
      }
      if (event.filters['sizeBytes']?.value) {
        params.sizeBytes = event.filters['sizeBytes'].value;
      }
      if (event.filters['createdAt']?.value) {
        const filterDate = event.filters['createdAt'].value;
        if (filterDate instanceof Date) {
          const startOfDay = new Date(filterDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(filterDate);
          endOfDay.setHours(23, 59, 59, 999);
          params.startDate = startOfDay.toISOString().split('T')[0];
          params.endDate = endOfDay.toISOString().split('T')[0];
        } else if (typeof filterDate === 'string') {
          params.startDate = filterDate;
          params.endDate = filterDate;
        }
      }
    }

    if (event.sortField) {
      params.sortField = event.sortField as string;
      params.sortOrder = event.sortOrder ?? 1;
    }

    return params;
  }

  private filesParamsEqual(a: FilesRequestParams, b: FilesRequestParams): boolean {
    return (
      a.offset === b.offset &&
      a.limit === b.limit &&
      (a.sortField ?? '') === (b.sortField ?? '') &&
      (a.sortOrder ?? 0) === (b.sortOrder ?? 0) &&
      (a.fileName ?? '') === (b.fileName ?? '') &&
      (a.mimeType ?? '') === (b.mimeType ?? '') &&
      (a.status ?? '') === (b.status ?? '')
    );
  }

  /** Update files params and URL from table lazy load event; resource reloads only when params actually change */
  updateFilesParamsFromLazyEvent(event: LazyLoadEvent): void {
    const wsId = this.workspaceId();
    const docId = this.documentId();
    if (!wsId || !docId) return;
    const newParams = this.lazyEventToApiParams(event);
    if (this.filesParamsEqual(this.filesParams(), newParams)) return; // Dedupe — avoids resource restart loop
    this.paginationService.updateQueryParams(
      this.paginationService.lazyLoadEventToQueryParams(event)
    );
    this.filesParams.set(newParams);
    this.filesRequest.set({ workspaceId: wsId, documentId: docId, ...newParams });
  }

  loadJobs(): void {
    // Prevent concurrent calls
    if (this.isLoadingJobs) {
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
        this.jobs.set(cachedJobs);
      }
    }
    
    // Fetch fresh jobs from API - API data always takes precedence
    this.apiService.getDocumentJobs(this.workspaceId(), documentId).subscribe({
      next: (apiJobs) => {
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
    // Prevent multiple polling instances
    if (this.pollingSubscription) {
      this.stopJobsPolling();
    }
    
    let consecutiveNoActiveJobs = 0;
    
    this.pollingSubscription = interval(500)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Always load jobs to get latest updates
        this.loadJobs();
        // Check after loading if we should stop
        const currentJobs = this.jobs();
        const hasPendingOrProcessing = currentJobs.some(
          (j) => j.status === 'pending' || j.status === 'processing',
        );
        if (!hasPendingOrProcessing && currentJobs.length > 0) {
          consecutiveNoActiveJobs++;
          // Stop polling after 3 consecutive checks with no active jobs (1.5 seconds)
          if (consecutiveNoActiveJobs >= 3) {
            this.stopJobsPolling();
          }
        } else {
          consecutiveNoActiveJobs = 0; // Reset counter if we have active jobs
        }
      });
  }

  stopJobsPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  // LocalStorage helper methods for tracking jobs
  private saveJobs(documentId: string, jobs: DocumentJob[]): void {
    try {
      const key = `jobs_${documentId}`;
      localStorage.setItem(key, JSON.stringify(jobs));
    } catch (e) {
      console.error('Failed to save jobs to localStorage:', e);
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
      console.error('Failed to get jobs from localStorage:', e);
    }
    return [];
  }

  private clearJobs(documentId: string): void {
    try {
      const key = `jobs_${documentId}`;
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to clear jobs from localStorage:', e);
    }
  }

  startAggressivePolling(): void {
    // Prevent multiple aggressive polling instances
    if (this.aggressivePollingSubscription) {
      this.stopAggressivePolling();
    }
    
    const currentJobs = this.jobs();
    const pendingJobIds = currentJobs
      .filter(j => j.status === 'pending' || j.status === 'processing')
      .map(j => j.id);
      
    if (pendingJobIds.length === 0) {
      return; // No jobs to track
    }
    
    this.aggressivePollingSubscription = interval(200) // Poll every 200ms
      .pipe(takeUntil(this.destroyAggressive$))
      .subscribe(() => {
        this.loadJobs(); // This updates localStorage automatically
        
        const currentJobsAfterLoad = this.jobs();
        const stillActive = currentJobsAfterLoad.filter(j => 
          j.status === 'pending' || j.status === 'processing'
        );
        
        if (stillActive.length === 0) {
          // All tracked jobs completed
          this.stopAggressivePolling();
        }
      });
  }

  stopAggressivePolling(): void {
    if (this.aggressivePollingSubscription) {
      this.aggressivePollingSubscription.unsubscribe();
      this.aggressivePollingSubscription = null;
    }
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
          // Reload files: set request so resource re-runs
          const reloadParams: FilesRequestParams = {
            offset: 0,
            limit: this.paginationService.pageSize(),
          };
          this.filesParams.set(reloadParams);
          this.filesRequest.set({
            workspaceId: this.workspaceId(),
            documentId: this.documentId(),
            ...reloadParams,
          });
          this.paginationService.updateQueryParams({
            page: 0,
            limit: this.paginationService.pageSize(),
          });
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
    if (bytes === 0) return `0 ${this.translateService.instant('documents.fileSizeUnits.bytes')}`;
    const k = 1024;
    const sizes = ['bytes', 'kb', 'mb', 'gb'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeLabel = this.translateService.instant(`documents.fileSizeUnits.${sizes[i]}`);
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizeLabel;
  }

  // Default: Get file status label from translation key
  getFileStatusLabel(status: string): string {
    return this.translateService.instant(`documents.fileStatus.${status}`) || status;
  }

  // Default: Get file status severity for PrimeNG Tag component
  getFileStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null | undefined {
    const severityMap: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null | undefined> = {
      'available': 'success',
      'processing': 'warn',
      'uploading': 'info',
      'error': 'danger',
    };
    const result = severityMap[status];
    return result !== undefined ? result : 'secondary';
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
