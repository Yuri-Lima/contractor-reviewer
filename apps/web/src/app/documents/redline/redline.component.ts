import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Toast } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { BaseDialogComponent, type DialogFooterButton } from '../../core/components/base-dialog';
import { ApiService } from '../../core/services/api.service';
import { OnboardingService } from '../../onboarding/onboarding.service';
import {
  RedlineRequest,
  RedlineResponse,
  RedlinePlaybook,
  RedlineChange,
  DiffBlock,
} from '@contractai-review/shared';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { DiffMatchPatch, DiffOp } from 'diff-match-patch-ts';

@Component({
  selector: 'app-redline',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Button,
    TooltipModule,
    SelectModule,
    TextareaModule,
    Card,
    Tag,
    Toast,
    MessageModule,
    ConfirmDialog,
    BaseDialogComponent,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './redline.html',
  styles: [`
    .redline-container {
      max-width: 1200px;
      margin: 0 auto;
    }
  `],
})
export class RedlineComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private translateService = inject(TranslateService);
  private onboardingService = inject(OnboardingService);
  private dmp = new DiffMatchPatch();
  private cdr = inject(ChangeDetectorRef);

  workspaceId = signal('');
  documentId = signal('');
  generating = signal(false);
  private redlineAbortController: AbortController | null = null;
  applying = signal(false);
  redlineResult = signal<RedlineResponse | null>(null);
  currentUser = signal<any>(null);
  decisions = signal<Map<string, 'accept' | 'reject'>>(new Map());
  editingMode = signal<'view' | 'edit-text' | 'edit-blocks'>('view');
  editedSuggestedText = signal<string>('');
  editedBlocks = signal<Map<string, string>>(new Map());
  selectedStartIndex = signal<number | undefined>(undefined);
  selectedEndIndex = signal<number | undefined>(undefined);
  fuzzyMatchInfo = signal<{ used: boolean; matchScore?: number; matchedText?: string; suggestedRegion?: { startIndex: number; endIndex: number }; requiresConfirmation?: boolean } | null>(null);
  showRegionConfirmation = signal(false);

  playbookOptions = [
    { label: 'Balanced', value: RedlinePlaybook.BALANCED },
    { label: 'Conservative', value: RedlinePlaybook.CONSERVATIVE },
    { label: 'Client-friendly', value: RedlinePlaybook.CLIENT_FRIENDLY },
  ];

  redlineForm: FormGroup;

  constructor() {
    this.redlineForm = this.fb.group({
      selectedText: ['', [Validators.required]],
      objective: [''],
      playbook: [RedlinePlaybook.BALANCED, [Validators.required]],
      instructions: [''],
    });
  }

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    const docId = this.route.snapshot.paramMap.get('documentId') || '';
    this.workspaceId.set(wsId);
    this.documentId.set(docId);

    // Get current user from auth service
    this.currentUser.set(this.authService.currentUser());
  }

  ngOnDestroy(): void {
    this.redlineAbortController?.abort();
  }

  cancelGenerate(): void {
    this.redlineAbortController?.abort();
  }

  getPlaybookDescription(playbook: RedlinePlaybook | null): string {
    if (!playbook) return this.translateService.instant(_('redline.selectPlaybook'));
    const descriptions: Record<RedlinePlaybook, string> = {
      [RedlinePlaybook.BALANCED]: this.translateService.instant(_('redline.playbooks.balanced')),
      [RedlinePlaybook.CONSERVATIVE]: this.translateService.instant(_('redline.playbooks.conservative')),
      [RedlinePlaybook.CLIENT_FRIENDLY]: this.translateService.instant(_('redline.playbooks.clientFriendly')),
    };
    return descriptions[playbook] || '';
  }

  onTextSelectedFromContent(event: { text: string; startIndex?: number; endIndex?: number }): void {
    this.redlineForm.patchValue({ selectedText: event.text });
    this.selectedStartIndex.set(event.startIndex);
    this.selectedEndIndex.set(event.endIndex);
  }

  onGenerate(): void {
    if (this.redlineForm.invalid) {
      return;
    }

    this.redlineAbortController?.abort();
    this.redlineAbortController = new AbortController();

    this.generating.set(true);
    this.decisions.set(new Map());
    this.editingMode.set('view');
    this.editedSuggestedText.set('');
    this.editedBlocks.set(new Map());
    
    // Get current user language
    const currentLang = this.translateService.currentLang || 'en';
    
    const request: RedlineRequest = {
      selectedText: this.redlineForm.value.selectedText.trim(),
      playbook: this.redlineForm.value.playbook,
      instructions: this.redlineForm.value.instructions || undefined,
      objective: this.redlineForm.value.objective || undefined,
      language: currentLang,
      startIndex: this.selectedStartIndex(), // Include position if available
      endIndex: this.selectedEndIndex(),
    };

    this.apiService
      .generateRedline(this.workspaceId(), this.documentId(), request, {
        signal: this.redlineAbortController.signal,
      })
      .subscribe({
        next: (response) => {
          this.redlineResult.set(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant(_('common.success')),
            detail: this.translateService.instant(_('redline.generateSuccess'), {
              count: response.changes.length,
            }),
          });
          this.generating.set(false);
        },
        error: (err) => {
          this.generating.set(false);
          if (err?.name === 'AbortError') return;
          console.error('Error generating redline:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant(_('common.error')),
            detail: err.error?.message || this.translateService.instant(_('redline.generateError')),
          });
        },
      });
  }

  acceptBlock(blockId: string): void {
    this.decisions.update(decisions => {
      const newDecisions = new Map(decisions);
      newDecisions.set(blockId, 'accept');
      return newDecisions;
    });
    // Force change detection if signal update doesn't trigger template update
    this.cdr.markForCheck();
  }

  rejectBlock(blockId: string): void {
    this.decisions.update(decisions => {
      const newDecisions = new Map(decisions);
      newDecisions.set(blockId, 'reject');
      return newDecisions;
    });
    // Force change detection if signal update doesn't trigger template update
    this.cdr.markForCheck();
  }

  getBlockDecision(blockId: string): 'accept' | 'reject' | null {
    const decisions = this.decisions(); // Explicitly read signal
    return decisions.get(blockId) || null;
  }

  hasDecisions(): boolean {
    return this.decisions().size > 0;
  }

  hasEditedContent(): boolean {
    return this.editedSuggestedText().trim().length > 0 || this.editedBlocks().size > 0;
  }

  confirmRejectProposal(): void {
    this.confirmationService.confirm({
      message: this.translateService.instant(_('redline.rejectProposalConfirm')),
      header: this.translateService.instant(_('redline.rejectProposal')),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translateService.instant(_('redline.rejectProposal')),
      rejectLabel: this.translateService.instant(_('common.cancel')),
      accept: () => {
        this.rejectProposal();
      },
    });
  }

  rejectProposal(): void {
    this.redlineResult.set(null);
    this.decisions.set(new Map());
    this.editingMode.set('view');
    this.editedSuggestedText.set('');
    this.editedBlocks.set(new Map());
    this.redlineForm.reset({
      playbook: RedlinePlaybook.BALANCED,
      selectedText: '',
      objective: '',
      instructions: '',
    });
    this.messageService.add({
      severity: 'success',
      summary: this.translateService.instant(_('common.success')),
      detail: this.translateService.instant(_('redline.rejectProposalSuccess')),
    });
  }

  startEditText(): void {
    const result = this.redlineResult();
    if (result?.changes && result.changes.length > 0) {
      this.editedSuggestedText.set(result.changes[0].suggestedText);
      this.editingMode.set('edit-text');
    }
  }

  startEditBlocks(): void {
    this.editingMode.set('edit-blocks');
  }

  cancelEdit(): void {
    this.editingMode.set('view');
    this.editedSuggestedText.set('');
    this.editedBlocks.set(new Map());
  }

  onSuggestedTextEdit(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      this.editedSuggestedText.set(target.value);
    }
  }

  onBlockTextEdit(blockId: string, event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      const currentBlocks = new Map(this.editedBlocks());
      currentBlocks.set(blockId, target.value);
      this.editedBlocks.set(currentBlocks);
    }
  }

  getEditedBlockText(blockId: string): string | null {
    return this.editedBlocks().get(blockId) || null;
  }

  saveEdit(): void {
    const result = this.redlineResult();
    if (!result?.changes || result.changes.length === 0) {
      return;
    }

    const change = result.changes[0];

    if (this.editingMode() === 'edit-text') {
      const editedText = this.editedSuggestedText().trim();
      if (!editedText) {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant(_('common.error')),
          detail: this.translateService.instant(_('redline.selectedTextRequired')),
        });
        return;
      }

      // Regenerate diff blocks from edited text
      const newDiffBlocks = this.generateDiffBlocks(change.originalText, editedText);
      
      // Update the change with new diff blocks and suggested text
      const updatedChange: RedlineChange = {
        ...change,
        suggestedText: editedText,
        diffBlocks: newDiffBlocks,
      };

      // Update redlineResult
      this.redlineResult.set({
        ...result,
        changes: [updatedChange],
      });

      // Clear decisions since diff blocks changed
      this.decisions.set(new Map());
    } else if (this.editingMode() === 'edit-blocks') {
      // Reconstruct suggested text from edited blocks
      const editedBlocks = this.editedBlocks();
      let suggestedText = '';
      
      for (const block of change.diffBlocks) {
        const editedText = editedBlocks.get(block.id);
        const blockText = editedText || block.text;
        
        if (block.type === 'equal' || block.type === 'add') {
          suggestedText += blockText;
        }
        // 'remove' blocks are not included in suggested text
      }

      // Regenerate diff blocks from reconstructed text
      const newDiffBlocks = this.generateDiffBlocks(change.originalText, suggestedText);
      
      const updatedChange: RedlineChange = {
        ...change,
        suggestedText,
        diffBlocks: newDiffBlocks,
      };

      this.redlineResult.set({
        ...result,
        changes: [updatedChange],
      });

      // Clear decisions since diff blocks changed
      this.decisions.set(new Map());
    }

    this.editingMode.set('view');
    this.messageService.add({
      severity: 'success',
      summary: this.translateService.instant(_('common.success')),
      detail: this.translateService.instant(_('redline.saveEdit')),
    });
  }

  generateDiffBlocks(originalText: string, suggestedText: string): DiffBlock[] {
    const diffs = this.dmp.diff_main(originalText, suggestedText);
    this.dmp.diff_cleanupSemantic(diffs);

    const blocks: DiffBlock[] = [];
    let blockIndex = 0;

    for (const diff of diffs) {
      const [operation, text] = diff;

      if (operation === DiffOp.Equal) {
        blocks.push({
          id: `b${blockIndex++}`,
          type: 'equal',
          text,
        });
      } else if (operation === DiffOp.Delete) {
        blocks.push({
          id: `b${blockIndex++}`,
          type: 'remove',
          text,
        });
      } else if (operation === DiffOp.Insert) {
        blocks.push({
          id: `b${blockIndex++}`,
          type: 'add',
          text,
        });
      }
    }

    return blocks;
  }

  applyChanges(): void {
    const result = this.redlineResult();
    if (!result) {
      return;
    }

    // Check if we have edited content or decisions
    const hasEditedText = this.editedSuggestedText().trim().length > 0;
    const hasEditedBlocks = this.editedBlocks().size > 0;
    const hasBlockDecisions = this.decisions().size > 0;

    if (!hasEditedText && !hasEditedBlocks && !hasBlockDecisions) {
      return;
    }

    const change = result.changes[0];
    let finalText: string;
    let decisionsArray: Array<{ blockId: string; decision: 'accept' | 'reject' }> | undefined;

    if (hasEditedText) {
      // Use edited suggested text directly
      finalText = this.editedSuggestedText().trim();
      decisionsArray = undefined;
    } else if (hasEditedBlocks) {
      // Reconstruct from edited blocks
      const editedBlocks = this.editedBlocks();
      let reconstructedText = '';
      
      for (const block of change.diffBlocks) {
        const editedText = editedBlocks.get(block.id);
        const blockText = editedText || block.text;
        
        if (block.type === 'equal' || block.type === 'add') {
          reconstructedText += blockText;
        }
      }
      
      finalText = reconstructedText;
      decisionsArray = undefined;
    } else {
      // Use existing decisions logic
      decisionsArray = Array.from(this.decisions().entries()).map(([blockId, decision]) => ({
        blockId,
        decision,
      }));
      finalText = undefined as any; // Will be calculated on backend
    }

    this.applying.set(true);
    this.apiService
      .applyRedline(
        this.workspaceId(),
        this.documentId(),
        result.versionId,
        decisionsArray,
        finalText,
      )
      .subscribe({
        next: (applyResult) => {
          this.onboardingService.markChecklistItem('apply_first_redline');
          this.messageService.add({
            severity: 'success',
            summary: this.translateService.instant(_('common.success')),
            detail: this.translateService.instant(_('redline.applySuccess'), {
              version: applyResult.versionNumber,
              user: this.currentUser()?.email || 'User',
            }),
          });
          this.applying.set(false);
          // Reset form and result
          this.redlineResult.set(null);
          this.decisions.set(new Map());
          this.editingMode.set('view');
          this.editedSuggestedText.set('');
          this.editedBlocks.set(new Map());
          this.redlineForm.reset({
            playbook: RedlinePlaybook.BALANCED,
            selectedText: '',
            objective: '',
            instructions: '',
          });
        },
        error: (err) => {
          console.error('Error applying redline:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translateService.instant(_('common.error')),
            detail: err.error?.message || this.translateService.instant(_('redline.applyError')),
          });
          this.applying.set(false);
        },
      });
  }

  scrollToCitation(citation: any): void {
    // TODO: Implement scroll to citation in document viewer
    console.log('Scroll to citation:', citation);
  }

  getConfidenceLabel(confidence?: 'high' | 'medium' | 'low'): string {
    if (!confidence) return '';
    return this.translateService.instant(`redline.confidence.${confidence}`);
  }

  getConfidenceSeverity(confidence?: 'high' | 'medium' | 'low'): 'success' | 'warn' | 'danger' {
    switch (confidence) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warn';
      case 'low':
        return 'danger';
      default:
        return 'warn';
    }
  }

  regionConfirmFooterButtons = computed<DialogFooterButton[]>(() => [
    {
      label: this.translateService.instant(_('redline.selectManually')),
      severity: 'secondary',
      outlined: true,
      action: 'emit',
      emitKey: 'selectManually',
    },
    {
      label: this.translateService.instant(_('redline.useSuggestedRegion')),
      severity: 'primary',
      action: 'emit',
      emitKey: 'useSuggestedRegion',
    },
  ]);

  onRegionConfirmButton(e: { key: string }): void {
    if (e.key === 'selectManually') {
      this.selectRegionManually();
    } else if (e.key === 'useSuggestedRegion') {
      this.confirmSuggestedRegion();
    }
  }

  confirmSuggestedRegion(): void {
    // User confirmed the suggested region, proceed with application
    this.showRegionConfirmation.set(false);
    this.applyChanges();
  }

  selectRegionManually(): void {
    // User wants to select region manually - for now, just close dialog
    // Future: could implement manual selection UI
    this.showRegionConfirmation.set(false);
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant(_('common.info')),
      detail: this.translateService.instant(_('redline.manualSelectionNotImplemented')),
    });
  }
}
