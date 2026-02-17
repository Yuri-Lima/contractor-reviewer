import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Message } from 'primeng/message';
import { AuthService } from '../../core/services/auth.service';
import { LoginRequest } from '@contractai-review/shared';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { LanguageSelectorComponent } from '../../layout/language-selector/language-selector.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    Button,
    Card,
    TooltipModule,
    InputText,
    Password,
    Message,
    TranslatePipe,
    LanguageSelectorComponent,
  ],
  templateUrl: './login.html',
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
