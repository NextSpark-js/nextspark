/**
 * Productivity Theme - Dashboard Configuration
 *
 * Board-centric dashboard for task management.
 */

export const DASHBOARD_CONFIG = {
  // =============================================================================
  // TOPBAR CONFIGURATION
  // =============================================================================
  topbar: {
    search: {
      enabled: true,
      placeholder: 'dashboard.search.placeholder',
      maxResults: 10,
    },
    notifications: {
      enabled: true, // Notifications for assigned cards, mentions
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
        {
          label: 'common.help.keyboard',
          action: 'showKeyboardShortcuts',
          icon: 'keyboard',
        }
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
    /**
     * Settings menu dropdown (gear icon)
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
    userMenu: {
      enabled: true,
      showAvatar: true,
      showEmail: true,
      showRole: false,
      items: [
        { type: 'link', label: 'navigation.profile', href: '/dashboard/settings/profile', icon: 'user' },
        { type: 'link', label: 'navigation.team', href: '/dashboard/settings/teams', icon: 'users' },
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
    defaultCollapsed: false,
    rememberState: true,
    collapsedWidth: '60px',
    expandedWidth: '260px',
    toggle: {
      enabled: true,
      showInTopbar: true,
      hideOnMobile: false,
    },
    navigation: {
      showEntityCounts: true,
      groupEntities: true,
      showRecents: true,
      maxRecents: 5,
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
          timezoneChange: true,
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
        enabled: false, // Not needed for this app
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
        enabled: true, // Team management for multi-tenant mode
        label: 'settings.pages.teams',
        description: 'settings.pages.teamsDescription',
        icon: 'users',
        order: 7,
        features: {
          createTeams: true, // Can create new teams in multi-tenant mode
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
    layout: {
      showDescription: true,
      showIcons: true,
      groupByCategory: false,
      enableSearch: true,
    },
  },

  // =============================================================================
  // ENTITY PAGES
  // =============================================================================
  entities: {
    defaultListView: {
      pagination: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 50],
        showSizeSelector: true,
      },
      sorting: {
        enabled: true,
        defaultSort: { field: 'position', direction: 'asc' },
        rememberSort: true,
      },
      filtering: {
        enabled: true,
        quickFilters: true,
        advancedFilters: true,
        rememberFilters: true,
      },
      search: {
        enabled: true,
        placeholder: 'dashboard.entities.searchPlaceholder',
        searchableFields: ['name', 'title', 'description'],
        instantSearch: true,
        debounceMs: 200,
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
        enabled: false,
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
      boards: {
        listView: {
          defaultSort: { field: 'position', direction: 'asc' },
        },
      },
      lists: {
        listView: {
          defaultSort: { field: 'position', direction: 'asc' },
        },
      },
      cards: {
        listView: {
          defaultSort: { field: 'position', direction: 'asc' },
          quickFilters: ['listId', 'assigneeId', 'dueDate'],
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
        entities: ['boards', 'cards'],
        timeframe: '7days',
        showTrends: true,
      },
      recentActivity: {
        enabled: true,
        maxItems: 10,
        entities: ['boards', 'cards'],
        showTimestamps: true,
      },
      quickActions: {
        enabled: true,
        actions: [
          { entity: 'boards', action: 'create', label: 'productivity.quickActions.createBoard' },
          { entity: 'cards', action: 'create', label: 'productivity.quickActions.createCard' },
        ],
      },
    },
    layout: {
      columns: 3,
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
      entityData: { enabled: true, duration: 1 * 60 * 1000 }, // Shorter cache for real-time feel
    },
    loading: {
      showSkeletons: true,
      showProgressBars: true,
      minimumLoadingTime: 150,
    },
    errors: {
      showErrorBoundaries: true,
      logErrors: true,
      enableRetry: true,
      maxRetries: 3,
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
        'N': 'newCard',
        'B': 'newBoard',
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
