import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { ROUTES, ROUTE_PATHS } from './core/routes';

export const routes: Routes = [
  {
    path: '',
    redirectTo: ROUTES.LOGIN,
    pathMatch: 'full',
  },
  {
    path: ROUTE_PATHS.LOGIN,
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: ROUTE_PATHS.REGISTER,
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: ROUTE_PATHS.SETTINGS,
    canActivate: [authGuard],
    loadComponent: () => import('./settings/account-settings.component').then(m => m.AccountSettingsComponent),
  },
  {
    path: ROUTE_PATHS.WORKSPACES,
    canActivate: [authGuard],
    loadComponent: () => import('./workspaces/workspaces.component').then(m => m.WorkspacesComponent),
  },
  {
    path: `${ROUTE_PATHS.WORKSPACES}/${ROUTE_PATHS.WORKSPACE_ID}`,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: ROUTE_PATHS.DOCUMENTS,
        pathMatch: 'full',
      },
      {
        path: ROUTE_PATHS.DOCUMENTS,
        loadComponent: () => import('./documents/documents-list/documents-list.component').then(m => m.DocumentsListComponent),
      },
      {
        path: `${ROUTE_PATHS.DOCUMENTS}/${ROUTE_PATHS.DOCUMENT_ID}`,
        loadComponent: () => import('./documents/document-view/document-view.component').then(m => m.DocumentViewComponent),
      },
      {
        path: ROUTE_PATHS.PRIVACY,
        loadComponent: () => import('./privacy/privacy.component').then(m => m.PrivacyComponent),
      },
      {
        path: ROUTE_PATHS.AUDIT,
        loadComponent: () => import('./audit/audit.component').then(m => m.AuditComponent),
      },
      {
        path: ROUTE_PATHS.MEMBERS,
        loadComponent: () => import('./workspaces/workspace-members/workspace-members.component').then(m => m.WorkspaceMembersComponent),
      },
      {
        path: ROUTE_PATHS.SETTINGS,
        loadComponent: () => import('./workspaces/settings/workspace-settings.component').then(m => m.WorkspaceSettingsComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: ROUTES.LOGIN,
  },
];
