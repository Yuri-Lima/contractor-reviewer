import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ApiService } from '../core/services/api.service';
import { TranslateService } from '@ngx-translate/core';
import { Workspace } from '@contractai-review/shared';
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
    InputText,
    ConfirmDialog,
    Toast,
    LocaleDatePipe,
    TranslatePipe
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
export class WorkspacesComponent implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  workspaces = signal<Workspace[]>([]);
  showCreateForm = signal(false);
  loading = signal(false);
  createForm: FormGroup;

  hasWorkspaces = computed(() => this.workspaces().length > 0);

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
            name: ws.name || this.translateService.instant('workspaces.unnamed')
          };
        });
        console.log('Workspaces with names:', workspacesWithNames);
        this.workspaces.set(workspacesWithNames);
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
          name: workspace?.name || this.translateService.instant('workspaces.unnamed')
        };
        console.log('Workspace with name:', workspaceWithName);
        // Add the new workspace to the list immediately
        this.workspaces.update(ws => [...ws, workspaceWithName]);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('workspaces.createSuccess'),
        });
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
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('workspaces.createError'),
        });
      },
    });
  }

  confirmDelete(workspaceId: string, workspaceName: string): void {
    this.confirmationService.confirm({
      message: this.translateService.instant('workspaces.confirmDeleteMessage', { name: workspaceName }),
      header: this.translateService.instant('workspaces.confirmDelete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant('common.delete'),
      rejectLabel: this.translateService.instant('common.cancel'),
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
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('workspaces.deleteSuccessMessage', { name: workspaceName }),
        });
        this.loadWorkspaces();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error deleting workspace:', err);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('workspaces.deleteError'),
        });
      },
    });
  }

  trackByWorkspaceId(index: number, workspace: Workspace): string {
    return workspace.id;
  }

  getWorkspaceName(workspace: Workspace): string {
    return workspace.name || this.translateService.instant('workspaces.unnamed');
  }
}
