/**
 * Dashboard-Specific Configuration
 * 
 * This file contains all configurable values specific to the dashboard interface.
 * Separate from general app configuration to allow fine-grained control over
 * dashboard features, layout, and behavior.
 */

// =============================================================================
// DASHBOARD CONFIGURATION
// =============================================================================

export const DASHBOARD_CONFIG = {
  // =============================================================================
  // TOPBAR CONFIGURATION
  // =============================================================================
  topbar: {
    /**
     * Search functionality in the topbar
     */
    search: {
      enabled: true,
      placeholder: 'dashboard.search.placeholder',
      maxResults: 8,
    },

    /**
     * Notifications dropdown
     */
    notifications: {
      enabled: true,
      // maxVisible: 5,
      // autoRefresh: true,
      // refreshInterval: 30000, // 30 seconds
      // showBadge: true,
      // playSound: false,
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
      type: 'dropdown', // 'dropdown' | 'link' | 'modal'
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
     * Admin access button (Super Admin area)
     * By default only visible to superadmins, but can be extended to developers
     */
    adminAccess: {
      enabled: true,
      showToDevelopers: true,
    },

    /**
     * Dev Zone access button (Developer area)
     * Only visible to users with developer role
     */
    devtoolsAccess: {
      enabled: true,
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
          twoFactorAuth: true,
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
    customizations: {
      tasks: {
        listView: {
          defaultSort: { field: 'priority', direction: 'desc' },
          quickFilters: ['status', 'priority', 'assignee'],
        },
        formView: {
          autosave: { enabled: true },
        },
      },
      clients: {
        listView: {
          defaultSort: { field: 'name', direction: 'asc' },
          searchableFields: ['name', 'email', 'company'],
        },
      },
    },
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
        timeframe: '30days', // 'today' | '7days' | '30days' | '90days'
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
      gutter: 'medium', // 'small' | 'medium' | 'large'
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
} as const

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Quick access to common dashboard configuration values
 */
export const TOPBAR_CONFIG = DASHBOARD_CONFIG.topbar
export const SIDEBAR_CONFIG = DASHBOARD_CONFIG.sidebar
export const SETTINGS_CONFIG = DASHBOARD_CONFIG.settings
export const ENTITIES_CONFIG = DASHBOARD_CONFIG.entities
export const HOMEPAGE_CONFIG = DASHBOARD_CONFIG.homepage

/**
 * Helper to check if a settings page is enabled
 */
export const isSettingsPageEnabled = (pageKey: keyof typeof DASHBOARD_CONFIG.settings.pages): boolean => {
  return DASHBOARD_CONFIG.settings.pages[pageKey]?.enabled ?? false
}

/**
 * Helper to get enabled settings pages sorted by order
 */
export const getEnabledSettingsPages = () => {
  return Object.entries(DASHBOARD_CONFIG.settings.pages)
    .filter(([_, config]) => config.enabled)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, config]) => ({ key, ...config }))
}

/**
 * Helper to check if a topbar feature is enabled
 */
export const isTopbarFeatureEnabled = (feature: keyof typeof DASHBOARD_CONFIG.topbar): boolean => {
  return DASHBOARD_CONFIG.topbar[feature]?.enabled ?? false
}
