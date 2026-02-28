import { Component, OnInit, signal, inject, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Toolbar } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Card } from 'primeng/card';
import { ConfirmationService, MessageService, SharedModule } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { ContextMenu } from 'primeng/contextmenu';
import { ApiService } from '../../core/services/api.service';
import { WorkspaceMember, WorkspaceRole } from '@contractai-review/shared';
import { AuthService } from '../../core/services/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { LocaleDatePipe } from '../../core/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseListComponent } from '../../core/components/base-list/base-list.component';
import { BaseListConfig } from '../../core/components/base-list/base-list.config';

@Component({
  selector: 'app-workspace-members',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    Toolbar,
    TooltipModule,
    SharedModule,
    InputText,
    Password,
    SelectModule,
    TableModule,
    ConfirmDialog,
    Toast,
    Message,
    Tag,
    Card,
    LocaleDatePipe,
    TranslatePipe,
    BaseListComponent,
    ContextMenu,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './workspace-members.html',
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

  membersContextMenuRef = viewChild<ContextMenu>('membersContextMenu');
  selectedMemberForContext = signal<WorkspaceMember | null>(null);
  membersContextMenuItems = computed<MenuItem[]>(() =>
    this.buildMembersMenu(this.selectedMemberForContext())
  );

  workspaceId = signal('');
  members = signal<WorkspaceMember[]>([]);
  loading = signal(false);
  addingMember = signal(false);
  showAddForm = signal(false);
  showRegisterFields = signal(false);
  currentUserId = signal<string>('');
  selectedMember = signal<WorkspaceMember | null>(null);

  canManageMembers = computed(() => true);

  // Table configuration (client-side pagination with selection when canManageMembers)
  tableConfig = computed<BaseListConfig>(() => {
    const cfg: BaseListConfig = {
      data: this.members(),
      loading: this.loading(),
      lazy: false,
      paginator: true,
      rows: 10,
      rowsPerPageOptions: [10, 25, 50],
      showCurrentPageReport: true,
      currentPageReportTemplate: (this.translateService.instant('common.showing') || 'Showing') + ' {first} ' + (this.translateService.instant('common.to') || 'to') + ' {last} ' + (this.translateService.instant('common.of') || 'of') + ' {totalRecords} ' + (this.translateService.instant('workspaceMembers.members') || 'members'),
      striped: true,
      emptyMessageKey: 'workspaceMembers.noMembersFound',
      colspan: this.canManageMembers() ? 5 : 4,
    };
    if (this.canManageMembers()) {
      cfg.selectionMode = 'single';
      cfg.selection = this.selectedMember();
      cfg.dataKey = 'id';
      cfg.onSelectionChange = (v: WorkspaceMember | null) => this.selectedMember.set(v);
    }
    return cfg;
  });

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
            this.resetAddForm();
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
        this.addingMember.set(false);
        if (err.status === 404) {
          // User not found - show full registration form
          this.showRegisterFields.set(true);
          this.addMemberForm.addControl(
            'name',
            this.fb.control('', Validators.required),
          );
          this.addMemberForm.addControl(
            'password',
            this.fb.control('', [
              Validators.required,
              Validators.minLength(8),
            ]),
          );
        } else {
          let errorMessage: string;
          if (err.status === 400) {
            errorMessage = this.translateService.instant(
              'workspaceMembers.invalidEmail',
            );
          } else if (err.status === 0) {
            errorMessage = this.translateService.instant('errors.network');
          } else {
            errorMessage = this.translateService.instant(
              'workspaceMembers.searchUserError',
            );
          }
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant('common.error'),
            detail: errorMessage,
          });
        }
      },
    });
  }

  onRegisterAndAdd(): void {
    if (!this.showRegisterFields()) return;
    const email = this.addMemberForm.value.email?.trim().toLowerCase() || '';
    const name = this.addMemberForm.value.name?.trim() || '';
    const password = this.addMemberForm.value.password || '';
    const role = this.addMemberForm.value.role;

    if (!email || !name || !password || password.length < 8) {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant('common.error'),
        detail: this.translateService.instant(
          'workspaceMembers.userNotFoundRegister',
        ),
      });
      return;
    }

    this.addingMember.set(true);
    this.apiService
      .inviteMember(this.workspaceId(), { email, name, password, role })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant('common.success'),
            detail: this.translateService.instant('workspaceMembers.addSuccess'),
          });
          this.resetAddForm();
          this.loadMembers();
          this.addingMember.set(false);
        },
        error: (err) => {
          console.error('Error inviting member:', err);
          let errorMessage: string;
          if (err.status === 403) {
            if (err.error?.message?.includes('already a member')) {
              errorMessage = this.translateService.instant(
                'workspaceMembers.alreadyMember',
              );
            } else {
              errorMessage = this.translateService.instant(
                'workspaceMembers.permissionDenied',
              );
            }
          } else if (err.status === 409) {
            errorMessage = this.translateService.instant(
              'workspaceMembers.userNotFound',
            );
          } else if (err.status === 400) {
            errorMessage =
              err.error?.message ||
              this.translateService.instant('workspaceMembers.addMemberError');
          } else if (err.status === 0) {
            errorMessage = this.translateService.instant('errors.network');
          } else {
            errorMessage = this.translateService.instant(
              'workspaceMembers.addMemberError',
            );
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

  resetAddForm(): void {
    this.showRegisterFields.set(false);
    if (this.addMemberForm.contains('name')) {
      this.addMemberForm.removeControl('name');
      this.addMemberForm.removeControl('password');
    }
    this.addMemberForm.reset({
      email: '',
      role: WorkspaceRole.MEMBER,
    });
    this.showAddForm.set(false);
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

  updateMemberRole(member: WorkspaceMember, role: WorkspaceRole): void {
    this.apiService.updateMemberRole(this.workspaceId(), member.userId, role).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('workspaceMembers.roleUpdated'),
        });
        this.loadMembers();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('workspaceMembers.updateRoleError'),
        });
      },
    });
  }

  private buildMembersMenu(member: WorkspaceMember | null): MenuItem[] {
    if (!member || !this.canManageMembers()) return [];
    if (member.role === WorkspaceRole.OWNER) return [];
    const t = (key: string) => this.translateService.instant(key);
    const isSelf = member.userId === this.currentUserId();
    const changeRoleItems: MenuItem[] = [
      {
        label: t('workspaceMembers.roles.admin'),
        icon: 'pi pi-shield',
        command: () => this.updateMemberRole(member, WorkspaceRole.ADMIN),
        disabled: member.role === WorkspaceRole.ADMIN,
      },
      {
        label: t('workspaceMembers.roles.member'),
        icon: 'pi pi-user',
        command: () => this.updateMemberRole(member, WorkspaceRole.MEMBER),
        disabled: member.role === WorkspaceRole.MEMBER,
      },
      {
        label: t('workspaceMembers.roles.viewer'),
        icon: 'pi pi-eye',
        command: () => this.updateMemberRole(member, WorkspaceRole.VIEWER),
        disabled: member.role === WorkspaceRole.VIEWER,
      },
    ];
    return [
      {
        label: t('contextMenu.members.changeRole'),
        icon: 'pi pi-user-edit',
        items: changeRoleItems,
      },
      { separator: true },
      {
        label: t('contextMenu.members.remove'),
        icon: 'pi pi-trash',
        command: () => this.confirmRemove(member),
        disabled: isSelf,
      },
    ];
  }

  removeMember(userId: string): void {
    this.apiService.removeMember(this.workspaceId(), userId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('workspaceMembers.removeMemberSuccess'),
        });
        this.selectedMember.set(null);
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
