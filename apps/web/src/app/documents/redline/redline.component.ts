import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { RedlineRequest, RedlineResponse, RedlinePlaybook, RedlineChange } from '../../core/models/redline.model';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../core/services/i18n.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-redline',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    SelectModule,
    TextareaModule,
    Card,
    Tag,
    Toast,
    MessageModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  template: `
    <div class="redline-container p-6">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">{{ 'redline.title' | translate }}</h2>

      <p-message
        severity="info"
        [text]="'redline.description' | translate"
        class="mb-6"
      ></p-message>

      <form [formGroup]="redlineForm" (ngSubmit)="onGenerate()" class="space-y-6">
        <p-card>
          <ng-template pTemplate="header">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">{{ 'redline.configuration' | translate }}</h3>
            </div>
          </ng-template>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'redline.playbook' | translate }}
              </label>
              <p-select
                formControlName="playbook"
                [options]="playbookOptions"
                optionLabel="label"
                optionValue="value"
                [placeholder]="'redline.selectPlaybook' | translate"
                class="w-full"
              ></p-select>
              <small class="text-gray-500 dark:text-gray-400 mt-1 block">
                {{ getPlaybookDescription(redlineForm.value.playbook) }}
              </small>
              <small class="p-error block mt-1" *ngIf="redlineForm.get('playbook')?.invalid && redlineForm.get('playbook')?.touched">
                {{ 'redline.playbookRequired' | translate }}
              </small>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'redline.customInstructions' | translate }}
              </label>
              <textarea
                pTextarea
                formControlName="instructions"
                rows="4"
                [placeholder]="'redline.addInstructions' | translate"
                class="w-full"
              ></textarea>
              <small class="text-gray-500 dark:text-gray-400 mt-1 block">
                {{ 'redline.instructionsDescription' | translate }}
              </small>
            </div>
          </div>
        </p-card>

        <div class="flex gap-2 justify-end">
          <p-button
            type="submit"
            [label]="'redline.generate' | translate"
            icon="pi pi-magic"
            [disabled]="redlineForm.invalid || generating()"
            [loading]="generating()"
          ></p-button>
        </div>
      </form>

      <!-- Generated Redline Results -->
      <div *ngIf="redlineResult()" class="mt-8">
        <p-card>
          <ng-template pTemplate="header">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {{ 'redline.generated' | translate }} - {{ redlineResult()?.changes?.length || 0 }} {{ 'redline.changes' | translate }}
              </h3>
            </div>
          </ng-template>
          <div class="p-4 space-y-6">
            <div *ngFor="let change of redlineResult()?.changes; let i = index" class="change-item p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="flex justify-between items-start mb-3">
                <h4 class="font-semibold text-gray-800 dark:text-gray-100">
                  {{ 'redline.change' | translate }} {{ i + 1 }}: {{ change.section }}
                </h4>
                <p-tag
                  [value]="redlineResult()?.playbook"
                  severity="info"
                ></p-tag>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <div class="text-sm font-medium text-red-600 dark:text-red-400 mb-2">{{ 'redline.original' | translate }}:</div>
                  <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {{ change.original }}
                  </div>
                </div>
                <div>
                  <div class="text-sm font-medium text-green-600 dark:text-green-400 mb-2">{{ 'redline.suggested' | translate }}:</div>
                  <div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {{ change.suggested }}
                  </div>
                </div>
              </div>

              <div class="mt-3">
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ 'redline.reason' | translate }}:</div>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ change.reason }}</p>
              </div>

              <div class="flex gap-2 mt-4">
                <p-button
                  [label]="'redline.accept' | translate"
                  icon="pi pi-check"
                  severity="success"
                  [outlined]="true"
                  (onClick)="acceptChange(i)"
                ></p-button>
                <p-button
                  [label]="'redline.reject' | translate"
                  icon="pi pi-times"
                  severity="danger"
                  [outlined]="true"
                  (onClick)="rejectChange(i)"
                ></p-button>
              </div>
            </div>

            <div *ngIf="!redlineResult()?.changes || redlineResult()!.changes.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
              {{ 'redline.noChanges' | translate }}
            </div>
          </div>
        </p-card>
      </div>

      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .redline-container {
      max-width: 1200px;
      margin: 0 auto;
    }
  `],
})
export class RedlineComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  workspaceId = signal('');
  documentId = signal('');
  generating = signal(false);
  redlineResult = signal<RedlineResponse | null>(null);

  playbookOptions = [
    { label: 'Balanced', value: RedlinePlaybook.BALANCED },
    { label: 'Conservative', value: RedlinePlaybook.CONSERVATIVE },
    { label: 'Client-friendly', value: RedlinePlaybook.CLIENT_FRIENDLY },
  ];

  redlineForm: FormGroup;

  constructor() {
    this.redlineForm = this.fb.group({
      playbook: [RedlinePlaybook.BALANCED, [Validators.required]],
      instructions: [''],
    });
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    const docId = this.route.snapshot.paramMap.get('documentId') || '';
    this.workspaceId.set(wsId);
    this.documentId.set(docId);
  }

  getPlaybookDescription(playbook: RedlinePlaybook | null): string {
    if (!playbook) return this.translateService.instant('redline.selectPlaybook');
    const descriptions: Record<RedlinePlaybook, string> = {
      [RedlinePlaybook.BALANCED]: this.translateService.instant('redline.playbooks.balanced'),
      [RedlinePlaybook.CONSERVATIVE]: this.translateService.instant('redline.playbooks.conservative'),
      [RedlinePlaybook.CLIENT_FRIENDLY]: this.translateService.instant('redline.playbooks.clientFriendly'),
    };
    return descriptions[playbook] || '';
  }

  onGenerate(): void {
    if (this.redlineForm.invalid) {
      return;
    }

    this.generating.set(true);
    const request: RedlineRequest = {
      playbook: this.redlineForm.value.playbook,
      instructions: this.redlineForm.value.instructions || undefined,
    };

    this.apiService.generateRedline(this.workspaceId(), this.documentId(), request).subscribe({
      next: (response) => {
        this.redlineResult.set(response);
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('redline.generateSuccess', { count: response.changes.length }),
        });
        this.generating.set(false);
      },
      error: (err) => {
        console.error('Error generating redline:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: err.error?.message || this.translateService.instant('redline.generateError'),
        });
        this.generating.set(false);
      },
    });
  }

  acceptChange(index: number): void {
    // TODO: Implement accept change logic (will create new version)
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('common.info'),
      detail: this.translateService.instant('redline.acceptInfo'),
    });
  }

  rejectChange(index: number): void {
    // TODO: Implement reject change logic
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('common.info'),
      detail: this.translateService.instant('redline.rejectInfo'),
    });
  }
}
