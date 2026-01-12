/**
 * Superadmin Selectors
 *
 * Selectors for the super admin panel:
 * - Navigation
 * - Users management
 * - Teams management
 * - Subscriptions
 * - Permissions
 */

export const SUPERADMIN_SELECTORS = {
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
} as const

export type SuperadminSelectorsType = typeof SUPERADMIN_SELECTORS
