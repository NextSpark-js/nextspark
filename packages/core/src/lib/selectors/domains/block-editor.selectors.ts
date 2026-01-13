/**
 * Block Editor Selectors - 7 First-Level Components
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────────────┐
 * │  HEADER: [←] Title  /slug [↗]    [Editor|Preview]  ●STATUS  [Save] [Publish]    │
 * ├──────────────────────┬───────────────────────────────────┬──────────────────────┤
 * │  [Bloques|Config]    │                                   │  Block Properties    │
 * │  ─────────────────   │         CANVAS                    │  ──────────────────  │
 * │                      │                                   │                      │
 * │  Tab "Bloques":      │   LAYOUT MODE:                    │  [Block Name]        │
 * │   blockPicker        │    layoutCanvas                   │  [Content|Design|Adv]│
 * │   - Search           │    └── sortableBlock (cards)      │                      │7
 * │   - Categories       │                                   │  form                │
 * │   - Block cards      │   PREVIEW MODE:                   │   ├── field          │
 * │                      │    previewCanvas                  │   ├── fieldGroup     │
 * │  Tab "Config":       │    └── floatingToolbar            │   └── arrayField     │
 * │   entityFieldsPanel  │                                   │                      │
 * │   - Entity fields    │   ─────────────────────────────   │                      │
 * │   - Categories       │   entityMetaPanel (en layout)     │                      │
 * │                      │   - SEO settings                  │                      │
 * │                      │   - Custom fields                 │                      │
 * └──────────────────────┴───────────────────────────────────┴──────────────────────┘
 *
 * Components:
 * 1. header              - Top bar (title, slug, toggles, actions, status, locale)
 * 2. blockPicker         - Left col - "Bloques" tab (block selector)
 * 3. entityFieldsPanel   - Left col - "Configuración" tab (entity fields)
 * 4. layoutCanvas        - Center col - Layout mode (draggable cards)
 * 5. previewCanvas       - Center col - Preview mode (real blocks)
 * 6. entityMetaPanel     - Center col - SEO and custom fields (below canvas)
 * 7. blockPropertiesPanel - Right col - Selected block properties
 */

export const BLOCK_EDITOR_SELECTORS = {
  // Main editor container (wraps everything)
  container: 'builder-editor',

  // =========================================================================
  // 1. HEADER - Top bar with title, slug, toggles, and actions
  // =========================================================================
  header: {
    container: 'builder-header',
    backButton: 'builder-back-btn',
    titleWrapper: 'builder-title-wrapper',
    titleInput: 'builder-title-input',
    slugWrapper: 'builder-slug-wrapper',
    slugPrefix: 'builder-slug-prefix',
    slugInput: 'builder-slug-input',
    externalLink: 'builder-external-link',
    viewToggle: 'builder-view-toggle',
    viewEditor: 'builder-view-editor',
    viewPreview: 'builder-view-preview',
    // Status selector (integrated in header)
    statusSelector: 'builder-status-selector',
    statusOption: 'builder-status-option-{value}',
    statusDot: 'builder-status-dot',
    statusLabel: 'builder-status-label',
    // Locale selector (integrated in header)
    localeSelector: 'builder-locale-selector',
    localeOption: 'builder-locale-option-{locale}',
    // Action buttons
    saveButton: 'builder-save-btn',
    publishButton: 'builder-publish-btn',
    settingsButton: 'builder-settings-btn',
  },

  // =========================================================================
  // 2. BLOCK PICKER - Left column "Bloques" tab
  // =========================================================================
  blockPicker: {
    container: 'block-picker',
    // Tabs
    tabBlocks: 'block-picker-tab-blocks',
    tabConfig: 'block-picker-tab-config',
    tabIndicator: 'block-picker-tab-indicator',
    // Search
    searchWrapper: 'block-picker-search-wrapper',
    searchIcon: 'block-picker-search-icon',
    searchInput: 'block-picker-search',
    searchClear: 'block-picker-search-clear',
    // Categories
    categoryChips: 'block-picker-categories',
    categoryChip: 'block-picker-category-{category}',
    categoryActive: 'block-picker-category-active',
    // Block list
    blockList: 'block-picker-list',
    blockCard: 'block-picker-card-{slug}',
    blockIcon: 'block-picker-icon-{slug}',
    blockName: 'block-picker-name-{slug}',
    blockDescription: 'block-picker-desc-{slug}',
    blockCategory: 'block-picker-cat-{slug}',
    addButton: 'block-picker-add-{slug}',
    empty: 'block-picker-empty',
  },

  // =========================================================================
  // 3. ENTITY FIELDS PANEL - Left column "Configuración" tab
  // =========================================================================
  entityFieldsPanel: {
    container: 'entity-fields-panel',
    field: 'entity-field-{name}',
    categoryList: 'entity-field-categories',
    categoryItem: 'entity-field-category-{slug}',
    categoryCheckbox: 'entity-field-category-checkbox-{slug}',
    categoryBadge: 'entity-field-category-badge-{slug}',
  },

  // =========================================================================
  // 4. LAYOUT CANVAS - Center column - Layout mode (draggable cards)
  // =========================================================================
  layoutCanvas: {
    container: 'layout-canvas',
    empty: 'layout-canvas-empty',
    dropZone: 'layout-canvas-dropzone',
    // Sortable block cards (children)
    sortableBlock: {
      container: 'sortable-block-{id}',
      card: 'sortable-block-card-{id}',
      dragHandle: 'sortable-block-drag-{id}',
      name: 'sortable-block-name-{id}',
      category: 'sortable-block-category-{id}',
      propsPreview: 'sortable-block-props-{id}',
      duplicateBtn: 'sortable-block-duplicate-{id}',
      removeBtn: 'sortable-block-remove-{id}',
      error: 'sortable-block-error-{id}',
    },
  },

  // =========================================================================
  // 5. PREVIEW CANVAS - Center column - Preview mode (real blocks)
  // =========================================================================
  previewCanvas: {
    container: 'preview-canvas',
    wrapper: 'preview-canvas-wrapper',
    content: 'preview-canvas-content',
    empty: 'preview-canvas-empty',
    block: 'preview-block-{id}',
    blockWrapper: 'preview-block-wrapper-{id}',
    blockSelected: 'preview-block-selected-{id}',
    editingBadge: 'preview-block-editing-{id}',
    // Floating toolbar (child)
    floatingToolbar: {
      container: 'floating-toolbar-{id}',
      dragHandle: 'floating-toolbar-drag-{id}',
      blockName: 'floating-toolbar-name-{id}',
      divider: 'floating-toolbar-divider-{id}',
      duplicateBtn: 'floating-toolbar-duplicate-{id}',
      deleteBtn: 'floating-toolbar-delete-{id}',
    },
    // Move buttons
    moveUp: 'preview-block-move-up-{id}',
    moveDown: 'preview-block-move-down-{id}',
  },

  // =========================================================================
  // 6. ENTITY META PANEL - Center column (below canvas in layout mode)
  // =========================================================================
  entityMetaPanel: {
    container: 'entity-meta-panel',
    // SEO section
    seoSection: {
      trigger: 'entity-meta-seo-trigger',
      content: 'entity-meta-seo-content',
      metaTitle: 'entity-meta-seo-title',
      metaDescription: 'entity-meta-seo-description',
      metaKeywords: 'entity-meta-seo-keywords',
      ogImage: 'entity-meta-seo-og-image',
    },
    // Custom fields section
    customFields: {
      trigger: 'entity-meta-custom-trigger',
      content: 'entity-meta-custom-content',
      fieldKey: 'entity-meta-custom-key-{index}',
      fieldValue: 'entity-meta-custom-value-{index}',
      fieldRemove: 'entity-meta-custom-remove-{index}',
      addButton: 'entity-meta-custom-add',
    },
  },

  // =========================================================================
  // 7. BLOCK PROPERTIES PANEL - Right column
  // =========================================================================
  blockPropertiesPanel: {
    container: 'block-properties-panel',
    header: 'block-properties-header',
    closeBtn: 'block-properties-close',
    blockIcon: 'block-properties-icon',
    blockName: 'block-properties-name',
    tabs: 'block-properties-tabs',
    tabContent: 'block-properties-tab-content',
    tabDesign: 'block-properties-tab-design',
    tabAdvanced: 'block-properties-tab-advanced',
    empty: 'block-properties-empty',
    error: 'block-properties-error',
    // Dynamic form (child)
    form: {
      container: 'block-properties-form',
      field: 'block-field-{name}',
      fieldGroup: 'block-field-group-{id}',
      // Array field (grandchild)
      arrayField: {
        container: 'block-array-{name}',
        item: 'block-array-{name}-item-{index}',
        itemField: 'block-array-{name}-{index}-{field}',
        itemMoveUp: 'block-array-{name}-{index}-up',
        itemMoveDown: 'block-array-{name}-{index}-down',
        itemRemove: 'block-array-{name}-{index}-remove',
        addButton: 'block-array-{name}-add',
      },
    },
  },

  // =========================================================================
  // POST-SPECIFIC FIELDS (used in entityFieldsPanel for posts)
  // =========================================================================
  postFields: {
    excerpt: 'entity-field-excerpt',
    featuredImage: 'entity-field-featuredImage',
    featuredImageUpload: 'entity-field-featuredImage-upload',
    categories: 'entity-field-categories',
    categoryOption: 'entity-field-category-option-{id}',
    categoryBadge: 'entity-field-category-badge-{id}',
    categoryRemove: 'entity-field-category-remove-{id}',
  },
} as const

export type BlockEditorSelectorsType = typeof BLOCK_EDITOR_SELECTORS
