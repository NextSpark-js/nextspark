/**
 * Default Dashboard Configuration (Core)
 *
 * This file contains the default configuration values for the dashboard.
 * These values can be overridden by theme-specific dashboard.config.ts files.
 *
 * The merge system will combine this default config with theme-specific configs,
 * allowing themes to override only the values they need to change.
 */

// =============================================================================
// DEFAULT DASHBOARD CONFIGURATION
// =============================================================================

export const DEFAULT_DASHBOARD_CONFIG = {
  // =============================================================================
  // TOPBAR CONFIGURATION
  // =============================================================================
  topbar: {
    /**
     * Search functionality in the topbar
     */
    search: {
      enabled: false,
      placeholder: 'dashboard.search.placeholder',
      maxResults: 8,
    },

    /**
     * Notifications dropdown
     */
    notifications: {
      enabled: false,
    },

    /**
     * Theme mode toggle
     */
    themeToggle: {
      enabled: true,
    },

    /**
     * Support/Help button
     */
    support: {
      enabled: true,
      type: 'dropdown' as const, // 'dropdown' | 'link' | 'modal'
      links: [
        {
          label: 'common.help.documentation',
          url: '/docs',
          icon: 'book-open',
          external: false,
        },
        {
          label: 'common.help.support',
          url: '/support',
          icon: 'help-circle',
          external: false,
        },
        {
          label: 'common.help.keyboard',
          action: 'showKeyboardShortcuts',
          icon: 'keyboard',
        }
      ],
    },

    /**
     * Quick create dropdown
     */
    quickCreate: {
      enabled: true,
    },

    /**
     * Superadmin access button (Super Admin area)
     * By default only visible to superadmins, but can be extended to developers
     */
    superadminAccess: {
      enabled: true,
      showToDevelopers: true, // Also show to developers when enabled
    },

    /**
     * DevTools access button (Developer area)
     * Only visible to users with developer role
     */
    devtoolsAccess: {
      enabled: true,
    },

    /**
     * Settings menu dropdown (gear icon)
     * Contains links to admin-level features
     */
    settingsMenu: {
      enabled: true,
      links: [
        {
          label: 'navigation.patterns',
          href: '/dashboard/patterns',
          icon: 'layers',
        },
      ],
    },

    /**
     * User menu dropdown
     */
    userMenu: {
      enabled: true,
      showAvatar: true,
      showEmail: true,
      showRole: false, // User role no longer relevant - team roles are shown in TeamSwitcher
      items: [
        { type: 'link', label: 'navigation.profile', href: '/dashboard/settings/profile', icon: 'user' },
        { type: 'link', label: 'navigation.settings', href: '/dashboard/settings', icon: 'settings' },
        { type: 'divider' },
        { type: 'action', label: 'buttons.signOut', action: 'signOut', icon: 'log-out' },
      ],
    },
  },

  // =============================================================================
  // SIDEBAR CONFIGURATION
  // =============================================================================
  sidebar: {
    /**
     * Default sidebar state
     */
    defaultCollapsed: false,
    rememberState: true,
    collapsedWidth: '60px',
    expandedWidth: '240px',

    /**
     * Sidebar toggle behavior
     */
    toggle: {
      enabled: true,
      showInTopbar: true,
      hideOnMobile: false,
    },

    /**
     * Navigation structure
     */
    navigation: {
      showEntityCounts: true,
      groupEntities: true,
      showRecents: true,
      maxRecents: 5,
    },
  },

  // =============================================================================
  // SETTINGS PAGES CONFIGURATION
  // =============================================================================
  settings: {
    /**
     * Available settings pages
     * Set enabled: false to hide a settings page
     */
    pages: {
      profile: {
        enabled: true,
        label: 'settings.pages.profile',
        description: 'settings.pages.profileDescription',
        icon: 'user',
        order: 1,
        features: {
          avatarUpload: true,
          nameChange: true,
          emailChange: true,
          localeChange: true,
          timezoneChange: false,
        },
      },

      security: {
        enabled: true,
        label: 'settings.pages.security',
        description: 'settings.pages.securityDescription',
        icon: 'shield',
        order: 2,
        features: {
          sessionManagement: true,
          loginHistory: true,
          securityQuestions: false,
        },
      },

      password: {
        enabled: true,
        label: 'settings.pages.password',
        description: 'settings.pages.passwordDescription',
        icon: 'key',
        order: 3,
        features: {
          passwordChange: true,
          passwordStrength: true,
          passwordHistory: false,
        },
      },

      notifications: {
        enabled: true,
        label: 'settings.pages.notifications',
        description: 'settings.pages.notificationsDescription',
        icon: 'bell',
        order: 4,
        features: {
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
          notificationCategories: true,
        },
      },

      'api-keys': {
        enabled: true,
        label: 'settings.pages.apiKeys',
        description: 'settings.pages.apiKeysDescription',
        icon: 'key',
        order: 5,
        features: {
          createKeys: true,
          revokeKeys: true,
          scopeManagement: true,
          usageAnalytics: true,
        },
        requiredRole: 'colaborator', // Minimum role required to access
      },

      billing: {
        enabled: true,
        label: 'settings.pages.billing',
        description: 'settings.pages.billingDescription',
        icon: 'credit-card',
        order: 6,
        features: {
          subscriptionManagement: true,
          paymentMethods: true,
          invoiceHistory: true,
          usageMetrics: true,
        },
        requiredRole: 'admin', // Only admins can manage billing
      },

      teams: {
        enabled: true,
        label: 'settings.pages.teams',
        description: 'settings.pages.teamsDescription',
        icon: 'users',
        order: 7,
        features: {
          createTeams: true,
          manageMembers: true,
          inviteMembers: true,
          teamSettings: true,
        },
      },

      plans: {
        enabled: true,
        label: 'settings.pages.plans',
        description: 'settings.pages.plansDescription',
        icon: 'credit-card',
        order: 8,
        features: {
          planComparison: true,
          planSelection: true,
        },
      },
    },

    /**
     * Settings layout configuration
     */
    layout: {
      showDescription: true,
      showIcons: true,
      groupByCategory: false,
      enableSearch: true,
    },
  },

  // =============================================================================
  // ENTITY PAGES CONFIGURATION
  // =============================================================================
  entities: {
    /**
     * Default list view configuration for all entities
     */
    defaultListView: {
      pagination: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 50, 100],
        showSizeSelector: true,
      },
      sorting: {
        enabled: true,
        defaultSort: { field: 'createdAt', direction: 'desc' },
        rememberSort: true,
      },
      filtering: {
        enabled: true,
        quickFilters: true,
        advancedFilters: true,
        rememberFilters: false,
      },
      search: {
        enabled: true,
        placeholder: 'dashboard.entities.searchPlaceholder',
        searchableFields: ['name', 'title', 'description', 'email'],
        instantSearch: true,
        debounceMs: 300,
      },
    },

    /**
     * Default form behavior for all entities
     */
    defaultFormView: {
      validation: {
        validateOnBlur: true,
        validateOnChange: false,
        showFieldErrors: true,
        showFormErrors: true,
      },
      autosave: {
        enabled: false,
        intervalMs: 30000,
        showIndicator: true,
      },
      confirmation: {
        showOnCreate: false,
        showOnUpdate: true,
        showOnDelete: true,
      },
    },

    /**
     * Per-entity customizations
     * Override default settings for specific entities
     */
    customizations: {},
  },

  // =============================================================================
  // DASHBOARD HOMEPAGE CONFIGURATION
  // =============================================================================
  homepage: {
    /**
     * Widgets to show on dashboard homepage
     */
    widgets: {
      welcome: {
        enabled: true,
        showUserName: true,
        showLastLogin: true,
        showQuickActions: true,
      },

      stats: {
        enabled: true,
        entities: ['tasks', 'clients', 'products', 'orders'],
        timeframe: '30days' as const, // 'today' | '7days' | '30days' | '90days'
        showTrends: true,
      },

      recentActivity: {
        enabled: true,
        maxItems: 10,
        entities: ['tasks', 'clients', 'products', 'orders'],
        showTimestamps: true,
      },

      quickActions: {
        enabled: true,
        actions: [
          { entity: 'tasks', action: 'create', label: 'dashboard.quickActions.createTask' },
          { entity: 'clients', action: 'create', label: 'dashboard.quickActions.createClient' },
          { entity: 'products', action: 'create', label: 'dashboard.quickActions.createProduct' },
        ],
      },
    },

    /**
     * Layout configuration
     */
    layout: {
      columns: 3,
      gutter: 'medium' as const, // 'small' | 'medium' | 'large'
      responsive: true,
    },
  },

  // =============================================================================
  // PERFORMANCE & BEHAVIOR
  // =============================================================================
  performance: {
    /**
     * Caching configuration
     */
    cache: {
      entityConfigs: {
        enabled: true,
        duration: 5 * 60 * 1000, // 5 minutes
      },
      entityData: {
        enabled: true,
        duration: 2 * 60 * 1000, // 2 minutes
      },
    },

    /**
     * Loading states
     */
    loading: {
      showSkeletons: true,
      showProgressBars: true,
      minimumLoadingTime: 300, // Prevent flashing
    },

    /**
     * Error handling
     */
    errors: {
      showErrorBoundaries: true,
      logErrors: true,
      enableRetry: true,
      maxRetries: 3,
    },
  },

  // =============================================================================
  // ACCESSIBILITY & UX
  // =============================================================================
  accessibility: {
    /**
     * Keyboard navigation
     * @todo Shortcuts are not implemented yet
     */
    keyboard: {
      enabled: true,
      showShortcuts: true,
      customShortcuts: {
        'Ctrl+K': 'openSearch',
        'Ctrl+Shift+N': 'quickCreate',
        'Ctrl+B': 'toggleSidebar',
        'Esc': 'closeModals',
      },
    },

    /**
     * Screen reader support
     */
    screenReader: {
      announceNavigation: true,
      announceActions: true,
      announceErrors: true,
    },

    /**
     * Visual indicators
     */
    visual: {
      showFocusOutlines: true,
      highContrastMode: false,
      reducedMotion: false,
    },
  },

  // =============================================================================
  // HELPER FUNCTIONS (added as properties for registry compatibility)
  // =============================================================================

  /**
   * Check if a settings page is enabled
   */
  isSettingsPageEnabled(this: any, pageKey: string): boolean {
    const pages = this.settings.pages as any
    return pages[pageKey]?.enabled ?? false
  },

  /**
   * Get enabled settings pages sorted by order
   */
  getEnabledSettingsPages(this: any) {
    return Object.entries(this.settings.pages)
      .filter(([_, config]: [string, any]) => config.enabled)
      .sort((a: [string, any], b: [string, any]) => a[1].order - b[1].order)
      .map(([key, config]: [string, any]) => ({
        key,
        order: config.order,
        label: config.label
      }))
  },

  /**
   * Check if a topbar feature is enabled
   */
  isTopbarFeatureEnabled(this: any, feature: string): boolean {
    const topbar = this.topbar as any
    return topbar[feature]?.enabled ?? false
  },
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DashboardConfig = typeof DEFAULT_DASHBOARD_CONFIG
export type TopbarConfig = typeof DEFAULT_DASHBOARD_CONFIG.topbar
export type SidebarConfig = typeof DEFAULT_DASHBOARD_CONFIG.sidebar
export type SettingsConfig = typeof DEFAULT_DASHBOARD_CONFIG.settings
export type EntitiesConfig = typeof DEFAULT_DASHBOARD_CONFIG.entities
export type HomepageConfig = typeof DEFAULT_DASHBOARD_CONFIG.homepage