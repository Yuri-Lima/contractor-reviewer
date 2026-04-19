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
import { ROUTES } from '../../core/routes';
import { AuthService } from '../../core/services/auth.service';
import { RegisterRequest } from '@contractai-review/shared';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { LanguageSelectorComponent } from '../../layout/language-selector/language-selector.component';

@Component({
  selector: 'app-register',
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
  templateUrl: './register.html',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private translateService = inject(TranslateService);

  readonly routes = ROUTES;

  registerForm: FormGroup;
  loading = signal(false);
  error = signal('');
  emailExists = signal(false);

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
    this.emailExists.set(false);

    const data: RegisterRequest = this.registerForm.value;
    this.authService.register(data).subscribe({
      next: () => {
        this.router.navigate([ROUTES.WORKSPACES]);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Register error:', err);

        if (err.status === 0) {
          this.error.set(this.translateService.instant(_('errors.network')));
        } else if (err.status === 409) {
          this.emailExists.set(true);
          this.error.set(this.translateService.instant(_('auth.emailAlreadyExists')));
        } else if (err.status === 400) {
          this.error.set(err.error?.message || this.translateService.instant(_('errors.generic')));
        } else {
          this.error.set(err.error?.message || this.translateService.instant(_('errors.generic')));
        }
      },
    });
  }
}
