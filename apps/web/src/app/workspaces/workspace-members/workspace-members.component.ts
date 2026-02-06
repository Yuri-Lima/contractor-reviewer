import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { WorkspaceMember, WorkspaceRole, AddMemberRequest } from '../../core/models/workspace.model';
import { AuthService } from '../../core/services/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { LocaleDatePipe } from '../../core/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-workspace-members',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    InputText,
    SelectModule,
    ConfirmDialog,
    Toast,
    TableModule,
    Tag,
    Tooltip,
    LocaleDatePipe,
    TranslatePipe
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="workspace-members-container p-6 max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100">{{ 'workspaceMembers.title' | translate }}</h1>
        <p-button
          [label]="'workspaceMembers.addMember' | translate"
          icon="pi pi-user-plus"
          (onClick)="showAddForm.set(true)"
          *ngIf="canManageMembers()"
        ></p-button>
      </div>

      <!-- Add Member Form -->
      <div *ngIf="showAddForm() && canManageMembers()" class="mb-6 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h3 class="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">{{ 'workspaceMembers.addMember' | translate }}</h3>
        <form [formGroup]="addMemberForm" (ngSubmit)="onAddMember()" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ 'workspaceMembers.email' | translate }}
            </label>
            <input
              pInputText
              formControlName="email"
              [placeholder]="'workspaceMembers.emailPlaceholder' | translate"
              class="w-full"
            />
            <small class="p-error block mt-1" *ngIf="addMemberForm.get('email')?.invalid && addMemberForm.get('email')?.touched">
              {{ 'validation.email' | translate }}
            </small>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ 'workspaceMembers.role' | translate }}
            </label>
            <p-select
              formControlName="role"
              [options]="roleOptions()"
              optionLabel="label"
              optionValue="value"
              [placeholder]="'workspaceMembers.selectRole' | translate"
              class="w-full"
            ></p-select>
            <small class="p-error block mt-1" *ngIf="addMemberForm.get('role')?.invalid && addMemberForm.get('role')?.touched">
              {{ 'validation.required' | translate }}
            </small>
          </div>
          <div class="flex gap-2">
            <p-button
              type="submit"
              [label]="'common.add' | translate"
              icon="pi pi-check"
              [disabled]="addMemberForm.invalid || addingMember()"
              [loading]="addingMember()"
            ></p-button>
            <p-button
              type="button"
              [label]="'common.cancel' | translate"
              icon="pi pi-times"
              severity="secondary"
              [outlined]="true"
              (onClick)="showAddForm.set(false); addMemberForm.reset();"
              [disabled]="addingMember()"
            ></p-button>
          </div>
        </form>
      </div>

      <!-- Members Table -->
      <p-table
        [value]="members()"
        [loading]="loading()"
        styleClass="p-datatable-striped"
        [paginator]="true"
        [rows]="10"
        [showCurrentPageReport]="true"
        [currentPageReportTemplate]="('common.showing' | translate) + ' {first} ' + ('common.to' | translate) + ' {last} ' + ('common.of' | translate) + ' {totalRecords} ' + ('workspaceMembers.members' | translate)"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>{{ 'workspaceMembers.name' | translate }}</th>
            <th>{{ 'workspaceMembers.email' | translate }}</th>
            <th>{{ 'workspaceMembers.role' | translate }}</th>
            <th>{{ 'workspaceMembers.joinedAt' | translate }}</th>
            <th *ngIf="canManageMembers()">{{ 'workspaceMembers.actions' | translate }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-member>
          <tr>
            <td>{{ member.user?.name || ('common.notAvailable' | translate) }}</td>
            <td>{{ member.user?.email || member.userId }}</td>
            <td>
              <p-tag
                [value]="getRoleLabel(member.role)"
                [severity]="getRoleSeverity(member.role)"
              ></p-tag>
            </td>
            <td>{{ member.joinedAt | localeDate: 'short' }}</td>
            <td *ngIf="canManageMembers()">
              <p-button
                icon="pi pi-trash"
                [text]="true"
                severity="danger"
                [disabled]="member.userId === currentUserId() || member.role === 'OWNER'"
                (onClick)="confirmRemove(member)"
                [rounded]="true"
                [pTooltip]="'workspaceMembers.remove' | translate"
              ></p-button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" class="text-center py-8 text-gray-500 dark:text-gray-400">
              {{ 'workspaceMembers.noMembersFound' | translate }}
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .workspace-members-container {
      min-height: 400px;
    }
  `],
})
export class WorkspaceMembersComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private translateService = inject(TranslateService);
  private fb = inject(FormBuilder);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  workspaceId = signal('');
  members = signal<WorkspaceMember[]>([]);
  loading = signal(false);
  addingMember = signal(false);
  showAddForm = signal(false);
  currentUserId = signal<string>('');

  roleOptions = computed(() => {
    // Access currentLang to create reactive dependency
    this.translateService.currentLang;
    return [
      { label: this.translateService.instant('workspaceMembers.roles.owner'), value: WorkspaceRole.OWNER },
      { label: this.translateService.instant('workspaceMembers.roles.admin'), value: WorkspaceRole.ADMIN },
      { label: this.translateService.instant('workspaceMembers.roles.member'), value: WorkspaceRole.MEMBER },
      { label: this.translateService.instant('workspaceMembers.roles.viewer'), value: WorkspaceRole.VIEWER },
    ];
  });

  addMemberForm: FormGroup;

  constructor() {
    this.addMemberForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: [WorkspaceRole.MEMBER, [Validators.required]],
    });
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.currentUserId.set(currentUser.id);
    }
    this.loadMembers();
  }

  loadMembers(): void {
    this.loading.set(true);
    this.apiService.getWorkspaceMembers(this.workspaceId()).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading members:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('workspaceMembers.loadMembersError'),
        });
        this.loading.set(false);
      },
    });
  }

  canManageMembers(): boolean {
    // TODO: Check if current user is OWNER or ADMIN
    // For now, allow all authenticated users
    return true;
  }

  getRoleLabel(role: WorkspaceRole): string {
    // Access currentLang to create reactive dependency
    this.translateService.currentLang;
    
    const keyMap: Record<WorkspaceRole, string> = {
      [WorkspaceRole.OWNER]: 'workspaceMembers.roles.owner',
      [WorkspaceRole.ADMIN]: 'workspaceMembers.roles.admin',
      [WorkspaceRole.MEMBER]: 'workspaceMembers.roles.member',
      [WorkspaceRole.VIEWER]: 'workspaceMembers.roles.viewer',
    };
    
    return this.translateService.instant(keyMap[role] || role);
  }

  getRoleSeverity(role: WorkspaceRole): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null | undefined {
    const severities: Record<WorkspaceRole, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null | undefined> = {
      [WorkspaceRole.OWNER]: 'danger',
      [WorkspaceRole.ADMIN]: 'warn',
      [WorkspaceRole.MEMBER]: 'info',
      [WorkspaceRole.VIEWER]: 'secondary',
    };
    return severities[role] || 'secondary';
  }

  onAddMember(): void {
    if (this.addMemberForm.invalid) {
      return;
    }

    // Normalizar email: trim + lowercase
    const rawEmail = this.addMemberForm.value.email;
    const email = rawEmail?.trim().toLowerCase() || '';
    
    if (!email) {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant('common.error'),
        detail: this.translateService.instant('workspaceMembers.invalidEmail'),
      });
      return;
    }

    const role = this.addMemberForm.value.role;

    this.addingMember.set(true);
    
    // First, search for user by email
    this.apiService.searchUserByEmail(email).subscribe({
      next: (user) => {
        // User found, add as member
        this.apiService.addMember(this.workspaceId(), { userId: user.id, role }).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant('common.success'),
              detail: this.translateService.instant('workspaceMembers.addSuccess'),
            });
            this.showAddForm.set(false);
            this.addMemberForm.reset();
            this.loadMembers();
            this.addingMember.set(false);
          },
          error: (err) => {
            console.error('Error adding member:', err);
            // Mapear erros do backend para chaves de tradução no frontend
            let errorMessage: string;
            
            if (err.status === 403) {
              // Usuário já é membro ou sem permissão
              if (err.error?.message?.includes('already a member')) {
                errorMessage = this.translateService.instant('workspaceMembers.alreadyMember');
              } else {
                errorMessage = this.translateService.instant('workspaceMembers.permissionDenied');
              }
            } else if (err.status === 404) {
              // Workspace ou usuário não encontrado
              errorMessage = this.translateService.instant('workspaceMembers.notFound');
            } else if (err.status === 0) {
              // Erro de rede
              errorMessage = this.translateService.instant('errors.network');
            } else {
              // Erro genérico
              errorMessage = this.translateService.instant('workspaceMembers.addMemberError');
            }
            
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('common.error'),
              detail: errorMessage,
            });
            this.addingMember.set(false);
          },
        });
      },
      error: (err) => {
        console.error('Error searching user:', err);
        // Mapear erros do backend para chaves de tradução no frontend
        let errorMessage: string;
        
        if (err.status === 404) {
          // Usuário não encontrado
          errorMessage = this.translateService.instant('workspaceMembers.userNotFound');
        } else if (err.status === 400) {
          // Email inválido ou faltando
          errorMessage = this.translateService.instant('workspaceMembers.invalidEmail');
        } else if (err.status === 0) {
          // Erro de rede
          errorMessage = this.translateService.instant('errors.network');
        } else {
          // Erro genérico
          errorMessage = this.translateService.instant('workspaceMembers.searchUserError');
        }
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: errorMessage,
        });
        this.addingMember.set(false);
      },
    });
  }

  confirmRemove(member: WorkspaceMember): void {
    const userName = member.user?.name || member.user?.email || this.translateService.instant('workspaceMembers.thisUser');
    this.confirmationService.confirm({
      message: this.translateService.instant('workspaceMembers.confirmRemoveMessage', { userName }),
      header: this.translateService.instant('workspaceMembers.confirmRemoveHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant('workspaceMembers.remove'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => {
        this.removeMember(member.userId);
      },
    });
  }

  removeMember(userId: string): void {
    this.apiService.removeMember(this.workspaceId(), userId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('workspaceMembers.removeMemberSuccess'),
        });
        this.loadMembers();
      },
      error: (err) => {
        console.error('Error removing member:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('workspaceMembers.removeMemberError'),
        });
      },
    });
  }
}
