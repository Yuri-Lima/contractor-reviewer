import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { DevVisualizationsService } from '../services/dev-visualizations.service';

@Directive({
  selector: '[appDevOnly]',
  standalone: true,
})
export class DevOnlyDirective {
  private hasView = false;

  private templateRef = inject(TemplateRef<unknown>);
  private vcRef = inject(ViewContainerRef);
  private service = inject(DevVisualizationsService);

  constructor() {
    effect(() => {
      const enabled = this.service.enabled();
      if (enabled && !this.hasView) {
        this.vcRef.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!enabled && this.hasView) {
        this.vcRef.clear();
        this.hasView = false;
      }
    });
  }
}
