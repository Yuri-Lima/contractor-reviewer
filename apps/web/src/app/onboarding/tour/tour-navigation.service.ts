import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { workspaceDocuments, workspaceDocument } from '../../core/routes';
import { ApiService } from '../../core/services/api.service';

@Injectable({
  providedIn: 'root',
})
export class TourNavigationService {
  private router = inject(Router);
  private apiService = inject(ApiService);

  /**
   * Parse current Router URL to extract workspaceId and documentId.
   */
  getCurrentRouteParams(): { workspaceId?: string; documentId?: string } {
    const url = this.router.url;
    const wsMatch = url.match(/\/workspaces\/([^/]+)/);
    const docMatch = url.match(/\/documents\/([^/]+)/);
    return {
      workspaceId: wsMatch?.[1],
      documentId: docMatch?.[1],
    };
  }

  /**
   * Returns true if currently on /workspaces/:id/documents or deeper (e.g. document view).
   */
  isOnDocumentsRouteOrDeeper(): boolean {
    const { workspaceId } = this.getCurrentRouteParams();
    return !!workspaceId && this.router.url.includes('/documents');
  }

  /**
   * Returns true if currently on /workspaces/:id/documents/:docId.
   */
  isOnDocumentViewRoute(): boolean {
    const { workspaceId, documentId } = this.getCurrentRouteParams();
    return !!workspaceId && !!documentId;
  }

  /**
   * Ensure we are on /workspaces/:id/documents. Navigate if needed.
   * Returns false if user has no workspaces.
   */
  async ensureDocumentsRoute(): Promise<boolean> {
    if (this.isOnDocumentsRouteOrDeeper()) {
      return true;
    }

    const workspaces = await firstValueFrom(this.apiService.getWorkspaces());
    const first = workspaces?.[0];
    if (!first) {
      return false;
    }

    const navResult = await this.router.navigate([...workspaceDocuments(first.id)]);
    return !!navResult;
  }

  /**
   * Ensure we are on /workspaces/:id/documents/:docId. Navigate if needed.
   * Returns false if user has no workspaces or no documents.
   */
  async ensureDocumentViewRoute(): Promise<boolean> {
    if (this.isOnDocumentViewRoute()) {
      return true;
    }

    const workspaces = await firstValueFrom(this.apiService.getWorkspaces());
    const firstWs = workspaces?.[0];
    if (!firstWs) {
      return false;
    }

    const docs = await firstValueFrom(this.apiService.getDocuments(firstWs.id));
    const firstDoc = docs?.[0];
    if (!firstDoc) {
      return false;
    }

    const navResult = await this.router.navigate([...workspaceDocument(firstWs.id, firstDoc.id)]);
    return !!navResult;
  }

  /**
   * Navigate to a route. Returns the navigation result.
   */
  async navigateTo(commands: unknown[]): Promise<boolean> {
    const result = await this.router.navigate(commands);
    return !!result;
  }

  /**
   * Poll for element until it appears or timeout. Resolves true when found, false on timeout.
   */
  async waitForElement(selector: string, timeoutMs = 3000): Promise<boolean> {
    const pollInterval = 100;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const el = document.querySelector(selector);
      if (el) return true;
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    return false;
  }
}
