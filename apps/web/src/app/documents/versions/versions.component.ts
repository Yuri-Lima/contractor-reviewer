import { Component, OnInit, signal, computed, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Toast } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { ContextMenu } from 'primeng/contextmenu';
import { MessageService } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { DocumentVersion, RedlineChange, DiffBlock } from '@contractai-review/shared';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-versions',
  standalone: true,
  imports: [CommonModule, Tag, Button, TooltipModule, Toast, MessageModule, ContextMenu, TranslatePipe],
  providers: [MessageService],
  template: `
    <p-contextMenu #versionContextMenu [model]="versionContextMenuItems()"></p-contextMenu>
    <div class="versions-container p-6">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">{{ 'versions.title' | translate }}</h2>

      @if (loading()) {
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          {{ 'versions.loading' | translate }}
        </div>
      }

      @if (!loading() && versions().length === 0) {
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          {{ 'versions.noVersions' | translate }}
        </div>
      }

      @if (!loading() && versions().length > 0) {
        <div class="space-y-4">
          @for (version of versions(); track version.id) {
            <div
              class="version-item p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              (contextmenu)="onVersionContextMenu($event, version)"
            >
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {{ 'versions.version' | translate }} {{ version.versionNumber }}
                  </h3>
                  <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {{ 'versions.createdBy' | translate }}: {{ getUserEmail(version.userId) }} • 
                    {{ formatDate(version.createdAt) }}
                  </div>
                  @if (version.playbook) {
                    <div class="mt-2">
                      <p-tag [value]="version.playbook" severity="info"></p-tag>
                    </div>
                  }
                </div>
                <p-button
                  [label]="selectedVersion()?.id === version.id ? ('versions.hide' | translate) : ('versions.view' | translate)"
                  [icon]="selectedVersion()?.id === version.id ? 'pi pi-eye-slash' : 'pi pi-eye'"
                  [outlined]="true"
                  (onClick)="toggleVersion(version)"
                  [pTooltip]="'tooltip.viewVersion' | translate"
                ></p-button>
              </div>

              <!-- Version Details -->
              @if (selectedVersion()?.id === version.id) {
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  @if (version.changes && version.changes.length > 0) {
                    <div class="space-y-4">
                      @for (change of version.changes; track $index) {
                        <div class="change-detail">
                          <!-- Explanation -->
                          <div class="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                            <div class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                              {{ 'redline.explanation' | translate }}:
                            </div>
                            <p class="text-sm text-blue-800 dark:text-blue-200">{{ change.explanation }}</p>
                          </div>

                          <!-- Diff Blocks -->
                          <div class="mb-3">
                            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              {{ 'redline.diffBlocks' | translate }}:
                            </h4>
                            <div class="space-y-2">
                              @for (block of change.diffBlocks; track block.id) {
                                <div
                                  class="p-2 rounded border text-sm"
                                  [class.bg-gray-50]="block.type === 'equal'"
                                  [class.dark:bg-gray-800]="block.type === 'equal'"
                                  [class.bg-red-50]="block.type === 'remove'"
                                  [class.dark:bg-red-900/20]="block.type === 'remove'"
                                  [class.bg-green-50]="block.type === 'add'"
                                  [class.dark:bg-green-900/20]="block.type === 'add'"
                                  [class.border-gray-200]="block.type === 'equal'"
                                  [class.dark:border-gray-700]="block.type === 'equal'"
                                  [class.border-red-200]="block.type === 'remove'"
                                  [class.dark:border-red-800]="block.type === 'remove'"
                                  [class.border-green-200]="block.type === 'add'"
                                  [class.dark:border-green-800]="block.type === 'add'"
                                >
                                  <span
                                    class="text-xs font-mono px-1 py-0.5 rounded mr-2"
                                    [class.bg-gray-200]="block.type === 'equal'"
                                    [class.dark:bg-gray-700]="block.type === 'equal'"
                                    [class.bg-red-200]="block.type === 'remove'"
                                    [class.dark:bg-red-800]="block.type === 'remove'"
                                    [class.bg-green-200]="block.type === 'add'"
                                    [class.dark:bg-green-800]="block.type === 'add'"
                                  >
                                    {{ block.type }}
                                  </span>
                                  <span class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ block.text }}</span>
                                </div>
                              }
                            </div>
                          </div>

                          <!-- Decisions -->
                          @if (version.decisions && version.decisions.length > 0) {
                            <div class="mb-3">
                              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                {{ 'versions.decisions' | translate }}:
                              </h4>
                              <div class="space-y-1">
                                @for (decision of version.decisions; track decision.blockId) {
                                  <div class="text-sm text-gray-600 dark:text-gray-400">
                                    <span class="font-mono">{{ decision.blockId }}</span>:
                                    <span [class.text-green-600]="decision.decision === 'accept'" [class.text-red-600]="decision.decision === 'reject'">
                                      {{ decision.decision === 'accept' ? ('redline.accept' | translate) : ('redline.reject' | translate) }}
                                    </span>
                                    <span class="text-xs text-gray-500 dark:text-gray-500 ml-2">
                                      ({{ getUserEmail(decision.userId) }})
                                    </span>
                                  </div>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                  @if (!version.changes || version.changes.length === 0) {
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      {{ 'versions.noChanges' | translate }}
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .versions-container {
      max-width: 1200px;
      margin: 0 auto;
    }
  `],
})
export class VersionsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  versionContextMenuRef = viewChild<ContextMenu>('versionContextMenu');
  selectedVersionForContext = signal<DocumentVersion | null>(null);
  versionContextMenuItems = computed<MenuItem[]>(() =>
    this.buildVersionMenu(this.selectedVersionForContext())
  );

  workspaceId = signal('');
  documentId = signal('');
  versions = signal<DocumentVersion[]>([]);
  loading = signal(false);
  selectedVersion = signal<DocumentVersion | null>(null);
  userMap = signal<Map<string, string>>(new Map());

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    const docId = this.route.snapshot.paramMap.get('documentId') || '';
    this.workspaceId.set(wsId);
    this.documentId.set(docId);

    this.loadVersions();
  }

  loadVersions(): void {
    this.loading.set(true);
    this.apiService.getDocumentVersions(this.workspaceId(), this.documentId()).subscribe({
      next: (versions) => {
        this.versions.set(versions);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading versions:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: this.translateService.instant(_('versions.loadError')),
        });
        this.loading.set(false);
      },
    });
  }

  onVersionContextMenu(event: MouseEvent, version: DocumentVersion): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedVersionForContext.set(version);
    this.versionContextMenuRef()?.show(event);
  }

  private buildVersionMenu(version: DocumentVersion | null): MenuItem[] {
    if (!version) return [];
    const t = (key: string) => this.translateService.instant(_(key));
    return [
      {
        label: t('contextMenu.versions.view'),
        icon: 'pi pi-eye',
        command: () => this.toggleVersion(version),
      },
    ];
  }

  toggleVersion(version: DocumentVersion): void {
    if (this.selectedVersion()?.id === version.id) {
      this.selectedVersion.set(null);
    } else {
      this.selectedVersion.set(version);
    }
  }

  getUserEmail(userId: string): string {
    // For now, return userId. In future, can fetch user details
    const currentUser = this.authService.currentUser();
    if (currentUser?.id === userId) {
      return currentUser.email || userId;
    }
    return userId;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }
}
