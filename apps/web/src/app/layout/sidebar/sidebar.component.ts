import { Component, input, computed, inject, viewChild, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PanelMenuModule } from 'primeng/panelmenu';
import { Button } from 'primeng/button';
import { Popover } from 'primeng/popover';
import { Avatar } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';
import {
  ROUTES,
  workspaceDocuments,
  workspacePrivacy,
  workspaceAudit,
  workspaceMembers,
  workspaceSettings,
} from '../../core/routes';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AvatarService } from '../../core/services/avatar.service';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PanelMenuModule,
    Button,
    Popover,
    Avatar,
    TooltipModule,
    ThemeSelectorComponent,
    LanguageSelectorComponent,
    TranslatePipe,
  ],
  template: `
    <aside class="sidebar flex flex-col min-w-72 w-72 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 sticky top-0 transition-colors duration-200 shadow-sm">
      <!-- Logo at top -->
      <div class="flex-shrink-0 p-4">
        <a
          [routerLink]="ROUTES.WORKSPACES"
          class="flex items-center gap-2 text-gray-800 dark:text-gray-100 font-semibold text-lg no-underline transition-colors hover:text-blue-600 dark:hover:text-blue-400 min-w-0"
          [pTooltip]="'tooltip.home' | translate"
        >
          <i class="pi pi-file text-2xl text-blue-600 dark:text-blue-400 flex-shrink-0"></i>
          <span class="truncate">{{ 'app.name' | translate }}</span>
        </a>
      </div>
      <!-- Scrollable nav -->
      <div class="flex-1 min-h-0 overflow-y-auto px-4">
        <div class="py-2">
          <p-panelMenu [model]="menuItems()" [multiple]="true" class="sidebar-panelmenu" />
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 pb-2">
          <p-panelMenu [model]="settingsItems()" [multiple]="true" class="sidebar-panelmenu" />
        </div>
      </div>
      <!-- Footer with cog button -->
      @if (isAuthenticated()) {
        <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
          <p-button
            icon="pi pi-cog"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            (onClick)="toggleCogPanel($event)"
            [pTooltip]="'tooltip.settingsMenu' | translate"
            data-tour="nav-settings"
          ></p-button>
          <p-popover #cogPanel [dismissable]="true" [style]="{ width: '280px' }">
            <div class="flex flex-col gap-4 py-2">
                <!-- User info -->
                <div class="flex items-center gap-3">
                  <p-avatar
                    [image]="sidebarAvatarUrl() ?? undefined"
                    [label]="sidebarAvatarUrl() ? undefined : userInitials()"
                    shape="circle"
                    [style]="sidebarAvatarUrl() ? {} : { 'background': 'linear-gradient(to bottom right, rgb(59 130 246), rgb(37 99 235))', 'color': 'white' }"
                    class="flex-shrink-0"
                  ></p-avatar>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{{ userName() }}</span>
                </div>
                <!-- Theme toggle -->
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400 block mb-1">{{ 'tooltip.themeToggle' | translate }}</span>
                  <app-theme-selector></app-theme-selector>
                </div>
                <!-- Language selector -->
                <div>
                  <span class="text-xs text-gray-500 dark:text-gray-400 block mb-1">{{ 'tooltip.language' | translate }}</span>
                  <app-language-selector></app-language-selector>
                </div>
                <div class="border-t border-gray-200 dark:border-gray-700"></div>
                <!-- Settings & Logout -->
                <div class="flex flex-col gap-1">
                  <a
                    [routerLink]="ROUTES.SETTINGS"
                    routerLinkActive="router-link-active"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 no-underline transition-colors"
                    (click)="hideCogPanel()"
                  >
                    <i class="pi pi-cog"></i>
                    <span>{{ 'settings.title' | translate }}</span>
                  </a>
                  <button
                    type="button"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left transition-colors cursor-pointer border-0 bg-transparent"
                    (click)="onLogoutClick()"
                  >
                    <i class="pi pi-sign-out"></i>
                    <span>{{ 'common.logout' | translate }}</span>
                  </button>
                </div>
              </div>
          </p-popover>
        </div>
      }
    </aside>
  `,
  styles: [
    `
      :host ::ng-deep .sidebar-panelmenu .p-panelmenu-panel {
        margin-bottom: 0.25rem;
      }
      :host ::ng-deep .sidebar-panelmenu .p-panelmenu-header > a {
        padding: 0.625rem 1rem;
        border-radius: 0.5rem;
        border: none;
        background: transparent;
        color: inherit;
        white-space: normal;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      :host ::ng-deep .sidebar-panelmenu .p-panelmenu-header > a:hover {
        background: rgb(243 244 246);
      }
      :host-context(.dark) ::ng-deep .sidebar-panelmenu .p-panelmenu-header > a:hover {
        background: rgb(55 65 81);
      }
      :host ::ng-deep .sidebar-panelmenu .p-panelmenu-header .p-panelmenu-header-link {
        background: transparent !important;
        border: none !important;
      }
      :host ::ng-deep .sidebar-panelmenu .p-panelmenu-content {
        border: none;
        background: transparent;
        padding: 0.25rem 0 0.25rem 0.5rem;
      }
      :host ::ng-deep .sidebar-panelmenu .p-menuitem-link {
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid transparent;
        white-space: normal;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      :host ::ng-deep .sidebar-panelmenu .p-menuitem-link:hover {
        background: rgb(243 244 246);
      }
      :host-context(.dark) ::ng-deep .sidebar-panelmenu .p-menuitem-link:hover {
        background: rgb(55 65 81);
      }
      :host ::ng-deep .sidebar-panelmenu .p-menuitem-link.router-link-active {
        background: rgb(219 234 254);
        color: rgb(37 99 235);
        border-left-color: rgb(37 99 235);
        font-weight: 500;
      }
      :host-context(.dark) ::ng-deep .sidebar-panelmenu .p-menuitem-link.router-link-active {
        background: rgb(30 58 138 / 0.2);
        color: rgb(96 165 250);
        border-left-color: rgb(96 165 250);
      }
    `,
  ],
})
export class SidebarComponent {
  workspaceId = input<string | undefined>();

  readonly ROUTES = ROUTES;

  cogPanelRef = viewChild<Popover>('cogPanel');

  private translateService = inject(TranslateService);
  private authService = inject(AuthService);
  private webSocketService = inject(WebSocketService);
  private avatarService = inject(AvatarService);

  sidebarAvatarUrl = signal<string | null>(null);
  private avatarBlobUrl: string | null = null;

  isAuthenticated = computed(() => this.authService.isAuthenticated());
  currentUser = computed(() => this.authService.currentUser());
  userName = computed(() => {
    const user = this.currentUser();
    return user?.name || user?.email || '';
  });
  userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '?';
    const name = user.name || user.email;
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  });

  constructor() {
    effect((onCleanup) => {
      const user = this.currentUser();
      if (!user) {
        if (this.avatarBlobUrl) {
          URL.revokeObjectURL(this.avatarBlobUrl);
          this.avatarBlobUrl = null;
        }
        this.sidebarAvatarUrl.set(null);
        return;
      }
      const sub = this.avatarService.getAvatarUrl(user).subscribe((url) => {
        if (this.avatarBlobUrl && this.avatarBlobUrl !== url) {
          URL.revokeObjectURL(this.avatarBlobUrl);
          this.avatarBlobUrl = null;
        }
        this.avatarBlobUrl = url && url.startsWith('blob:') ? url : null;
        this.sidebarAvatarUrl.set(url);
      });
      onCleanup(() => {
        sub.unsubscribe();
        if (this.avatarBlobUrl) {
          URL.revokeObjectURL(this.avatarBlobUrl);
          this.avatarBlobUrl = null;
        }
      });
    });
  }

  /** Triggers menu rebuild when language changes */
  private currentLang = toSignal(this.translateService.onLangChange, { initialValue: null });

  toggleCogPanel(event: Event): void {
    this.cogPanelRef()?.toggle(event);
  }

  hideCogPanel(): void {
    this.cogPanelRef()?.hide();
  }

  onLogoutClick(): void {
    this.hideCogPanel();
    this.webSocketService.disconnect();
    this.authService.logout();
  }

  menuItems = computed<MenuItem[]>(() => {
    this.currentLang(); // depend on lang change to rebuild menu labels
    const id = this.workspaceId();
    const workspaceChildren: MenuItem[] = [
      {
        label: this.translateService.instant(_('workspaces.allWorkspaces')),
        icon: 'pi pi-building',
        routerLink: ROUTES.WORKSPACES,
        routerLinkActiveOptions: { exact: true },
        data: { tour: 'nav-workspaces' },
      },
    ];

    if (id) {
      workspaceChildren.push(
        {
          label: this.translateService.instant(_('documents.title')),
          icon: 'pi pi-file',
          routerLink: workspaceDocuments(id),
          routerLinkActiveOptions: { exact: false },
          data: { tour: 'nav-documents' },
        },
        {
          label: this.translateService.instant(_('privacy.title')),
          icon: 'pi pi-lock',
          routerLink: workspacePrivacy(id),
          routerLinkActiveOptions: { exact: true },
        },
        {
          label: this.translateService.instant(_('audit.title')),
          icon: 'pi pi-chart-bar',
          routerLink: workspaceAudit(id),
          routerLinkActiveOptions: { exact: true },
        },
        {
          label: this.translateService.instant(_('workspaceMembers.title')),
          icon: 'pi pi-users',
          routerLink: workspaceMembers(id),
          routerLinkActiveOptions: { exact: true },
        },
        {
          label: this.translateService.instant(_('workspaceSettings.menuItem')),
          icon: 'pi pi-cog',
          routerLink: workspaceSettings(id),
          routerLinkActiveOptions: { exact: true },
        }
      );
    }

    return [
      {
        label: this.translateService.instant(_('workspaces.title')),
        icon: 'pi pi-folder-open',
        items: workspaceChildren,
        expanded: !!id, // Auto-open when in workspace context (e.g. documents from Workspaces)
      },
    ];
  });

  settingsItems = computed<MenuItem[]>(() => {
    this.currentLang(); // depend on lang change to rebuild menu labels
    return [
    {
      label: this.translateService.instant(_('settings.title')),
      icon: 'pi pi-cog',
      routerLink: ROUTES.SETTINGS,
      routerLinkActiveOptions: { exact: true },
      data: { tour: 'nav-settings' },
    },
  ];
  });
}
