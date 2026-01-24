/**
 * Block Editor Selectors - 7 First-Level Components (v2.0 - UX Redesign)
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 * │  HEADER: [←] [Title...............] [/slug.........] [Preview|Settings] [📱|🖥️]* ●STATUS│
 * │          ←────────── dynamic width ─────────────────→                    *only Preview  │
 * ├───────────────────────┬─────────────────────────────────────────┬───────────────────────┤
 * │  LEFT COLUMN          │            CENTER COLUMN                │    RIGHT COLUMN       │
 * │  [Blocks|Patterns|    │                                         │    Block Properties   │
 * │   Layout]             │   IF TAB = "Preview":                   │    ─────────────────  │
 * │  ───────────────────  │    previewCanvas                        │                       │
 * │                       │    ├── viewport: 375px (mobile)         │    [Block Name]       │
 * │  Tab "Blocks":        │    │              100% (desktop)        │    [Content|Design|   │
 * │   blockPicker         │    └── floatingToolbar                  │     Advanced]         │
 * │   - Search            │                                         │                       │
 * │   - Categories        │   IF TAB = "Settings":                  │    form               │
 * │   - Block cards       │    configPanel (single scroll)          │     ├── field         │
 * │                       │    ├── entityFieldsSection (collapsible)│     ├── fieldGroup    │
 * │  Tab "Patterns":      │    └── seoMetaSection (collapsible)     │     └── arrayField    │
 * │   (patterns list)     │                                         │                       │
 * │                       │                                         │                       │
 * │  Tab "Layout": ←NEW   │                                         │                       │
 * │   treeView            │                                         │                       │
 * │   ├── treeNode        │                                         │                       │
 * │   └── (drag & drop)   │                                         │                       │
 * └───────────────────────┴─────────────────────────────────────────┴───────────────────────┘
 *
 * Components:
 * 1. header              - Top bar (title, slug, view tabs, viewport toggle, status, actions)
 * 2. blockPicker         - Left col - "Blocks" tab (block selector)
 * 3. treeView            - Left col - "Layout" tab (block tree structure) [NEW]
 * 4. previewCanvas       - Center col - Preview mode (real blocks with responsive viewport)
 * 5. configPanel         - Center col - Settings mode (entity fields + SEO/meta) [NEW]
 * 6. blockPropertiesPanel - Right col - Selected block properties
 *
 * DEPRECATED (kept for backward compatibility):
 * - layoutCanvas         - Replaced by treeView in left column
 * - entityFieldsPanel    - Moved into configPanel
 * - entityMetaPanel      - Moved into configPanel
 */

export const BLOCK_EDITOR_SELECTORS = {
  // Main editor container (wraps everything)
  container: 'builder-editor',

  // =========================================================================
  // 1. HEADER - Top bar with title, slug, view tabs, viewport toggle, actions
  // =========================================================================
  header: {
    container: 'builder-header',
    backButton: 'builder-back-btn',
    // Title input (dynamic width)
    titleWrapper: 'builder-title-wrapper',
    titleInput: 'builder-title-input',
    // Slug input (dynamic width)
    slugWrapper: 'builder-slug-wrapper',
    slugPrefix: 'builder-slug-prefix',
    slugInput: 'builder-slug-input',
    externalLink: 'builder-external-link',
    // View mode tabs (Preview | Settings)
    viewToggle: 'builder-view-toggle',
    viewPreview: 'builder-view-preview',
    viewSettings: 'builder-view-settings',
    // Viewport toggle (mobile/desktop) - only visible in Preview mode
    viewportToggle: {
      container: 'builder-viewport-toggle',
      mobileBtn: 'builder-viewport-mobile',
      desktopBtn: 'builder-viewport-desktop',
    },
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
  // 2. BLOCK PICKER - Left column "Blocks" tab
  // =========================================================================
  blockPicker: {
    container: 'block-picker',
    // Tabs (Blocks | Patterns | Layout)
    tabBlocks: 'block-picker-tab-blocks',
    tabPatterns: 'block-picker-tab-patterns',
    tabLayout: 'block-picker-tab-layout',
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
    // Patterns tab
    patternsSearchWrapper: 'block-picker-patterns-search-wrapper',
    patternsSearchIcon: 'block-picker-patterns-search-icon',
    patternsSearch: 'block-picker-patterns-search',
    patternsList: 'block-picker-patterns-list',
    patternsEmpty: 'block-picker-patterns-empty',
    patternCard: 'block-picker-pattern-card-{id}',
    patternCardIcon: 'block-picker-pattern-icon-{id}',
    patternCardTitle: 'block-picker-pattern-title-{id}',
    patternCardDescription: 'block-picker-pattern-desc-{id}',
    patternCardBlockCount: 'block-picker-pattern-blocks-{id}',
    patternCardInsertButton: 'block-picker-pattern-insert-{id}',
  },

  // =========================================================================
  // 3. TREE VIEW - Left column "Layout" tab (NEW)
  // =========================================================================
  treeView: {
    container: 'builder-tree-view',
    empty: 'builder-tree-empty',
    // Tree nodes
    node: 'builder-tree-node-{id}',
    nodeIcon: 'builder-tree-node-icon-{id}',
    nodeName: 'builder-tree-node-name-{id}',
    nodeDragHandle: 'builder-tree-node-drag-{id}',
    nodeSelected: 'builder-tree-node-selected',
    // Pattern groups (blocks from same pattern shown grouped)
    patternGroup: 'builder-tree-pattern-{ref}',
    patternGroupHeader: 'builder-tree-pattern-header-{ref}',
    patternGroupBlocks: 'builder-tree-pattern-blocks-{ref}',
  },

  // =========================================================================
  // 4. PREVIEW CANVAS - Center column - Preview mode (responsive viewport)
  // =========================================================================
  previewCanvas: {
    container: 'preview-canvas',
    wrapper: 'preview-canvas-wrapper',
    content: 'preview-canvas-content',
    empty: 'preview-canvas-empty',
    // Viewport wrapper (for container queries responsive preview)
    viewport: 'preview-canvas-viewport-{mode}',
    // Viewport modes
    viewportMobile: 'preview-canvas-mobile',
    viewportDesktop: 'preview-canvas-desktop',
    // Iframe preview (for mobile - real viewport simulation)
    iframePreview: {
      container: 'preview-iframe-container',
      loading: 'preview-iframe-loading',
      frame: 'preview-iframe-frame',
    },
    // Blocks
    block: 'preview-block-{id}',
    blockWrapper: 'preview-block-wrapper-{id}',
    blockSelected: 'preview-block-selected-{id}',
    editingBadge: 'preview-block-editing-{id}',
    // Generic selector prefix for counting blocks
    blockGeneric: 'preview-block-',
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
  // 5. CONFIG PANEL - Center column - Settings mode (NEW)
  // =========================================================================
  configPanel: {
    container: 'builder-config-panel',
    scroll: 'builder-config-scroll',
    // Entity Fields section (collapsible)
    entityFieldsSection: {
      container: 'builder-config-entity-section',
      trigger: 'builder-config-entity-trigger',
      content: 'builder-config-entity-content',
      field: 'builder-config-entity-field-{name}',
    },
    // SEO & Meta section (collapsible)
    seoMetaSection: {
      container: 'builder-config-seo-section',
      trigger: 'builder-config-seo-trigger',
      content: 'builder-config-seo-content',
      metaTitle: 'builder-config-seo-title',
      metaDescription: 'builder-config-seo-description',
      metaKeywords: 'builder-config-seo-keywords',
      ogImage: 'builder-config-seo-og-image',
      // Custom fields
      customFields: {
        container: 'builder-config-custom-fields',
        fieldKey: 'builder-config-custom-key-{index}',
        fieldValue: 'builder-config-custom-value-{index}',
        fieldRemove: 'builder-config-custom-remove-{index}',
        addButton: 'builder-config-custom-add',
      },
    },
  },

  // =========================================================================
  // PATTERN REFERENCE - Pattern reference rendering in canvas
  // =========================================================================
  patternReference: {
    container: 'pattern-reference-{ref}',
    badge: 'pattern-reference-badge-{ref}',
    remove: 'pattern-reference-remove-{ref}',
    locked: 'pattern-reference-locked-{ref}',
    editLink: 'pattern-reference-edit-link-{ref}',
  },

  // =========================================================================
  // 6. BLOCK PROPERTIES PANEL - Right column
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
    // Reset props button
    resetPropsBtn: 'block-properties-reset-btn',
    // Pattern reference (when a pattern is selected)
    patternLocked: 'block-properties-pattern-locked',
    patternTitle: 'block-properties-pattern-title',
    patternEditLink: 'block-properties-pattern-edit',
    patternRemoveBtn: 'block-properties-pattern-remove',
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
  // POST-SPECIFIC FIELDS (used in configPanel.entityFieldsSection for posts)
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

  // =========================================================================
  // DEPRECATED - Kept for backward compatibility
  // =========================================================================
  /** @deprecated Use treeView instead - layoutCanvas functionality moved to left column */
  layoutCanvas: {
    container: 'layout-canvas',
    empty: 'layout-canvas-empty',
    dropZone: 'layout-canvas-dropzone',
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
      // Generic selector prefix for counting blocks
      generic: 'sortable-block-',
    },
  },

  /** @deprecated Use configPanel.entityFieldsSection instead */
  entityFieldsPanel: {
    container: 'entity-fields-panel',
    field: 'entity-field-{name}',
    categoryList: 'entity-field-categories',
    categoryItem: 'entity-field-category-{slug}',
    categoryCheckbox: 'entity-field-category-checkbox-{slug}',
    categoryBadge: 'entity-field-category-badge-{slug}',
  },

  /** @deprecated Use configPanel.seoMetaSection instead */
  entityMetaPanel: {
    container: 'entity-meta-panel',
    seoSection: {
      trigger: 'entity-meta-seo-trigger',
      content: 'entity-meta-seo-content',
      metaTitle: 'entity-meta-seo-title',
      metaDescription: 'entity-meta-seo-description',
      metaKeywords: 'entity-meta-seo-keywords',
      ogImage: 'entity-meta-seo-og-image',
    },
    customFields: {
      trigger: 'entity-meta-custom-trigger',
      content: 'entity-meta-custom-content',
      fieldKey: 'entity-meta-custom-key-{index}',
      fieldValue: 'entity-meta-custom-value-{index}',
      fieldRemove: 'entity-meta-custom-remove-{index}',
      addButton: 'entity-meta-custom-add',
    },
  },
} as const

export type BlockEditorSelectorsType = typeof BLOCK_EDITOR_SELECTORS
