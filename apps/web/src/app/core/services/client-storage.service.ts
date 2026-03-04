import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { STORAGE_KEY_PREFIX } from '@contractai-review/shared/constants';

@Injectable({
  providedIn: 'root',
})
export class ClientStorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly memory = new Map<string, string>();

  private isAvailable(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  getItem<T>(
    key: string,
    defaultValue: T,
    deserializer: (s: string) => T = JSON.parse,
  ): T {
    if (!this.isAvailable()) return defaultValue;
    try {
      const fullKey = STORAGE_KEY_PREFIX + key;
      const raw = localStorage.getItem(fullKey) ?? this.memory.get(fullKey);
      return raw != null ? deserializer(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  setItem<T>(
    key: string,
    value: T,
    serializer: (v: T) => string = JSON.stringify,
  ): void {
    const fullKey = STORAGE_KEY_PREFIX + key;
    const serialized = serializer(value);
    if (!this.isAvailable()) {
      this.memory.set(fullKey, serialized);
      return;
    }
    try {
      localStorage.setItem(fullKey, serialized);
      this.memory.set(fullKey, serialized);
    } catch {
      this.memory.set(fullKey, serialized);
    }
  }

  removeItem(key: string): void {
    const fullKey = STORAGE_KEY_PREFIX + key;
    if (!this.isAvailable()) {
      this.memory.delete(fullKey);
      return;
    }
    try {
      localStorage.removeItem(fullKey);
      this.memory.delete(fullKey);
    } catch {
      this.memory.delete(fullKey);
    }
  }
}
