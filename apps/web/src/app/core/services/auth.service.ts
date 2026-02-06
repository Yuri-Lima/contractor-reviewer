import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { LoginRequest, LoginResponse, RegisterRequest, User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'contractai_token';
  private readonly USER_KEY = 'contractai_user';

  currentUser = signal<User | null>(this.getStoredUser());
  isAuthenticated = signal<boolean>(!!this.getToken());

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    // Check if token is still valid on init
    if (this.isAuthenticated()) {
      this.validateToken();
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.auth.login}`, credentials).pipe(
      tap((response) => {
        this.setToken(response.accessToken);
        this.setUser(response.user);
        this.currentUser.set(response.user);
        this.isAuthenticated.set(true);
      }),
    );
  }

  register(data: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.auth.register}`, data).pipe(
      tap((response) => {
        this.setToken(response.accessToken);
        this.setUser(response.user);
        this.currentUser.set(response.user);
        this.isAuthenticated.set(true);
      }),
    );
  }

  logout(): void {
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  private setUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  private getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  private clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private validateToken(): void {
    // In a real app, you might want to call an endpoint to validate the token
    // For now, we'll just check if it exists
    const token = this.getToken();
    if (!token) {
      this.clearAuth();
    }
  }
}
