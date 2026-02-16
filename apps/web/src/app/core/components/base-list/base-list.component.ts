import { Component, input, contentChild, computed, Signal, TemplateRef, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule, Table, TableService, TableLazyLoadEvent } from 'primeng/table';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseListConfig, LazyLoadEvent } from './base-list.config';

// Default: Factory function to provide Table instance
// Behavior: Returns the actual Table component instance from ViewChild reference
// Applies when: pSortableColumn and pColumnFilter directives need Table instance in projected templates
// Rationale: When templates are projected via ngTemplateOutlet, directives need access to the actual table instance
function tableFactory(component: BaseListComponent): Table | null {
  return component.tableRef() ?? null;
}

/**
 * Generic reusable table wrapper component using PrimeNG p-table
 * 
 * Uses Angular 17+ function-based APIs (input(), contentChild()) instead of decorators.
 * Supports both client-side and server-side pagination (lazy loading).
 * Supports column filtering with customizable filter templates.
 * 
 * @example Basic usage:
 * ```typescript
 * <app-base-list [data]="items()" [config]="tableConfig()">
 *   <ng-template #headerTemplate>
 *     <tr>
 *       <th>Name</th>
 *       <th>Email</th>
 *     </tr>
 *   </ng-template>
 *   <ng-template #bodyTemplate let-item>
 *     <tr>
 *       <td>{{ item.name }}</td>
 *       <td>{{ item.email }}</td>
 *     </tr>
 *   </ng-template>
 * </app-base-list>
 * ```
 * 
 * @example With column filtering:
 * ```typescript
 * <app-base-list [data]="items()" [config]="tableConfig()">
 *   <ng-template #headerTemplate>
 *     <tr>
 *       <th pSortableColumn="name" pColumnFilter field="name" filterMatchMode="contains">
 *         Name
 *       </th>
 *       <th pSortableColumn="email" pColumnFilter field="email" filterMatchMode="contains">
 *         Email
 *       </th>
 *     </tr>
 *   </ng-template>
 *   
 *   <!-- Optional: Custom filter template -->
 *   <ng-template #filterTemplate let-column let-filterCallback="filterCallback" let-field="field">
 *     @if (field === 'status') {
 *       <p-select
 *         [options]="statusOptions"
 *         (onChange)="filterCallback($event.value)"
 *         [showClear]="true"
 *       ></p-select>
 *     }
 *   </ng-template>
 *   
 *   <ng-template #bodyTemplate let-item>
 *     <tr>
 *       <td>{{ item.name }}</td>
 *       <td>{{ item.email }}</td>
 *     </tr>
 *   </ng-template>
 * </app-base-list>
 * ```
 */
@Component({
  selector: 'app-base-list',
  standalone: true,
  imports: [TableModule, CommonModule, TranslatePipe],
  providers: [
    TableService, // Default: TableService provider - required for p-table functionality
    // Behavior: Provides table state management and event handling services
    // Applies when: p-table component needs table services for sorting, filtering, pagination
    // Rationale: TableService is required by PrimeNG's p-table component for internal operations
    {
      provide: Table, // Default: Provide Table component instance via factory
      // Behavior: Factory function returns the actual Table instance from ViewChild reference
      // Applies when: pSortableColumn and pColumnFilter directives in projected templates need Table instance
      // Rationale: When templates are projected via ngTemplateOutlet, directives need access to the actual table instance
      useFactory: tableFactory,
      deps: [BaseListComponent]
    }
  ],
  template: `
    <div class="base-list-container">
      <!-- Actions slot (optional) - can use ng-content for non-template content -->
      <ng-content select="[slot=actions]"></ng-content>
      
      <!-- PrimeNG Table -->
      <p-table
        #table
        [value]="data()"
        [loading]="loading()"
        [paginator]="config().paginator ?? true"
        [lazy]="config().lazy ?? false"
        [rows]="config().rows ?? 25"
        [rowsPerPageOptions]="config().rowsPerPageOptions ?? [10, 25, 50, 100]"
        [showCurrentPageReport]="config().showCurrentPageReport ?? true"
        [currentPageReportTemplate]="config().currentPageReportTemplate || ''"
        [sortMode]="config().sortMode ?? 'multiple'"
        [totalRecords]="config().totalRecords || 0"
        [filters]="getFilters()"
        [scrollable]="config().scrollable ?? true"
        [scrollHeight]="getScrollHeight()"
        (onLazyLoad)="onLazyLoad($event)"
        [class]="getTableClasses()"
      >
        <!-- Header template projection -->
        <ng-template pTemplate="header">
          @if (headerTemplate()) {
            <ng-container *ngTemplateOutlet="headerTemplate()!"></ng-container>
          }
        </ng-template>
        
        <!-- Filter template projection - for custom filter UI per column -->
        <ng-template pTemplate="filter" let-column let-filterCallback="filterCallback">
          @if (filterTemplate()) {
            <ng-container *ngTemplateOutlet="filterTemplate()!; context: {
              $implicit: column,
              filterCallback: filterCallback,
              field: column.field
            }"></ng-container>
          }
        </ng-template>
        
        <!-- Body template projection - passes row data via context -->
        <ng-template pTemplate="body" let-rowData>
          @if (bodyTemplate()) {
            <ng-container *ngTemplateOutlet="bodyTemplate()!; context: {$implicit: rowData}"></ng-container>
          }
        </ng-template>
        
        <!-- Empty template projection -->
        <ng-template pTemplate="emptymessage">
          @if (emptyTemplate()) {
            <ng-container *ngTemplateOutlet="emptyTemplate()!; context: {$implicit: colspan()}"></ng-container>
          } @else {
            <tr>
              <td [attr.colspan]="colspan()" class="text-center py-8 text-gray-500 dark:text-gray-400">
                {{ (config().emptyMessageKey || 'baseList.emptyMessage') | translate }}
              </td>
            </tr>
          }
        </ng-template>
        
        <!-- Footer template projection (optional) -->
        @if (footerTemplate()) {
          <ng-template pTemplate="footer">
            <ng-container *ngTemplateOutlet="footerTemplate()!"></ng-container>
          </ng-template>
        }
      </p-table>
    </div>
  `,
  styles: [`
    .base-list-container {
      width: 100%;
    }
  `],
})
export class BaseListComponent<T = any> {
  // Function-based inputs (replaces @Input decorators)
  config = input.required<BaseListConfig>()
  
  data = input.required<T[]>();

  // Default: ViewChild reference to p-table component instance
  // Behavior: Gets reference to the Table component instance after view initialization
  // Applies when: Component view is initialized and p-table is rendered
  // Rationale: Needed to provide Table instance for pSortableColumn and pColumnFilter directives in projected templates
  tableRef = viewChild<Table>('table');

  // Function-based content queries (replaces @ContentChild decorators)
  // Returns Signal<TemplateRef<any> | undefined>
  headerTemplate = contentChild<TemplateRef<any>>('headerTemplate');
  bodyTemplate = contentChild<TemplateRef<any>>('bodyTemplate');
  emptyTemplate = contentChild<TemplateRef<any>>('emptyTemplate');
  footerTemplate = contentChild<TemplateRef<any>>('footerTemplate');
  filterTemplate = contentChild<TemplateRef<any>>('filterTemplate');

  // Computed properties
  loading = computed(() => {
    const configValue = this.config();
    const loadingValue = typeof configValue.loading === 'function' 
      ? (configValue.loading as Signal<boolean>)() 
      : configValue.loading;
    return loadingValue;
  });

  colspan = computed(() => 
    this.config().colspan || this.detectColumnCount()
  );

  // Lazy loading handler
  onLazyLoad(event: TableLazyLoadEvent): void {
    const config = this.config();
    if (config.lazy && config.onLazyLoad) {
      // Convert TableLazyLoadEvent to LazyLoadEvent format
      const lazyEvent: LazyLoadEvent = {
        first: event.first ?? undefined,
        rows: event.rows ?? undefined,
        sortField: typeof event.sortField === 'string' ? event.sortField : undefined,
        sortOrder: event.sortOrder ?? undefined,
        multiSortMeta: event.multiSortMeta ?? undefined,
        filters: event.filters ? this.convertFilters(event.filters) : undefined,
        globalFilter: typeof event.globalFilter === 'string' ? event.globalFilter : undefined,
      };
      config.onLazyLoad(lazyEvent);
    }
  }

  // Helper methods
  private convertFilters(filters: { [s: string]: any }): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key in filters) {
      if (filters.hasOwnProperty(key)) {
        const value = filters[key];
        if (value !== null && value !== undefined) {
          result[key] = value;
        }
      }
    }
    return result;
  }

  // Helper methods for filtering
  getFilters(): Record<string, any> {
    return this.config().filters || {};
  }

  // Helper method for scroll height
  getScrollHeight(): string | undefined {
    const config = this.config();
    // If scrollable is enabled (default true), use configured scrollHeight or default
    if (config.scrollable !== false) {
      return config.scrollHeight || '400px';
    }
    // If scrollable is explicitly disabled, return undefined
    return undefined;
  }

  getTableClasses(): string {
    const config = this.config();
    const classes: string[] = [];
    
    if (config.striped !== false) {
      classes.push('p-datatable-striped');
    }
    
    return classes.join(' ');
  }

  private detectColumnCount(): number {
    // Try to detect from header template or default to 1
    // This is a simplified implementation - can be enhanced to actually count columns
    return 1;
  }
}
