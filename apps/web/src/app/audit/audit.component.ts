import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
// Default: SelectModule import - needed for dropdown filters in filter template
// Behavior: Provides p-select component for action and targetType column filters
// Applies when: Filter template renders dropdown filters
// Rationale: Required for custom dropdown filter UI
import { SelectModule } from 'primeng/select';
// Default: DatePickerModule import - needed for date picker in filter template
// Behavior: Provides p-datepicker component for createdAt column filter
// Applies when: Filter template renders date picker filter
// Rationale: Required for custom date picker filter UI
import { DatePickerModule } from 'primeng/datepicker';
// Default: TableModule import - required for pSortableColumn and pColumnFilter directives
// Behavior: Provides table directives for sorting and filtering
// Applies when: Header template uses pSortableColumn and pColumnFilter
// Rationale: Required for column sorting and filtering functionality
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Card } from 'primeng/card';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../core/services/api.service';
import { TranslateService } from '@ngx-translate/core';
import { LocaleDatePipe } from '../core/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseListComponent } from '../core/components/base-list/base-list.component';
import { BaseListConfig } from '../core/components/base-list/base-list.config';
import { PaginationService } from '../core/services/pagination.service';
import { LazyLoadEvent } from 'primeng/api';
import { AuditLog } from '@contractai-review/shared';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [
    CommonModule,
    // Default: FormsModule - needed for filter template bindings (ngModel, event bindings)
    // Behavior: Provides two-way data binding and form directives
    // Applies when: Filter templates use ngModel or event bindings
    // Rationale: Required for filter template form controls
    FormsModule,
    // Default: SelectModule - needed for dropdown filters in filter template
    // Behavior: Provides p-select component for action and targetType filters
    // Applies when: Filter template renders dropdown filters
    // Rationale: Required for custom dropdown filter UI
    SelectModule,
    // Default: DatePickerModule - needed for date picker in filter template
    // Behavior: Provides p-datepicker component for createdAt filter
    // Applies when: Filter template renders date picker filter
    // Rationale: Required for custom date picker filter UI
    DatePickerModule,
    // Default: TableModule - required for pSortableColumn and pColumnFilter directives
    // Behavior: Provides table directives for sorting and filtering
    // Applies when: Header template uses pSortableColumn and pColumnFilter
    // Rationale: Required for column sorting and filtering functionality
    TableModule,
    Tag,
    Card,
    Toast,
    LocaleDatePipe,
    TranslatePipe,
    BaseListComponent
  ],
  providers: [MessageService],
  templateUrl: './audit.html',
  styles: [`
    .audit-container {
      min-height: 400px;
    }
  `],
})
export class AuditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private paginationService = inject(PaginationService);

  workspaceId = signal('');
  logs = signal<AuditLog[]>([]);
  loading = signal(false);
  total = signal(0);

  // Default: Action options for dropdown filter template
  // Behavior: Array of action types with labels and values
  // Applies when: Used in filter template for 'action' column filter
  // Rationale: Provides user-friendly labels for action filter dropdown
  actionOptions = [
    { label: 'Open/View', value: 'open_view' },
    { label: 'Download', value: 'download' },
    { label: 'Chat Query', value: 'chat_query' },
    { label: 'Redline Generate', value: 'redline_generate' },
    { label: 'Delete', value: 'delete' },
    { label: 'Export Privacy', value: 'export_privacy' },
    { label: 'Upload', value: 'upload' },
    { label: 'Member Add', value: 'member_add' },
    { label: 'Member Remove', value: 'member_remove' },
    { label: 'Settings Update', value: 'settings_update' },
  ];

  // Default: Target type options for dropdown filter template
  // Behavior: Array of target types with labels and values
  // Applies when: Used in filter template for 'targetType' column filter
  // Rationale: Provides user-friendly labels for target type filter dropdown
  targetTypeOptions = [
    { label: 'Document', value: 'document' },
    { label: 'File', value: 'file' },
    { label: 'Workspace', value: 'workspace' },
    { label: 'User', value: 'user' },
    { label: 'Chat', value: 'chat' },
    { label: 'Version', value: 'version' },
  ];

  // Default: Table configuration with lazy loading and column filtering
  // Behavior: Computed signal that provides table configuration to BaseListComponent
  // Applies when: Component renders and table needs configuration
  // Rationale: Centralized configuration with reactive updates when dependencies change
  tableConfig = computed<BaseListConfig>(() => ({
    data: this.logs(),
    loading: this.loading(),
    // Default: Server-side pagination enabled
    // Behavior: Triggers onLazyLoad event when pagination/sorting/filtering changes
    // Applies when: User interacts with table (page change, sort, filter)
    // Rationale: Efficient for large datasets - only loads current page data
    lazy: true,
    totalRecords: this.total(),
    rows: this.paginationService.pageSize(),
    rowsPerPageOptions: [10, 25, 50, 100],
    showCurrentPageReport: true,
    currentPageReportTemplate: (this.translateService.instant('audit.showing') || 'Showing') + ' {first} ' + (this.translateService.instant('common.to') || 'to') + ' {last} ' + (this.translateService.instant('common.of') || 'of') + ' {totalRecords} ' + (this.translateService.instant('audit.logs') || 'logs'),
    sortMode: 'multiple',
    striped: true,
    emptyMessageKey: 'audit.noLogsFound',
    colspan: 6,
    // Default: Empty filters object - no filters applied initially
    // Behavior: Column filters are empty by default, users can apply filters directly from column headers
    // Format: { fieldName: { value: any, matchMode: string } } - empty object means no filters
    // Applies when: Component initializes - users start with unfiltered view
    // Rationale: Clean initial state - users apply filters as needed from column headers
    filters: {},
    onLazyLoad: (event: LazyLoadEvent) => this.loadLogsLazy(event),
  }));

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.paginationService.initializeFromQueryParams();
    this.loadLogsLazy({
      first: this.paginationService.getOffset(this.paginationService.currentPage(), this.paginationService.pageSize()),
      rows: this.paginationService.pageSize(),
    });
  }

  // Default: Process column filters from LazyLoadEvent - column filters are the only filtering mechanism
  // Behavior: Extracts filters from event.filters, maps to API parameters, makes API call
  // Applies when: User interacts with table (pagination, sorting, or column filtering)
  // Rationale: Column filters provide better UX - filters visible directly in table headers
  loadLogsLazy(event: LazyLoadEvent): void {
    // Default: Update URL query params to reflect current table state
    // Behavior: Syncs pagination, sorting, and filtering state with URL
    // Applies when: Table state changes (page, sort, filter)
    // Rationale: Enables bookmarkable URLs and browser back/forward navigation
    const queryParams = this.paginationService.lazyLoadEventToQueryParams(event);
    this.paginationService.updateQueryParams(queryParams);
    
    // Default: Calculate pagination offset and limit
    // Behavior: event.first is the starting index, event.rows is page size
    // Applies when: Pagination changes or initial load
    // Rationale: Server-side pagination requires offset/limit for API calls
    const offset = event.first || 0;
    const limit = event.rows || 25;
    
    this.loading.set(true);
    const params: any = {
      offset,
      limit,
    };
    
    // Default: Extract column filters from event.filters
    // Behavior: event.filters structure: { fieldName: { value: any, matchMode: string } }
    // Example: { action: { value: 'delete', matchMode: 'equals' } }
    // Applies when: Column filters are applied via pColumnFilter directives
    // Rationale: Column filters are automatically included in LazyLoadEvent when pColumnFilter is used
    if (event.filters) {
      // Default: Map action filter to API parameter
      // Behavior: Direct mapping - API expects exact action value
      // Applies when: User selects action from dropdown filter
      // Rationale: API uses 'action' parameter name directly
      if (event.filters['action']?.value) {
        params.action = event.filters['action'].value;
      }
      
      // Default: Map targetType filter to API parameter
      // Behavior: Direct mapping - API expects exact targetType value
      // Applies when: User selects targetType from dropdown filter
      // Rationale: API uses 'targetType' parameter name directly
      if (event.filters['targetType']?.value) {
        params.targetType = event.filters['targetType'].value;
      }
      
      // Default: Map actorUserId filter to API userId parameter
      // Behavior: Maps to 'userId' parameter (API uses 'userId', not 'actorUserId')
      // Applies when: User types text in actorUserId column filter
      // Rationale: API parameter name differs from column field name
      if (event.filters['actorUserId']?.value) {
        params.userId = event.filters['actorUserId'].value;
      }
      
      // Default: Handle IP filter (may not be supported by backend)
      // Behavior: Maps to 'ip' parameter if API supports it
      // Applies when: User types text in IP column filter
      // Rationale: IP filtering may require backend support - verify API support
      if (event.filters['ip']?.value) {
        // Note: IP filtering may not be supported by backend - verify or skip
        // params.ip = event.filters['ip'].value;
      }
      
      // Default: Convert createdAt date filter to API date range parameters
      // Behavior: For 'dateIs' matchMode, converts single date to startDate and endDate covering entire day
      // Applies when: User selects date in createdAt column filter
      // Rationale: API expects date range (startDate/endDate), not single date
      if (event.filters['createdAt']?.value) {
        const filterDate = event.filters['createdAt'].value;
        // Default: Convert Date object to ISO date string format
        // Behavior: Creates date range from 00:00:00 to 23:59:59 of selected date
        // Applies when: dateIs matchMode is used
        // Rationale: Ensures all records from that date are included, regardless of time
        if (filterDate instanceof Date) {
          const startOfDay = new Date(filterDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(filterDate);
          endOfDay.setHours(23, 59, 59, 999);
          params.startDate = startOfDay.toISOString().split('T')[0];
          params.endDate = endOfDay.toISOString().split('T')[0];
        } else if (typeof filterDate === 'string') {
          // Handle string date format
          params.startDate = filterDate;
          params.endDate = filterDate;
        }
      }
    }

    // Default: Add sorting parameters if sort field is specified
    // Behavior: Maps sortField and sortOrder to API parameters
    // Applies when: User clicks column header to sort
    // Rationale: API requires sort parameters for server-side sorting
    if (event.sortField) {
      params.sortField = event.sortField;
      params.sortOrder = event.sortOrder || 1;
    }

    this.apiService.getAuditLogs(this.workspaceId(), params).subscribe({
      next: (response: any) => {
        // Handle different response structures
        if (Array.isArray(response)) {
          // If response is a direct array
          this.logs.set(response);
          this.total.set(response.length);
        } else if (response && response.logs) {
          // Expected structure: { logs: [], total: number, limit: number, offset: number }
          this.logs.set(response.logs || []);
          this.total.set(response.total || response.logs?.length || 0);
        } else {
          // Unexpected response
          console.warn('Unexpected response structure:', response);
          this.logs.set([]);
          this.total.set(0);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading audit logs:', err);
        console.error('Error details:', {
          status: err.status,
          statusText: err.statusText,
          message: err.message,
          error: err.error,
          url: err.url,
        });
        
        // Map backend errors to translation keys
        let errorMessage: string;
        
        if (err.status === 403) {
          // No permission - user is not ADMIN or OWNER
          errorMessage = this.translateService.instant('audit.permissionDenied');
        } else if (err.status === 404) {
          // Workspace not found
          errorMessage = this.translateService.instant('audit.notFound');
        } else if (err.status === 0) {
          // Network error
          errorMessage = this.translateService.instant('errors.network');
        } else {
          // Generic error
          errorMessage = this.translateService.instant('audit.loadLogsError');
        }
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: errorMessage,
        });
        this.loading.set(false);
      },
    });
  }


  getActionLabel(action: string): string {
    const option = this.actionOptions.find(opt => opt.value === action);
    return option?.label || action;
  }

  getActionSeverity(action: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null | undefined {
    const severityMap: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null | undefined> = {
      'delete': 'danger',
      'download': 'warn',
      'upload': 'info',
      'chat_query': 'info',
      'redline_generate': 'success',
    };
    return severityMap[action] || 'secondary';
  }

  getTargetTypeLabel(targetType: string): string {
    const option = this.targetTypeOptions.find(opt => opt.value === targetType);
    return option?.label || targetType;
  }

  formatMetadata(metadata: any): string {
    if (!metadata) return '-';
    const keys = Object.keys(metadata);
    if (keys.length === 0) return '-';
    return keys.map(k => `${k}: ${metadata[k]}`).join(', ');
  }

  exportCsv(): void {
    const csv = this.convertToCsv(this.logs());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-logs-${this.workspaceId()}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.messageService.add({
      severity: 'success',
      summary: this.translateService.instant('common.success'),
      detail: this.translateService.instant('audit.exportSuccess'),
    });
  }

  convertToCsv(logs: AuditLog[]): string {
    const headers = ['Ação', 'Tipo', 'Usuário', 'IP', 'Data', 'Metadata'];
    const rows = logs.map(log => [
      this.getActionLabel(log.action),
      this.getTargetTypeLabel(log.targetType),
      log.actorUserId,
      log.ip || 'N/A',
      new Date(log.createdAt).toLocaleString(),
      JSON.stringify(log.metadata || {}),
    ]);
    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
  }
}
