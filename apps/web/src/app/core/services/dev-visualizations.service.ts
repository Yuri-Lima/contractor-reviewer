import { Injectable, inject, signal } from '@angular/core';
import { ClientStorageService } from './client-storage.service';

const DEV_VISUALIZATIONS_KEY = 'dev_visualizations';

@Injectable({
  providedIn: 'root',
})
export class DevVisualizationsService {
  private readonly clientStorage = inject(ClientStorageService);

  readonly enabled = signal(
    this.clientStorage.getItem(DEV_VISUALIZATIONS_KEY, false, (s) => s === 'true'),
  );

  setEnabled(value: boolean): void {
    this.clientStorage.setItem(
      DEV_VISUALIZATIONS_KEY,
      value,
      (v) => String(v),
    );
    this.enabled.set(value);
  }

  toggle(): void {
    this.setEnabled(!this.enabled());
  }
}
