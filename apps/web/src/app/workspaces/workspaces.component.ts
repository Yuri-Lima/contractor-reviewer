import { Component, OnInit, OnDestroy, signal, computed, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { InputText } from 'primeng/inputtext';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ContextMenu } from 'primeng/contextmenu';
import { ConfirmationService, MessageService } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { Toast } from 'primeng/toast';
import {
  workspaceDocuments,
  workspaceSettings,
  workspaceMembers,
} from '../core/routes';
import { FileUploadComponent } from '../core/components/file-upload';
import { ApiService } from '../core/services/api.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { Workspace, IMAGE_ASSET_INPUT_ACCEPT } from '@contractai-review/shared';
import { LocaleDatePipe } from '../core/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-workspaces',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    Button,
    Card,
    TooltipModule,
    InputText,
    ConfirmDialog,
    Toast,
    ContextMenu,
    LocaleDatePipe,
    TranslatePipe,
    FileUploadComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './workspaces.html',
  styles: [`
    .workspaces-container {
      min-height: calc(100vh - 200px);
    }
    .workspace-card {
      height: 100%;
    }
    .workspace-card:hover {
      transform: translateY(-2px);
    }
  `],
})
export class WorkspacesComponent implements OnInit, OnDestroy {
  readonly workspaceDocumentsRoute = workspaceDocuments;

  private apiService = inject(ApiService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private onboardingService = inject(OnboardingService);

  workspaceContextMenuRef = viewChild<ContextMenu>('workspaceContextMenu');

  workspaces = signal<Workspace[]>([]);
  showCreateForm = signal(false);
  loading = signal(false);
  createForm: FormGroup;

  selectedWorkspaceForContext = signal<Workspace | null>(null);
  workspaceContextMenuItems = computed<MenuItem[]>(() =>
    this.buildWorkspaceMenu(this.selectedWorkspaceForContext())
  );

  hasWorkspaces = computed(() => this.workspaces().length > 0);

  uploadingLogo = signal<Record<string, boolean>>({});
  logoUrls = signal<Record<string, string>>({});

  readonly IMAGE_ACCEPT = IMAGE_ASSET_INPUT_ACCEPT;

  constructor() {
    this.createForm = this.fb.group({
      name: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadWorkspaces();
  }

  loadWorkspaces(): void {
    this.apiService.getWorkspaces().subscribe({
      next: (workspaces) => {
        console.log('Loaded workspaces (raw):', workspaces);
        console.log('First workspace details:', workspaces[0]);
        // Ensure all workspaces have a name
        const workspacesWithNames = workspaces.map(ws => {
          console.log('Processing workspace:', ws);
          console.log('Workspace name:', ws.name);
          return {
            ...ws,
            name: ws.name || this.translateService.instant(_('workspaces.unnamed'))
          };
        });
        console.log('Workspaces with names:', workspacesWithNames);
        this.workspaces.set(workspacesWithNames);
        workspacesWithNames.forEach((ws) => this.loadWorkspaceLogoUrl(ws.id));
      },
      error: (err) => {
        console.error('Error loading workspaces:', err);
      },
    });
  }

  onCreate(): void {
    if (this.createForm.invalid) {
      return;
    }

    this.loading.set(true);
    const workspaceName = this.createForm.get('name')?.value;
    console.log('Creating workspace with name:', workspaceName);
    this.apiService.createWorkspace(this.createForm.value).subscribe({
      next: (workspace) => {
        console.log('Workspace created (raw):', workspace);
        console.log('Workspace name:', workspace?.name);
        // Ensure workspace has a name
        const workspaceWithName = {
          ...workspace,
          name: workspace?.name || this.translateService.instant(_('workspaces.unnamed'))
        };
        console.log('Workspace with name:', workspaceWithName);
        // Add the new workspace to the list immediately
        this.workspaces.update(ws => [...ws, workspaceWithName]);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('workspaces.createSuccess')),
        });
        this.onboardingService.markChecklistItem('create_workspace');
        this.showCreateForm.set(false);
        this.createForm.reset();
        // Also reload to ensure we have the latest data
        this.loadWorkspaces();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error creating workspace:', err);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('workspaces.createError')),
        });
      },
    });
  }

  confirmDelete(workspaceId: string, workspaceName: string): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('workspaces.confirmDeleteMessage'), { name: workspaceName }),
      header: this.translateService.instant(_('workspaces.confirmDelete')),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant(_('common.delete')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.deleteWorkspace(workspaceId, workspaceName);
      },
    });
  }

  deleteWorkspace(workspaceId: string, workspaceName: string): void {
    this.loading.set(true);
    this.apiService.deleteWorkspace(workspaceId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('workspaces.deleteSuccessMessage'), { name: workspaceName }),
        });
        this.loadWorkspaces();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error deleting workspace:', err);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('workspaces.deleteError')),
        });
      },
    });
  }

  trackByWorkspaceId(index: number, workspace: Workspace): string {
    return workspace.id;
  }

  getWorkspaceName(workspace: Workspace): string {
    return workspace.name || this.translateService.instant(_('workspaces.unnamed'));
  }

  logoUrl(workspaceId: string): string | null {
    return this.logoUrls()[workspaceId] ?? null;
  }

  loadWorkspaceLogoUrl(workspaceId: string): void {
    const prevUrl = this.logoUrls()[workspaceId];
    this.apiService.getWorkspaceLogoBlobUrl(workspaceId).subscribe({
      next: (url) => {
        if (prevUrl && prevUrl.startsWith('blob:')) {
          URL.revokeObjectURL(prevUrl);
        }
        if (url) {
          this.logoUrls.update((prev) => ({ ...prev, [workspaceId]: url }));
        } else {
          this.logoUrls.update((prev) => {
            const next = { ...prev };
            delete next[workspaceId];
            return next;
          });
        }
      },
    });
  }

  ngOnDestroy(): void {
    Object.values(this.logoUrls()).forEach((url) => {
      if (url?.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }

  onWorkspaceLogoSelected(workspace: Workspace, file: File): void {
    this.uploadingLogo.update((prev) => ({ ...prev, [workspace.id]: true }));
    this.apiService.uploadWorkspaceLogo(workspace.id, file).subscribe({
      next: () => {
        this.loadWorkspaceLogoUrl(workspace.id);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('workspaces.logoUploaded')),
        });
        this.uploadingLogo.update((prev) => ({ ...prev, [workspace.id]: false }));
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message ?? this.translateService.instant(_('workspaces.logoUploadError')),
        });
        this.uploadingLogo.update((prev) => ({ ...prev, [workspace.id]: false }));
      },
    });
  }

  onWorkspaceContextMenu(event: MouseEvent, workspace: Workspace): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedWorkspaceForContext.set(workspace);
    this.workspaceContextMenuRef()?.show(event);
  }

  private buildWorkspaceMenu(ws: Workspace | null): MenuItem[] {
    if (!ws) return [];
    const t = (key: string) => this.translateService.instant(_(key));
    return [
      {
        label: t('contextMenu.workspaces.openDocuments'),
        icon: 'pi pi-folder-open',
        command: () => {
          this.router.navigate(workspaceDocuments(ws.id));
        },
      },
      {
        label: t('contextMenu.workspaces.settings'),
        icon: 'pi pi-cog',
        command: () => {
          this.router.navigate(workspaceSettings(ws.id));
        },
      },
      {
        label: t('contextMenu.workspaces.members'),
        icon: 'pi pi-users',
        command: () => {
          this.router.navigate(workspaceMembers(ws.id));
        },
      },
      { separator: true },
      {
        label: t('contextMenu.workspaces.delete'),
        icon: 'pi pi-trash',
        command: () => {
          this.confirmDelete(ws.id, ws.name);
        },
      },
    ];
  }
}
