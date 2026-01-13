/**
 * Superadmin Selectors - 8 First-Level Components
 *
 * Architecture:
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  SIDEBAR (collapsible)  │           MAIN CONTENT AREA                        │
 * │  ════════════════════   │  ══════════════════════════════════════════════    │
 * │                         │                                                     │
 * │  🛡️ Super Admin         │  PAGE HEADER:                                       │
 * │  ─────────────────      │  [←] Page Title                    [🔄 Refresh]    │
 * │                         │                                                     │
 * │  📊 Dashboard           │  ─────────────────────────────────────────────────  │
 * │  👥 Users               │                                                     │
 * │  🏢 Teams               │  STATS ROW (optional):                              │
 * │  🔐 Team Roles          │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
 * │  📚 Documentation       │  │ Stat 1 │ │ Stat 2 │ │ Stat 3 │ │ Stat 4 │       │
 * │  💳 Subscriptions       │  └────────┘ └────────┘ └────────┘ └────────┘       │
 * │  📈 Analytics (soon)    │                                                     │
 * │  ⚙️ Config (soon)       │  ─────────────────────────────────────────────────  │
 * │                         │                                                     │
 * │  ─────────────────      │  FILTERS ROW:                                       │
 * │  [↩️ Back to Dashboard] │  🔍 Search...  [Filter ▼] [Filter ▼] [Clear]       │
 * │                         │                                                     │
 * └─────────────────────────│  ─────────────────────────────────────────────────  │
 *                           │                                                     │
 *                           │  TABS (optional):                                   │
 *                           │  [Tab 1] [Tab 2]                                    │
 *                           │                                                     │
 *                           │  ─────────────────────────────────────────────────  │
 *                           │                                                     │
 *                           │  TABLE/CONTENT:                                     │
 *                           │  ┌──────────────────────────────────────────────┐  │
 *                           │  │ Header  │ Header  │ Header  │ Actions       │  │
 *                           │  ├─────────┼─────────┼─────────┼───────────────┤  │
 *                           │  │ Cell    │ Cell    │ Cell    │ [⋮] Menu      │  │
 *                           │  │ Cell    │ Cell    │ Cell    │ [⋮] Menu      │  │
 *                           │  └──────────────────────────────────────────────┘  │
 *                           │                                                     │
 *                           │  ─────────────────────────────────────────────────  │
 *                           │                                                     │
 *                           │  PAGINATION:                                        │
 *                           │  Showing 1-10 of 50  │ Rows: [10▼] │ [◀][▶]       │
 *                           │                                                     │
 *                           │  ─────────────────────────────────────────────────  │
 *                           │                                                     │
 *                           │  FOOTER METADATA:                                   │
 *                           │  Last updated: ... │ Source: ...                    │
 *                           └─────────────────────────────────────────────────────┘
 *
 * Components:
 * 1. sidebar              - Navigation sidebar (collapsible)
 * 2. dashboard            - Dashboard overview page
 * 3. users                - Users list page (with detail nested)
 * 4. teams                - Teams list page (with detail nested)
 * 5. subscriptions        - Subscriptions overview page
 * 6. teamRoles            - RBAC Matrix and Plan Features page
 * 7. docs                 - Admin documentation pages
 */

export const SUPERADMIN_SELECTORS = {
  // Main wrapper
  container: 'superadmin-container',

  // =========================================================================
  // 1. SIDEBAR - Navigation sidebar (collapsible)
  // =========================================================================
  sidebar: {
    container: 'superadmin-sidebar',
    header: 'superadmin-sidebar-header',
    collapseButton: 'superadmin-sidebar-collapse',
    securityNotice: 'superadmin-sidebar-security',
    nav: {
      dashboard: 'superadmin-nav-dashboard',
      users: 'superadmin-nav-users',
      teams: 'superadmin-nav-teams',
      teamRoles: 'superadmin-nav-team-roles',
      docs: 'superadmin-nav-docs',
      subscriptions: 'superadmin-nav-subscriptions',
      analytics: 'superadmin-nav-analytics',
      config: 'superadmin-nav-config',
    },
    exitButton: 'superadmin-sidebar-exit',
  },

  // =========================================================================
  // 2. DASHBOARD - Overview page with quick actions
  // =========================================================================
  dashboard: {
    container: 'superadmin-dashboard',
    header: {
      title: 'superadmin-dashboard-title',
      badge: 'superadmin-dashboard-badge',
    },
    quickActions: {
      container: 'superadmin-quick-actions',
      users: 'superadmin-quick-users',
      analytics: 'superadmin-quick-analytics',
      config: 'superadmin-quick-config',
    },
    systemStatus: {
      container: 'superadmin-system-status',
      online: 'superadmin-status-online',
      version: 'superadmin-status-version',
      security: 'superadmin-status-security',
    },
  },

  // =========================================================================
  // 3. USERS - User management (list + detail views)
  // =========================================================================
  users: {
    container: 'superadmin-users',
    header: {
      backButton: 'superadmin-users-back',
      title: 'superadmin-users-title',
      refreshButton: 'superadmin-users-refresh',
    },
    stats: {
      totalUsers: 'superadmin-users-stat-total',
      workTeams: 'superadmin-users-stat-teams',
      superadmins: 'superadmin-users-stat-superadmins',
      distribution: 'superadmin-users-stat-distribution',
    },
    filters: {
      search: 'superadmin-users-search',
      roleFilter: 'superadmin-users-filter-role',
      statusFilter: 'superadmin-users-filter-status',
      clearButton: 'superadmin-users-filter-clear',
    },
    tabs: {
      container: 'superadmin-users-tabs',
      regularUsers: 'superadmin-users-tab-regular',
      superadmins: 'superadmin-users-tab-super',
    },
    table: {
      element: 'superadmin-users-table',
      row: 'superadmin-users-row-{id}',
      viewButton: 'superadmin-users-view-{id}',
      editButton: 'superadmin-users-edit-{id}',
      banButton: 'superadmin-users-ban-{id}',
      deleteButton: 'superadmin-users-delete-{id}',
      impersonateButton: 'superadmin-users-impersonate-{id}',
    },
    pagination: {
      container: 'superadmin-users-pagination',
      pageSize: 'superadmin-users-page-size',
      first: 'superadmin-users-page-first',
      prev: 'superadmin-users-page-prev',
      next: 'superadmin-users-page-next',
      last: 'superadmin-users-page-last',
    },
    // Detail view (nested)
    detail: {
      container: 'superadmin-user-detail',
      info: {
        email: 'superadmin-user-email',
        role: 'superadmin-user-role',
        status: 'superadmin-user-status',
        teams: 'superadmin-user-teams',
        activity: 'superadmin-user-activity',
      },
      actions: 'superadmin-user-actions',
      metas: {
        container: 'superadmin-user-metas',
        title: 'superadmin-user-metas-title',
        table: 'superadmin-user-metas-table',
        empty: 'superadmin-user-metas-empty',
        row: 'superadmin-user-meta-row-{key}',
        key: 'superadmin-user-meta-key-{key}',
        value: 'superadmin-user-meta-value-{key}',
        type: 'superadmin-user-meta-type-{key}',
        public: 'superadmin-user-meta-public-{key}',
        searchable: 'superadmin-user-meta-searchable-{key}',
      },
    },
  },

  // =========================================================================
  // 4. TEAMS - Team management (list + detail views)
  // =========================================================================
  teams: {
    container: 'superadmin-teams',
    header: {
      backButton: 'superadmin-teams-back',
      title: 'superadmin-teams-title',
      refreshButton: 'superadmin-teams-refresh',
    },
    stats: {
      totalTeams: 'superadmin-teams-stat-total',
    },
    filters: {
      search: 'superadmin-teams-search',
      clearButton: 'superadmin-teams-filter-clear',
    },
    tabs: {
      container: 'superadmin-teams-tabs',
      userTeams: 'superadmin-teams-tab-user',
      systemAdmin: 'superadmin-teams-tab-system',
    },
    table: {
      element: 'superadmin-teams-table',
      row: 'superadmin-teams-row-{id}',
      menuButton: 'superadmin-teams-menu-{id}',
      menuContent: 'superadmin-teams-menu-content-{id}',
      viewButton: 'superadmin-teams-view-{id}',
      editButton: 'superadmin-teams-edit-{id}',
      deleteButton: 'superadmin-teams-delete-{id}',
    },
    pagination: {
      container: 'superadmin-teams-pagination',
      pageSize: 'superadmin-teams-page-size',
      first: 'superadmin-teams-page-first',
      prev: 'superadmin-teams-page-prev',
      next: 'superadmin-teams-page-next',
      last: 'superadmin-teams-page-last',
    },
    // Detail view (nested)
    detail: {
      container: 'superadmin-team-detail',
      info: {
        name: 'superadmin-team-name',
        owner: 'superadmin-team-owner',
        members: 'superadmin-team-members',
      },
      membersTable: {
        container: 'superadmin-team-members-table',
        row: 'superadmin-team-member-row-{id}',
      },
      subscription: {
        container: 'superadmin-team-subscription',
        plan: 'superadmin-team-plan',
        status: 'superadmin-team-sub-status',
        period: 'superadmin-team-sub-period',
        stripeLink: 'superadmin-team-stripe-link',
      },
      billingHistory: {
        container: 'superadmin-team-billing',
        row: 'superadmin-team-billing-row-{id}',
      },
      usage: {
        container: 'superadmin-team-usage',
        metric: 'superadmin-team-usage-{slug}',
      },
    },
  },

  // =========================================================================
  // 5. SUBSCRIPTIONS - Subscriptions overview page
  // =========================================================================
  subscriptions: {
    container: 'superadmin-subscriptions',
    header: {
      backButton: 'superadmin-subscriptions-back',
      title: 'superadmin-subscriptions-title',
      refreshButton: 'superadmin-subscriptions-refresh',
    },
    stats: {
      mrr: 'superadmin-subscriptions-mrr',
      arr: 'superadmin-subscriptions-arr',
      activeCount: 'superadmin-subscriptions-active',
      totalCount: 'superadmin-subscriptions-total',
      needsAttention: 'superadmin-subscriptions-attention',
      planDistribution: 'superadmin-subscriptions-distribution',
      planCount: 'superadmin-subscriptions-plan-{plan}',
    },
    filters: {
      search: 'superadmin-subscriptions-search',
      statusFilter: 'superadmin-subscriptions-filter-status',
      planFilter: 'superadmin-subscriptions-filter-plan',
      intervalFilter: 'superadmin-subscriptions-filter-interval',
      clearButton: 'superadmin-subscriptions-filter-clear',
    },
    table: {
      element: 'superadmin-subscriptions-table',
      row: 'superadmin-subscriptions-row-{id}',
      viewTeamButton: 'superadmin-subscriptions-view-team-{id}',
      stripeLink: 'superadmin-subscriptions-stripe-{id}',
    },
    pagination: {
      container: 'superadmin-subscriptions-pagination',
      pageSize: 'superadmin-subscriptions-page-size',
      first: 'superadmin-subscriptions-page-first',
      prev: 'superadmin-subscriptions-page-prev',
      next: 'superadmin-subscriptions-page-next',
      last: 'superadmin-subscriptions-page-last',
    },
  },

  // =========================================================================
  // 6. TEAM ROLES - RBAC Matrix and Plan Features
  // =========================================================================
  teamRoles: {
    container: 'superadmin-team-roles',
    header: {
      backButton: 'superadmin-team-roles-back',
      title: 'superadmin-team-roles-title',
    },
    tabs: {
      container: 'superadmin-team-roles-tabs',
      rbac: 'superadmin-team-roles-tab-rbac',
      plans: 'superadmin-team-roles-tab-plans',
    },
    // RBAC Tab
    rbac: {
      stats: {
        roles: 'superadmin-rbac-stat-roles',
        permissions: 'superadmin-rbac-stat-permissions',
        protectedRole: 'superadmin-rbac-stat-protected',
        defaultRole: 'superadmin-rbac-stat-default',
      },
      hierarchy: {
        container: 'superadmin-rbac-hierarchy',
        roleCard: 'superadmin-rbac-role-{role}',
      },
      matrix: {
        container: 'superadmin-rbac-matrix',
        permissionRow: 'superadmin-rbac-permission-{permission}',
      },
    },
    // Plans Tab
    plans: {
      stats: {
        totalPlans: 'superadmin-plans-stat-total',
        features: 'superadmin-plans-stat-features',
        limits: 'superadmin-plans-stat-limits',
        activeTheme: 'superadmin-plans-stat-theme',
      },
      planCard: 'superadmin-plans-card-{slug}',
      matrix: {
        container: 'superadmin-plans-matrix',
        featureRow: 'superadmin-plans-feature-{slug}',
        limitRow: 'superadmin-plans-limit-{slug}',
      },
    },
  },

  // =========================================================================
  // 7. DOCS - Admin documentation pages
  // =========================================================================
  docs: {
    container: 'superadmin-docs-container',
    pageDetail: 'superadmin-docs-page',
    sectionCard: 'superadmin-docs-section-{slug}',
    pageLink: 'superadmin-docs-link-{slug}',
  },
} as const

export type SuperadminSelectorsType = typeof SUPERADMIN_SELECTORS
