/**
 * Taxonomies Selectors
 *
 * Selectors for taxonomy management (categories, tags, etc.).
 */

export const TAXONOMIES_SELECTORS = {
  list: {
    container: 'taxonomies-list-table',
    createButton: 'taxonomies-create-button',
    row: 'taxonomy-row-{id}',
    editButton: 'taxonomies-edit-{id}',
    deleteButton: 'taxonomies-delete-{id}',
  },
  form: {
    dialog: 'taxonomy-form-dialog',
    nameInput: 'taxonomy-name-input',
    slugInput: 'taxonomy-slug-input',
    descriptionInput: 'taxonomy-description-input',
    iconInput: 'taxonomy-icon-input',
    colorInput: 'taxonomy-color-input',
    parentSelect: 'taxonomy-parent-select',
    orderInput: 'taxonomy-order-input',
    saveButton: 'taxonomy-save-button',
    cancelButton: 'taxonomy-cancel-button',
  },
  confirmDelete: {
    dialog: 'taxonomy-delete-dialog',
    confirmButton: 'taxonomy-delete-confirm',
    cancelButton: 'taxonomy-delete-cancel',
  },
} as const

export type TaxonomiesSelectorsType = typeof TAXONOMIES_SELECTORS
