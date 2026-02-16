/**
 * Optional toolbar configuration for ListCardComponent.
 * When provided, renders Add and/or Delete buttons based on flags.
 */
export interface ListToolbarConfig {
  /** Show Add button */
  showAddButton?: boolean;
  /** i18n key for Add button label */
  addButtonLabelKey?: string;
  /** PrimeIcons class for Add button (e.g. 'pi pi-user-plus') */
  addButtonIcon?: string;
  /** Optional data-tour attribute for Add button */
  addButtonDataTour?: string;
  /** Called when Add button is clicked */
  onAdd?: () => void;

  /** Show Delete button */
  showDeleteButton?: boolean;
  /** i18n key for Delete button label */
  deleteButtonLabelKey?: string;
  /** PrimeIcons class for Delete button (e.g. 'pi pi-trash') */
  deleteButtonIcon?: string;
  /** Return true to disable the Delete button (e.g. no selection, or cannot delete selected item) */
  isDeleteDisabled?: () => boolean;
  /** Called when Delete button is clicked. Parent should use selected item and perform confirm + delete. */
  onDelete?: () => void;
}
