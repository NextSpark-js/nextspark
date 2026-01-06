/**
 * Blog Theme - Dashboard Configuration
 *
 * Simplified dashboard focused on content creation.
 */

export const DASHBOARD_CONFIG = {
  // =============================================================================
  // TOPBAR CONFIGURATION
  // =============================================================================
  topbar: {
    search: {
      enabled: true,
      placeholder: 'dashboard.search.placeholder',
      maxResults: 5,
    },
    notifications: {
      enabled: false, // No notifications for single-user blog
    },
    themeToggle: {
      enabled: true,
    },
    support: {
      enabled: true,
      type: 'dropdown',
      links: [
        {
          label: 'common.help.documentation',
          url: '/docs',
          icon: 'book-open',
          external: false,
        },
      ],
    },
    quickCreate: {
      enabled: true,
    },
    /**
     * Admin access button (Super Admin area)
     */
    adminAccess: {
      enabled: true,
      showToDevelopers: true,
    },
    /**
     * Dev Zone access button (Developer area)
     */
    devtoolsAccess: {
      enabled: true,
    },
    userMenu: {
      enabled: true,
      showAvatar: true,
      showEmail: true,
      showRole: false,
      items: [
        { type: 'link', label: 'navigation.profile', href: '/dashboard/settings/profile', icon: 'user' },
        { type: 'link', label: 'navigation.settings', href: '/dashboard/settings', icon: 'settings' },
        { type: 'divider' },
        { type: 'link', label: 'blog.viewBlog', href: '/', icon: 'external-link' },
        { type: 'divider' },
        { type: 'action', label: 'buttons.signOut', action: 'signOut', icon: 'log-out' },
      ],
    },
  },

  // =============================================================================
  // SIDEBAR CONFIGURATION
  // =============================================================================
  sidebar: {
    defaultCollapsed: false,
    rememberState: true,
    collapsedWidth: '60px',
    expandedWidth: '220px',
    toggle: {
      enabled: true,
      showInTopbar: true,
      hideOnMobile: false,
    },
    navigation: {
      showEntityCounts: true,
      groupEntities: false, // Simple flat navigation for blog
      showRecents: true,
      maxRecents: 3,
    },
  },

  // =============================================================================
  // SETTINGS PAGES
  // =============================================================================
  settings: {
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
          twoFactorAuth: false, // Simplified for personal blog
          sessionManagement: true,
          loginHistory: false,
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
        enabled: false, // No notifications
        label: 'settings.pages.notifications',
        description: 'settings.pages.notificationsDescription',
        icon: 'bell',
        order: 4,
        features: {},
      },
      'api-keys': {
        enabled: false, // Not needed for personal blog
        label: 'settings.pages.apiKeys',
        description: 'settings.pages.apiKeysDescription',
        icon: 'key',
        order: 5,
        features: {},
      },
      billing: {
        enabled: true,
        label: 'settings.pages.billing',
        description: 'settings.pages.billingDescription',
        icon: 'credit-card',
        order: 6,
        features: {},
      },
      teams: {
        enabled: false, // No teams in single-user mode
        label: 'settings.pages.teams',
        description: 'settings.pages.teamsDescription',
        icon: 'users',
        order: 7,
        features: {},
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
    layout: {
      showDescription: true,
      showIcons: true,
      groupByCategory: false,
      enableSearch: false,
    },
  },

  // =============================================================================
  // ENTITY PAGES
  // =============================================================================
  entities: {
    defaultListView: {
      pagination: {
        defaultPageSize: 10,
        allowedPageSizes: [10, 25, 50],
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
        advancedFilters: false,
        rememberFilters: false,
      },
      search: {
        enabled: true,
        placeholder: 'dashboard.entities.searchPlaceholder',
        searchableFields: ['title', 'content', 'excerpt'],
        instantSearch: true,
        debounceMs: 300,
      },
    },
    defaultFormView: {
      validation: {
        validateOnBlur: true,
        validateOnChange: false,
        showFieldErrors: true,
        showFormErrors: true,
      },
      autosave: {
        enabled: true, // Autosave for blog posts
        intervalMs: 30000,
        showIndicator: true,
      },
      confirmation: {
        showOnCreate: false,
        showOnUpdate: false,
        showOnDelete: true,
      },
    },
    customizations: {
      posts: {
        listView: {
          defaultSort: { field: 'createdAt', direction: 'desc' },
          quickFilters: ['status'],
        },
        formView: {
          autosave: { enabled: true },
        },
      },
    },
  },

  // =============================================================================
  // DASHBOARD HOMEPAGE
  // =============================================================================
  homepage: {
    widgets: {
      welcome: {
        enabled: true,
        showUserName: true,
        showLastLogin: false,
        showQuickActions: true,
      },
      stats: {
        enabled: true,
        entities: ['posts'],
        timeframe: '30days',
        showTrends: false,
      },
      recentActivity: {
        enabled: true,
        maxItems: 5,
        entities: ['posts'],
        showTimestamps: true,
      },
      quickActions: {
        enabled: true,
        actions: [
          { entity: 'posts', action: 'create', label: 'blog.quickActions.writePost' },
        ],
      },
    },
    layout: {
      columns: 2,
      gutter: 'medium',
      responsive: true,
    },
  },

  // =============================================================================
  // PERFORMANCE
  // =============================================================================
  performance: {
    cache: {
      entityConfigs: { enabled: true, duration: 5 * 60 * 1000 },
      entityData: { enabled: true, duration: 2 * 60 * 1000 },
    },
    loading: {
      showSkeletons: true,
      showProgressBars: true,
      minimumLoadingTime: 200,
    },
    errors: {
      showErrorBoundaries: true,
      logErrors: true,
      enableRetry: true,
      maxRetries: 2,
    },
  },

  // =============================================================================
  // ACCESSIBILITY
  // =============================================================================
  accessibility: {
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
    screenReader: {
      announceNavigation: true,
      announceActions: true,
      announceErrors: true,
    },
    visual: {
      showFocusOutlines: true,
      highContrastMode: false,
      reducedMotion: false,
    },
  },
} as const

export const TOPBAR_CONFIG = DASHBOARD_CONFIG.topbar
export const SIDEBAR_CONFIG = DASHBOARD_CONFIG.sidebar
export const SETTINGS_CONFIG = DASHBOARD_CONFIG.settings
export const ENTITIES_CONFIG = DASHBOARD_CONFIG.entities
export const HOMEPAGE_CONFIG = DASHBOARD_CONFIG.homepage
