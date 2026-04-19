import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { Message } from 'primeng/message';
import { Avatar } from 'primeng/avatar';
import { TabsModule } from 'primeng/tabs';
import { SliderModule } from 'primeng/slider';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FileUploadComponent } from '../core/components/file-upload';
import { GlobalPromptsEditorComponent } from './global-prompts-editor/global-prompts-editor.component';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { WebSocketService } from '../core/services/websocket.service';
import { DevVisualizationsService } from '../core/services/dev-visualizations.service';
import { AvatarService } from '../core/services/avatar.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { TourService } from '../onboarding/tour/tour.service';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  IMAGE_ASSET_INPUT_ACCEPT,
  STORAGE_PROVIDER_OPTIONS,
  type UserStorageConfigResponse,
  type UpdateUserStorageRequest,
  type StorageProvider,
} from '@contractai-review/shared';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    Button,
    InputText,
    Password,
    SelectModule,
    TooltipModule,
    Card,
    ConfirmDialog,
    Toast,
    Message,
    Avatar,
    TabsModule,
    SliderModule,
    ToggleSwitchModule,
    TranslatePipe,
    FileUploadComponent,
    GlobalPromptsEditorComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './account-settings.html',
  styles: [`
    .account-settings-container {
      min-height: 400px;
    }
  `],
})
export class AccountSettingsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private webSocketService = inject(WebSocketService);
  private avatarService = inject(AvatarService);
  private fb = inject(FormBuilder);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private onboardingService = inject(OnboardingService);
  private tourService = inject(TourService);
  devVisualizationsService = inject(DevVisualizationsService);

  isOwnerInAnyWorkspace = signal(false);

  currentUser = signal(this.authService.currentUser());
  deleting = signal(false);
  resetting = signal(false);
  uploadingAvatar = signal(false);
  removingAvatar = signal(false);
  avatarDisplayUrl = signal<string | null>(null);
  activeTab = signal<string>('profile');
  storageConfig = signal<UserStorageConfigResponse>({ configured: false });
  storageLoading = signal(false);
  storageSaving = signal(false);
  chatPreferencesLoading = signal(false);
  chatSaving = signal(false);
  private avatarBlobUrl: string | null = null;

  readonly IMAGE_ACCEPT = IMAGE_ASSET_INPUT_ACCEPT;

  /** Mutable copy for PrimeNG Select. Handles ESM/CommonJS interop when shared package may export differently. */
  readonly providerOptions: { value: StorageProvider; labelKey: string; credentialHelpKey: string }[] =
    Array.isArray(STORAGE_PROVIDER_OPTIONS)
      ? [...STORAGE_PROVIDER_OPTIONS]
      : [
          { value: 's3' as StorageProvider, labelKey: 'settings.providerS3', credentialHelpKey: 'settings.credentialHelpS3' },
          { value: 'r2' as StorageProvider, labelKey: 'settings.providerR2', credentialHelpKey: 'settings.credentialHelpR2' },
          { value: 'hetzner' as StorageProvider, labelKey: 'settings.providerHetzner', credentialHelpKey: 'settings.credentialHelpHetzner' },
        ];

  deleteForm: FormGroup;
  storageForm: FormGroup;
  chatForm: FormGroup;

  constructor() {
    this.deleteForm = this.fb.group({
      confirmText: ['', [Validators.required, this.validateDeleteText]],
      confirmCheckbox: [false, [Validators.requiredTrue]],
    });
    this.storageForm = this.fb.group({
      provider: ['s3' as StorageProvider, Validators.required],
      endpoint: ['', Validators.required],
      region: ['us-east-1', Validators.required],
      bucket: ['', Validators.required],
      accessKeyId: ['', Validators.required],
      secretAccessKey: ['', Validators.required],
    });
    this.chatForm = this.fb.group({
      similarityThreshold: [0.95, [Validators.required, Validators.min(0.8), Validators.max(1)]],
      useDefault: [true],
    });
  }

  ngOnInit(): void {
    this.loadAvatarUrl();
    this.loadStorageConfig();
    this.loadChatPreferences();
    this.loadOwnerEligibility();
  }

  private loadOwnerEligibility(): void {
    this.apiService.getAccount().subscribe({
      next: (user) => {
        this.isOwnerInAnyWorkspace.set(user.isOwnerInAnyWorkspace ?? false);
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    if (this.avatarBlobUrl) {
      URL.revokeObjectURL(this.avatarBlobUrl);
    }
  }

  private loadAvatarUrl(): void {
    this.avatarService.getAvatarUrl(this.currentUser()).subscribe((url) => {
      if (this.avatarBlobUrl) {
        URL.revokeObjectURL(this.avatarBlobUrl);
        this.avatarBlobUrl = null;
      }
      this.avatarBlobUrl = url && url.startsWith('blob:') ? url : null;
      this.avatarDisplayUrl.set(url);
    });
  }

  onAvatarFileSelected(file: File): void {
    this.uploadingAvatar.set(true);
    this.apiService.uploadAvatar(file).subscribe({
      next: (user) => {
        this.authService.updateUser(user);
        this.currentUser.set(user);
        this.loadAvatarUrl();
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('settings.avatarUploaded')),
        });
        this.uploadingAvatar.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('settings.avatarError')),
        });
        this.uploadingAvatar.set(false);
      },
    });
  }

  removeAvatar(): void {
    this.removingAvatar.set(true);
    this.apiService.deleteAvatar().subscribe({
      next: () => {
        this.apiService.getAccount().subscribe({
          next: (user) => {
            this.authService.updateUser(user);
            this.currentUser.set(user);
            this.loadAvatarUrl();
            this.messageService.add({
              severity: 'success',
              summary: this.translateService.instant(_('common.success')),
              detail: this.translateService.instant(_('settings.avatarRemoved')),
            });
          },
          error: () => this.removingAvatar.set(false),
          complete: () => this.removingAvatar.set(false),
        });
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('settings.avatarError')),
        });
        this.removingAvatar.set(false);
      },
    });
  }

  get effectiveAvatarUrl(): string | null {
    return this.avatarDisplayUrl();
  }

  get hasCustomAvatar(): boolean {
    const url = this.currentUser()?.avatarUrl;
    return !!url && !url.startsWith('http');
  }

  confirmResetOnboarding(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('onboarding.resetConfirmMessage')),
      header: this.translateService.instant(_('onboarding.resetConfirmTitle')),
      icon: 'pi pi-refresh',
      acceptLabel: this.translateService.instant(_('onboarding.resetOnboarding')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.resetOnboarding();
      },
    });
  }

  resetOnboarding(): void {
    this.resetting.set(true);
    this.onboardingService.resetOnboarding();
    this.messageService.add({
      severity: 'success',
      summary: this.translateService.instant(_('common.success')),
      detail: this.translateService.instant(_('onboarding.resetSuccess')),
    });
    this.resetting.set(false);
  }

  startTourNow(): void {
    this.tourService.startTour('primary');
  }

  validateDeleteText(control: any) {
    if (control.value !== 'DELETE') {
      return { invalidDeleteText: true };
    }
    return null;
  }

  confirmDeleteAccount(): void {
    if (this.deleteForm.invalid) {
      return;
    }

    this.confirmationService.confirm({
      message: this.translateService.instant(_('settings.finalConfirmDelete')),
      header: this.translateService.instant(_('settings.finalConfirmDeleteHeader')),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant(_('settings.yesDeleteAccount')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.deleteAccount();
      },
    });
  }

  loadStorageConfig(): void {
    this.storageLoading.set(true);
    this.apiService.getAccountStorage().subscribe({
      next: (config) => {
        this.storageConfig.set(config);
        if (config.configured && config.endpoint != null) {
          this.storageForm.patchValue({
            provider: config.provider ?? 's3',
            endpoint: config.endpoint,
            region: config.region ?? 'us-east-1',
            bucket: config.bucket ?? '',
            accessKeyId: '',
            secretAccessKey: '',
          });
        }
        this.storageLoading.set(false);
      },
      error: () => this.storageLoading.set(false),
    });
  }

  saveStorageConfig(): void {
    if (this.storageForm.invalid) {
      this.storageForm.markAllAsTouched();
      return;
    }
    const v = this.storageForm.value;
    const request: UpdateUserStorageRequest = {
      provider: v.provider as StorageProvider,
      endpoint: v.endpoint,
      region: v.region,
      bucket: v.bucket,
      credentials: {
        accessKeyId: v.accessKeyId,
        secretAccessKey: v.secretAccessKey,
      },
    };
    this.storageSaving.set(true);
    this.apiService.updateAccountStorage(request).subscribe({
      next: (config) => {
        this.storageConfig.set(config);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('settings.storageSaveSuccess')),
        });
        this.storageSaving.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message ?? this.translateService.instant(_('settings.storageError')),
        });
        this.storageSaving.set(false);
      },
    });
  }

  confirmRemoveStorage(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('settings.storageRemoveConfirm')),
      header: this.translateService.instant(_('settings.storageRemoveConfirmHeader')),
      icon: 'pi pi-trash',
      acceptLabel: this.translateService.instant(_('settings.removeConfiguration')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => this.removeStorageConfig(),
    });
  }

  getCredentialHelpKey(provider: StorageProvider | null): string {
    if (!provider) return '';
    return this.providerOptions.find((o) => o.value === provider)?.credentialHelpKey ?? '';
  }

  setActiveTab(tab: string | number | undefined): void {
    if (tab != null) {
      this.activeTab.set(String(tab));
      if (tab === 'chat') {
        this.loadChatPreferences();
      }
    }
  }

  loadChatPreferences(): void {
    this.chatPreferencesLoading.set(true);
    this.apiService.getAccount().subscribe({
      next: (user) => {
        const val = user.ragCacheSimilarityThreshold;
        const useDefault = val == null;
        this.chatForm.patchValue({
          similarityThreshold: val ?? 0.95,
          useDefault,
        });
        this.chatPreferencesLoading.set(false);
      },
      error: () => this.chatPreferencesLoading.set(false),
    });
  }

  onUseDefaultSimilarityChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.chatForm.patchValue({
      useDefault: checked,
      similarityThreshold: checked ? 0.95 : this.chatForm.get('similarityThreshold')?.value ?? 0.95,
    });
  }

  saveChatPreferences(): void {
    const useDefault = this.chatForm.get('useDefault')?.value;
    const request = {
      ragCacheSimilarityThreshold: useDefault ? null : this.chatForm.get('similarityThreshold')?.value ?? null,
    };
    this.chatSaving.set(true);
    this.apiService.updateAccountPreferences(request).subscribe({
      next: (user) => {
        this.authService.updateUser(user);
        this.currentUser.set(user);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('chat.preferencesSaved')),
        });
        this.chatSaving.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message ?? this.translateService.instant(_('chat.preferencesError')),
        });
        this.chatSaving.set(false);
      },
    });
  }

  removeStorageConfig(): void {
    this.storageSaving.set(true);
    this.apiService.deleteAccountStorage().subscribe({
      next: () => {
        this.storageConfig.set({ configured: false });
        this.storageForm.reset({
          provider: 's3',
          endpoint: '',
          region: 'us-east-1',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
        });
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('settings.storageRemoveSuccess')),
        });
        this.storageSaving.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message ?? this.translateService.instant(_('settings.storageError')),
        });
        this.storageSaving.set(false);
      },
    });
  }

  deleteAccount(): void {
    this.deleting.set(true);
    this.apiService.deleteAccount().subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('settings.accountDeleted')),
          detail: this.translateService.instant(_('settings.accountDeletedSuccess')),
        });
        // Logout and redirect to login
        this.webSocketService.disconnect();
        this.authService.logout();
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        console.error('Error deleting account:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: err.error?.message || this.translateService.instant(_('settings.deleteAccountError')),
        });
        this.deleting.set(false);
      },
    });
  }
}
