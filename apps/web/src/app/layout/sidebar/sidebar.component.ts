import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-64px)] sticky top-16 transition-colors duration-200 shadow-sm">
      <nav class="p-4 space-y-1">
        <a
          routerLink="/workspaces"
          routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-medium"
          class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 no-underline"
        >
          <i class="pi pi-building text-lg"></i>
          <span class="text-sm">Workspaces</span>
        </a>
        @if (workspaceId) {
          <a
            [routerLink]="['/workspaces', workspaceId, 'documents']"
            routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-medium"
            class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 no-underline"
          >
            <i class="pi pi-file text-lg"></i>
            <span class="text-sm">Documents</span>
          </a>
          <a
            [routerLink]="['/workspaces', workspaceId, 'privacy']"
            routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-medium"
            class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 no-underline"
          >
            <i class="pi pi-lock text-lg"></i>
            <span class="text-sm">Privacy</span>
          </a>
          <a
            [routerLink]="['/workspaces', workspaceId, 'audit']"
            routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-medium"
            class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 no-underline"
          >
            <i class="pi pi-chart-bar text-lg"></i>
            <span class="text-sm">Audit Logs</span>
          </a>
          <a
            [routerLink]="['/workspaces', workspaceId, 'members']"
            routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-medium"
            class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 no-underline"
          >
            <i class="pi pi-users text-lg"></i>
            <span class="text-sm">Membros</span>
          </a>
          <a
            [routerLink]="['/workspaces', workspaceId, 'retention']"
            routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-medium"
            class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 no-underline"
          >
            <i class="pi pi-clock text-lg"></i>
            <span class="text-sm">Retenção</span>
          </a>
        }
        <div class="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
          <a
            routerLink="/settings"
            routerLinkActive="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-medium"
            class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 no-underline"
          >
            <i class="pi pi-cog text-lg"></i>
            <span class="text-sm">Configurações</span>
          </a>
        </div>
      </nav>
    </aside>
  `,
})
export class SidebarComponent {
  @Input() workspaceId?: string;
}
