import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./settings/account-settings.component').then(m => m.AccountSettingsComponent),
  },
  {
    path: 'workspaces',
    canActivate: [authGuard],
    loadComponent: () => import('./workspaces/workspaces.component').then(m => m.WorkspacesComponent),
  },
  {
    path: 'workspaces/:workspaceId',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'documents',
        pathMatch: 'full',
      },
      {
        path: 'documents',
        loadComponent: () => import('./documents/documents-list/documents-list.component').then(m => m.DocumentsListComponent),
      },
      {
        path: 'documents/:documentId',
        loadComponent: () => import('./documents/document-view/document-view.component').then(m => m.DocumentViewComponent),
      },
      {
        path: 'privacy',
        loadComponent: () => import('./privacy/privacy.component').then(m => m.PrivacyComponent),
      },
      {
        path: 'audit',
        loadComponent: () => import('./audit/audit.component').then(m => m.AuditComponent),
      },
      {
        path: 'members',
        loadComponent: () => import('./workspaces/workspace-members/workspace-members.component').then(m => m.WorkspaceMembersComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./workspaces/settings/workspace-settings.component').then(m => m.WorkspaceSettingsComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
