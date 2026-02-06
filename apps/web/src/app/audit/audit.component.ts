import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Button } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ApiService } from '../core/services/api.service';
import { TranslateService } from '@ngx-translate/core';
import { LocaleDatePipe } from '../core/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorUserId: string;
  ip: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: string;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    SelectModule,
    DatePickerModule,
    TableModule,
    Tag,
    Toast,
    Card,
    LocaleDatePipe,
    TranslatePipe
  ],
  providers: [MessageService],
  template: `
    <div class="audit-container p-6 max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">{{ 'audit.title' | translate }}</h1>

      <p-card class="mb-6">
        <ng-template pTemplate="header">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">{{ 'audit.filters' | translate }}</h2>
          </div>
        </ng-template>
        <div class="p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ 'audit.action' | translate }}</label>
              <p-select
                [options]="actionOptions"
                [(ngModel)]="filters.action"
                optionLabel="label"
                optionValue="value"
                [placeholder]="'audit.allActions' | translate"
                [showClear]="true"
                class="w-full"
              ></p-select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ 'audit.targetType' | translate }}</label>
              <p-select
                [options]="targetTypeOptions"
                [(ngModel)]="filters.targetType"
                optionLabel="label"
                optionValue="value"
                [placeholder]="'audit.allTypes' | translate"
                [showClear]="true"
                class="w-full"
              ></p-select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ 'audit.startDate' | translate }}</label>
              <p-datepicker
                [(ngModel)]="filters.startDate"
                [showIcon]="true"
                dateFormat="yy-mm-dd"
                [showClear]="true"
                [placeholder]="'audit.selectDate' | translate"
                iconDisplay="input"
                class="w-full"
              ></p-datepicker>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ 'audit.endDate' | translate }}</label>
              <p-datepicker
                [(ngModel)]="filters.endDate"
                [showIcon]="true"
                dateFormat="yy-mm-dd"
                [showClear]="true"
                [placeholder]="'audit.selectDate' | translate"
                iconDisplay="input"
                class="w-full"
              ></p-datepicker>
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <p-button
              [label]="'common.filter' | translate"
              icon="pi pi-filter"
              (onClick)="loadLogs()"
              [loading]="loading()"
            ></p-button>
            <p-button
              [label]="'common.clear' | translate"
              icon="pi pi-times"
              severity="secondary"
              [outlined]="true"
              (onClick)="clearFilters()"
            ></p-button>
            <p-button
              [label]="'audit.exportCsv' | translate"
              icon="pi pi-download"
              severity="info"
              [outlined]="true"
              (onClick)="exportCsv()"
              [disabled]="logs().length === 0"
            ></p-button>
          </div>
        </div>
      </p-card>

      <p-table
        [value]="logs()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="20"
        [rowsPerPageOptions]="[10, 20, 50, 100]"
        [showCurrentPageReport]="true"
        [currentPageReportTemplate]="('audit.showing' | translate) + ' {first} ' + ('common.to' | translate) + ' {last} ' + ('common.of' | translate) + ' {totalRecords} ' + ('audit.logs' | translate)"
        [sortMode]="'multiple'"
        styleClass="p-datatable-striped"
      >
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="action">
              {{ 'audit.action' | translate }} <p-sortIcon field="action"></p-sortIcon>
            </th>
            <th pSortableColumn="targetType">
              {{ 'audit.type' | translate }} <p-sortIcon field="targetType"></p-sortIcon>
            </th>
            <th pSortableColumn="actorUserId">{{ 'audit.user' | translate }}</th>
            <th pSortableColumn="ip">IP</th>
            <th pSortableColumn="createdAt">
              {{ 'audit.date' | translate }} <p-sortIcon field="createdAt"></p-sortIcon>
            </th>
            <th>{{ 'audit.metadata' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-log>
          <tr>
            <td>
              <p-tag
                [value]="getActionLabel(log.action)"
                [severity]="getActionSeverity(log.action)"
              ></p-tag>
            </td>
            <td>
              <p-tag
                [value]="getTargetTypeLabel(log.targetType)"
                severity="secondary"
              ></p-tag>
            </td>
            <td class="text-sm">{{ log.actorUserId.substring(0, 8) }}...</td>
            <td class="text-sm">{{ log.ip || ('common.notAvailable' | translate) }}</td>
            <td class="text-sm">{{ log.createdAt | localeDate: 'short' }}</td>
            <td>
              <span *ngIf="log.metadata" class="text-xs text-gray-600 dark:text-gray-400">
                {{ formatMetadata(log.metadata) }}
              </span>
              <span *ngIf="!log.metadata" class="text-xs text-gray-400">-</span>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="6" class="text-center py-8 text-gray-500 dark:text-gray-400">
              {{ 'audit.noLogsFound' | translate }}
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p-toast></p-toast>
    </div>
  `,
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

  workspaceId = signal('');
  logs = signal<AuditLog[]>([]);
  loading = signal(false);
  total = signal(0);

  filters = {
    action: null as string | null,
    targetType: null as string | null,
    startDate: null as Date | null,
    endDate: null as Date | null,
  };

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

  targetTypeOptions = [
    { label: 'Document', value: 'document' },
    { label: 'File', value: 'file' },
    { label: 'Workspace', value: 'workspace' },
    { label: 'User', value: 'user' },
    { label: 'Chat', value: 'chat' },
    { label: 'Version', value: 'version' },
  ];

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    const params: any = {};
    
    if (this.filters.action) {
      params.action = this.filters.action;
    }
    if (this.filters.targetType) {
      params.targetType = this.filters.targetType;
    }
    if (this.filters.startDate) {
      params.startDate = this.filters.startDate.toISOString().split('T')[0];
    }
    if (this.filters.endDate) {
      params.endDate = this.filters.endDate.toISOString().split('T')[0];
    }

    this.apiService.getAuditLogs(this.workspaceId(), params).subscribe({
      next: (response: any) => {
        // Tratar diferentes estruturas de resposta
        if (Array.isArray(response)) {
          // Se a resposta é um array direto
          this.logs.set(response);
          this.total.set(response.length);
        } else if (response && response.logs) {
          // Estrutura esperada: { logs: [], total: number }
          this.logs.set(response.logs || []);
          this.total.set(response.total || response.logs?.length || 0);
        } else {
          // Resposta inesperada
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
        
        // Mapear erros do backend para chaves de tradução
        let errorMessage: string;
        
        if (err.status === 403) {
          // Sem permissão - usuário não é ADMIN ou OWNER
          errorMessage = this.translateService.instant('audit.permissionDenied');
        } else if (err.status === 404) {
          // Workspace não encontrado
          errorMessage = this.translateService.instant('audit.notFound');
        } else if (err.status === 0) {
          // Erro de rede
          errorMessage = this.translateService.instant('errors.network');
        } else {
          // Erro genérico
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

  clearFilters(): void {
    this.filters = {
      action: null,
      targetType: null,
      startDate: null,
      endDate: null,
    };
    this.loadLogs();
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
