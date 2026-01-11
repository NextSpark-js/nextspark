/**
 * Core Selectors
 *
 * Single source of truth for all data-cy selectors in core components.
 * Themes can import and extend these selectors.
 *
 * Naming conventions:
 * - Static selectors: "domain-element" (e.g., "nav-main", "login-form")
 * - Dynamic selectors: "domain-element-{placeholder}" (e.g., "{slug}-row-{id}")
 *
 * Placeholders:
 * - {slug} - Entity slug (customers, tasks, pages, posts)
 * - {id} - Record ID
 * - {name} - Field name
 * - {section} - Settings section name
 * - {action} - Action name (edit, delete, view)
 * - {value} - Filter/option value
 * - {index} - Array index
 * - {mode} - View mode (view, edit, create)
 */

export const CORE_SELECTORS = {
  // ===========================================================================
  // AUTH
  // ===========================================================================
  auth: {
    login: {
      // Structure
      card: 'login-form-card',
      header: 'login-header',
      footer: 'login-footer',
      form: 'login-form',
      options: 'login-options',
      // Inputs
      emailInput: 'login-email-input',
      passwordInput: 'login-password-input',
      emailError: 'login-email-error',
      passwordError: 'login-password-error',
      // Buttons
      submit: 'login-submit',
      googleSignin: 'login-google-signin',
      showEmail: 'login-show-email',
      hideEmail: 'login-hide-email',
      // Links
      forgotPassword: 'login-forgot-password',
      signupLink: 'login-signup-link',
      // Misc
      inviteBanner: 'login-invite-banner',
      errorAlert: 'login-error-alert',
      rememberCheckbox: 'login-remember-checkbox',
    },
    signup: {
      form: 'signup-form',
      firstName: 'signup-first-name',
      lastName: 'signup-last-name',
      email: 'signup-email',
      password: 'signup-password',
      confirmPassword: 'signup-confirm-password',
      submitButton: 'signup-submit',
      googleButton: 'signup-google',
      loginLink: 'signup-login-link',
      inviteBanner: 'signup-invite-banner',
      error: 'signup-error',
    },
    forgotPassword: {
      form: 'forgot-password-form',
      email: 'forgot-password-email',
      submitButton: 'forgot-password-submit',
      backToLogin: 'forgot-password-back',
      successMessage: 'forgot-password-success',
      successBack: 'forgot-password-success-back',
      retryButton: 'forgot-password-retry',
      error: 'forgot-password-error',
    },
    resetPassword: {
      form: 'reset-password-form',
      password: 'reset-password-password',
      confirmPassword: 'reset-password-confirm',
      submitButton: 'reset-password-submit',
      error: 'reset-password-error',
      success: 'reset-password-success',
      loginLink: 'reset-password-login-link',
      backToLogin: 'reset-password-back',
    },
    verifyEmail: {
      container: 'verify-email-container',
      resendButton: 'verify-email-resend',
      successMessage: 'verify-email-success',
      error: 'verify-email-error',
    },
    devKeyring: {
      container: 'devkeyring-container',
      trigger: 'devkeyring-trigger',
      content: 'devkeyring-content',
      user: 'devkeyring-user-{index}',
    },
  },

  // ===========================================================================
  // DASHBOARD - Shell & TopNav
  // ===========================================================================
  dashboard: {
    shell: {
      container: 'dashboard-container',
      quickCreateButton: 'topnav-quick-create-button',
      quickCreateDropdown: 'topnav-quick-create-dropdown',
      quickCreateLink: 'quick-create-{slug}-link',
    },
    topnav: {
      sidebarToggle: 'topnav-sidebar-toggle',
      header: 'topnav-header',
      logo: 'topnav-logo',
      searchSection: 'topnav-search-section',
      actions: 'topnav-actions',
      notifications: 'topnav-notifications',
      help: 'topnav-help',
      themeToggle: 'topnav-theme-toggle',
      superadmin: 'topnav-superadmin',
      devtools: 'topnav-devtools',
      userMenuTrigger: 'topnav-user-menu-trigger',
      userMenu: 'topnav-user-menu',
      menuItem: 'topnav-menu-{icon}',
      menuAction: 'topnav-menu-{action}',
      userLoading: 'topnav-user-loading',
      signin: 'topnav-signin',
      signup: 'topnav-signup',
      // Mobile
      mobileActions: 'topnav-mobile-actions',
      mobileMenuToggle: 'topnav-mobile-menu-toggle',
      mobileMenu: 'topnav-mobile-menu',
      mobileUserInfo: 'topnav-mobile-user-info',
      mobileLinkProfile: 'topnav-mobile-link-profile',
      mobileLinkSettings: 'topnav-mobile-link-settings',
      mobileLinkBilling: 'topnav-mobile-link-billing',
      mobileSignout: 'topnav-mobile-signout',
      mobileNavSuperadmin: 'topnav-mobile-nav-superadmin',
      mobileNavDevtools: 'topnav-mobile-nav-devtools',
    },
    sidebar: {
      main: 'sidebar-main',
      header: 'sidebar-header',
      content: 'sidebar-content',
      footer: 'sidebar-footer',
    },
    navigation: {
      main: 'nav-main',
      dashboardLink: 'nav-link-dashboard',
      entityLink: 'nav-link-entity-{slug}',
      section: 'nav-section-{id}',
      sectionLabel: 'nav-section-label-{id}',
      sectionItem: 'nav-section-item-{sectionId}-{itemId}',
    },
    // Mobile components
    mobile: {
      topbar: {
        header: 'mobile-topbar-header',
        userProfile: 'mobile-topbar-user-profile',
        notifications: 'mobile-topbar-notifications',
        themeToggle: 'mobile-topbar-theme-toggle',
      },
      bottomNav: {
        nav: 'mobile-bottomnav-nav',
        item: 'mobile-bottomnav-item-{id}',
      },
      moreSheet: {
        content: 'mobile-more-sheet-content',
        item: 'mobile-more-sheet-item-{id}',
        superadminLink: 'mobile-more-sheet-superadmin-link',
        teamSwitcher: 'mobile-more-sheet-team-switcher',
        signoutButton: 'mobile-more-sheet-signout-button',
      },
      quickCreateSheet: {
        content: 'mobile-quick-create-sheet-content',
        item: 'mobile-quick-create-sheet-item-{slug}',
      },
    },
  },

  // ===========================================================================
  // DASHBOARD - Entities (Dynamic with {slug})
  // ===========================================================================
  entities: {
    page: {
      container: '{slug}-page',
      title: '{slug}-title',
    },
    list: {
      container: '{slug}-list',
    },
    table: {
      container: '{slug}-table-container',
      element: '{slug}-table',
      search: '{slug}-search',
      addButton: '{slug}-add',
      selectionCount: '{slug}-selection-count',
      selectAll: '{slug}-select-all',
      row: '{slug}-row-{id}',
      rowSelect: '{slug}-select-{id}',
      cell: '{slug}-cell-{field}-{id}',
      rowMenu: '{slug}-menu-{id}',
      rowActionsMenu: '{slug}-actions-{id}',
      rowAction: '{slug}-menu-{action}-{id}',
      quickAction: '{slug}-quick-{action}-{id}',
    },
    pagination: {
      container: '{slug}-pagination',
      pageSize: '{slug}-page-size',
      pageSizeOption: '{slug}-page-size-{size}',
      pageInfo: '{slug}-page-info',
      first: '{slug}-page-first',
      prev: '{slug}-page-prev',
      next: '{slug}-page-next',
      last: '{slug}-page-last',
    },
    bulk: {
      bar: '{slug}-bulk-bar',
      count: '{slug}-bulk-count',
      selectAll: '{slug}-bulk-select-all',
      statusButton: '{slug}-bulk-status',
      deleteButton: '{slug}-bulk-delete',
      clearButton: '{slug}-bulk-clear',
      statusDialog: '{slug}-bulk-status-dialog',
      statusSelect: '{slug}-bulk-status-select',
      statusOption: '{slug}-bulk-status-option-{value}',
      statusCancel: '{slug}-bulk-status-cancel',
      statusConfirm: '{slug}-bulk-status-confirm',
      deleteDialog: '{slug}-bulk-delete-dialog',
      deleteCancel: '{slug}-bulk-delete-cancel',
      deleteConfirm: '{slug}-bulk-delete-confirm',
    },
    header: {
      container: '{slug}-{mode}-header',
      backButton: '{slug}-back-btn',
      title: '{slug}-title',
      copyId: '{slug}-copy-id',
      editButton: '{slug}-edit-btn',
      deleteButton: '{slug}-delete-btn',
      deleteDialog: '{slug}-delete-dialog',
      deleteCancel: '{slug}-delete-cancel',
      deleteConfirm: '{slug}-delete-confirm',
    },
    detail: {
      container: '{slug}-detail',
    },
    form: {
      container: '{slug}-form',
      field: '{slug}-field-{name}',
      submitButton: '{slug}-form-submit',
      cancelButton: '{slug}-form-cancel',
    },
    filter: {
      container: '{slug}-filter-{field}',
      trigger: '{slug}-filter-{field}-trigger',
      content: '{slug}-filter-{field}-content',
      option: '{slug}-filter-{field}-option-{value}',
      badge: '{slug}-filter-{field}-badge-{value}',
      removeBadge: '{slug}-filter-{field}-remove-{value}',
      clearAll: '{slug}-filter-{field}-clear-all',
    },
    search: {
      container: '{slug}-search',
      icon: '{slug}-search-icon',
      input: '{slug}-search-input',
      clear: '{slug}-search-clear',
    },
    confirm: {
      dialog: '{slug}-confirm-dialog',
      cancel: '{slug}-confirm-cancel',
      action: '{slug}-confirm-action',
    },
    childEntity: {
      container: '{parentSlug}-{childName}-container',
      addButton: '{parentSlug}-{childName}-add-button',
    },
  },

  // ===========================================================================
  // DASHBOARD - Global Search
  // ===========================================================================
  globalSearch: {
    modal: 'search-modal',
    trigger: 'search-trigger',
    input: 'search-input',
    results: 'search-results',
    result: 'search-result',
  },

  // ===========================================================================
  // DASHBOARD - Taxonomies (Categories, Tags, etc.)
  // ===========================================================================
  taxonomies: {
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
  },

  // ===========================================================================
  // DASHBOARD - Teams
  // ===========================================================================
  teams: {
    switcher: {
      compact: 'team-switcher-compact',
      full: 'team-switcher',
      dropdown: 'team-switcher-dropdown',
      option: 'team-option-{slug}',
      manageLink: 'manage-teams-link',
      createButton: 'create-team-button',
    },
    switchModal: {
      container: 'team-switch-modal',
    },
    create: {
      dialog: 'create-team-dialog',
      button: 'create-team-button',
      nameInput: 'team-name-input',
      slugInput: 'team-slug-input',
      descriptionInput: 'team-description-input',
      cancel: 'cancel-create-team',
      submit: 'submit-create-team',
    },
    /**
     * Inline editing for team name and description
     *
     * Note on selector structure: The name and description fields have separate
     * selector definitions rather than using a dynamic pattern. This is an intentional
     * design decision because:
     * 1. There are only 2 fields (name and description), making duplication minimal
     * 2. Each field has different input types (Input vs Textarea) with distinct selectors
     * 3. Explicit definitions provide better clarity and type safety
     * 4. The small duplication cost is outweighed by improved readability
     *
     * Decision documented in PR #1 code review (Issue #9).
     */
    edit: {
      // Name field - inline (v1.1)
      name: {
        value: 'team-edit-name-value',
        editIcon: 'team-edit-name-edit-icon',
        input: 'team-edit-name-input',
        saveIcon: 'team-edit-name-save-icon',
        cancelIcon: 'team-edit-name-cancel-icon',
        error: 'team-edit-name-error',
      },
      // Description field - inline (v1.1)
      description: {
        value: 'team-edit-description-value',
        editIcon: 'team-edit-description-edit-icon',
        textarea: 'team-edit-description-textarea',
        saveIcon: 'team-edit-description-save-icon',
        cancelIcon: 'team-edit-description-cancel-icon',
        error: 'team-edit-description-error',
      },
      // Shared feedback
      success: 'team-edit-success',
      error: 'team-edit-error',
    },
    members: {
      section: 'team-members-section',
      row: 'member-row-{id}',
      actions: 'member-actions-{id}',
      makeRole: 'make-{role}-action',
      remove: 'remove-member-action',
    },
    invite: {
      button: 'invite-member-button',
      buttonDisabled: 'invite-member-button-disabled',
      dialog: 'invite-member-dialog',
      emailInput: 'member-email-input',
      roleSelect: 'member-role-select',
      roleOption: 'role-option-{role}',
      cancel: 'cancel-invite-member',
      submit: 'submit-invite-member',
    },
    invitations: {
      row: 'invitation-row-{id}',
      cancel: 'cancel-invitation-{id}',
    },
  },

  // ===========================================================================
  // DASHBOARD - Block Editor (Pages & Posts)
  // ===========================================================================
  blockEditor: {
    container: 'builder-editor',
    titleInput: 'editor-title-input',
    slugInput: 'editor-slug-input',
    saveButton: 'save-btn',
    statusBadge: 'status-badge',
    leftSidebarToggle: 'left-sidebar-toggle',
    viewModeToggle: 'view-mode-toggle',

    blockPicker: {
      container: 'block-picker',
      searchInput: 'block-search-input',
      categoryAll: 'category-all',
      category: 'category-{category}',
      blockItem: 'block-item-{slug}',
      addBlock: 'add-block-{slug}',
    },

    blockCanvas: {
      container: 'block-preview-canvas',
      empty: 'block-preview-canvas-empty',
    },

    previewCanvas: {
      container: 'block-preview-canvas',
      empty: 'block-preview-canvas-empty',
      block: 'preview-block-{id}',
      moveUp: 'preview-block-{id}-move-up',
      moveDown: 'preview-block-{id}-move-down',
    },

    sortableBlock: {
      container: 'sortable-block-{id}',
      dragHandle: 'drag-handle-{id}',
      duplicate: 'duplicate-block-{id}',
      remove: 'remove-block-{id}',
      error: 'block-error-{id}',
    },

    settingsPanel: {
      container: 'block-settings-panel',
      empty: 'settings-panel-empty',
      error: 'settings-panel-error',
      resetProps: 'reset-block-props',
      removeBlock: 'remove-block-settings',
      tabContent: 'tab-content',
      tabDesign: 'tab-design',
      tabAdvanced: 'tab-advanced',
    },

    pageSettings: {
      container: 'page-settings-panel',
      seoTrigger: 'seo-settings-trigger',
      metaTitle: 'seo-meta-title',
      metaDescription: 'seo-meta-description',
      metaKeywords: 'seo-meta-keywords',
      ogImage: 'seo-og-image',
      customFieldsTrigger: 'custom-fields-trigger',
      customFieldKey: 'custom-field-key-{index}',
      customFieldValue: 'custom-field-value-{index}',
      customFieldRemove: 'custom-field-remove-{index}',
      addCustomField: 'add-custom-field',
    },

    statusSelector: {
      trigger: 'status-selector',
      option: 'status-option-{value}',
    },

    dynamicForm: {
      container: 'dynamic-form',
      field: 'field-{name}',
      fieldGroup: 'field-group-{id}',
      arrayGroup: 'array-group-{name}',
    },

    arrayField: {
      container: 'array-field-{name}',
      item: 'array-field-{name}-{index}-{field}',
      moveUp: 'array-field-{name}-{index}-move-up',
      moveDown: 'array-field-{name}-{index}-move-down',
      remove: 'array-field-{name}-{index}-remove',
      add: 'array-field-{name}-add',
    },

    entityFieldsSidebar: {
      container: 'entity-fields-sidebar',
      field: 'field-{name}',
      category: 'category-{slug}',
    },

    // Post-specific fields
    postFields: {
      excerpt: 'field-excerpt',
      featuredImage: 'field-featuredImage',
      featuredImageUpload: 'field-featuredImage-upload',
      categories: 'field-categories',
      categoryOption: 'category-option-{id}',
      categoryBadge: 'category-badge-{id}',
      categoryRemove: 'category-remove-{id}',
    },

    // Page/Post locale field
    localeField: {
      select: 'field-locale',
      option: 'locale-option-{locale}',
    },
  },

  // ===========================================================================
  // SETTINGS
  // ===========================================================================
  settings: {
    layout: {
      main: 'settings-layout-main',
      nav: 'settings-layout-nav',
      backToDashboard: 'settings-layout-back-to-dashboard',
      header: 'settings-layout-header',
      contentArea: 'settings-layout-content-area',
      sidebar: 'settings-layout-sidebar',
      pageContent: 'settings-layout-page-content',
    },
    sidebar: {
      main: 'settings-sidebar-main',
      header: 'settings-sidebar-header',
      navItems: 'settings-sidebar-nav-items',
      navItem: 'settings-sidebar-nav-{section}',
    },
    overview: {
      container: 'settings-overview',
      item: 'settings-overview-{key}',
    },
    profile: {
      container: 'settings-profile',
      form: 'profile-form',
      avatar: 'profile-avatar',
      avatarUpload: 'profile-avatar-upload',
      firstName: 'profile-first-name',
      lastName: 'profile-last-name',
      email: 'profile-email',
      submitButton: 'profile-submit',
      successMessage: 'profile-success',
    },
    password: {
      container: 'settings-password',
      form: 'password-form',
      currentPassword: 'password-current',
      newPassword: 'password-new',
      confirmPassword: 'password-confirm',
      submitButton: 'password-submit',
      successMessage: 'password-success',
    },
    team: {
      container: 'settings-team',
      name: 'team-name',
      slug: 'team-slug',
      description: 'team-description',
      avatar: 'team-avatar',
      avatarUpload: 'team-avatar-upload',
      submitButton: 'team-submit',
      deleteButton: 'team-delete',
      deleteDialog: 'team-delete-dialog',
      deleteConfirm: 'team-delete-confirm',
    },
    members: {
      container: 'settings-members',
      inviteButton: 'members-invite',
      inviteDialog: 'members-invite-dialog',
      inviteEmail: 'members-invite-email',
      inviteRole: 'members-invite-role',
      inviteSubmit: 'members-invite-submit',
      memberRow: 'member-row-{id}',
      memberRole: 'member-role-{id}',
      memberRemove: 'member-remove-{id}',
      pendingInvites: 'members-pending-invites',
      pendingInvite: 'pending-invite-{id}',
      cancelInvite: 'cancel-invite-{id}',
    },
    billing: {
      container: 'settings-billing',
      main: 'billing-main',
      header: 'billing-header',
      currentPlan: 'billing-current-plan',
      upgradeButton: 'billing-upgrade',
      upgradePlan: 'billing-upgrade-plan',
      cancelButton: 'billing-cancel',
      addPayment: 'billing-add-payment',
      invoicesTable: 'billing-invoices',
      invoicesTableAlt: 'invoices-table',
      invoiceRow: 'invoice-row-{id}',
      invoicesRow: 'invoices-row',
      invoiceDownload: 'invoice-download-{id}',
      invoicesLoadMore: 'invoices-load-more',
      invoiceStatusBadge: 'invoice-status-badge',
      paymentMethod: 'billing-payment-method',
      paymentMethodAlt: 'payment-method',
      updatePayment: 'billing-update-payment',
      usage: 'billing-usage',
      usageDashboard: 'usage-dashboard',
    },
    pricing: {
      table: 'pricing-table',
      settingsTable: 'pricing-settings-table',
    },
    features: {
      placeholder: 'feature-placeholder-{feature}',
      content: '{feature}-content',
      placeholderUpgradeBtn: 'placeholder-upgrade-btn',
    },
    apiKeys: {
      page: 'api-keys-page',
      title: 'api-keys-title',
      container: 'settings-api-keys',
      createButton: 'api-keys-create-button',
      createDialog: 'api-keys-create-dialog',
      list: 'api-keys-list',
      skeleton: 'api-keys-skeleton',
      empty: 'api-keys-empty',
      emptyCreateButton: 'api-keys-empty-create-button',
      keyName: 'api-key-name',
      keyScopes: 'api-key-scopes',
      scopeOption: 'api-key-scope-{scope}',
      createSubmit: 'api-key-create-submit',
      keyRow: 'api-key-row-{id}',
      keyName_: 'api-keys-name-{id}',
      keyPrefix: 'api-keys-prefix-{id}',
      copyPrefix: 'api-keys-copy-prefix-{id}',
      keyStatus: 'api-keys-status-{id}',
      statusBadge: 'api-keys-status-badge-{id}',
      menuTrigger: 'api-keys-menu-trigger-{id}',
      menu: 'api-keys-menu-{id}',
      viewDetails: 'api-keys-view-details-{id}',
      toggle: 'api-keys-toggle-{id}',
      revoke: 'api-keys-revoke-{id}',
      scopes: 'api-keys-scopes-{id}',
      scope: 'api-keys-scope-{id}-{scope}',
      stats: 'api-keys-stats-{id}',
      totalRequests: 'api-keys-total-requests-{id}',
      last24h: 'api-keys-last-24h-{id}',
      avgTime: 'api-keys-avg-time-{id}',
      metadata: 'api-keys-metadata-{id}',
      createdAt: 'api-keys-created-at-{id}',
      lastUsed: 'api-keys-last-used-{id}',
      expiresAt: 'api-keys-expires-at-{id}',
      detailsDialog: 'api-keys-details-dialog',
      detailsTitle: 'api-keys-details-title',
      detailsLoading: 'api-keys-details-loading',
      detailsContent: 'api-keys-details-content',
      detailsBasicInfo: 'api-keys-details-basic-info',
      detailsName: 'api-keys-details-name',
      detailsStatus: 'api-keys-details-status',
      detailsStats: 'api-keys-details-stats',
      detailsTotalRequests: 'api-keys-details-total-requests',
      detailsLast24h: 'api-keys-details-last-24h',
      detailsLast7d: 'api-keys-details-last-7d',
      detailsLast30d: 'api-keys-details-last-30d',
      detailsAvgTime: 'api-keys-details-avg-time',
      detailsSuccessRate: 'api-keys-details-success-rate',
      keyReveal: 'api-key-reveal-{id}',
      keyRevoke: 'api-key-revoke-{id}',
      revokeDialog: 'api-key-revoke-dialog',
      revokeConfirm: 'api-key-revoke-confirm',
      newKeyDisplay: 'api-key-new-display',
      copyKey: 'api-key-copy',
      dialogFooter: 'api-keys-dialog-footer',
    },
    notifications: {
      container: 'settings-notifications',
      emailToggle: 'notifications-email',
      pushToggle: 'notifications-push',
      category: 'notifications-{category}',
      submitButton: 'notifications-submit',
    },
    teams: {
      main: 'teams-settings-main',
      header: 'teams-settings-header',
      loading: 'teams-settings-loading',
      singleUser: 'teams-settings-single-user',
      teamsList: 'teams-settings-teams-list',
      teamDetails: 'teams-settings-team-details',
    },
    plans: {
      main: 'plans-settings-main',
      header: 'plans-settings-header',
      table: 'plans-settings-table',
    },
  },

  // ===========================================================================
  // SUPERADMIN (Super Admin Panel)
  // ===========================================================================
  superadmin: {
    container: 'superadmin-container',
    navigation: {
      dashboard: 'superadmin-nav-dashboard',
      users: 'superadmin-nav-users',
      teams: 'superadmin-nav-teams',
      teamRoles: 'superadmin-nav-team-roles',
      docs: 'superadmin-nav-docs',
      subscriptions: 'superadmin-nav-subscriptions',
      analytics: 'superadmin-nav-analytics',
      config: 'superadmin-nav-config',
      exitToDashboard: 'superadmin-sidebar-exit-to-dashboard',
    },
    dashboard: {
      container: 'superadmin-dashboard',
    },
    users: {
      container: 'superadmin-users-container',
      table: 'superadmin-users-table',
      search: 'superadmin-users-search',
      row: 'superadmin-user-row-{id}',
      viewButton: 'superadmin-user-view-{id}',
      editButton: 'superadmin-user-edit-{id}',
      banButton: 'superadmin-user-ban-{id}',
      deleteButton: 'superadmin-user-delete-{id}',
      impersonateButton: 'superadmin-user-impersonate-{id}',
    },
    userDetail: {
      container: 'superadmin-user-detail',
      email: 'superadmin-user-email',
      role: 'superadmin-user-role',
      status: 'superadmin-user-status',
      teams: 'superadmin-user-teams',
      activity: 'superadmin-user-activity',
      actions: 'superadmin-user-actions',
      // User Metadata
      metas: 'superadmin-user-metas',
      metasTitle: 'superadmin-user-metas-title',
      metasTable: 'superadmin-user-metas-table',
      metasEmpty: 'superadmin-user-metas-empty',
      metaRow: 'superadmin-user-meta-row-{key}',
      metaKey: 'superadmin-user-meta-key-{key}',
      metaValue: 'superadmin-user-meta-value-{key}',
      metaType: 'superadmin-user-meta-type-{key}',
      metaPublic: 'superadmin-user-meta-public-{key}',
      metaSearchable: 'superadmin-user-meta-searchable-{key}',
    },
    teams: {
      container: 'superadmin-teams-container',
      table: 'superadmin-teams-table',
      search: 'superadmin-teams-search',
      row: 'superadmin-team-row-{id}',
      actionsButton: 'superadmin-team-actions-{id}',
      viewButton: 'superadmin-team-view-{id}',
      editButton: 'superadmin-team-edit-{id}',
      deleteButton: 'superadmin-team-delete-{id}',
    },
    teamDetail: {
      container: 'superadmin-team-detail',
      name: 'superadmin-team-name',
      owner: 'superadmin-team-owner',
      members: 'superadmin-team-members',
      plan: 'superadmin-team-plan',
      usage: 'superadmin-team-usage',
    },
    subscriptions: {
      container: 'superadmin-subscriptions-container',
      mrr: 'superadmin-subscriptions-mrr',
      planDistribution: 'superadmin-subscriptions-plan-distribution',
      planCount: 'superadmin-subscriptions-plan-count-{plan}',
      activeCount: 'superadmin-subscriptions-active-count',
    },
    pagination: {
      pageSize: 'superadmin-page-size-select',
      first: 'superadmin-pagination-first',
      prev: 'superadmin-pagination-prev',
      next: 'superadmin-pagination-next',
      last: 'superadmin-pagination-last',
    },
    filters: {
      search: 'superadmin-search-{context}',
      dropdown: 'superadmin-filter-{context}',
    },
    permissions: {
      row: 'superadmin-permission-row-{permission}',
    },
    teamRoles: {
      backButton: 'back-to-superadmin',
      roleCard: 'role-card-{role}',
      permissionRow: 'permission-row-{permission}',
    },
    planFeatures: {
      featureRow: 'superadmin-feature-row-{slug}',
      limitRow: 'superadmin-limit-row-{slug}',
    },
  },

  // ===========================================================================
  // DEVTOOLS
  // ===========================================================================
  devtools: {
    navigation: {
      sidebar: 'devtools-sidebar',
      collapseToggle: 'devtools-sidebar-collapse-toggle',
      navItem: 'devtools-nav-{section}',
      exitToDashboard: 'devtools-sidebar-exit-to-dashboard',
      goToSuperadmin: 'devtools-sidebar-go-to-superadmin',
      mobileHeader: 'devtools-mobile-header',
    },
    home: {
      page: 'devtools-home-page',
      styleLink: 'devtools-home-style-link',
      testsLink: 'devtools-home-tests-link',
      configLink: 'devtools-home-config-link',
    },
    style: {
      page: 'devtools-style-page',
      tabComponents: 'devtools-style-tab-components',
      tabFieldTypes: 'devtools-style-tab-field-types',
      tabTheme: 'devtools-style-tab-theme',
      tabGuidelines: 'devtools-style-tab-guidelines',
      componentGallery: 'devtools-style-component-gallery',
      fieldTypes: 'devtools-style-field-types',
      themePreview: 'devtools-style-theme-preview',
    },
    config: {
      page: 'devtools-config-page',
      viewer: 'devtools-config-viewer',
      tabTheme: 'devtools-config-tab-theme',
      tabEntities: 'devtools-config-tab-entities',
      themeContent: 'devtools-config-theme-content',
      entitiesContent: 'devtools-config-entities-content',
      copyTheme: 'devtools-config-copy-theme',
      copyEntities: 'devtools-config-copy-entities',
    },
    tests: {
      page: 'devtools-tests-page',
      viewer: 'devtools-tests-viewer',
      loading: 'devtools-tests-loading',
      tree: 'devtools-tests-tree',
      folder: 'devtools-tests-folder-{name}',
      file: 'devtools-tests-file-{name}',
      content: 'devtools-tests-content',
      markdownContent: 'devtools-tests-markdown-content',
      notFound: 'devtools-tests-not-found',
      backToList: 'devtools-tests-back-to-list',
      emptyState: 'devtools-tests-empty-state',
      fileLoading: 'devtools-tests-file-loading',
      error: 'devtools-tests-error',
      // Dashboard
      dashboard: 'devtools-tests-dashboard',
      dashboardButton: 'devtools-tests-dashboard-button',
      dashboardStats: 'devtools-tests-dashboard-stats',
      dashboardStatFeatures: 'devtools-tests-dashboard-stat-features',
      dashboardStatFlows: 'devtools-tests-dashboard-stat-flows',
      dashboardStatFiles: 'devtools-tests-dashboard-stat-files',
      dashboardStatTags: 'devtools-tests-dashboard-stat-tags',
      dashboardGaps: 'devtools-tests-dashboard-gaps',
      dashboardGapItem: 'devtools-tests-dashboard-gap-{slug}',
    },
    features: {
      page: 'devtools-features-page',
      viewer: 'devtools-features-viewer',
      search: 'devtools-features-search',
      filterAll: 'devtools-features-filter-all',
      filterCategory: 'devtools-features-filter-{category}',
      coverageAll: 'devtools-features-coverage-all',
      coverageCovered: 'devtools-features-coverage-covered',
      coverageUncovered: 'devtools-features-coverage-uncovered',
      card: 'devtools-features-card-{slug}',
      copyTag: 'devtools-features-copy-{slug}',
    },
    flows: {
      page: 'devtools-flows-page',
      viewer: 'devtools-flows-viewer',
      search: 'devtools-flows-search',
      filterAll: 'devtools-flows-filter-all',
      filterCategory: 'devtools-flows-filter-{category}',
      coverageAll: 'devtools-flows-coverage-all',
      coverageCovered: 'devtools-flows-coverage-covered',
      coverageUncovered: 'devtools-flows-coverage-uncovered',
      card: 'devtools-flows-card-{slug}',
      copyTag: 'devtools-flows-copy-{slug}',
    },
    blocks: {
      page: 'devtools-blocks-page',
      viewer: 'devtools-blocks-viewer',
      search: 'devtools-blocks-search',
      filterAll: 'devtools-blocks-filter-all',
      filterCategory: 'devtools-blocks-filter-{category}',
      coverageAll: 'devtools-blocks-coverage-all',
      coverageCovered: 'devtools-blocks-coverage-covered',
      coverageUncovered: 'devtools-blocks-coverage-uncovered',
      card: 'devtools-blocks-card-{slug}',
      copyTag: 'devtools-blocks-copy-{slug}',
      viewDetails: 'devtools-blocks-view-{slug}',
      detail: {
        page: 'devtools-block-detail-{slug}',
        back: 'devtools-block-detail-back',
        tabPreview: 'devtools-block-detail-tab-preview',
        tabFields: 'devtools-block-detail-tab-fields',
        tabOverview: 'devtools-block-detail-tab-overview',
        preview: 'devtools-block-detail-preview-{slug}',
        exampleSelector: 'devtools-block-example-selector',
        exampleBtn: 'devtools-block-example-btn-{index}',
        exampleName: 'devtools-block-example-name',
        exampleDescription: 'devtools-block-example-description',
      },
    },
    tags: {
      page: 'devtools-tags-page',
      viewer: 'devtools-tags-viewer',
      search: 'devtools-tags-search',
      category: 'devtools-tags-category-{category}',
      tag: 'devtools-tags-tag-{tag}',
      tagLink: 'devtools-tags-link-{tag}',
      filesPanel: 'devtools-tags-files-panel-{tag}',
    },
    scheduledActions: {
      page: 'devtools-scheduled-actions-page',
      filterStatus: 'scheduled-actions-filter-status',
      filterType: 'scheduled-actions-filter-type',
      filterApply: 'scheduled-actions-filter-apply',
      filterReset: 'scheduled-actions-filter-reset',
      table: 'scheduled-actions-table',
      row: 'scheduled-actions-row-{id}',
      cellType: 'scheduled-actions-cell-type',
      cellStatus: 'scheduled-actions-cell-status',
      cellScheduledAt: 'scheduled-actions-cell-scheduled-at',
      cellTeam: 'scheduled-actions-cell-team',
      cellPayload: 'scheduled-actions-cell-payload',
      cellError: 'scheduled-actions-cell-error',
      statusPending: 'scheduled-actions-status-pending',
      statusRunning: 'scheduled-actions-status-running',
      statusCompleted: 'scheduled-actions-status-completed',
      statusFailed: 'scheduled-actions-status-failed',
      pagination: 'scheduled-actions-pagination',
      paginationPrev: 'scheduled-actions-pagination-prev',
      paginationNext: 'scheduled-actions-pagination-next',
      emptyState: 'scheduled-actions-empty-state',
    },
  },

  // ===========================================================================
  // PUBLIC PAGES
  // ===========================================================================
  public: {
    navbar: {
      container: 'public-navbar',
      logo: 'navbar-logo',
      loginButton: 'navbar-login',
      signupButton: 'navbar-signup',
    },
    footer: {
      container: 'public-footer',
      logo: 'footer-logo',
    },
    page: {
      container: 'public-page-{slug}',
      title: 'page-title',
      content: 'page-content',
    },
    blog: {
      listContainer: 'blog-list',
      postCard: 'blog-post-{slug}',
    },
  },

  // ===========================================================================
  // COMMON / SHARED
  // ===========================================================================
  common: {
    permissionDenied: 'permission-denied',
    loading: 'loading-spinner',
    error: 'error-message',
    toast: 'toast-{type}',
    modal: {
      overlay: 'modal-overlay',
      container: 'modal-container',
      title: 'modal-title',
      close: 'modal-close',
      content: 'modal-content',
      footer: 'modal-footer',
    },
  },
} as const

/**
 * Type for the CORE_SELECTORS object
 */
export type CoreSelectorsType = typeof CORE_SELECTORS
