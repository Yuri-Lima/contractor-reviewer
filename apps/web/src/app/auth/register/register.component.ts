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
import { RegisterRequest } from '../../core/models/user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-register',
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
            <i class="pi pi-user-plus text-4xl text-primary dark:text-blue-400 mb-2"></i>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ 'auth.registerTitle' | translate }}</h1>
          </div>
        </ng-template>
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="space-y-4 p-6">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <i class="pi pi-user mr-2"></i>{{ 'auth.name' | translate }}
            </label>
            <input
              pInputText
              id="name"
              type="text"
              formControlName="name"
              [placeholder]="'auth.name' | translate"
              class="w-full"
              [class.ng-invalid]="registerForm.get('name')?.invalid && registerForm.get('name')?.touched"
            />
            <small
              class="p-error block mt-1"
              *ngIf="registerForm.get('name')?.invalid && registerForm.get('name')?.touched"
            >
              {{ 'auth.requiredName' | translate }}
            </small>
          </div>

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
              [class.ng-invalid]="registerForm.get('email')?.invalid && registerForm.get('email')?.touched"
            />
            <small
              class="p-error block mt-1"
              *ngIf="registerForm.get('email')?.invalid && registerForm.get('email')?.touched"
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
              [feedback]="true"
              [toggleMask]="true"
              styleClass="w-full"
              [inputStyleClass]="registerForm.get('password')?.invalid && registerForm.get('password')?.touched ? 'ng-invalid' : ''"
            ></p-password>
            <small
              class="p-error block mt-1"
              *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched"
            >
              {{ 'validation.minLength' | translate: {min: 8} }}
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
            [label]="'auth.signUp' | translate"
            icon="pi pi-user-plus"
            [disabled]="registerForm.invalid || loading()"
            [loading]="loading()"
            styleClass="w-full"
          ></p-button>
        </form>

        <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ 'auth.hasAccount' | translate }} </span>
          <a routerLink="/login" class="text-blue-600 dark:text-blue-400 font-medium hover:underline transition-colors">
            {{ 'auth.signIn' | translate }}
          </a>
        </div>
      </p-card>
    </div>
  `,
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private translateService = inject(TranslateService);

  registerForm: FormGroup;
  loading = signal(false);
  error = signal('');

  canSubmit = computed(() => !this.registerForm.invalid && !this.loading());

  constructor() {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const data: RegisterRequest = this.registerForm.value;
    this.authService.register(data).subscribe({
      next: () => {
        this.router.navigate(['/workspaces']);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Register error:', err);
        
        // Tratar diferentes tipos de erro
        if (err.status === 0) {
          this.error.set(this.translateService.instant('errors.network'));
        } else if (err.status === 409) {
          this.error.set(this.translateService.instant('errors.generic'));
        } else if (err.status === 400) {
          this.error.set(err.error?.message || this.translateService.instant('errors.generic'));
        } else {
          this.error.set(err.error?.message || this.translateService.instant('errors.generic'));
        }
      },
    });
  }
}
