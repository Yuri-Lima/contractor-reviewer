/**
 * Configuration for a footer button in BaseDialogComponent.
 * Used when footerButtons config is provided (config-driven default pattern).
 */
export interface DialogFooterButton {
  label: string;
  icon?: string;
  severity?: 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast';
  outlined?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** 'close' = emit closed and close dialog; 'emit' = emit buttonClicked with emitKey */
  action: 'emit' | 'close';
  /** Emitted via buttonClicked output when action is 'emit' */
  emitKey?: string;
}
