/**
 * Entities Selectors
 *
 * Dynamic selectors for entity CRUD operations.
 * All selectors use {slug} placeholder for entity type.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * FIRST-LEVEL KEYS ORGANIZATION (6 keys)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. page        - Page-level container
 * 2. list        - List view (search, filters, table, pagination, bulk, confirm)
 * 3. header      - Entity detail header (view/edit/create modes)
 * 4. detail      - Detail view container
 * 5. form        - Form container, fields, and actions
 * 6. childEntity - Child entity management section
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                         ENTITY LIST VIEW LAYOUT                            ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  ┌─────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ [page.container]                                                    │  ║
 * ║  │                                                                     │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ [list.container]                                             │  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌─────────────────────────────────────────────────────────┐│  │  ║
 * ║  │  │  │ Header Row                                              ││  │  ║
 * ║  │  │  │ ┌────────────────┐  ┌───────────────────┐  ┌──────────┐││  │  ║
 * ║  │  │  │ │ Title          │  │ [list.search.*]   │  │[list.add]│││  │  ║
 * ║  │  │  │ │ "Customers"    │  │ 🔍 Search...      │  │  + Add   │││  │  ║
 * ║  │  │  │ └────────────────┘  └───────────────────┘  └──────────┘││  │  ║
 * ║  │  │  └─────────────────────────────────────────────────────────┘│  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌─────────────────────────────────────────────────────────┐│  │  ║
 * ║  │  │  │ [list.filters.*]                                        ││  │  ║
 * ║  │  │  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  ││  │  ║
 * ║  │  │  │ │ Status ▼     │ │ Type ▼       │ │  Clear filters   │  ││  │  ║
 * ║  │  │  │ │ [trigger]    │ │ [trigger]    │ │  [clearAll]      │  ││  │  ║
 * ║  │  │  │ └──────────────┘ └──────────────┘ └──────────────────┘  ││  │  ║
 * ║  │  │  └─────────────────────────────────────────────────────────┘│  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌─────────────────────────────────────────────────────────┐│  │  ║
 * ║  │  │  │ [list.table.*]                                          ││  │  ║
 * ║  │  │  │ ┌───┬───────────────────────────────────────────┬─────┐ ││  │  ║
 * ║  │  │  │ │ ☐ │ Name [column.header] │ Status │ Date      │ ⋮   │ ││  │  ║
 * ║  │  │  │ │[selectAll]│ [sort]       │        │           │     │ ││  │  ║
 * ║  │  │  │ ├───┼───────────────────────────────────────────┼─────┤ ││  │  ║
 * ║  │  │  │ │ ☐ │ [row.element]        │ [cell] │ [cell]    │[menu]│││  │  ║
 * ║  │  │  │ │   │ John Doe             │ Active │ 2024      │     │ ││  │  ║
 * ║  │  │  │ ├───┼───────────────────────────────────────────┼─────┤ ││  │  ║
 * ║  │  │  │ │ ☑ │ [row.element]        │ [cell] │ [cell]    │[menu]│││  │  ║
 * ║  │  │  │ │   │ Jane Smith           │ Pending│ 2024      │     │ ││  │  ║
 * ║  │  │  │ └───┴───────────────────────────────────────────┴─────┘ ││  │  ║
 * ║  │  │  └─────────────────────────────────────────────────────────┘│  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌─────────────────────────────────────────────────────────┐│  │  ║
 * ║  │  │  │ [list.pagination.*]                                     ││  │  ║
 * ║  │  │  │ [info] Showing 1-10 of 50  [prev] [1][2][3] [next]      ││  │  ║
 * ║  │  │  └─────────────────────────────────────────────────────────┘│  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────┘  │  ║
 * ║  └─────────────────────────────────────────────────────────────────────┘  ║
 * ║                                                                            ║
 * ║  ┌─────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ [list.bulk.*] (floating bar, appears when items selected)          │  ║
 * ║  │ ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌───┐   │  ║
 * ║  │ │ [count]    │ │Select All│ │Change Stat.│ │  Delete    │ │ ✕ │   │  ║
 * ║  │ │ "3 items"  │ │[selectAll]│ │[statusBtn] │ │[deleteBtn] │ │   │   │  ║
 * ║  │ └────────────┘ └──────────┘ └────────────┘ └────────────┘ └───┘   │  ║
 * ║  └─────────────────────────────────────────────────────────────────────┘  ║
 * ║                                                                            ║
 * ║  [list.confirm.*] - Generic confirmation dialogs for row actions          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      ENTITY DETAIL/VIEW LAYOUT                             ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  ┌─────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ [detail.container]                                                  │  ║
 * ║  │                                                                     │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ [header.container] mode="view"                               │  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌──────────────────┐                    ┌─────┐ ┌────────┐ │  │  ║
 * ║  │  │  │ [header.back]    │                    │Edit │ │ Delete │ │  │  ║
 * ║  │  │  │ ← Back to List   │                    │[edit]│ │[delete]│ │  │  ║
 * ║  │  │  └──────────────────┘                    └─────┘ └────────┘ │  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌──────────────────────────────────────────────────────┐   │  │  ║
 * ║  │  │  │ [header.title] "Customer: John Doe"                  │   │  │  ║
 * ║  │  │  └──────────────────────────────────────────────────────┘   │  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────┘  │  ║
 * ║  │                                                                     │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ Detail Fields                                                │  │  ║
 * ║  │  │  ┌────────────────────┐  ┌────────────────────┐             │  │  ║
 * ║  │  │  │ Name: John Doe     │  │ Email: john@ex.com │             │  │  ║
 * ║  │  │  └────────────────────┘  └────────────────────┘             │  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────┘  │  ║
 * ║  │                                                                     │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ [childEntity.*] Child Entity Section                         │  │  ║
 * ║  │  │  ┌─────────────────────────────┐  ┌─────────────────┐       │  │  ║
 * ║  │  │  │ Social Platforms            │  │ + Add Platform  │       │  │  ║
 * ║  │  │  │ [container]                 │  │ [addButton]     │       │  │  ║
 * ║  │  │  └─────────────────────────────┘  └─────────────────┘       │  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────┘  │  ║
 * ║  └─────────────────────────────────────────────────────────────────────┘  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      ENTITY CREATE/EDIT LAYOUT                             ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  ┌─────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ [form.container]                                                    │  ║
 * ║  │                                                                     │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ [header.container] mode="create" | mode="edit"               │  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌──────────────────┐                                       │  │  ║
 * ║  │  │  │ [header.back]    │                                       │  │  ║
 * ║  │  │  │ ← Back to List   │                                       │  │  ║
 * ║  │  │  └──────────────────┘                                       │  │  ║
 * ║  │  │                                                              │  │  ║
 * ║  │  │  ┌──────────────────────────────────────────────────────┐   │  │  ║
 * ║  │  │  │ [header.title] "Create Customer" | "Edit: John Doe"  │   │  │  ║
 * ║  │  │  └──────────────────────────────────────────────────────┘   │  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────┘  │  ║
 * ║  │                                                                     │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ Form Fields                                                  │  │  ║
 * ║  │  │  ┌────────────────────┐  ┌────────────────────┐             │  │  ║
 * ║  │  │  │ [form.field] Name  │  │ [form.field] Email │             │  │  ║
 * ║  │  │  │ ┌────────────────┐ │  │ ┌────────────────┐ │             │  │  ║
 * ║  │  │  │ │                │ │  │ │                │ │             │  │  ║
 * ║  │  │  │ └────────────────┘ │  │ └────────────────┘ │             │  │  ║
 * ║  │  │  └────────────────────┘  └────────────────────┘             │  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────┘  │  ║
 * ║  │                                                                     │  ║
 * ║  │  ┌──────────────────────────────────────────────────────────────┐  │  ║
 * ║  │  │ Actions                           ┌────────┐ ┌─────────────┐ │  │  ║
 * ║  │  │                                   │ Cancel │ │ Save/Create │ │  │  ║
 * ║  │  │                                   │        │ │[form.submit]│ │  │  ║
 * ║  │  │                                   └────────┘ └─────────────┘ │  │  ║
 * ║  │  └──────────────────────────────────────────────────────────────┘  │  ║
 * ║  └─────────────────────────────────────────────────────────────────────┘  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Placeholders:
 * - {slug}       - Entity slug (customers, tasks, pages, posts)
 * - {id}         - Record ID
 * - {name}       - Field name
 * - {field}      - Filter field name
 * - {value}      - Filter/option value
 * - {action}     - Action name (edit, delete, view)
 * - {mode}       - View mode (view, edit, create)
 * - {size}       - Page size
 * - {parentSlug} - Parent entity slug
 * - {childName}  - Child entity name
 */

export const ENTITIES_SELECTORS = {
  // =========================================================================
  // 1. PAGE - Page-level container
  // =========================================================================
  page: {
    container: '{slug}-page',
    title: '{slug}-page-title',
  },

  // =========================================================================
  // 2. LIST - Unified list view (search, filters, table, pagination, bulk)
  // =========================================================================
  list: {
    container: '{slug}-list',
    addButton: '{slug}-add',
    selectionCount: '{slug}-selection-count',

    // -----------------------------------------------------------------------
    // 2.1 Search
    // -----------------------------------------------------------------------
    search: {
      container: '{slug}-search',
      input: '{slug}-search-input',
      clear: '{slug}-search-clear',
    },

    // -----------------------------------------------------------------------
    // 2.2 Filters
    // -----------------------------------------------------------------------
    filters: {
      container: '{slug}-filters',
      trigger: '{slug}-filter-{field}',
      content: '{slug}-filter-{field}-content',
      option: '{slug}-filter-{field}-option-{value}',
      badge: '{slug}-filter-{field}-badge-{value}',
      removeBadge: '{slug}-filter-{field}-remove-{value}',
      clearAll: '{slug}-filter-{field}-clear-all',
    },

    // -----------------------------------------------------------------------
    // 2.3 Table
    // -----------------------------------------------------------------------
    table: {
      container: '{slug}-table-container',
      element: '{slug}-table',
      selectAll: '{slug}-select-all',
      empty: '{slug}-table-empty',
      loading: '{slug}-table-loading',

      // Column headers
      column: {
        header: '{slug}-col-{name}',
        sort: '{slug}-sort-{name}',
      },

      // Rows
      row: {
        element: '{slug}-row-{id}',
        checkbox: '{slug}-select-{id}',
        menu: '{slug}-menu-{id}',
        menuContent: '{slug}-menu-content-{id}',
        action: '{slug}-action-{action}-{id}',
        quickAction: '{slug}-quick-{action}-{id}',
      },

      // Cells
      cell: {
        element: '{slug}-cell-{name}-{id}',
      },
    },

    // -----------------------------------------------------------------------
    // 2.4 Pagination
    // -----------------------------------------------------------------------
    pagination: {
      container: '{slug}-pagination',
      info: '{slug}-page-info',
      pageSize: '{slug}-page-size',
      pageSizeOption: '{slug}-page-size-{size}',
      first: '{slug}-page-first',
      prev: '{slug}-page-prev',
      next: '{slug}-page-next',
      last: '{slug}-page-last',
    },

    // -----------------------------------------------------------------------
    // 2.5 Bulk Actions
    // -----------------------------------------------------------------------
    bulk: {
      bar: '{slug}-bulk-bar',
      count: '{slug}-bulk-count',
      selectAll: '{slug}-bulk-select-all',
      // Status change
      statusButton: '{slug}-bulk-status',
      statusDialog: '{slug}-bulk-status-dialog',
      statusSelect: '{slug}-bulk-status-select',
      statusOption: '{slug}-bulk-status-{value}',
      statusCancel: '{slug}-bulk-status-cancel',
      statusConfirm: '{slug}-bulk-status-confirm',
      // Delete
      deleteButton: '{slug}-bulk-delete',
      deleteDialog: '{slug}-bulk-delete-dialog',
      deleteCancel: '{slug}-bulk-delete-cancel',
      deleteConfirm: '{slug}-bulk-delete-confirm',
      // Clear selection
      clearButton: '{slug}-bulk-clear',
    },

    // -----------------------------------------------------------------------
    // 2.6 Confirm Dialogs (for row actions)
    // -----------------------------------------------------------------------
    confirm: {
      dialog: '{slug}-confirm-dialog',
      cancel: '{slug}-confirm-cancel',
      action: '{slug}-confirm-action',
    },
  },

  // =========================================================================
  // 3. HEADER - Entity detail header (view/edit/create modes)
  // =========================================================================
  header: {
    container: '{slug}-{mode}-header',
    backButton: '{slug}-back',
    title: '{slug}-header-title',
    // Actions (view mode)
    editButton: '{slug}-edit',
    deleteButton: '{slug}-delete',
    // Delete confirmation
    deleteDialog: '{slug}-delete-dialog',
    deleteCancel: '{slug}-delete-cancel',
    deleteConfirm: '{slug}-delete-confirm',
  },

  // =========================================================================
  // 4. DETAIL - Detail view container
  // =========================================================================
  detail: {
    container: '{slug}-detail',
    copyId: '{slug}-copy-id',
  },

  // =========================================================================
  // 5. FORM - Form container, fields, and actions
  // =========================================================================
  form: {
    container: '{slug}-form',
    field: '{slug}-field-{name}',
    /** One choice of a select / radio field, once its list is open. */
    fieldOption: '{slug}-field-{name}-option-{value}',
    submitButton: '{slug}-form-submit',
  },

  // =========================================================================
  // 6. CHILD ENTITY - Child entity management section
  // =========================================================================
  childEntity: {
    container: '{parentSlug}-{childName}-section',
    addButton: '{parentSlug}-{childName}-add',
  },
} as const

export type EntitiesSelectorsType = typeof ENTITIES_SELECTORS
