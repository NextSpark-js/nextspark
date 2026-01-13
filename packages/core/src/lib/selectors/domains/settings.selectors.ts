/**
 * Settings Selectors - 9 First-Level Components
 *
 * Architecture:
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  SETTINGS LAYOUT                                                              │
 * ├──────────────────────┬───────────────────────────────────────────────────────┤
 * │  SIDEBAR (w-64)      │           PAGE CONTENT AREA                            │
 * │  ════════════════    │  ══════════════════════════════════════════════════    │
 * │                      │                                                        │
 * │  [← Back]            │  OVERVIEW PAGE:                                        │
 * │                      │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
 * │  Navigation:         │  │Profile │ │Password│ │Security│ │API Keys│          │
 * │  ─────────────       │  └────────┘ └────────┘ └────────┘ └────────┘          │
 * │  👤 Profile          │                                                        │
 * │  🔒 Password         │  SECURITY PAGE:                                        │
 * │  🛡️ Security         │  ┌────────────────────────────────────────────────┐   │
 * │  🔔 Notifications    │  │ Two-Factor Auth Toggle │ Login Alerts Toggle   │   │
 * │  🔑 API Keys         │  ├────────────────────────────────────────────────┤   │
 * │  💳 Billing          │  │ Active Sessions Table                          │   │
 * │  👥 Teams            │  │ [Device] [Browser] [Location] [Revoke]         │   │
 * │                      │  └────────────────────────────────────────────────┘   │
 * │                      │                                                        │
 * │                      │  TEAMS PAGE:                                           │
 * │                      │  ┌────────────┐ ┌──────────────────────────────┐      │
 * │                      │  │Team Config │ │ Members List + Invites       │      │
 * │                      │  │ Name/Slug  │ │ [Invite Member] [Remove]     │      │
 * │                      │  └────────────┘ └──────────────────────────────┘      │
 * └──────────────────────┴────────────────────────────────────────────────────────┘
 *
 * Components:
 * 1. sidebar              - Navigation sidebar (includes layout elements)
 * 2. overview             - Overview/home page with cards
 * 3. profile              - User profile editing
 * 4. password             - Password change
 * 5. security             - 2FA, login alerts, active sessions
 * 6. notifications        - Notification preferences
 * 7. apiKeys              - API key management
 * 8. billing              - Billing, invoices, payment (includes pricing, features)
 * 9. teams                - Team management (includes current team, members)
 */

export const SETTINGS_SELECTORS = {
  // Main wrapper
  container: 'settings-container',

  // =========================================================================
  // 1. SIDEBAR - Navigation sidebar (includes layout elements)
  // =========================================================================
  sidebar: {
    container: 'settings-sidebar',
    header: 'settings-sidebar-header',
    backButton: 'settings-back-to-dashboard',
    nav: {
      container: 'settings-nav',
      items: 'settings-sidebar-nav-items',
      item: 'settings-sidebar-nav-{section}',
    },
    // Layout elements
    layout: {
      main: 'settings-layout-main',
      header: 'settings-layout-header',
      contentArea: 'settings-layout-content-area',
      pageContent: 'settings-layout-page-content',
    },
  },

  // =========================================================================
  // 2. OVERVIEW - Settings home page
  // =========================================================================
  overview: {
    container: 'settings-overview',
    card: 'settings-overview-{key}',
  },

  // =========================================================================
  // 3. PROFILE - User profile editing
  // =========================================================================
  profile: {
    container: 'settings-profile',
    form: 'profile-form',
    avatar: {
      container: 'profile-avatar',
      upload: 'profile-avatar-upload',
    },
    firstName: 'profile-first-name',
    lastName: 'profile-last-name',
    email: 'profile-email',
    country: 'profile-country',
    timezone: 'profile-timezone',
    locale: 'profile-locale',
    submitButton: 'profile-submit',
    successMessage: 'profile-success',
    deleteAccount: {
      button: 'profile-delete-account',
      dialog: 'profile-delete-dialog',
      confirm: 'profile-delete-confirm',
    },
  },

  // =========================================================================
  // 4. PASSWORD - Password change
  // =========================================================================
  password: {
    container: 'settings-password',
    form: 'password-form',
    currentPassword: 'password-current',
    newPassword: 'password-new',
    confirmPassword: 'password-confirm',
    revokeOtherSessions: 'password-revoke-sessions',
    submitButton: 'password-submit',
    successMessage: 'password-success',
  },

  // =========================================================================
  // 5. SECURITY - 2FA, login alerts, active sessions
  // =========================================================================
  security: {
    container: 'settings-security',
    header: 'security-header',
    // Two-Factor Authentication
    twoFactor: {
      container: 'security-2fa',
      toggle: 'security-2fa-toggle',
      status: 'security-2fa-status',
      setupButton: 'security-2fa-setup',
      disableButton: 'security-2fa-disable',
      setupDialog: {
        container: 'security-2fa-dialog',
        qrCode: 'security-2fa-qr',
        secretKey: 'security-2fa-secret',
        verifyInput: 'security-2fa-verify-input',
        confirmButton: 'security-2fa-confirm',
      },
    },
    // Login Alerts
    loginAlerts: {
      toggle: 'security-login-alerts-toggle',
      status: 'security-login-alerts-status',
    },
    // Active Sessions
    sessions: {
      container: 'security-sessions',
      list: 'security-sessions-list',
      row: {
        container: 'security-session-{id}',
        device: 'security-session-device-{id}',
        browser: 'security-session-browser-{id}',
        location: 'security-session-location-{id}',
        lastActive: 'security-session-last-active-{id}',
        currentBadge: 'security-session-current-{id}',
        revokeButton: 'security-session-revoke-{id}',
      },
      revokeAllButton: 'security-sessions-revoke-all',
    },
    successMessage: 'security-success',
  },

  // =========================================================================
  // 6. NOTIFICATIONS - Notification preferences
  // =========================================================================
  notifications: {
    container: 'settings-notifications',
    masterToggle: 'notifications-master-toggle',
    pushToggle: 'notifications-push-toggle',
    category: {
      container: 'notifications-category-{category}',
      emailToggle: 'notifications-{category}-email',
      pushToggle: 'notifications-{category}-push',
    },
    submitButton: 'notifications-submit',
    successMessage: 'notifications-success',
  },

  // =========================================================================
  // 7. API KEYS - API key management
  // =========================================================================
  apiKeys: {
    container: 'settings-api-keys',
    header: 'api-keys-header',
    createButton: 'api-keys-create-button',
    list: {
      container: 'api-keys-list',
      empty: 'api-keys-empty',
      skeleton: 'api-keys-skeleton',
    },
    row: {
      container: 'api-key-row-{id}',
      name: 'api-key-name-{id}',
      prefix: 'api-key-prefix-{id}',
      copyPrefix: 'api-key-copy-prefix-{id}',
      status: 'api-key-status-{id}',
      scopes: 'api-key-scopes-{id}',
      scope: 'api-key-scope-{id}-{scope}',
      stats: {
        container: 'api-key-stats-{id}',
        totalRequests: 'api-key-total-requests-{id}',
        last24h: 'api-key-last-24h-{id}',
        avgTime: 'api-key-avg-time-{id}',
      },
      metadata: {
        container: 'api-key-metadata-{id}',
        createdAt: 'api-key-created-at-{id}',
        lastUsed: 'api-key-last-used-{id}',
        expiresAt: 'api-key-expires-at-{id}',
      },
      menu: {
        trigger: 'api-key-menu-{id}',
        content: 'api-key-menu-content-{id}',
        viewDetails: 'api-key-view-details-{id}',
        toggle: 'api-key-toggle-{id}',
        revoke: 'api-key-revoke-{id}',
      },
    },
    createDialog: {
      container: 'api-key-create-dialog',
      nameInput: 'api-key-name-input',
      scopesContainer: 'api-key-scopes-container',
      scopeOption: 'api-key-scope-option-{scope}',
      submitButton: 'api-key-create-submit',
      footer: 'api-key-dialog-footer',
    },
    detailsDialog: {
      container: 'api-key-details-dialog',
      title: 'api-key-details-title',
      loading: 'api-key-details-loading',
      content: 'api-key-details-content',
      basicInfo: {
        container: 'api-key-details-basic-info',
        name: 'api-key-details-name',
        status: 'api-key-details-status',
      },
      stats: {
        container: 'api-key-details-stats',
        totalRequests: 'api-key-details-total-requests',
        last24h: 'api-key-details-last-24h',
        last7d: 'api-key-details-last-7d',
        last30d: 'api-key-details-last-30d',
        avgTime: 'api-key-details-avg-time',
        successRate: 'api-key-details-success-rate',
      },
    },
    newKeyDisplay: {
      container: 'api-key-new-display',
      copyButton: 'api-key-copy',
    },
    revokeDialog: {
      container: 'api-key-revoke-dialog',
      confirmButton: 'api-key-revoke-confirm',
    },
  },

  // =========================================================================
  // 8. BILLING - Billing, invoices, payment methods
  // =========================================================================
  billing: {
    container: 'settings-billing',
    header: 'billing-header',
    // Current plan section
    currentPlan: {
      container: 'billing-current-plan',
      name: 'billing-plan-name',
      price: 'billing-plan-price',
      features: 'billing-plan-features',
      upgradeButton: 'billing-upgrade',
      cancelButton: 'billing-cancel',
    },
    // Invoices section
    invoices: {
      container: 'billing-invoices',
      table: 'invoices-table',
      row: 'invoice-row-{id}',
      statusBadge: 'invoice-status-{id}',
      downloadButton: 'invoice-download-{id}',
      loadMoreButton: 'invoices-load-more',
    },
    // Payment method section
    paymentMethod: {
      container: 'billing-payment-method',
      card: 'payment-method-card',
      addButton: 'billing-add-payment',
      updateButton: 'billing-update-payment',
    },
    // Usage section
    usage: {
      container: 'billing-usage',
      dashboard: 'usage-dashboard',
      metric: 'usage-metric-{slug}',
    },
    // Pricing table (for upgrade)
    pricing: {
      table: 'pricing-table',
      plan: 'pricing-plan-{slug}',
      selectButton: 'pricing-select-{slug}',
    },
    // Feature placeholders (upgrade prompts)
    features: {
      placeholder: 'feature-placeholder-{feature}',
      content: 'feature-content-{feature}',
      upgradeButton: 'feature-upgrade-button',
    },
  },

  // =========================================================================
  // 9. TEAMS - Team management (current team + members + teams list)
  // =========================================================================
  teams: {
    container: 'settings-teams',
    header: 'teams-header',
    loading: 'teams-loading',
    singleUserMode: 'teams-single-user',
    // Current team configuration
    current: {
      container: 'team-current',
      form: 'team-form',
      name: 'team-name',
      slug: 'team-slug',
      description: 'team-description',
      avatar: {
        container: 'team-avatar',
        upload: 'team-avatar-upload',
      },
      submitButton: 'team-submit',
      deleteButton: 'team-delete',
      deleteDialog: {
        container: 'team-delete-dialog',
        confirmButton: 'team-delete-confirm',
      },
    },
    // Members management
    members: {
      container: 'team-members',
      list: 'members-list',
      row: {
        container: 'member-row-{id}',
        avatar: 'member-avatar-{id}',
        name: 'member-name-{id}',
        email: 'member-email-{id}',
        role: 'member-role-{id}',
        removeButton: 'member-remove-{id}',
      },
      inviteButton: 'members-invite-button',
      inviteDialog: {
        container: 'members-invite-dialog',
        emailInput: 'members-invite-email',
        roleSelect: 'members-invite-role',
        submitButton: 'members-invite-submit',
      },
      pendingInvites: {
        container: 'members-pending-invites',
        row: 'pending-invite-{id}',
        cancelButton: 'cancel-invite-{id}',
      },
    },
    // Teams list (for multi-team accounts)
    list: {
      container: 'teams-list',
      teamCard: 'team-card-{id}',
      createButton: 'teams-create-button',
      details: 'team-details-{id}',
    },
  },
} as const

export type SettingsSelectorsType = typeof SETTINGS_SELECTORS
