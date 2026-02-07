/**
 * Media Library Selectors
 *
 * data-cy selectors for all media library interactive elements.
 * Used across MediaLibrary modal, MediaSelector field, and related components.
 */

export const MEDIA_SELECTORS = {
  // Main library dialog/modal
  library: {
    dialog: 'media-library-dialog',
    closeBtn: 'media-library-close',
    title: 'media-library-title',
  },

  // Toolbar controls
  toolbar: {
    container: 'media-toolbar',
    uploadBtn: 'media-upload-btn',
    searchInput: 'media-search-input',
    typeFilter: 'media-type-filter',
    sortSelect: 'media-sort-select',
    viewToggle: {
      grid: 'media-view-grid',
      list: 'media-view-list',
    },
    columnSelect: 'media-column-select',
  },

  // Upload zone
  upload: {
    dropzone: 'media-upload-dropzone',
    fileInput: 'media-upload-input',
    progress: 'media-upload-progress-{id}',
    progressBar: 'media-upload-progress-bar',
  },

  // Grid view
  grid: {
    container: 'media-grid',
    item: 'media-grid-item-{id}',
    thumbnail: 'media-thumbnail-{id}',
    checkbox: 'media-checkbox-{id}',
    menuBtn: 'media-menu-{id}',
    menuEdit: 'media-menu-edit-{id}',
    menuDelete: 'media-menu-delete-{id}',
  },

  // List/table view
  list: {
    container: 'media-list',
    row: 'media-list-row-{id}',
    cell: 'media-list-cell-{id}-{field}',
  },

  // Detail panel (edit metadata)
  detail: {
    dialog: 'media-detail-dialog',
    panel: 'media-detail-panel',
    titleInput: 'media-title-input',
    altInput: 'media-alt-input',
    captionInput: 'media-caption-input',
    saveBtn: 'media-detail-save',
    cancelBtn: 'media-detail-cancel',
    tags: 'media-detail-tags',
    tagBadge: 'media-detail-tag-{id}',
    addTagBtn: 'media-detail-add-tag',
  },

  // Footer controls
  footer: {
    container: 'media-footer',
    selectionCount: 'media-selection-count',
    cancelBtn: 'media-cancel-btn',
    selectBtn: 'media-select-btn',
  },

  // MediaSelector form field component
  selector: {
    container: 'media-selector',
    selectBtn: 'media-selector-select-btn',
    changeBtn: 'media-selector-change-btn',
    removeBtn: 'media-selector-remove-btn',
    preview: 'media-selector-preview',
  },

  // Empty states
  empty: {
    container: 'media-empty-state',
    uploadBtn: 'media-empty-upload-btn',
  },

  // Delete confirmation dialog
  deleteConfirm: {
    dialog: 'media-delete-confirm',
    confirmBtn: 'media-delete-confirm-btn',
    cancelBtn: 'media-delete-cancel-btn',
  },

  // Dashboard page
  dashboard: {
    container: 'media-dashboard',
    title: 'media-dashboard-title',
    bulkDeleteBtn: 'media-bulk-delete-btn',
    pagination: 'media-pagination',
    prevPageBtn: 'media-prev-page-btn',
    nextPageBtn: 'media-next-page-btn',
  },

  // Tag filter
  tagFilter: {
    container: 'media-tag-filter',
    trigger: 'media-tag-filter-trigger',
    popover: 'media-tag-filter-popover',
    tag: 'media-tag-filter-tag-{id}',
    activeTag: 'media-tag-filter-active-{id}',
  },
} as const

export type MediaSelectorsType = typeof MEDIA_SELECTORS
