import { Injectable, inject } from '@angular/core';
import Shepherd from 'shepherd.js';
import type { StepOptions } from 'shepherd.js';
import type { Tour } from 'shepherd.js';
import { TranslateService } from '@ngx-translate/core';
import { OnboardingService } from '../onboarding.service';
import { TourNavigationService } from './tour-navigation.service';
import { DocumentViewTabService } from './document-view-tab.service';
import { WorkspaceSettingsTabService } from './workspace-settings-tab.service';
import type { RouteGuideKey } from '@contractai-review/shared';

type TourKey = 'primary';

@Injectable({
  providedIn: 'root',
})
export class TourService {
  private translate = inject(TranslateService);
  private onboardingService = inject(OnboardingService);
  private tourNavService = inject(TourNavigationService);
  private documentViewTabService = inject(DocumentViewTabService);
  private wsTabService = inject(WorkspaceSettingsTabService);

  private activeTour: Tour | null = null;

  startTour(tourKey: TourKey): void {
    this.activeTour?.complete();
    this.activeTour = null;

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
        when: {
          show: () => {
            const step = Shepherd.activeTour?.getCurrentStep();
            const el = step?.getElement?.() as HTMLElement | undefined;
            const id = step?.id;
            if (el && id) el.setAttribute('data-testid', `tour-step-${id}`);
          },
        },
      },
      exitOnEsc: true,
    });

    tour.on('cancel', () => this.onTourCancel(tourKey));
    tour.on('complete', () => this.onTourComplete(tourKey));

    const steps = this.buildPrimarySteps(tour);
    tour.addSteps(steps);
    tour.start();
    this.activeTour = tour;
  }

  private buildPrimarySteps(_tour: Tour): StepOptions[] {
    const t = (key: string) => this.translate.instant(key);
    const nav = this.tourNavService;
    const tabSvc = this.documentViewTabService;
    const onboarding = this.onboardingService;

    return [
      {
        id: 'welcome',
        title: t('onboarding.tour.welcome'),
        text: t('onboarding.tour.welcomeText'),
        attachTo: undefined,
        buttons: [
          { text: t('common.cancel'), action: function (this: Tour) { this.cancel(); }, secondary: true },
          {
            text: t('common.next'),
            action: async function (this: Tour) {
              await nav.navigateTo(['/workspaces']);
              await nav.waitForElement('[data-tour="create-workspace-btn"]');
              this.next();
            },
          },
        ],
      },
      {
        id: 'createWorkspace',
        title: t('onboarding.tour.createWorkspace'),
        text: t('onboarding.tour.createWorkspaceText'),
        attachTo: { element: '[data-tour="create-workspace-btn"]', on: 'bottom' as const },
        buttons: [
          { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
          {
            text: t('common.next'),
            action: async function (this: Tour) {
              onboarding.markChecklistItem('create_workspace');
              const ok = await nav.ensureDocumentViewRoute();
              if (ok) {
                tabSvc.requestTab('0');
                await nav.waitForElement('[data-tour="upload-btn"]');
              }
              this.next();
            },
          },
        ],
      },
      {
        id: 'uploadDocument',
        title: t('onboarding.tour.uploadDocument'),
        text: t('onboarding.tour.uploadDocumentText'),
        attachTo: {
          element: () => document.querySelector('[data-tour="upload-btn"]') as HTMLElement | null,
          on: 'bottom' as const,
        },
        buttons: [
          { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
          {
            text: t('common.next'),
            action: async function (this: Tour) {
              onboarding.markChecklistItem('upload_contract');
              tabSvc.requestTab('2');
              await nav.waitForElement('[data-tour="chat-input"]');
              this.next();
            },
          },
        ],
      },
      {
        id: 'chat',
        title: t('onboarding.tour.chat'),
        text: t('onboarding.tour.chatText'),
        attachTo: {
          element: () => document.querySelector('[data-tour="chat-input"]') as HTMLElement | null,
          on: 'top' as const,
        },
        buttons: [
          { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
          {
            text: t('common.next'),
            action: async function (this: Tour) {
              onboarding.markChecklistItem('run_first_review');
              tabSvc.requestTab('1');
              await nav.waitForElement('[data-tour="redline-generate-btn"]');
              this.next();
            },
          },
        ],
      },
      {
        id: 'redline',
        title: t('onboarding.tour.redline'),
        text: t('onboarding.tour.redlineText'),
        attachTo: {
          element: () => document.querySelector('[data-tour="redline-generate-btn"]') as HTMLElement | null,
          on: 'top' as const,
        },
        buttons: [
          { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
          {
            text: t('common.next'),
            action: async function (this: Tour) {
              onboarding.markChecklistItem('apply_first_redline');
              tabSvc.requestTab('0');
              await nav.waitForElement('[data-tour="download-btn"]');
              this.next();
            },
          },
        ],
      },
      {
        id: 'exportDocument',
        title: t('onboarding.tour.exportDocument'),
        text: t('onboarding.tour.exportDocumentText'),
        attachTo: {
          element: () => document.querySelector('[data-tour="download-btn"]') as HTMLElement | null,
          on: 'top' as const,
        },
        when: {
          show: () => {
            const el = document.querySelector('[data-tour="download-btn"]');
            const step = Shepherd.activeTour?.getCurrentStep();
            if (step && !el && typeof step.updateStepOptions === 'function') {
              step.updateStepOptions({ text: t('onboarding.tour.exportNoFiles') });
            }
          },
        },
        buttons: [
          { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
          {
            text: t('common.next'),
            action: function (this: Tour) {
              onboarding.markChecklistItem('export_document');
              this.next();
            },
          },
        ],
      },
      {
        id: 'done',
        title: t('onboarding.tour.done'),
        text: t('onboarding.tour.doneText'),
        attachTo: undefined,
        buttons: [
          { text: t('common.close'), action: function (this: Tour) { this.complete(); } },
        ],
      },
    ];
  }

  startContextualTour(key: RouteGuideKey): void {
    this.activeTour?.complete();
    this.activeTour = null;

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
        when: {
          show: () => {
            const step = Shepherd.activeTour?.getCurrentStep();
            const el = step?.getElement?.() as HTMLElement | undefined;
            const id = step?.id;
            if (el && id) el.setAttribute('data-testid', `tour-step-${id}`);
          },
        },
      },
      exitOnEsc: true,
    });

    tour.on('cancel', () => { this.activeTour = null; });
    tour.on('complete', () => { this.activeTour = null; });

    const steps = this.buildContextualSteps(key);
    tour.addSteps(steps);
    tour.start();
    this.activeTour = tour;
  }

  private buildContextualSteps(key: RouteGuideKey): StepOptions[] {
    const t = (k: string) => this.translate.instant(k);
    const nav = this.tourNavService;
    const wsTabSvc = this.wsTabService;

    const configs: Record<RouteGuideKey, StepOptions[]> = {
      documents_list: [
        {
          id: 'documents-create',
          title: t('onboarding.tour.ctx.documentsListTitle'),
          text: t('onboarding.tour.ctx.documentsListText'),
          attachTo: { element: '[data-tour="documents-create-btn"]', on: 'bottom' as const },
          buttons: [
            { text: t('common.cancel'), action: function (this: Tour) { this.cancel(); }, secondary: true },
            { text: t('common.next'), action: function (this: Tour) { this.next(); } },
          ],
        },
        {
          id: 'documents-cards',
          title: t('onboarding.tour.ctx.documentsListCardsTitle'),
          text: t('onboarding.tour.ctx.documentsListCardsText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="documents-grid"]') as HTMLElement | null,
            on: 'top' as const,
          },
          buttons: [{ text: t('common.close'), action: function (this: Tour) { this.complete(); } }],
        },
      ],
      workspace_settings: [
        {
          id: 'ws-settings-tabs',
          title: t('onboarding.tour.ctx.wsSettingsTitle'),
          text: t('onboarding.tour.ctx.wsSettingsText'),
          attachTo: { element: '[data-tour="ws-settings-tabs"]', on: 'bottom' as const },
          when: { beforeShow: () => { wsTabSvc.requestTab('general'); } },
          buttons: [
            { text: t('common.cancel'), action: function (this: Tour) { this.cancel(); }, secondary: true },
            {
              text: t('common.next'),
              action: async function (this: Tour) {
                wsTabSvc.requestTab('retention');
                await nav.waitForElement('[data-tour="ws-settings-retention"]');
                this.next();
              },
            },
          ],
        },
        {
          id: 'ws-settings-retention',
          title: t('onboarding.tour.ctx.wsSettingsRetentionTitle'),
          text: t('onboarding.tour.ctx.wsSettingsRetentionText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="ws-settings-retention"]') as HTMLElement | null,
            on: 'top' as const,
          },
          when: { beforeShow: () => { wsTabSvc.requestTab('retention'); } },
          buttons: [
            { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
            { text: t('common.next'), action: function (this: Tour) { this.next(); } },
          ],
        },
        {
          id: 'ws-settings-retention-text-embeddings',
          title: t('onboarding.tour.ctx.wsSettingsRetentionTextEmbeddingsTitle'),
          text: t('onboarding.tour.ctx.wsSettingsRetentionTextEmbeddingsText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="ws-settings-retention-text-embeddings"]') as HTMLElement | null,
            on: 'top' as const,
          },
          when: { beforeShow: () => { wsTabSvc.requestTab('retention'); } },
          buttons: [
            { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
            { text: t('common.next'), action: function (this: Tour) { this.next(); } },
          ],
        },
        {
          id: 'ws-settings-retention-fuzzy-match',
          title: t('onboarding.tour.ctx.wsSettingsRetentionFuzzyMatchTitle'),
          text: t('onboarding.tour.ctx.wsSettingsRetentionFuzzyMatchText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="ws-settings-retention-fuzzy-match"]') as HTMLElement | null,
            on: 'top' as const,
          },
          when: { beforeShow: () => { wsTabSvc.requestTab('retention'); } },
          buttons: [
            { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
            {
              text: t('common.next'),
              action: async function (this: Tour) {
                wsTabSvc.requestTab('documentProcessing');
                await nav.waitForElement('[data-tour="ws-settings-document-processing"]');
                this.next();
              },
            },
          ],
        },
        {
          id: 'ws-settings-document-processing',
          title: t('onboarding.tour.ctx.wsSettingsChunkingTitle'),
          text: t('onboarding.tour.ctx.wsSettingsChunkingText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="ws-settings-document-processing"]') as HTMLElement | null,
            on: 'top' as const,
          },
          when: { beforeShow: () => { wsTabSvc.requestTab('documentProcessing'); } },
          buttons: [
            { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
            {
              text: t('common.next'),
              action: async function (this: Tour) {
                wsTabSvc.requestTab('parsers');
                await nav.waitForElement('[data-tour="ws-settings-parsers"]');
                this.next();
              },
            },
          ],
        },
        {
          id: 'ws-settings-parsers',
          title: t('onboarding.tour.ctx.wsSettingsParsersTitle'),
          text: t('onboarding.tour.ctx.wsSettingsParsersText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="ws-settings-parsers"]') as HTMLElement | null,
            on: 'top' as const,
          },
          when: { beforeShow: () => { wsTabSvc.requestTab('parsers'); } },
          buttons: [
            { text: t('common.previous'), action: function (this: Tour) { this.back(); }, secondary: true },
            {
              text: t('common.next'),
              action: async function (this: Tour) {
                wsTabSvc.requestTab('prompts');
                await nav.waitForElement('[data-tour="ws-settings-prompts"]');
                this.next();
              },
            },
          ],
        },
        {
          id: 'ws-settings-prompts',
          title: t('onboarding.tour.ctx.wsSettingsPromptsTitle'),
          text: t('onboarding.tour.ctx.wsSettingsPromptsText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="ws-settings-prompts"]') as HTMLElement | null,
            on: 'top' as const,
          },
          when: { beforeShow: () => { wsTabSvc.requestTab('prompts'); } },
          buttons: [{ text: t('common.close'), action: function (this: Tour) { this.complete(); } }],
        },
      ],
      members: [
        {
          id: 'members-add',
          title: t('onboarding.tour.ctx.membersAddTitle'),
          text: t('onboarding.tour.ctx.membersAddText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="members-add-btn"]') as HTMLElement | null,
            on: 'bottom' as const,
          },
          buttons: [
            { text: t('common.cancel'), action: function (this: Tour) { this.cancel(); }, secondary: true },
            { text: t('common.next'), action: function (this: Tour) { this.next(); } },
          ],
        },
        {
          id: 'members-table',
          title: t('onboarding.tour.ctx.membersTableTitle'),
          text: t('onboarding.tour.ctx.membersTableText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="members-table"]') as HTMLElement | null,
            on: 'top' as const,
          },
          buttons: [{ text: t('common.close'), action: function (this: Tour) { this.complete(); } }],
        },
      ],
      privacy: [
        {
          id: 'privacy-nologs',
          title: t('onboarding.tour.ctx.privacyNologsTitle'),
          text: t('onboarding.tour.ctx.privacyNologsText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="privacy-nologs-toggle"]') as HTMLElement | null,
            on: 'bottom' as const,
          },
          buttons: [
            { text: t('common.cancel'), action: function (this: Tour) { this.cancel(); }, secondary: true },
            { text: t('common.next'), action: function (this: Tour) { this.next(); } },
          ],
        },
        {
          id: 'privacy-export',
          title: t('onboarding.tour.ctx.privacyExportTitle'),
          text: t('onboarding.tour.ctx.privacyExportText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="privacy-export-btn"]') as HTMLElement | null,
            on: 'top' as const,
          },
          buttons: [{ text: t('common.close'), action: function (this: Tour) { this.complete(); } }],
        },
      ],
      audit: [
        {
          id: 'audit-table',
          title: t('onboarding.tour.ctx.auditTableTitle'),
          text: t('onboarding.tour.ctx.auditTableText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="audit-table"]') as HTMLElement | null,
            on: 'top' as const,
          },
          buttons: [
            { text: t('common.cancel'), action: function (this: Tour) { this.cancel(); }, secondary: true },
            { text: t('common.next'), action: function (this: Tour) { this.next(); } },
          ],
        },
        {
          id: 'audit-filters',
          title: t('onboarding.tour.ctx.auditFiltersTitle'),
          text: t('onboarding.tour.ctx.auditFiltersText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="audit-filters"]') as HTMLElement | null,
            on: 'bottom' as const,
          },
          buttons: [{ text: t('common.close'), action: function (this: Tour) { this.complete(); } }],
        },
      ],
      account_settings: [
        {
          id: 'account-onboarding',
          title: t('onboarding.tour.ctx.accountOnboardingTitle'),
          text: t('onboarding.tour.ctx.accountOnboardingText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="account-onboarding-card"]') as HTMLElement | null,
            on: 'bottom' as const,
          },
          buttons: [
            { text: t('common.cancel'), action: function (this: Tour) { this.cancel(); }, secondary: true },
            { text: t('common.next'), action: function (this: Tour) { this.next(); } },
          ],
        },
        {
          id: 'account-danger',
          title: t('onboarding.tour.ctx.accountDangerTitle'),
          text: t('onboarding.tour.ctx.accountDangerText'),
          attachTo: {
            element: () => document.querySelector('[data-tour="account-danger-zone"]') as HTMLElement | null,
            on: 'top' as const,
          },
          buttons: [{ text: t('common.close'), action: function (this: Tour) { this.complete(); } }],
        },
      ],
    };

    return configs[key] ?? [];
  }

  private onTourCancel(tourKey: TourKey): void {
    this.onboardingService.updateTour(tourKey, { dismissed: true });
    this.activeTour = null;
  }

  private onTourComplete(tourKey: TourKey): void {
    this.onboardingService.updateTour(tourKey, { completed: true });
    this.onboardingService.completeOnboarding();
    this.activeTour = null;
  }
}
