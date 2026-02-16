import { Signal } from '@angular/core';
import { LazyLoadEvent } from 'primeng/api';

/**
 * Configuration interface for BaseListComponent
 */
export interface BaseListConfig {
  // Data and loading
  data: any[]; // Table data array (for client-side) or current page data (for server-side)
  loading: boolean | Signal<boolean>; // Loading state (supports signals)
  totalRecords?: number; // Total records count (required for server-side pagination)

  // Pagination
  paginator?: boolean; // Enable pagination (default: true)
  lazy?: boolean; // Enable server-side pagination/lazy loading (default: false)
  rows?: number; // Rows per page (default: 25)
  rowsPerPageOptions?: number[]; // Page size options (default: [10, 25, 50, 100])
  showCurrentPageReport?: boolean; // Show pagination info (default: true)
  currentPageReportTemplate?: string; // Pagination template (supports {first}, {last}, {totalRecords})

  // Lazy loading callback (required when lazy=true)
  onLazyLoad?: (event: LazyLoadEvent) => void; // Callback for lazy loading

  // Sorting
  sortMode?: 'single' | 'multiple'; // Sorting mode (default: 'multiple')

  // Styling
  striped?: boolean; // Apply striped styling (default: true)
  emptyMessageKey?: string; // Translation key for empty state
  colspan?: number; // Column count for empty message (auto-detected if not provided)

  // Additional PrimeNG table props
  scrollable?: boolean; // Enable scrolling (default: true)
  scrollHeight?: string; // Height of scrollable area (default: '400px' when scrollable=true)
  responsive?: boolean;
  resizableColumns?: boolean;
  reorderableColumns?: boolean;

  // Filtering
  filters?: Record<string, any>; // Initial filter values { fieldName: { value: any, matchMode: string } }
  // Note: Filtering behavior is determined by the 'lazy' property:
  // - When lazy=true: filters trigger onLazyLoad event (server-side filtering)
  // - When lazy=false: PrimeNG handles filtering client-side automatically
  filterMode?: 'client' | 'server'; // Informational only - actual mode determined by 'lazy' property
  globalFilter?: string; // Global filter value (for tracking - not directly bound to p-table)
  globalFilterFields?: string[]; // Fields to include in global filter (for tracking - not directly bound to p-table)
}

/**
 * Default configuration values for BaseListComponent
 */
export const DEFAULT_BASE_LIST_CONFIG: Partial<BaseListConfig> = {
  paginator: true,
  lazy: true, // Server-side pagination by default
  rows: 25, // Default 25 items per page
  rowsPerPageOptions: [10, 25, 50, 100],
  showCurrentPageReport: true,
  sortMode: 'multiple',
  striped: true,
  emptyMessageKey: 'baseList.emptyMessage',
  responsive: false,
  resizableColumns: false,
  reorderableColumns: false,
  scrollable: true, // Enable scrolling by default
  scrollHeight: '600px', // Default scroll height when scrollable is enabled
};

// Re-export LazyLoadEvent from primeng/api for convenience
export type { LazyLoadEvent };
