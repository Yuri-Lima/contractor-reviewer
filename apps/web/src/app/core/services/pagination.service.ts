import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { LazyLoadEvent } from 'primeng/api';

/**
 * Service to manage pagination state and sync with URL query params
 * 
 * Provides helpers for converting PrimeNG LazyLoadEvent to query params
 * and managing pagination state (page, limit, sorting, etc.)
 * 
 * Default page size: 25 items
 */
@Injectable({ providedIn: 'root' })
export class PaginationService {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  // Default values
  private readonly DEFAULT_PAGE_SIZE = 25;
  private readonly DEFAULT_PAGE = 0; // PrimeNG uses 0-based indexing
  
  // Current pagination state from query params
  currentPage = signal<number>(this.DEFAULT_PAGE);
  pageSize = signal<number>(this.DEFAULT_PAGE_SIZE);
  sortField = signal<string | undefined>(undefined);
  sortOrder = signal<number | undefined>(undefined);
  
  /**
   * Initialize pagination state from URL query params
   * Should be called in component ngOnInit
   */
  initializeFromQueryParams(): void {
    const params = this.route.snapshot.queryParams;
    this.currentPage.set(parseInt(params['page'] || '0', 10));
    this.pageSize.set(parseInt(params['limit'] || String(this.DEFAULT_PAGE_SIZE), 10));
    this.sortField.set(params['sortField'] || undefined);
    this.sortOrder.set(params['sortOrder'] ? parseInt(params['sortOrder'], 10) : undefined);
  }
  
  /**
   * Convert PrimeNG LazyLoadEvent to query params
   * 
   * @param event - LazyLoadEvent from PrimeNG table
   * @returns Query params object ready for router navigation
   */
  lazyLoadEventToQueryParams(event: LazyLoadEvent): Params {
    const params: Params = {};
    
    // Calculate page from first/rows
    const page = event.first !== undefined && event.rows ? Math.floor(event.first / event.rows) : 0;
    params['page'] = page;
    params['limit'] = event.rows || this.DEFAULT_PAGE_SIZE;
    
    // Sorting
    if (event.sortField) {
      params['sortField'] = event.sortField;
      params['sortOrder'] = event.sortOrder || 1;
    }
    
    // Multi-sort
    if (event.multiSortMeta && event.multiSortMeta.length > 0) {
      params['multiSort'] = JSON.stringify(event.multiSortMeta);
    }
    
    return params;
  }
  
  /**
   * Update URL query params with pagination state
   * 
   * @param params - Query params to update
   */
  updateQueryParams(params: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
    
    // Update internal state
    if (params['page'] !== undefined) {
      this.currentPage.set(parseInt(params['page'], 10));
    }
    if (params['limit'] !== undefined) {
      this.pageSize.set(parseInt(params['limit'], 10));
    }
    if (params['sortField'] !== undefined) {
      this.sortField.set(params['sortField']);
    }
    if (params['sortOrder'] !== undefined) {
      this.sortOrder.set(parseInt(params['sortOrder'], 10));
    }
  }
  
  /**
   * Get offset for API calls (convert page to offset)
   * 
   * @param page - Page number (0-based)
   * @param pageSize - Number of items per page
   * @returns Offset value for API calls
   */
  getOffset(page: number, pageSize: number): number {
    return page * pageSize;
  }
  
  /**
   * Get offset from LazyLoadEvent
   * 
   * @param event - LazyLoadEvent from PrimeNG table
   * @returns Offset value for API calls
   */
  getOffsetFromEvent(event: LazyLoadEvent): number {
    return event.first || 0;
  }
}
