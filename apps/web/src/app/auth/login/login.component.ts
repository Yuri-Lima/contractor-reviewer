import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Message } from 'primeng/message';
import { AuthService } from '../../core/services/auth.service';
import { LoginRequest } from '../../core/models/user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    Button,
    Card,
    InputText,
    Password,
    Message,
    TranslatePipe,
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 dark:from-gray-900 dark:to-gray-800 p-4 transition-colors duration-200">
      <p-card class="w-full max-w-md dark:bg-gray-800 dark:border-gray-700">
        <ng-template pTemplate="header">
          <div class="text-center p-4">
            <i class="pi pi-sign-in text-4xl text-primary dark:text-blue-400 mb-2"></i>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ 'auth.loginTitle' | translate }}</h1>
          </div>
        </ng-template>
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-4 p-6">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <i class="pi pi-envelope mr-2"></i>{{ 'auth.email' | translate }}
            </label>
            <input
              pInputText
              id="email"
              type="email"
              formControlName="email"
              placeholder="seu@email.com"
              class="w-full"
              [class.ng-invalid]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
            />
            <small
              class="p-error block mt-1"
              *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
            >
              {{ 'auth.invalidEmail' | translate }}
            </small>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <i class="pi pi-lock mr-2"></i>{{ 'auth.password' | translate }}
            </label>
            <p-password
              id="password"
              formControlName="password"
              placeholder="••••••••"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              [inputStyleClass]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched ? 'ng-invalid' : ''"
            ></p-password>
            <small
              class="p-error block mt-1"
              *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
            >
              {{ 'auth.requiredPassword' | translate }}
            </small>
          </div>

          <p-message
            severity="error"
            [text]="error()"
            *ngIf="error()"
            class="w-full"
          ></p-message>

          <p-button
            type="submit"
            [label]="'auth.signIn' | translate"
            icon="pi pi-sign-in"
            [disabled]="loginForm.invalid || loading()"
            [loading]="loading()"
            styleClass="w-full"
          ></p-button>
        </form>

        <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ 'auth.noAccount' | translate }} </span>
          <a routerLink="/register" class="text-blue-600 dark:text-blue-400 font-medium hover:underline transition-colors">
            {{ 'auth.register' | translate }}
          </a>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private translateService = inject(TranslateService);

  loginForm: FormGroup;
  loading = signal(false);
  error = signal('');

  canSubmit = computed(() => !this.loginForm.invalid && !this.loading());

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const credentials: LoginRequest = this.loginForm.value;
    this.authService.login(credentials).subscribe({
      next: () => {
        this.router.navigate(['/workspaces']);
      },
      error: (err) => {
        this.loading.set(false);
        const errorMsg = err.error?.message || this.translateService.instant('auth.loginError');
        this.error.set(errorMsg);
      },
    });
  }
}
