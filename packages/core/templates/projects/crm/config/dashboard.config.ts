/**
 * CRM Theme - Dashboard Configuration
 *
 * Data-centric dashboard for sales and marketing teams.
 */

export const DASHBOARD_CONFIG = {
  // =============================================================================
  // TOPBAR CONFIGURATION
  // =============================================================================
  topbar: {
    search: {
      enabled: true,
      placeholder: 'dashboard.search.placeholder',
      maxResults: 15,
    },
    notifications: {
      enabled: true,
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
      showRole: true, // Show role in CRM
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
        enabled: true,
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
        enabled: true,
        label: 'settings.pages.teams',
        description: 'settings.pages.teamsDescription',
        icon: 'users',
        order: 7,
        features: {
          createTeams: false, // Single-tenant mode
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
        defaultPageSize: 25,
        allowedPageSizes: [10, 25, 50, 100],
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
        rememberFilters: true,
      },
      search: {
        enabled: true,
        placeholder: 'dashboard.entities.searchPlaceholder',
        searchableFields: ['name', 'email', 'company', 'phone'],
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
      leads: {
        listView: {
          defaultSort: { field: 'score', direction: 'desc' },
          quickFilters: ['status', 'source', 'assignedTo'],
        },
      },
      opportunities: {
        listView: {
          defaultSort: { field: 'closeDate', direction: 'asc' },
          quickFilters: ['status', 'pipelineId', 'assignedTo'],
        },
      },
      contacts: {
        listView: {
          quickFilters: ['companyId', 'isPrimary'],
        },
      },
      activities: {
        listView: {
          defaultSort: { field: 'dueDate', direction: 'asc' },
          quickFilters: ['type', 'status', 'assignedTo'],
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
        showLastLogin: true,
        showQuickActions: true,
      },
      stats: {
        enabled: true,
        entities: ['leads', 'opportunities', 'contacts', 'companies'],
        timeframe: '30days',
        showTrends: true,
      },
      recentActivity: {
        enabled: true,
        maxItems: 15,
        entities: ['leads', 'opportunities', 'activities'],
        showTimestamps: true,
      },
      quickActions: {
        enabled: true,
        actions: [
          { entity: 'leads', action: 'create', label: 'crm.quickActions.newLead' },
          { entity: 'contacts', action: 'create', label: 'crm.quickActions.newContact' },
          { entity: 'opportunities', action: 'create', label: 'crm.quickActions.newOpportunity' },
          { entity: 'activities', action: 'create', label: 'crm.quickActions.scheduleActivity' },
        ],
      },
      pipeline: {
        enabled: true,
        showValue: true,
        showCount: true,
      },
    },
    layout: {
      columns: 4,
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
        'L': 'newLead',
        'O': 'newOpportunity',
        'C': 'newContact',
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
