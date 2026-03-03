import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { DocumentPromptsEditorComponent } from '../document-prompts-editor/document-prompts-editor.component';
import { documentSettings, workspaceDocument } from '../../core/routes';
import type { Document } from '@contractai-review/shared';

@Component({
  selector: 'app-document-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TabsModule,
    Toast,
    TranslatePipe,
    DocumentPromptsEditorComponent,
  ],
  providers: [MessageService],
  templateUrl: './document-settings.html',
})
export class DocumentSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);

  workspaceId = signal('');
  documentId = signal('');
  document = signal<Document | null>(null);
  loading = signal(true);
  activeTab = signal<string>('prompts');

  readonly documentSettings = documentSettings;
  readonly workspaceDocument = workspaceDocument;

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    const docId = this.route.snapshot.paramMap.get('documentId') || '';
    this.workspaceId.set(wsId);
    this.documentId.set(docId);
    this.loadDocument();
  }

  loadDocument(): void {
    const wsId = this.workspaceId();
    const docId = this.documentId();
    if (!wsId || !docId) {
      this.loading.set(false);
      return;
    }
    this.apiService.getDocument(wsId, docId).subscribe({
      next: (doc) => {
        this.document.set(doc);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  getDisplayTitle(doc: Document | null): string {
    if (!doc?.title) return '';
    const t = doc.title;
    return typeof t === 'string' ? t : String(t);
  }

  setActiveTab(tab: string | number | undefined): void {
    if (tab != null) this.activeTab.set(String(tab));
  }
}
