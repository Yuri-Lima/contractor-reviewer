import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DocumentViewTabService {
  requestedTab = signal<string | null>(null);

  requestTab(tab: string): void {
    this.requestedTab.set(tab);
  }

  clearRequest(): void {
    this.requestedTab.set(null);
  }
}
