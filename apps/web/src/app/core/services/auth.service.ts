import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { LoginRequest, LoginResponse, RegisterRequest, User } from '@contractai-review/shared';

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
    const token = this.getToken();
    if (!token) {
      this.clearAuth();
      return;
    }

    // Basic JWT expiration check (if token is JWT)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp;
      
      // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
      if (exp && exp * 1000 < Date.now()) {
        console.warn('Token expired, clearing authentication');
        this.clearAuth();
        return;
      }
    } catch (e) {
      // If token is not a valid JWT, we'll assume it's valid for now
      // In production, you should validate with the backend
    }

    // Optional: Validate token with backend
    // You can uncomment this to validate token on app init
    // this.http.get(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}`).subscribe({
    //   error: () => this.clearAuth()
    // });
  }
}
