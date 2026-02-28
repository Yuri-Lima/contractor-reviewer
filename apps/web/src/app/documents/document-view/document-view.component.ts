import { Component, OnInit, OnDestroy, signal, computed, effect, inject, viewChild, DestroyRef, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Toolbar } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { ConfirmationService, MessageService, SharedModule } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { ContextMenu } from 'primeng/contextmenu';
import { TabsModule } from 'primeng/tabs';
import { ProgressBar } from 'primeng/progressbar';
import { Dialog } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Card } from 'primeng/card';
import { interval, Subject } from 'rxjs';
import { takeUntil, timeout } from 'rxjs';
import { workspaceDocuments } from '../../core/routes';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { ApiService } from '../../core/services/api.service';
import { VoiceRecordingService } from '../../core/services/voice-recording.service';
import { OnboardingService } from '../../onboarding/onboarding.service';
import { DocumentViewTabService } from '../../onboarding/tour/document-view-tab.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  Document,
  DocumentFile,
  DocumentJob,
  ChatResponse,
  Citation,
  ParserInfo,
  FILE_INPUT_ACCEPT,
  ChatResponseModeValues,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_BATCH_SIZE_BYTES,
  MAX_BATCH_FILE_COUNT,
  type ChatResponseMode,
  type FileSearchScope,
} from '@contractai-review/shared';

/** Local fallback when shared package fails to load (e.g. 404). Must match ChatResponseModeValues. */
const CHAT_MODE = {
  TextOnly: 'text_only',
  AudioOnly: 'audio_only',
  AudioAndText: 'audio_and_text',
} as const;
import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';
import { RedlineComponent } from '../redline/redline.component';
import { VersionsComponent } from '../versions/versions.component';
import { FileContentDialogComponent } from '../file-content-dialog/file-content-dialog.component';
import { BaseListComponent } from '../../core/components/base-list/base-list.component';
import { FileUploadComponent } from '../../core/components/file-upload';
import {
  SearchInputComponent,
  type SearchScopeOption,
  type SearchModeOption,
} from '../../core/components/search-input';
import { EditableTitleComponent } from '../../core/components/editable-title/editable-title.component';
import { BaseListConfig } from '../../core/components/base-list/base-list.config';
import { LazyLoadEvent } from 'primeng/api';
import { PaginationService } from '../../core/services/pagination.service';
import { LocaleDatePipe } from '../../core/pipes/locale-date.pipe';
import { takeUntilDestroyed, rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, from, of } from 'rxjs';
import { mergeMap, map, catchError, toArray, switchMap, tap } from 'rxjs/operators';

/** API request params for getDocumentFiles (pagination, sort, filters, fuzzy search) */
interface FilesRequestParams {
  offset: number;
  limit: number;
  sortField?: string;
  sortOrder?: number;
  q?: string;
  fileName?: string;
  mimeType?: string;
  status?: string;
  searchMode?: 'fuzzy' | 'contains';
  similarityThreshold?: number;
  sizeBytes?: number;
  startDate?: string;
  endDate?: string;
}

/** Params passed to the files resource loader (workspace + document + request) */
interface FilesResourceParams extends FilesRequestParams {
  workspaceId: string;
  documentId: string;
  /** Incremented to force rxResource refetch after upload/delete */
  refreshKey?: number;
}

/** Audio state for a chat message when TTS is enabled */
type ChatMessageAudioState = 'none' | 'synthesizing' | 'ready' | 'playing';

/** Extended chat message with optional audio playback state */
interface ChatMessageWithAudio {
  question: string;
  answerText?: string;
  confidence?: string;
  citations?: Citation[];
  audioState?: ChatMessageAudioState;
  audioUrl?: string;
}

@Component({
  selector: 'app-document-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    Button,
    Toolbar,
    TooltipModule,
    SharedModule,
    ConfirmDialog,
    Toast,
    TabsModule,
    ProgressBar,
    TableModule,
    Tag,
    Card,
    Dialog,
    SelectModule,
    PdfViewerComponent,
    RedlineComponent,
    VersionsComponent,
    FileContentDialogComponent,
    BaseListComponent,
    ContextMenu,
    LocaleDatePipe,
    TranslatePipe,
    FileUploadComponent,
    SearchInputComponent,
    EditableTitleComponent,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="document-view-container p-6 max-w-7xl mx-auto">
      <div class="document-header flex justify-between items-center mb-6">
        <div>
          <app-editable-title
            [value]="getDisplayTitle(document())"
            (valueChange)="onDocumentTitleChange($event)"
            [displayTruncate]="false"
            [size]="'lg'"
          />
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>{{ 'documents.status' | translate }}: 
              <span class="font-semibold" [class.text-green-600]="document()?.status === 'available'"
                    [class.text-yellow-600]="document()?.status === 'processing'"
                    [class.text-red-600]="document()?.status === 'error'">
                {{ getStatusLabel(document()?.status || '') }}
              </span>
            </span>
            @if (getDisplayJurisdiction(document())) {
              <span>
                {{ 'documents.jurisdiction' | translate }}: {{ getDisplayJurisdiction(document()) }}
                <span class="text-xs">({{ getDisplayJurisdictionStatus(document()) }})</span>
              </span>
            }
          </div>
        </div>
        <div class="document-actions flex gap-2">
          <app-file-upload
            trigger="button"
            [accept]="fileInputAccept"
            [multiple]="true"
            labelKey="documents.uploadFile"
            icon="pi pi-upload"
            tooltipKey="tooltip.uploadFile"
            [buttonOutlined]="true"
            [dataTour]="'upload-btn'"
            (fileSelected)="onFileSelected($event)"
            (filesSelected)="onFilesSelected($event)"
          />
          @if (canDelete()) {
            <p-button
              [label]="'common.delete' | translate"
              icon="pi pi-trash"
              severity="danger"
              [outlined]="true"
              (onClick)="confirmDelete()"
              [pTooltip]="'tooltip.deleteDocument' | translate"
            ></p-button>
          }
        </div>
      </div>

      <!-- Job Progress Indicator (consolidated for multi-file uploads) -->
      @if (hasActiveJobs()) {
        <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
            {{ 'documents.processingFiles' | translate: { count: activeJobs().length } }}
          </h3>
          <div class="space-y-3">
            <div class="job-progress-item">
              <div class="flex justify-between items-center mb-1">
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ consolidatedStageSummary() }}</span>
                <span class="text-xs text-gray-600 dark:text-gray-400">{{ consolidatedProgress() }}%</span>
              </div>
              <p-progressBar [value]="consolidatedProgress()" [showValue]="false"></p-progressBar>
            </div>
          </div>
        </div>
      }

      <!-- Failed Jobs -->
      @if (hasFailedJobs()) {
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 class="text-sm font-semibold text-red-900 dark:text-red-100 mb-3">{{ 'documents.failedJobs' | translate }}</h3>
          <div class="space-y-3">
            @for (job of failedJobs(); track job.id) {
              <div class="job-error-item">
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ getJobTypeLabel(job.type) }}</span>
                <p class="text-sm text-red-800 dark:text-red-200 mt-1">{{ job.lastError || ('documents.uploadError' | translate) }}</p>
              </div>
            }
          </div>
        </div>
      }

      <p-tabs [value]="activeTab()" (valueChange)="activeTab.set($event ?? '0')">
        <p-tablist>
          <p-tab value="0">{{ 'documents.files' | translate }}</p-tab>
          <p-tab value="1">{{ 'documents.redline' | translate }}</p-tab>
          <p-tab value="2">{{ 'documents.chat' | translate }}</p-tab>
          <p-tab value="3">{{ 'versions.title' | translate }}</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="0">
            <p-contextMenu #fileContextMenu [model]="fileContextMenuItems()"></p-contextMenu>
            <p-card class="files-section mt-4">
              <div class="p-4">
              <app-base-list
                [data]="files()"
                [config]="filesTableConfig()"
                [contextMenu]="fileContextMenuRef()"
                (contextMenuSelect)="selectedFileForContext.set($event.data)"
              >
                <ng-template #toolbarTemplate>
                  <p-toolbar class="mb-4">
                    <ng-template pTemplate="start">
                      <app-search-input
                        class="flex-1 min-w-0"
                        [value]="fileSearchQuery()"
                        (valueChange)="applyFileSearch($event)"
                        [showSearchModeSelector]="true"
                        [searchModeOptions]="fileSearchModeOptions"
                        [searchMode]="fileSearchMode()"
                        (searchModeChange)="onFileSearchModeChange($event)"
                        [showSimilaritySlider]="true"
                        [similarityThreshold]="fileSimilarityThreshold()"
                        (similarityThresholdChange)="onFileSimilarityThresholdChange($event)"
                        [showScopeSelector]="true"
                        [scopeOptions]="fileSearchScopeOptions"
                        [scope]="fileSearchScope()"
                        (scopeChange)="onFileSearchScopeChange($event)"
                        placeholderKey="documents.searchFiles"
                        dataTour="files-search"
                      />
                    </ng-template>
                    <ng-template pTemplate="end">
                      <p-button
                        [label]="'common.delete' | translate"
                        icon="pi pi-trash"
                        severity="danger"
                        [disabled]="selectedFiles().length === 0"
                        (onClick)="onToolbarDeleteClick()"
                        [pTooltip]="'common.delete' | translate"
                      ></p-button>
                    </ng-template>
                  </p-toolbar>
                </ng-template>
                <!-- Header template with sorting and filtering -->
                <ng-template #headerTemplate>
                  <tr>
                    <th style="width: 3rem">
                      <p-tableHeaderCheckbox></p-tableHeaderCheckbox>
                    </th>
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
                    <th></th>
                  </tr>
                </ng-template>
                
                <!-- Body template -->
                <ng-template #bodyTemplate let-file>
                  <tr [pSelectableRow]="file" [pContextMenuRow]="file" (dblclick)="openFileContentDialog(file, $event)">
                    <td>
                      <p-tableCheckbox [value]="file"></p-tableCheckbox>
                    </td>
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
                            icon="pi pi-eye"
                            [outlined]="true"
                            size="small"
                            (onClick)="viewFile(file); $event.stopPropagation()"
                            [pTooltip]="'documents.viewFile' | translate"
                          ></p-button>
                        }
                        <p-button
                          data-tour="download-btn"
                          icon="pi pi-download"
                          [outlined]="true"
                          severity="secondary"
                          size="small"
                          (onClick)="downloadFile(file); $event.stopPropagation()"
                          [pTooltip]="'common.download' | translate"
                        ></p-button>
                        <p-button
                          icon="pi pi-trash"
                          severity="danger"
                          [outlined]="true"
                          size="small"
                          (onClick)="confirmDeleteFile(file); $event.stopPropagation()"
                          [pTooltip]="'common.delete' | translate"
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
            </p-card>
          </p-tabpanel>

          <p-tabpanel value="1">
            <app-redline #redlineComponent></app-redline>
          </p-tabpanel>

          <p-tabpanel value="2">
            <div class="chat-section mt-4">
              <div class="chat-messages space-y-4 mb-4 max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                @for (msg of chatMessages(); track $index) {
                  <div class="chat-message p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div class="message-question mb-3">
                      <strong class="text-blue-600 dark:text-blue-400">{{ 'documents.you' | translate }}:</strong>
                      <p class="text-gray-800 dark:text-gray-200 mt-1">{{ msg.question }}</p>
                    </div>
                    @if (msg.answerText || msg.audioState === 'synthesizing') {
                      <div class="message-answer">
                        <strong class="text-green-600 dark:text-green-400">{{ 'documents.assistant' | translate }}:</strong>
                        @if (chatResponseMode() !== ChatResponseMode.AudioOnly) {
                          <p class="text-gray-800 dark:text-gray-200 mt-1 mb-2">{{ msg.answerText }}</p>
                        }
                        @if ((chatResponseMode() === ChatResponseMode.AudioOnly || chatResponseMode() === ChatResponseMode.AudioAndText) && msg.audioState === 'synthesizing') {
                          <p class="text-sm text-gray-500 dark:text-gray-400 italic mb-2">{{ 'chat.synthesizing' | translate }}</p>
                        }
                        @if ((chatResponseMode() === ChatResponseMode.AudioOnly || chatResponseMode() === ChatResponseMode.AudioAndText) && (msg.audioState === 'ready' || msg.audioState === 'playing') && msg.audioUrl) {
                          <div class="flex items-center gap-2 mb-2">
                            @if (playingMessageIndex() === $index) {
                              <p-button
                                icon="pi pi-pause"
                                [outlined]="true"
                                size="small"
                                (onClick)="pauseMessageAudio($index)"
                                [pTooltip]="'chat.pauseAudio' | translate"
                              ></p-button>
                            } @else {
                              <p-button
                                [icon]="'pi pi-play'"
                                [outlined]="true"
                                size="small"
                                (onClick)="playMessageAudio($index)"
                                [pTooltip]="'chat.playAudio' | translate"
                              ></p-button>
                            }
                            <span class="text-sm text-gray-500 dark:text-gray-400">{{ 'chat.playAudio' | translate }}</span>
                          </div>
                        }
                        @if (chatResponseMode() === ChatResponseMode.AudioOnly && msg.answerText) {
                          <p class="text-gray-800 dark:text-gray-200 mt-1 mb-2 sr-only">{{ msg.answerText }}</p>
                        }
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
              <div class="chat-input flex gap-2" data-tour="chat-input">
                <input
                  [value]="question()"
                  (input)="onQuestionInput($event)"
                  class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  [placeholder]="'documents.askQuestion' | translate"
                  (keyup.enter)="sendQuestion()"
                />
                @if (voiceAvailable()) {
                  <p-button
                    [icon]="voiceRecording() ? 'pi pi-stop' : 'pi pi-microphone'"
                    [severity]="voiceRecording() ? 'danger' : 'secondary'"
                    [outlined]="true"
                    [disabled]="loading() || voiceTranscribing()"
                    [loading]="voiceTranscribing()"
                    (onClick)="toggleVoiceRecording()"
                    [pTooltip]="voiceRecording() ? ('chat.stopListening' | translate) : ('chat.voiceInput' | translate)"
                  ></p-button>
                }
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

          <p-tabpanel value="3">
            <app-versions></app-versions>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>

      <!-- File Viewer Modal (only when user clicks View button) -->
      @if (fileToView()) {
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" (click)="closeFileViewer()">
          <div class="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto" (click)="$event.stopPropagation()">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ fileToView()?.fileName }}</h3>
              <p-button icon="pi pi-times" [text]="true" (onClick)="closeFileViewer()" severity="secondary" [pTooltip]="'tooltip.close' | translate"></p-button>
            </div>
            <div class="p-4">
              @if (fileToView() && isPdfFile(fileToView()!)) {
                <app-pdf-viewer
                  [fileUrl]="getFileObjectUrl(fileToView()!.id)"
                  [fileName]="fileToView()!.fileName"
                ></app-pdf-viewer>
              }
              @if (fileToView() && isImageFile(fileToView()!)) {
                <div class="flex justify-center">
                  <img [src]="getFileObjectUrl(fileToView()!.id)" [alt]="fileToView()!.fileName" class="max-w-full h-auto" />
                </div>
              }
              @if (fileToView() && isTextFile(fileToView()!)) {
                <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded">
                  <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ textFileContent() }}</pre>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Parser Selection Dialog -->
      <p-dialog
        [visible]="showParserDialog()"
        [modal]="true"
        [header]="getParserDialogHeader()"
        [style]="{ width: '400px' }"
        (onHide)="cancelParserDialog()"
      >
        <div class="space-y-4">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            @if (pendingFiles() && pendingFiles()!.length > 1) {
              {{ 'documents.selectParserForFiles' | translate: { count: pendingFiles()!.length } }}
            } @else {
              {{ 'documents.selectParser' | translate }}: <strong>{{ pendingFiles()?.[0]?.name }}</strong>
            }
          </p>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ 'parsers.selectParser' | translate }}
            </label>
            <p-select
              [options]="parserOptionsWithDisabled()"
              [ngModel]="selectedParser()"
              (ngModelChange)="selectedParser.set($event)"
              optionLabel="name"
              optionValue="id"
              optionDisabled="disabled"
              [placeholder]="'parsers.selectParser' | translate"
              class="w-full"
              styleClass="w-full"
            >
              <ng-template let-p pTemplate="item">
                <span [class.opacity-50]="p.disabled">{{ p.name }}</span>
                @if (p.requiresApiKey && !p.hasApiKeyConfigured) {
                  <span class="text-xs text-amber-600 ml-2">({{ 'parsers.apiKeyRequired' | translate }})</span>
                }
              </ng-template>
            </p-select>
          </div>
        </div>
        <ng-template pTemplate="footer">
          <p-button [label]="'common.cancel' | translate" severity="secondary" [outlined]="true" (onClick)="cancelParserDialog()"></p-button>
          <p-button [label]="'parsers.uploadWithParser' | translate" (onClick)="confirmParserSelection()"
            [disabled]="!canConfirmUpload() || uploadingFiles()"></p-button>
        </ng-template>
      </p-dialog>

      <app-file-content-dialog
        [file]="fileForContentDialog()"
        [workspaceId]="workspaceId()"
        [documentId]="documentId()"
        (closed)="fileForContentDialog.set(null)"
        (closedWithSelections)="onFileContentClosedWithSelections($event)"
      ></app-file-content-dialog>

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
  private onboardingService = inject(OnboardingService);
  private documentViewTabService = inject(DocumentViewTabService);
  private voiceRecordingService = inject(VoiceRecordingService);

  redlineComponent = viewChild<RedlineComponent>('redlineComponent');

  /** Expose enum for template comparisons. Uses fallback when shared package fails to load. */
  readonly ChatResponseMode = ChatResponseModeValues ?? CHAT_MODE;

  readonly fileInputAccept = FILE_INPUT_ACCEPT;

  workspaceId = signal('');
  documentId = signal('');
  document = signal<Document | null>(null);
  question = signal('');
  loading = signal(false);
  voiceRecording = signal(false);
  voiceTranscribing = signal(false);
  voiceAvailable = signal(false);
  chatMessages = signal<ChatMessageWithAudio[]>([]);
  chatResponseMode = signal<ChatResponseMode>((ChatResponseModeValues ?? CHAT_MODE).TextOnly);
  voiceAutoSend = signal(false);
  /** Currently playing message index; only one at a time */
  playingMessageIndex = signal<number | null>(null);
  private currentAudio: HTMLAudioElement | null = null;
  selectedFiles = signal<DocumentFile[]>([]); // Multi-selection for bulk delete
  fileContextMenuRef = viewChild<ContextMenu>('fileContextMenu');
  selectedFileForContext = signal<DocumentFile | null>(null);
  fileContextMenuItems = computed<MenuItem[]>(() =>
    this.buildFileMenu(this.selectedFileForContext())
  );
  fileToView = signal<DocumentFile | null>(null);   // For file viewer dialog (opened by View button only)
  fileForContentDialog = signal<DocumentFile | null>(null); // For file content dialog (opened by double-click)
  fileSearchQuery = signal<string>('');
  fileSearchScope = signal<FileSearchScope>('all');
  fileSearchMode = signal<'fuzzy' | 'contains'>('contains');
  fileSimilarityThreshold = signal<number>(0.2);
  readonly fileSearchModeOptions: SearchModeOption[] = [
    { value: 'contains', labelKey: 'documents.searchModeContains' },
    { value: 'fuzzy', labelKey: 'documents.searchModeFuzzy' },
  ];
  readonly fileSearchScopeOptions: SearchScopeOption[] = [
    { value: 'all', labelKey: 'documents.searchAll' },
    { value: 'fileName', labelKey: 'documents.fileName' },
    { value: 'mimeType', labelKey: 'documents.fileType' },
    { value: 'status', labelKey: 'documents.status' },
    { value: 'createdAt', labelKey: 'documents.createdAt' },
  ];
  activeTab = signal<string | number>('0');
  textFileContent = signal<string>('');
  parsers = signal<ParserInfo[]>([]);
  showParserDialog = signal(false);
  selectedParser = signal<string>('docling');
  /** Single file (legacy) or first of batch - used for backward compat in some templates */
  pendingFile = signal<File | null>(null);
  /** Files to upload - single or batch */
  pendingFiles = signal<File[] | null>(null);
  /** True while upload is in progress (disables confirm button to prevent double-submit) */
  uploadingFiles = signal(false);
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
      if (params['q'] != null && params['q'] !== '') apiParams['q'] = params['q'];
      if (params['fileName'] != null && params['fileName'] !== '') apiParams['fileName'] = params['fileName'];
      if (params['mimeType'] != null && params['mimeType'] !== '') apiParams['mimeType'] = params['mimeType'];
      if (params['status'] != null && params['status'] !== '') apiParams['status'] = params['status'];
      if (params['searchMode'] != null) apiParams['searchMode'] = params['searchMode'];
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

  /** Aggregated progress: average of all active jobs */
  consolidatedProgress = computed(() => {
    const active = this.activeJobs();
    if (!active.length) return 0;
    const sum = active.reduce((acc, j) => acc + this.getJobProgress(j), 0);
    return Math.round(sum / active.length);
  });

  /** Stage summary for display: e.g. "Parsing (2), Chunking (1)" */
  consolidatedStageSummary = computed(() => {
    const active = this.activeJobs();
    const byType = new Map<string, number>();
    active.forEach(j => byType.set(j.type, (byType.get(j.type) ?? 0) + 1));
    return Array.from(byType.entries())
      .map(([type, count]) => `${this.getJobTypeLabel(type)} (${count})`)
      .join(', ');
  });
  
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
    currentPageReportTemplate: (this.translateService.instant(_('common.showing')) || 'Showing') + ' {first} ' + (this.translateService.instant(_('common.to')) || 'to') + ' {last} ' + (this.translateService.instant(_('common.of')) || 'of') + ' {totalRecords} ' + (this.translateService.instant(_('documents.files')) || 'files'),
    sortMode: 'multiple',
    striped: true,
    emptyMessageKey: 'documents.noFiles',
    colspan: 7,
    filters: {},
    onLazyLoad: (event: LazyLoadEvent) => this.updateFilesParamsFromLazyEvent(event),
    selectionMode: 'multiple' as const,
    selection: this.selectedFiles(),
    dataKey: 'id',
    onSelectionChange: (v: DocumentFile | DocumentFile[] | null) =>
      this.selectedFiles.set(Array.isArray(v) ? v : v ? [v] : []),
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
          this.loadParsers();
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
          this.loadWorkspaceChatSettings();
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
            searchMode: this.fileSearchMode(),
            similarityThreshold: this.fileSimilarityThreshold(),
          };
          this.filesParams.set(initialParams);
          this.filesRequest.set({ workspaceId: wsId, documentId: docId, ...initialParams });
        });
      }
    });

    // React to tour tab request (switch to chat/redline tab when tour advances)
    effect(() => {
      const tab = this.documentViewTabService.requestedTab();
      if (tab != null && this.workspaceId() && this.documentId()) {
        this.activeTab.set(tab);
        this.documentViewTabService.clearRequest();
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
        summary: this.translateService.instant(_('common.error')),
        detail:
          this.translateService.instant(_('documents.loadFilesError')) ||
          'Error loading files',
      });
    });
  }

  ngOnDestroy(): void {
    this.stopAggressivePolling();
    this.stopCurrentAudio();
    // Release voice recording resources if user navigates away while recording
    if (this.voiceRecording()) {
      this.voiceRecordingService.cancelRecording();
      this.voiceRecording.set(false);
    }
    // Clean up object URLs to prevent memory leaks
    this.fileObjectUrls().forEach(url => URL.revokeObjectURL(url));
    this.fileObjectUrls.set(new Map());
    // Revoke TTS audio blob URLs
    this.chatMessages().forEach((m) => {
      if (m.audioUrl) URL.revokeObjectURL(m.audioUrl);
    });
  }

  ngOnInit(): void {
    this.workspaceId.set(this.route.snapshot.paramMap.get('workspaceId') || '');
    this.documentId.set(this.route.snapshot.paramMap.get('documentId') || '');
    this.voiceAvailable.set(this.voiceRecordingService.isAvailable());
  }

  async toggleVoiceRecording(): Promise<void> {
    if (this.voiceTranscribing() || this.loading()) return;
    if (this.voiceRecording()) {
      this.voiceRecording.set(false);
      this.voiceTranscribing.set(true);
      try {
        const blob = await this.voiceRecordingService.stopRecording();
        const lang = this.translateService.getCurrentLang() || 'en';
        this.apiService
          .transcribe(this.workspaceId(), this.documentId(), blob, lang)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              this.voiceTranscribing.set(false);
              if (this.voiceAutoSend() && res.text?.trim()) {
                this.sendQuestion(res.text.trim());
              } else {
                const current = this.question();
                const separator = current ? ' ' : '';
                this.question.set(current + separator + (res.text || ''));
              }
            },
            error: (err) => {
              this.messageService.add({
                severity: 'error',
                summary: this.translateService.instant(_('common.error')),
                detail: err?.error?.message ?? this.translateService.instant(_('chat.transcribeError')),
              });
              this.voiceTranscribing.set(false);
            },
          });
      } catch (err:any) {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err?.error?.message ?? err?.message ?? this.translateService.instant(_('chat.transcribeError')),
        });
        this.voiceTranscribing.set(false);
      }
    } else {
      try {
        await this.voiceRecordingService.startRecording();
        this.voiceRecording.set(true);
      } catch (err:any) {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err?.error?.message ?? err?.message ?? this.translateService.instant(_('chat.voiceInputUnsupported')),
        });
      }
    }
  }

  loadParsers(): void {
    const wsId = this.workspaceId();
    if (!wsId) return;
    this.apiService.getDocumentParsers(wsId).subscribe({
      next: (list) => this.parsers.set(list),
      error: () => {},
    });
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

  loadWorkspaceChatSettings(): void {
    const wsId = this.workspaceId();
    if (!wsId) return;
    this.apiService.getWorkspaceSettings(wsId).subscribe({
      next: (settings) => {
        const mode = settings.chatResponseMode ?? (ChatResponseModeValues ?? CHAT_MODE).TextOnly;
        this.chatResponseMode.set(mode);
        this.voiceAutoSend.set(settings.voiceAutoSend ?? false);
      },
      error: () => {},
    });
  }

  /** Map PrimeNG LazyLoadEvent to API request params; merges in search input state */
  private lazyEventToApiParams(event: LazyLoadEvent): FilesRequestParams {
    const offset = event.first ?? 0;
    const limit = event.rows ?? 25;
    const params: FilesRequestParams = {
      offset,
      limit,
      searchMode: this.fileSearchMode(),
      similarityThreshold: this.fileSimilarityThreshold(),
    };

    const scope = this.fileSearchScope();
    const query = this.fileSearchQuery().trim();
    if (query) {
      if (scope === 'all') {
        params.q = query;
        params.fileName = undefined;
        params.mimeType = undefined;
        params.status = undefined;
        params.startDate = undefined;
        params.endDate = undefined;
      } else if (scope === 'createdAt') {
        params.q = undefined;
        params.fileName = undefined;
        params.mimeType = undefined;
        params.status = undefined;
        const parsed = this.parseDateString(query);
        if (parsed) {
          params.startDate = parsed.startDate;
          params.endDate = parsed.endDate;
        }
      } else {
        params.q = undefined;
        params.startDate = undefined;
        params.endDate = undefined;
        if (scope === 'fileName') params.fileName = query;
        else if (scope === 'mimeType') params.mimeType = query;
        else if (scope === 'status') params.status = query;
      }
    }

    if (event.filters && !params.q) {
      if (!params.fileName && event.filters['fileName']?.value) {
        params.fileName = event.filters['fileName'].value;
      }
      if (!params.mimeType && event.filters['mimeType']?.value) {
        params.mimeType = event.filters['mimeType'].value;
      }
      if (!params.status && event.filters['status']?.value) {
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
      (a.searchMode ?? '') === (b.searchMode ?? '') &&
      (a.similarityThreshold ?? 0.2) === (b.similarityThreshold ?? 0.2) &&
      (a.q ?? '') === (b.q ?? '') &&
      (a.fileName ?? '') === (b.fileName ?? '') &&
      (a.mimeType ?? '') === (b.mimeType ?? '') &&
      (a.status ?? '') === (b.status ?? '') &&
      (a.startDate ?? '') === (b.startDate ?? '') &&
      (a.endDate ?? '') === (b.endDate ?? '')
    );
  }

  /** Handle search mode change from SearchInputComponent; re-applies current search */
  onFileSearchModeChange(value: 'fuzzy' | 'contains'): void {
    this.fileSearchMode.set(value);
    this.applyFileSearch(this.fileSearchQuery());
  }

  /** Handle similarity threshold change from SearchInputComponent; re-applies current search */
  onFileSimilarityThresholdChange(value: number): void {
    this.fileSimilarityThreshold.set(value);
    this.applyFileSearch(this.fileSearchQuery());
  }

  /** Handle scope change from SearchInputComponent; validates and sets scope */
  onFileSearchScopeChange(value: string): void {
    const valid: FileSearchScope[] = ['all', 'fileName', 'mimeType', 'status', 'createdAt'];
    if (valid.includes(value as FileSearchScope)) {
      this.fileSearchScope.set(value as FileSearchScope);
      this.applyFileSearch(this.fileSearchQuery());
    }
  }

  /** Apply search from SearchInputComponent; resets to page 0 */
  applyFileSearch(query: string): void {
    const wsId = this.workspaceId();
    const docId = this.documentId();
    if (!wsId || !docId) return;

    this.fileSearchQuery.set(query);
    const scope = this.fileSearchScope();
    const current = this.filesParams();
    const newParams: FilesRequestParams = {
      ...current,
      offset: 0,
      searchMode: this.fileSearchMode(),
      similarityThreshold: this.fileSimilarityThreshold(),
      q: undefined,
      fileName: undefined,
      mimeType: undefined,
      status: undefined,
      startDate: undefined,
      endDate: undefined,
    };
    const trimmed = query.trim();
    if (scope === 'all' && trimmed) {
      newParams.q = trimmed;
    } else if (scope === 'fileName' && trimmed) {
      newParams.fileName = trimmed;
    } else if (scope === 'mimeType' && trimmed) {
      newParams.mimeType = trimmed;
    } else if (scope === 'status' && trimmed) {
      newParams.status = trimmed;
    } else if (scope === 'createdAt' && trimmed) {
      const parsed = this.parseDateString(trimmed);
      if (parsed) {
        newParams.startDate = parsed.startDate;
        newParams.endDate = parsed.endDate;
      }
    }

    if (this.filesParamsEqual(this.filesParams(), newParams)) return;
    this.paginationService.updateQueryParams({ page: 0 });
    this.filesParams.set(newParams);
    this.filesRequest.set({ workspaceId: wsId, documentId: docId, ...newParams });
  }

  /**
   * Parse a date string into startDate/endDate (YYYY-MM-DD) for a full-day filter.
   * Supports ISO (YYYY-MM-DD), DD/MM/YYYY, MM/DD/YYYY, and lenient Date parsing.
   */
  private parseDateString(input: string): { startDate: string; endDate: string } | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // ISO: YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      const year = parseInt(y!, 10);
      const month = parseInt(m!, 10) - 1;
      const day = parseInt(d!, 10);
      const date = new Date(Date.UTC(year, month, day));
      if (!isNaN(date.getTime()) && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        const iso = date.toISOString().split('T')[0];
        return { startDate: iso, endDate: iso };
      }
    }

    // DD/MM/YYYY or MM/DD/YYYY (slash or hyphen separated)
    const partsMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (partsMatch) {
      const [, a, b, y] = partsMatch;
      const first = parseInt(a!, 10);
      const second = parseInt(b!, 10);
      const year = parseInt(y!, 10);
      // If first > 12, it must be day (DD/MM); else try DD/MM then MM/DD
      let date: Date;
      if (first > 12) {
        date = new Date(year, second - 1, first);
      } else if (second > 12) {
        date = new Date(year, first - 1, second);
      } else {
        date = new Date(year, second - 1, first);
      }
      if (!isNaN(date.getTime())) {
        const iso = date.toISOString().split('T')[0];
        return { startDate: iso, endDate: iso };
      }
    }

    // Lenient fallback
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const iso = parsed.toISOString().split('T')[0];
      return { startDate: iso, endDate: iso };
    }

    return null;
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

  /**
   * Apply API jobs to state: merge with cache, update signal, save to localStorage.
   * Called from loadJobs and polling pipelines.
   */
  private applyJobsFromApi(documentId: string, apiJobs: DocumentJob[]): void {
    const apiJobsMap = new Map(apiJobs.map(j => [j.id, j]));
    const cachedJobs = this.getJobs(documentId);
    const mergedJobs: DocumentJob[] = [...apiJobs];
    cachedJobs.forEach(cachedJob => {
      if (!apiJobsMap.has(cachedJob.id)) mergedJobs.push(cachedJob);
    });
    this.jobs.set(mergedJobs);
    this.saveJobs(documentId, apiJobs);
  }

  loadJobs(): void {
    if (this.isLoadingJobs) return;
    const documentId = this.documentId();
    if (!documentId) return;
    this.isLoadingJobs = true;
    const currentJobs = this.jobs();
    if (currentJobs.length === 0) {
      const cachedJobs = this.getJobs(documentId);
      if (cachedJobs.length > 0) this.jobs.set(cachedJobs);
    }
    this.apiService.getDocumentJobs(this.workspaceId(), documentId).subscribe({
      next: (apiJobs) => {
        this.applyJobsFromApi(documentId, apiJobs);
        const mergedJobs = this.jobs();
        if (!mergedJobs.some(j => j.status === 'pending' || j.status === 'processing')) {
          this.stopAggressivePolling();
        }
        this.isLoadingJobs = false;
      },
      error: (err) => {
        console.error('Error loading jobs:', err);
        this.isLoadingJobs = false;
      },
    });
  }

  startJobsPolling(): void {
    if (this.pollingSubscription) this.stopJobsPolling();
    const wsId = this.workspaceId();
    const docId = this.documentId();
    if (!wsId || !docId) return;
    let consecutiveNoActiveJobs = 0;
    this.pollingSubscription = interval(500)
      .pipe(
        switchMap(() => this.apiService.getDocumentJobs(wsId, docId)),
        tap(apiJobs => this.applyJobsFromApi(docId, apiJobs)),
        tap(() => {
          const jobs = this.jobs();
          const hasPendingOrProcessing = jobs.some(
            j => j.status === 'pending' || j.status === 'processing',
          );
          if (!hasPendingOrProcessing && jobs.length > 0) {
            consecutiveNoActiveJobs++;
            if (consecutiveNoActiveJobs >= 3) this.stopJobsPolling();
          } else {
            consecutiveNoActiveJobs = 0;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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
    if (this.aggressivePollingSubscription) this.stopAggressivePolling();
    const wsId = this.workspaceId();
    const docId = this.documentId();
    if (!wsId || !docId) return;
    const currentJobs = this.jobs();
    if (!currentJobs.some(j => j.status === 'pending' || j.status === 'processing')) return;
    this.aggressivePollingSubscription = interval(200)
      .pipe(
        switchMap(() => this.apiService.getDocumentJobs(wsId, docId)),
        tap(apiJobs => this.applyJobsFromApi(docId, apiJobs)),
        tap(() => {
          const stillActive = this.jobs().filter(
            j => j.status === 'pending' || j.status === 'processing',
          );
          if (stillActive.length === 0) this.stopAggressivePolling();
        }),
        takeUntil(this.destroyAggressive$),
      )
      .subscribe();
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

  /** Ensures title is displayed as string (avoids [object Object] if API returns object) */
  getDisplayTitle(doc: Document | null): string {
    if (!doc?.title) return '';
    const t = doc.title;
    return typeof t === 'string' ? t : String(t);
  }

  onDocumentTitleChange(newTitle: string): void {
    const wsId = this.workspaceId();
    const docId = this.documentId();
    if (!wsId || !docId) return;
    this.apiService.updateDocument(wsId, docId, { title: newTitle }).subscribe({
      next: (updated) => {
        this.document.update((d) => (d ? { ...d, title: updated.title } : null));
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('documents.updateSuccess')),
        });
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message ?? this.translateService.instant(_('documents.updateError')),
        });
      },
    });
  }

  /** Ensures jurisdiction is displayed as string */
  getDisplayJurisdiction(doc: Document | null): string {
    if (!doc?.resolvedJurisdiction) return '';
    const j = doc.resolvedJurisdiction;
    return typeof j === 'string' ? j : (typeof j === 'object' && j !== null && 'jurisdiction' in j ? String((j as { jurisdiction?: string }).jurisdiction ?? '') : String(j));
  }

  /** Ensures jurisdiction status is displayed as string */
  getDisplayJurisdictionStatus(doc: Document | null): string {
    if (!doc?.jurisdictionStatus) return '';
    const s = doc.jurisdictionStatus;
    return typeof s === 'string' ? s : String(s);
  }

  /** Parser dialog header as string (avoids [object Object] from translate) */
  getParserDialogHeader(): string {
    const files = this.pendingFiles();
    if (files && files.length > 1) {
      return this.translateService.instant(_('documents.selectParserForFiles'), { count: files.length });
    }
    const h = this.translateService.instant(_('documents.parserDialogTitle'));
    return typeof h === 'string' ? h : 'Choose Document Parser';
  }

  getConfidenceLabel(confidence: string): string {
    if (!confidence) return '';
    return this.translateService.instant(`redline.confidence.${confidence}`) || confidence;
  }

  onQuestionInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.question.set(target.value);
    }
  }

  onFileSelected(file: File): void {
    this.openPendingFilesFlow([file]);
  }

  onFilesSelected(files: File[]): void {
    const validation = this.validateFilesForUpload(files);
    if (!validation.valid) {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant(_('common.error')),
        detail: validation.error!,
      });
      return;
    }
    this.openPendingFilesFlow(files);
  }

  private validateFilesForUpload(files: File[]): { valid: boolean; error?: string } {
    if (files.length === 0) return { valid: false, error: this.translateService.instant(_('documents.uploadError')) };
    if (files.length > MAX_BATCH_FILE_COUNT) {
      return {
        valid: false,
        error: this.translateService.instant(_('documents.uploadBatchCountExceeded')),
      };
    }
    let totalBytes = 0;
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        return {
          valid: false,
          error: this.translateService.instant(_('documents.uploadFileSizeExceeded'), { fileName: f.name }),
        };
      }
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
        return {
          valid: false,
          error: this.translateService.instant(_('documents.uploadError')) + ` (${f.name}: invalid extension)`,
        };
      }
      totalBytes += f.size;
    }
    if (totalBytes > MAX_BATCH_SIZE_BYTES) {
      return {
        valid: false,
        error: this.translateService.instant(_('documents.uploadBatchSizeExceeded')),
      };
    }
    return { valid: true };
  }

  private openPendingFilesFlow(files: File[]): void {
    this.pendingFile.set(files[0] ?? null);
    this.pendingFiles.set(files);
    const wsId = this.workspaceId();
    forkJoin({
      parsers: this.apiService.getDocumentParsers(wsId),
      settings: this.apiService.getWorkspaceSettings(wsId),
    }).subscribe({
      next: ({ parsers: list, settings }) => {
        this.parsers.set(list);
        const defaultParser = settings.documentProcessing?.defaultDocumentParser ?? 'docling';
        const defaultP = list.find(p => p.id === defaultParser);
        const defaultIsEnabled = defaultP ? this.isParserEnabled(defaultP) : false;
        const fallback = list.find(p => this.isParserEnabled(p))?.id ?? 'docling';
        this.selectedParser.set(defaultIsEnabled ? defaultParser : fallback);
      },
      error: () => {
        this.selectedParser.set('docling');
      },
    });
    this.showParserDialog.set(true);
  }

  cancelParserDialog(): void {
    this.showParserDialog.set(false);
    this.pendingFile.set(null);
    this.pendingFiles.set(null);
  }

  confirmParserSelection(): void {
    const files = this.pendingFiles();
    const parser = this.selectedParser();
    if (!files?.length) return;
    const validFiles = files.filter((f): f is File => f != null && f instanceof File);
    if (!validFiles.length) {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant(_('common.error')),
        detail: this.translateService.instant(_('documents.uploadError')),
      });
      return;
    }
    this.uploadingFiles.set(true);
    const wsId = this.workspaceId();
    const docId = this.documentId();
    const total = validFiles.length;

    from(validFiles)
      .pipe(
        mergeMap(
          (file) =>
            this.apiService.uploadFile(wsId, docId, file, parser).pipe(
              map(() => ({ success: true as const })),
              catchError((err) => {
                const fileName = file?.name ?? 'unknown';
                console.error('Error uploading file:', fileName, err);
                return of({
                  success: false as const,
                  errorMessage: err?.error?.message as string | undefined,
                });
              }),
            ),
          2,
        ),
        toArray(),
      )
      .subscribe({
        next: (results) => {
          const successCount = results.filter((r) => r.success).length;
          const failCount = results.filter((r) => !r.success).length;
          const firstError = results.find((r) => !r.success && 'errorMessage' in r && r.errorMessage) as
            | { errorMessage?: string }
            | undefined;
          // Edge case: no results despite having files to upload (e.g. filtered out or pipe error)
          if (results.length === 0 && total > 0) {
            this.uploadingFiles.set(false);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant(_('common.error')),
              detail: this.translateService.instant(_('documents.uploadError')),
            });
            this.showParserDialog.set(false);
            this.pendingFile.set(null);
            this.pendingFiles.set(null);
            return;
          }
          this.uploadingFiles.set(false);
          this.onboardingService.markChecklistItem('upload_contract');
          this.showParserDialog.set(false);
          this.pendingFile.set(null);
          this.pendingFiles.set(null);
          this.loadJobs();
          setTimeout(() => {
            const currentJobs = this.jobs();
            if (currentJobs.some(j => j.status === 'pending' || j.status === 'processing')) {
              this.startAggressivePolling();
            }
          }, 100);
          this.loadDocument();
          const reloadParams: FilesRequestParams = { offset: 0, limit: this.paginationService.pageSize() };
          this.filesParams.set(reloadParams);
          // Use refreshKey to force rxResource to refetch; small delay ensures backend has committed
          setTimeout(() => {
            this.filesRequest.set({
              workspaceId: wsId,
              documentId: docId,
              ...reloadParams,
              refreshKey: Date.now(),
            });
          }, 150);
          this.paginationService.updateQueryParams({ page: 0, limit: this.paginationService.pageSize() });
          if (failCount === 0) {
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant(_('common.success')),
              detail: this.translateService.instant(_('documents.uploadBatchSuccess'), { count: successCount }),
            });
          } else if (successCount > 0) {
            const partialDetail = this.translateService.instant(_('documents.uploadPartialError'), {
              success: successCount,
              total,
              failed: failCount,
            });
            const detail = firstError?.errorMessage
              ? `${partialDetail}. ${firstError.errorMessage}`
              : partialDetail;
            this.messageService.add({
              severity: 'warn',
              summary: this.translateService.instant(_('common.error')),
              detail,
            });
          } else {
            const detail =
              firstError?.errorMessage ||
              this.translateService.instant(_('documents.uploadError'));
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant(_('common.error')),
              detail,
            });
          }
        },
        error: (err) => {
          this.uploadingFiles.set(false);
          console.error('Error during batch upload:', err);
          const detail =
            err?.error?.message || this.translateService.instant(_('documents.uploadError'));
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant(_('common.error')),
            detail,
          });
        },
      });
  }

  isParserEnabled(p: ParserInfo): boolean {
    if (!p.requiresApiKey) return true;
    return !!p.hasApiKeyConfigured;
  }

  parserOptionsWithDisabled = computed(() =>
    this.parsers().map(p => ({ ...p, disabled: !this.isParserEnabled(p) }))
  );

  canConfirmUpload(): boolean {
    const p = this.parsers().find(x => x.id === this.selectedParser());
    return !!p && this.isParserEnabled(p);
  }

  sendQuestion(questionTextOverride?: string): void {
    const questionText = (questionTextOverride ?? this.question().trim()).trim();
    if (!questionText) return;

    this.loading.set(true);
    if (!questionTextOverride) {
      this.question.set('');
    }

    const currentLang = this.translateService.currentLang || 'en';
    const mode = this.chatResponseMode();

    this.apiService
      .chat(this.workspaceId(), this.documentId(), {
        question: questionText,
        language: currentLang,
      })
      .subscribe({
        next: (response: ChatResponse) => {
          const wasFirstMessage = this.chatMessages().length === 0;
          const needsAudio =
            mode === (ChatResponseModeValues ?? CHAT_MODE).AudioOnly || mode === (ChatResponseModeValues ?? CHAT_MODE).AudioAndText;
          const newMessage: ChatMessageWithAudio = {
            question: questionText,
            answerText: response.answerText,
            confidence: response.confidence,
            citations: response.citations,
            audioState: needsAudio ? 'synthesizing' : 'none',
          };
          this.chatMessages.update((messages) => [...messages, newMessage]);
          if (wasFirstMessage) {
            this.onboardingService.markChecklistItem('run_first_review');
          }
          this.loading.set(false);

          if (needsAudio && response.answerText?.trim()) {
            this.synthesizeAndPlayForMessage(
              this.chatMessages().length - 1,
              response.answerText,
              currentLang,
            );
          }
        },
        error: (err) => {
          console.error('Error sending question:', err);
          this.loading.set(false);
        },
      });
  }

  private synthesizeAndPlayForMessage(
    index: number,
    text: string,
    language: string,
  ): void {
    this.apiService
      .synthesizeSpeech(this.workspaceId(), this.documentId(), text, language)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.chatMessages.update((messages) => {
            const next = [...messages];
            if (next[index]) {
              next[index] = {
                ...next[index],
                audioState: 'ready' as const,
                audioUrl: url,
              };
            }
            return next;
          });
          this.playMessageAudio(index);
        },
        error: () => {
          this.chatMessages.update((messages) => {
            const next = [...messages];
            if (next[index]) {
              next[index] = { ...next[index], audioState: 'none' as const };
            }
            return next;
          });
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant(_('common.error')),
            detail: this.translateService.instant(_('chat.audioError')),
          });
        },
      });
  }

  playMessageAudio(index: number): void {
    const messages = this.chatMessages();
    const msg = messages[index];
    if (!msg?.audioUrl) return;

    this.stopCurrentAudio();

    const audio = new Audio(msg.audioUrl);
    this.currentAudio = audio;
    this.playingMessageIndex.set(index);
    this.chatMessages.update((msgs) => {
      const next = [...msgs];
      if (next[index]) next[index] = { ...next[index], audioState: 'playing' as const };
      return next;
    });

    const resetState = () => {
      this.playingMessageIndex.set(null);
      this.currentAudio = null;
      this.chatMessages.update((msgs) => {
        const next = [...msgs];
        if (next[index]) next[index] = { ...next[index], audioState: 'ready' as const };
        return next;
      });
    };

    audio.onended = resetState;
    audio.onerror = resetState;
    audio.play().catch(resetState);
  }

  pauseMessageAudio(index: number): void {
    if (this.playingMessageIndex() !== index) return;
    this.stopCurrentAudio();
    this.playingMessageIndex.set(null);
    this.chatMessages.update((msgs) => {
      const next = [...msgs];
      if (next[index]) next[index] = { ...next[index], audioState: 'ready' as const };
      return next;
    });
  }

  private stopCurrentAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
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
          summary: this.translateService.instant(_('common.error')),
          detail: this.translateService.instant(_('documents.loadFileError')),
        });
      },
    });
  }

  viewFile(file: DocumentFile): void {
    this.fileToView.set(file);

    if (this.isTextFile(file)) {
      // Load text content using HttpClient with authentication
      this.apiService.downloadFileAsBlob(this.workspaceId(), this.documentId(), file.id).subscribe({
        next: (blob) => {
          blob.text().then(text => {
            this.textFileContent.set(text);
          }).catch(err => {
            console.error('Error reading text file:', err);
            this.textFileContent.set(this.translateService.instant(_('documents.loadFileError')));
          });
        },
        error: (err) => {
          console.error('Error loading text file:', err);
          this.textFileContent.set(this.translateService.instant(_('documents.loadFileError')));
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
              summary: this.translateService.instant(_('common.error')),
              detail: this.translateService.instant(_('documents.loadFileError')),
            });
          },
        });
      }
    }
  }

  closeFileViewer(): void {
    this.fileToView.set(null);
    this.textFileContent.set('');
  }

  downloadFile(file: DocumentFile): void {
    this.apiService.downloadFileAsBlob(this.workspaceId(), this.documentId(), file.id).subscribe({
      next: (blob) => {
        this.onboardingService.markChecklistItem('export_document');
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
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('documents.downloadError')),
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
    return (
      file.mimeType === 'text/plain' ||
      file.mimeType === 'text/markdown' ||
      file.mimeType === 'text/x-markdown' ||
      file.fileName.toLowerCase().endsWith('.txt') ||
      file.fileName.toLowerCase().endsWith('.md')
    );
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return `0 ${this.translateService.instant(_('documents.fileSizeUnits.bytes'))}`;
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

  openFileContentDialog(file: DocumentFile, event: MouseEvent): void {
    // Ignore double-clicks on buttons (View, Download) - let button action run instead
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    this.fileForContentDialog.set(file);
  }

  onFileContentClosedWithSelections(selections: string[]): void {
    if (selections.length === 0) return;
    const combinedText = selections.join('\n\n');
    const redline = this.redlineComponent();
    if (redline) {
      redline.onTextSelectedFromContent({ text: combinedText });
    }
    this.fileForContentDialog.set(null);
    this.activeTab.set('1');
    this.messageService.add({
      severity: 'success',
      summary: this.translateService.instant(_('common.success')),
      detail: this.translateService.instant(_('redline.selectionsAdded')),
    });
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('documents.confirmDeleteMessage'), { title: this.document()?.title || '' }),
      header: this.translateService.instant(_('documents.confirmDelete')),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant(_('common.delete')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.deleteDocument();
      },
    });
  }

  onToolbarDeleteClick(): void {
    const files = this.selectedFiles();
    if (files.length === 0) return;
    if (files.length === 1) {
      this.confirmDeleteFile(files[0]!);
    } else {
      this.confirmDeleteSelectedFiles();
    }
  }

  confirmDeleteSelectedFiles(): void {
    const files = this.selectedFiles();
    if (files.length === 0) return;
    this.confirmationService.confirm({
      message: this.translateService.instant(_('documents.confirmDeleteFilesMessage'), { count: files.length }),
      header: this.translateService.instant(_('documents.confirmDeleteFiles')),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant(_('common.delete')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.deleteSelectedFiles();
      },
    });
  }

  private deleteSelectedFiles(): void {
    const files = this.selectedFiles();
    if (files.length === 0) return;
    const wsId = this.workspaceId();
    const docId = this.documentId();
    const ids = files.map(f => f.id);

    from(ids)
      .pipe(
        mergeMap((fileId) =>
          this.apiService.deleteFile(wsId, docId, fileId).pipe(
            map(() => ({ success: true as const })),
            catchError((err) => {
              console.error('Error deleting file:', fileId, err);
              return of({ success: false as const });
            }),
          ),
        2,
        ),
        toArray(),
      )
      .subscribe({
        next: (results) => {
          const successCount = results.filter(r => r.success).length;
          this.selectedFiles.set([]);
          if (this.fileToView() && ids.includes(this.fileToView()!.id)) {
            this.closeFileViewer();
          }
          const reloadParams: FilesRequestParams = {
            ...this.filesParams(),
            offset: 0,
            limit: this.paginationService.pageSize(),
          };
          this.filesParams.set(reloadParams);
          this.filesRequest.set({
            workspaceId: wsId,
            documentId: docId,
            ...reloadParams,
            refreshKey: Date.now(),
          });
          this.paginationService.updateQueryParams({ page: 0, limit: this.paginationService.pageSize() });
          if (successCount > 0) {
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant(_('common.success')),
              detail: this.translateService.instant(_('documents.deleteFilesSuccess'), { count: successCount }),
            });
          }
          if (successCount < results.length) {
            this.messageService.add({
              severity: 'warn',
              summary: this.translateService.instant(_('common.error')),
              detail: this.translateService.instant(_('documents.deleteFileError')),
            });
          }
        },
        error: (err) => {
          console.error('Error during bulk delete:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant(_('common.error')),
            detail: err.error?.message || this.translateService.instant(_('documents.deleteFileError')),
          });
        },
      });
  }

  confirmDeleteFile(file: DocumentFile): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('documents.confirmDeleteFileMessage'), { fileName: file.fileName }),
      header: this.translateService.instant(_('documents.confirmDeleteFile')),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant(_('common.delete')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.deleteFile(file.id);
      },
    });
  }

  private buildFileMenu(file: DocumentFile | null): MenuItem[] {
    if (!file) return [];
    const t = (key: string) => this.translateService.instant(_(key));
    const items: MenuItem[] = [];
    if (file.status === 'available') {
      items.push({
        label: t('contextMenu.files.view'),
        icon: 'pi pi-eye',
        command: () => {
          this.openFileContentDialog(file, {} as MouseEvent);
        },
      });
    }
    items.push(
      {
        label: t('contextMenu.files.download'),
        icon: 'pi pi-download',
        command: () => this.downloadFile(file),
      },
      { separator: true },
      {
        label: t('contextMenu.files.delete'),
        icon: 'pi pi-trash',
        command: () => this.confirmDeleteFile(file),
      }
    );
    return items;
  }

  deleteFile(fileId: string): void {
    this.apiService.deleteFile(this.workspaceId(), this.documentId(), fileId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('documents.deleteFileSuccess')),
        });
        this.selectedFiles.update(files => files.filter(f => f.id !== fileId));
        if (this.fileToView()?.id === fileId) {
          this.closeFileViewer();
        }
        const reloadParams: FilesRequestParams = {
          ...this.filesParams(),
          offset: 0,
          limit: this.paginationService.pageSize(),
        };
        this.filesParams.set(reloadParams);
        this.filesRequest.set({
          workspaceId: this.workspaceId(),
          documentId: this.documentId(),
          ...reloadParams,
          refreshKey: Date.now(),
        });
        this.paginationService.updateQueryParams({ page: 0, limit: this.paginationService.pageSize() });
      },
      error: (err) => {
        console.error('Error deleting file:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('documents.deleteFileError')),
        });
      },
    });
  }

  deleteDocument(): void {
    this.apiService.deleteDocument(this.workspaceId(), this.documentId()).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('documents.deleteSuccess')),
        });
        this.router.navigate([...workspaceDocuments(this.workspaceId())]);
      },
      error: (err) => {
        console.error('Error deleting document:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('documents.deleteError')),
        });
      },
    });
  }
}
