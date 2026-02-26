import { Component, OnInit, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputNumber } from 'primeng/inputnumber';
import { Toast } from 'primeng/toast';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ApiService } from '../core/services/api.service';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';
import { TranslatePipe } from '@ngx-translate/core';

interface NoLogsConfig {
  skipDocumentContent?: boolean;
  skipChatMessages?: boolean;
  skipVersions?: boolean;
  acceleratedPurgeDays?: number;
}

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    Card,
    TooltipModule,
    ToggleSwitchModule,
    InputNumber,
    Toast,
    Message,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './privacy.html',
  styles: [`
    .privacy-container {
      min-height: 400px;
    }
  `],
})
export class PrivacyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  workspaceId = signal('');
  saving = signal(false);
  exporting = signal(false);

  // Computed property for days suffix
  daysSuffix = computed(() => ` ${this.translateService.instant(_('common.days'))}`);

  // Signal to track no-logs enabled state (avoids ExpressionChangedAfterItHasBeenCheckedError)
  private noLogsEnabledSignal = signal<boolean>(false);

  // Computed property to avoid ExpressionChangedAfterItHasBeenCheckedError
  isNoLogsEnabled = computed(() => this.noLogsEnabledSignal());

  noLogsForm: FormGroup;

  constructor() {
    this.noLogsForm = this.fb.group({
      noLogsEnabled: [false],
      skipDocumentContent: [false],
      skipChatMessages: [false],
      skipVersions: [false],
      acceleratedPurgeDays: [7],
    });

    // Update signal when form value changes
    this.noLogsForm.get('noLogsEnabled')?.valueChanges.subscribe((value) => {
      this.noLogsEnabledSignal.set(value || false);
    });

    // Initialize signal with form value
    this.noLogsEnabledSignal.set(this.noLogsForm.get('noLogsEnabled')?.value || false);
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadNoLogsConfig();
  }

  loadNoLogsConfig(): void {
    this.apiService.getNoLogsConfig(this.workspaceId()).subscribe({
      next: (response) => {
        // Update form with loaded configuration
        this.noLogsForm.patchValue({
          noLogsEnabled: response.enabled,
          skipDocumentContent: response.config?.skipDocumentContent || false,
          skipChatMessages: response.config?.skipChatMessages || false,
          skipVersions: response.config?.skipVersions || false,
          acceleratedPurgeDays: response.config?.acceleratedPurgeDays || 7,
        }, { emitEvent: false }); // Don't emit events to avoid triggering valueChanges
        
        // Update signal directly
        this.noLogsEnabledSignal.set(response.enabled || false);
      },
      error: (err) => {
        console.error('Error loading no-logs config:', err);
        // Keep default values (all false) if loading fails
        this.noLogsEnabledSignal.set(false);
      },
    });
  }

  onNoLogsToggle(): void {
    // Auto-save when toggling main switch off
    if (!this.noLogsForm.value.noLogsEnabled) {
      // Reset sub-options when disabling
      this.noLogsForm.patchValue({
        skipDocumentContent: false,
        skipChatMessages: false,
        skipVersions: false,
        acceleratedPurgeDays: 7,
      });
      this.saveNoLogsConfig();
    }
  }

  saveNoLogsConfig(): void {
    this.saving.set(true);
    
    if (!this.noLogsForm.value.noLogsEnabled) {
      // If disabled, save with all options off
      this.apiService.toggleNoLogs(this.workspaceId(), false).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant(_('common.success')),
            detail: this.translateService.instant(_('privacy.saveSuccess')),
          });
          this.saving.set(false);
        },
        error: (err) => {
          console.error('Error saving no-logs config:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant(_('common.error')),
            detail: this.translateService.instant(_('privacy.saveError')),
          });
          this.saving.set(false);
          // Reload config on error to restore previous state
          this.loadNoLogsConfig();
        },
      });
      return;
    }

    const config: NoLogsConfig = {
      skipDocumentContent: this.noLogsForm.value.skipDocumentContent,
      skipChatMessages: this.noLogsForm.value.skipChatMessages,
      skipVersions: this.noLogsForm.value.skipVersions,
      acceleratedPurgeDays: this.noLogsForm.value.acceleratedPurgeDays,
    };

    this.apiService.toggleNoLogs(this.workspaceId(), true, config).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('privacy.saveSuccess'),
        });
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Error saving no-logs config:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant(_('privacy.saveError')),
        });
        this.saving.set(false);
        // Reload config on error to restore previous state
        this.loadNoLogsConfig();
      },
    });
  }

  exportData(): void {
    this.exporting.set(true);
    this.apiService.exportPrivacyData(this.workspaceId()).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `privacy-export-${this.workspaceId()}-${Date.now()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant(_('common.success')),
          detail: this.translateService.instant(_('privacy.exportSuccess')),
        });
        this.exporting.set(false);
      },
      error: (err) => {
        console.error('Error exporting data:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: this.translateService.instant(_('privacy.exportError')),
        });
        this.exporting.set(false);
      },
    });
  }
}
