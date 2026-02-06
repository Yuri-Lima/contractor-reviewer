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
import { Workspace } from '../core/models/workspace.model';
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
  template: `
    <div class="workspaces-container p-6 max-w-7xl mx-auto">
      <!-- Header Section -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Workspaces</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ 'workspaces.description' | translate }}</p>
        </div>
        <p-button
          [label]="'workspaces.create' | translate"
          icon="pi pi-plus"
          (onClick)="showCreateForm.set(true)"
          [outlined]="false"
          styleClass="w-full sm:w-auto"
        ></p-button>
      </div>

      <!-- Create Form -->
      <p-card *ngIf="showCreateForm()" styleClass="mb-8">
        <ng-template pTemplate="header">
          <div class="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">Criar Novo Workspace</h3>
          </div>
        </ng-template>
        <form [formGroup]="createForm" (ngSubmit)="onCreate()" class="p-5 space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome do Workspace
            </label>
            <input
              pInputText
              formControlName="name"
              placeholder="Meu Workspace"
              class="w-full"
              [class.ng-invalid]="createForm.get('name')?.invalid && createForm.get('name')?.touched"
            />
            <small class="p-error block mt-1" *ngIf="createForm.get('name')?.invalid && createForm.get('name')?.touched">
              Nome do workspace é obrigatório
            </small>
          </div>
          <div class="flex gap-3 pt-2">
            <p-button
              type="submit"
              label="Criar"
              icon="pi pi-check"
              [disabled]="createForm.invalid || loading()"
              [loading]="loading()"
            ></p-button>
            <p-button
              type="button"
              label="Cancelar"
              icon="pi pi-times"
              severity="secondary"
              [outlined]="true"
              (onClick)="showCreateForm.set(false); createForm.reset();"
              [disabled]="loading()"
            ></p-button>
          </div>
        </form>
      </p-card>

      <!-- Workspaces Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" *ngIf="workspaces().length > 0; else emptyState">
        <p-card
          *ngFor="let workspace of workspaces()"
          styleClass="workspace-card transition-all duration-200 cursor-pointer group hover:shadow-lg dark:hover:shadow-xl"
        >
          <ng-template pTemplate="header">
            <div class="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
              <div class="flex justify-between items-start gap-3">
                <a
                  [routerLink]="['/workspaces', workspace.id, 'documents']"
                  class="flex-1 min-w-0 group"
                  (click)="$event.stopPropagation()"
                >
                  <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                      <i class="pi pi-building text-xl text-blue-600 dark:text-blue-400"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {{ workspace.name }}
                      </h3>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        <i class="pi pi-calendar mr-1"></i>
                        {{ workspace.createdAt | localeDate: 'dd/MM/yyyy' }}
                      </p>
                    </div>
                  </div>
                </a>
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  [rounded]="true"
                  (onClick)="confirmDelete(workspace.id, workspace.name); $event.stopPropagation()"
                  [disabled]="loading()"
                  styleClass="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Deletar workspace"
                ></p-button>
              </div>
            </div>
          </ng-template>
          <div class="p-5">
            <a
              [routerLink]="['/workspaces', workspace.id, 'documents']"
              class="block no-underline"
              (click)="$event.stopPropagation()"
            >
              <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <span class="flex items-center gap-2">
                  <i class="pi pi-arrow-right"></i>
                  Ver documentos
                </span>
                <i class="pi pi-chevron-right text-xs"></i>
              </div>
            </a>
          </div>
        </p-card>
      </div>

      <!-- Empty State -->
      <ng-template #emptyState>
        <div class="text-center py-16 px-4">
          <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
            <i class="pi pi-building text-5xl text-gray-400 dark:text-gray-600"></i>
          </div>
          <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Nenhum workspace encontrado</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Crie seu primeiro workspace para começar a organizar e revisar seus contratos.
          </p>
          <p-button
            label="Criar Primeiro Workspace"
            icon="pi pi-plus"
            (onClick)="showCreateForm.set(true)"
            [outlined]="false"
          ></p-button>
        </div>
      </ng-template>
    </div>

    <p-confirmDialog></p-confirmDialog>
    <p-toast></p-toast>
  `,
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
        this.workspaces.set(workspaces);
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
    this.apiService.createWorkspace(this.createForm.value).subscribe({
      next: () => {
        this.showCreateForm.set(false);
        this.createForm.reset();
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
}
