import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import type { User } from '@contractai-review/shared';

@Injectable({
  providedIn: 'root',
})
export class AvatarService {
  constructor(private http: HttpClient) {}

  /**
   * Returns an observable of the avatar URL to display.
   * - For Gravatar: returns the URL directly
   * - For custom avatar: fetches with auth and returns object URL.
   * Note: When using blob URLs, caller should call URL.revokeObjectURL on destroy to avoid memory leaks.
   */
  getAvatarUrl(user: User | null): Observable<string | null> {
    if (!user) return of(null);
    const url = user.avatarUrl;
    if (!url) return of(null);
    if (url.startsWith('http')) return of(url);
    const avatarUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/avatar`;
    return this.http.get(avatarUrl, { responseType: 'blob' }).pipe(
      map((blob) => URL.createObjectURL(blob)),
      catchError(() => of(null)),
    );
  }
}
