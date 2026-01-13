/**
 * SuperadminPOM - Page Object Model for Superadmin Area
 *
 * Handles Superadmin Panel pages:
 * - Dashboard with system stats (/superadmin)
 * - All users management (/superadmin/users, /superadmin/users/[id])
 * - All teams management (/superadmin/teams, /superadmin/teams/[id])
 * - Team Roles - RBAC & Plan Features (/superadmin/team-roles)
 * - Subscriptions overview (/superadmin/subscriptions)
 * - Admin documentation (/superadmin/docs, /superadmin/docs/[section]/[page])
 *
 * Selector Structure (8 first-level keys):
 * - container: Main wrapper
 * - sidebar: Navigation sidebar (collapsible)
 * - dashboard: Dashboard overview page
 * - users: Users management (list + detail)
 * - teams: Teams management (list + detail)
 * - subscriptions: Subscriptions overview
 * - teamRoles: RBAC Matrix and Plan Features
 * - docs: Admin documentation pages
 *
 * Uses selectors from centralized selectors.ts
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

type PaginationContext = 'users' | 'teams' | 'subscriptions'

export class SuperadminPOM extends BasePOM {
  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): SuperadminPOM {
    return new SuperadminPOM()
  }

  // ============================================
  // SELECTORS
  // ============================================

  get selectors() {
    return {
      // Main container
      container: cySelector('superadmin.container'),

      // ─────────────────────────────────────────
      // SIDEBAR - Navigation sidebar (collapsible)
      // ─────────────────────────────────────────
      sidebar: {
        container: cySelector('superadmin.sidebar.container'),
        header: cySelector('superadmin.sidebar.header'),
        collapseButton: cySelector('superadmin.sidebar.collapseButton'),
        securityNotice: cySelector('superadmin.sidebar.securityNotice'),
        nav: {
          dashboard: cySelector('superadmin.sidebar.nav.dashboard'),
          users: cySelector('superadmin.sidebar.nav.users'),
          teams: cySelector('superadmin.sidebar.nav.teams'),
          teamRoles: cySelector('superadmin.sidebar.nav.teamRoles'),
          docs: cySelector('superadmin.sidebar.nav.docs'),
          subscriptions: cySelector('superadmin.sidebar.nav.subscriptions'),
          analytics: cySelector('superadmin.sidebar.nav.analytics'),
          config: cySelector('superadmin.sidebar.nav.config'),
        },
        exitButton: cySelector('superadmin.sidebar.exitButton'),
      },

      // ─────────────────────────────────────────
      // DASHBOARD - Overview page
      // ─────────────────────────────────────────
      dashboard: {
        container: cySelector('superadmin.dashboard.container'),
        header: {
          title: cySelector('superadmin.dashboard.header.title'),
          badge: cySelector('superadmin.dashboard.header.badge'),
        },
        quickActions: {
          container: cySelector('superadmin.dashboard.quickActions.container'),
          users: cySelector('superadmin.dashboard.quickActions.users'),
          analytics: cySelector('superadmin.dashboard.quickActions.analytics'),
          config: cySelector('superadmin.dashboard.quickActions.config'),
        },
        systemStatus: {
          container: cySelector('superadmin.dashboard.systemStatus.container'),
          online: cySelector('superadmin.dashboard.systemStatus.online'),
          version: cySelector('superadmin.dashboard.systemStatus.version'),
          security: cySelector('superadmin.dashboard.systemStatus.security'),
        },
      },

      // ─────────────────────────────────────────
      // USERS - User management (list + detail)
      // ─────────────────────────────────────────
      users: {
        container: cySelector('superadmin.users.container'),
        header: {
          backButton: cySelector('superadmin.users.header.backButton'),
          title: cySelector('superadmin.users.header.title'),
          refreshButton: cySelector('superadmin.users.header.refreshButton'),
        },
        stats: {
          totalUsers: cySelector('superadmin.users.stats.totalUsers'),
          workTeams: cySelector('superadmin.users.stats.workTeams'),
          superadmins: cySelector('superadmin.users.stats.superadmins'),
          distribution: cySelector('superadmin.users.stats.distribution'),
        },
        filters: {
          search: cySelector('superadmin.users.filters.search'),
          roleFilter: cySelector('superadmin.users.filters.roleFilter'),
          statusFilter: cySelector('superadmin.users.filters.statusFilter'),
          clearButton: cySelector('superadmin.users.filters.clearButton'),
        },
        tabs: {
          container: cySelector('superadmin.users.tabs.container'),
          regularUsers: cySelector('superadmin.users.tabs.regularUsers'),
          superadmins: cySelector('superadmin.users.tabs.superadmins'),
        },
        table: {
          element: cySelector('superadmin.users.table.element'),
          row: (id: string) => cySelector('superadmin.users.table.row', { id }),
          viewButton: (id: string) => cySelector('superadmin.users.table.viewButton', { id }),
          editButton: (id: string) => cySelector('superadmin.users.table.editButton', { id }),
          banButton: (id: string) => cySelector('superadmin.users.table.banButton', { id }),
          deleteButton: (id: string) => cySelector('superadmin.users.table.deleteButton', { id }),
          impersonateButton: (id: string) => cySelector('superadmin.users.table.impersonateButton', { id }),
        },
        pagination: {
          container: cySelector('superadmin.users.pagination.container'),
          pageSize: cySelector('superadmin.users.pagination.pageSize'),
          first: cySelector('superadmin.users.pagination.first'),
          prev: cySelector('superadmin.users.pagination.prev'),
          next: cySelector('superadmin.users.pagination.next'),
          last: cySelector('superadmin.users.pagination.last'),
        },
        detail: {
          container: cySelector('superadmin.users.detail.container'),
          info: {
            email: cySelector('superadmin.users.detail.info.email'),
            role: cySelector('superadmin.users.detail.info.role'),
            status: cySelector('superadmin.users.detail.info.status'),
            teams: cySelector('superadmin.users.detail.info.teams'),
            activity: cySelector('superadmin.users.detail.info.activity'),
          },
          actions: cySelector('superadmin.users.detail.actions'),
          metas: {
            container: cySelector('superadmin.users.detail.metas.container'),
            title: cySelector('superadmin.users.detail.metas.title'),
            table: cySelector('superadmin.users.detail.metas.table'),
            empty: cySelector('superadmin.users.detail.metas.empty'),
            row: (key: string) => cySelector('superadmin.users.detail.metas.row', { key }),
            key: (key: string) => cySelector('superadmin.users.detail.metas.key', { key }),
            value: (key: string) => cySelector('superadmin.users.detail.metas.value', { key }),
            type: (key: string) => cySelector('superadmin.users.detail.metas.type', { key }),
            public: (key: string) => cySelector('superadmin.users.detail.metas.public', { key }),
            searchable: (key: string) => cySelector('superadmin.users.detail.metas.searchable', { key }),
          },
        },
      },

      // ─────────────────────────────────────────
      // TEAMS - Team management (list + detail)
      // ─────────────────────────────────────────
      teams: {
        container: cySelector('superadmin.teams.container'),
        header: {
          backButton: cySelector('superadmin.teams.header.backButton'),
          title: cySelector('superadmin.teams.header.title'),
          refreshButton: cySelector('superadmin.teams.header.refreshButton'),
        },
        stats: {
          totalTeams: cySelector('superadmin.teams.stats.totalTeams'),
        },
        filters: {
          search: cySelector('superadmin.teams.filters.search'),
          clearButton: cySelector('superadmin.teams.filters.clearButton'),
        },
        tabs: {
          container: cySelector('superadmin.teams.tabs.container'),
          userTeams: cySelector('superadmin.teams.tabs.userTeams'),
          systemAdmin: cySelector('superadmin.teams.tabs.systemAdmin'),
        },
        table: {
          element: cySelector('superadmin.teams.table.element'),
          row: (id: string) => cySelector('superadmin.teams.table.row', { id }),
          menuButton: (id: string) => cySelector('superadmin.teams.table.menuButton', { id }),
          menuContent: (id: string) => cySelector('superadmin.teams.table.menuContent', { id }),
          viewButton: (id: string) => cySelector('superadmin.teams.table.viewButton', { id }),
          editButton: (id: string) => cySelector('superadmin.teams.table.editButton', { id }),
          deleteButton: (id: string) => cySelector('superadmin.teams.table.deleteButton', { id }),
        },
        pagination: {
          container: cySelector('superadmin.teams.pagination.container'),
          pageSize: cySelector('superadmin.teams.pagination.pageSize'),
          first: cySelector('superadmin.teams.pagination.first'),
          prev: cySelector('superadmin.teams.pagination.prev'),
          next: cySelector('superadmin.teams.pagination.next'),
          last: cySelector('superadmin.teams.pagination.last'),
        },
        detail: {
          container: cySelector('superadmin.teams.detail.container'),
          info: {
            name: cySelector('superadmin.teams.detail.info.name'),
            owner: cySelector('superadmin.teams.detail.info.owner'),
            members: cySelector('superadmin.teams.detail.info.members'),
          },
          membersTable: {
            container: cySelector('superadmin.teams.detail.membersTable.container'),
            row: (id: string) => cySelector('superadmin.teams.detail.membersTable.row', { id }),
          },
          subscription: {
            container: cySelector('superadmin.teams.detail.subscription.container'),
            plan: cySelector('superadmin.teams.detail.subscription.plan'),
            status: cySelector('superadmin.teams.detail.subscription.status'),
            period: cySelector('superadmin.teams.detail.subscription.period'),
            stripeLink: cySelector('superadmin.teams.detail.subscription.stripeLink'),
          },
          billingHistory: {
            container: cySelector('superadmin.teams.detail.billingHistory.container'),
            row: (id: string) => cySelector('superadmin.teams.detail.billingHistory.row', { id }),
          },
          usage: {
            container: cySelector('superadmin.teams.detail.usage.container'),
            metric: (slug: string) => cySelector('superadmin.teams.detail.usage.metric', { slug }),
          },
        },
      },

      // ─────────────────────────────────────────
      // SUBSCRIPTIONS - Subscriptions overview
      // ─────────────────────────────────────────
      subscriptions: {
        container: cySelector('superadmin.subscriptions.container'),
        header: {
          backButton: cySelector('superadmin.subscriptions.header.backButton'),
          title: cySelector('superadmin.subscriptions.header.title'),
          refreshButton: cySelector('superadmin.subscriptions.header.refreshButton'),
        },
        stats: {
          mrr: cySelector('superadmin.subscriptions.stats.mrr'),
          arr: cySelector('superadmin.subscriptions.stats.arr'),
          activeCount: cySelector('superadmin.subscriptions.stats.activeCount'),
          totalCount: cySelector('superadmin.subscriptions.stats.totalCount'),
          needsAttention: cySelector('superadmin.subscriptions.stats.needsAttention'),
          planDistribution: cySelector('superadmin.subscriptions.stats.planDistribution'),
          planCount: (plan: string) => cySelector('superadmin.subscriptions.stats.planCount', { plan }),
        },
        filters: {
          search: cySelector('superadmin.subscriptions.filters.search'),
          statusFilter: cySelector('superadmin.subscriptions.filters.statusFilter'),
          planFilter: cySelector('superadmin.subscriptions.filters.planFilter'),
          intervalFilter: cySelector('superadmin.subscriptions.filters.intervalFilter'),
          clearButton: cySelector('superadmin.subscriptions.filters.clearButton'),
        },
        table: {
          element: cySelector('superadmin.subscriptions.table.element'),
          row: (id: string) => cySelector('superadmin.subscriptions.table.row', { id }),
          viewTeamButton: (id: string) => cySelector('superadmin.subscriptions.table.viewTeamButton', { id }),
          stripeLink: (id: string) => cySelector('superadmin.subscriptions.table.stripeLink', { id }),
        },
        pagination: {
          container: cySelector('superadmin.subscriptions.pagination.container'),
          pageSize: cySelector('superadmin.subscriptions.pagination.pageSize'),
          first: cySelector('superadmin.subscriptions.pagination.first'),
          prev: cySelector('superadmin.subscriptions.pagination.prev'),
          next: cySelector('superadmin.subscriptions.pagination.next'),
          last: cySelector('superadmin.subscriptions.pagination.last'),
        },
      },

      // ─────────────────────────────────────────
      // TEAM ROLES - RBAC Matrix and Plan Features
      // ─────────────────────────────────────────
      teamRoles: {
        container: cySelector('superadmin.teamRoles.container'),
        header: {
          backButton: cySelector('superadmin.teamRoles.header.backButton'),
          title: cySelector('superadmin.teamRoles.header.title'),
        },
        tabs: {
          container: cySelector('superadmin.teamRoles.tabs.container'),
          rbac: cySelector('superadmin.teamRoles.tabs.rbac'),
          plans: cySelector('superadmin.teamRoles.tabs.plans'),
        },
        rbac: {
          stats: {
            roles: cySelector('superadmin.teamRoles.rbac.stats.roles'),
            permissions: cySelector('superadmin.teamRoles.rbac.stats.permissions'),
            protectedRole: cySelector('superadmin.teamRoles.rbac.stats.protectedRole'),
            defaultRole: cySelector('superadmin.teamRoles.rbac.stats.defaultRole'),
          },
          hierarchy: {
            container: cySelector('superadmin.teamRoles.rbac.hierarchy.container'),
            roleCard: (role: string) => cySelector('superadmin.teamRoles.rbac.hierarchy.roleCard', { role }),
          },
          matrix: {
            container: cySelector('superadmin.teamRoles.rbac.matrix.container'),
            permissionRow: (permission: string) => cySelector('superadmin.teamRoles.rbac.matrix.permissionRow', { permission: permission.replace(/\./g, '-') }),
          },
        },
        plans: {
          stats: {
            totalPlans: cySelector('superadmin.teamRoles.plans.stats.totalPlans'),
            features: cySelector('superadmin.teamRoles.plans.stats.features'),
            limits: cySelector('superadmin.teamRoles.plans.stats.limits'),
            activeTheme: cySelector('superadmin.teamRoles.plans.stats.activeTheme'),
          },
          planCard: (slug: string) => cySelector('superadmin.teamRoles.plans.planCard', { slug }),
          matrix: {
            container: cySelector('superadmin.teamRoles.plans.matrix.container'),
            featureRow: (slug: string) => cySelector('superadmin.teamRoles.plans.matrix.featureRow', { slug }),
            limitRow: (slug: string) => cySelector('superadmin.teamRoles.plans.matrix.limitRow', { slug }),
          },
        },
      },

      // ─────────────────────────────────────────
      // DOCS - Admin documentation pages
      // ─────────────────────────────────────────
      docs: {
        container: cySelector('superadmin.docs.container'),
        pageDetail: cySelector('superadmin.docs.pageDetail'),
        sectionCard: (slug: string) => cySelector('superadmin.docs.sectionCard', { slug }),
        pageLink: (slug: string) => cySelector('superadmin.docs.pageLink', { slug }),
      },
    }
  }

  // ============================================
  // LEGACY SELECTOR ALIASES (for backward compatibility)
  // These map old selector names to new structure
  // TODO: Remove after updating all tests
  // ============================================

  get legacySelectors() {
    return {
      // Old navigation selectors → new sidebar.nav
      navContainer: this.selectors.container,
      navDashboard: this.selectors.sidebar.nav.dashboard,
      navUsers: this.selectors.sidebar.nav.users,
      navTeams: this.selectors.sidebar.nav.teams,
      navTeamRoles: this.selectors.sidebar.nav.teamRoles,
      navSubscriptions: this.selectors.sidebar.nav.subscriptions,
      exitToDashboard: this.selectors.sidebar.exitButton,

      // Old dashboard selectors
      dashboardContainer: this.selectors.dashboard.container,

      // Old users selectors
      usersContainer: this.selectors.users.container,
      usersTable: this.selectors.users.table.element,
      usersSearch: this.selectors.users.filters.search,
      userRow: this.selectors.users.table.row,
      userView: this.selectors.users.table.viewButton,
      userEdit: this.selectors.users.table.editButton,
      userBan: this.selectors.users.table.banButton,
      userDelete: this.selectors.users.table.deleteButton,
      userImpersonate: this.selectors.users.table.impersonateButton,

      // Old teams selectors
      teamsContainer: this.selectors.teams.container,
      teamsTable: this.selectors.teams.table.element,
      teamsSearch: this.selectors.teams.filters.search,
      teamRow: this.selectors.teams.table.row,
      teamActionsButton: this.selectors.teams.table.menuButton,
      teamView: this.selectors.teams.table.viewButton,
      teamEdit: this.selectors.teams.table.editButton,
      teamDelete: this.selectors.teams.table.deleteButton,

      // Old subscriptions selectors
      subscriptionsContainer: this.selectors.subscriptions.container,
      subscriptionsMrr: this.selectors.subscriptions.stats.mrr,
      subscriptionsPlanDistribution: this.selectors.subscriptions.stats.planDistribution,
      subscriptionsPlanCount: this.selectors.subscriptions.stats.planCount,
      subscriptionsActiveCount: this.selectors.subscriptions.stats.activeCount,

      // Old permission selectors
      permissionRow: this.selectors.teamRoles.rbac.matrix.permissionRow,
    }
  }

  // ============================================
  // NAVIGATION - Visit Pages
  // ============================================

  /** Navigate to Superadmin dashboard */
  visitDashboard() {
    cy.visit('/superadmin', { timeout: 60000 })
    return this
  }

  /** Navigate to all users page */
  visitUsers() {
    cy.visit('/superadmin/users', { timeout: 60000 })
    return this
  }

  /** Navigate to user detail page */
  visitUserDetail(id: string) {
    cy.visit(`/superadmin/users/${id}`, { timeout: 60000 })
    return this
  }

  /** Navigate to all teams page */
  visitTeams() {
    cy.visit('/superadmin/teams', { timeout: 60000 })
    return this
  }

  /** Navigate to team detail page */
  visitTeamDetail(id: string) {
    cy.visit(`/superadmin/teams/${id}`, { timeout: 60000 })
    return this
  }

  /** Navigate to subscriptions overview */
  visitSubscriptions() {
    cy.visit('/superadmin/subscriptions', { timeout: 60000 })
    return this
  }

  /** Navigate to team roles (RBAC & Plans) */
  visitTeamRoles() {
    cy.visit('/superadmin/team-roles', { timeout: 60000 })
    return this
  }

  /** Navigate to docs index */
  visitDocs() {
    cy.visit('/superadmin/docs', { timeout: 60000 })
    return this
  }

  /** Navigate to a specific doc page */
  visitDocPage(section: string, page: string) {
    cy.visit(`/superadmin/docs/${section}/${page}`, { timeout: 60000 })
    return this
  }

  // ============================================
  // NAVIGATION - Sidebar Clicks
  // ============================================

  /** Click nav link to dashboard */
  clickNavDashboard() {
    cy.get(this.selectors.sidebar.nav.dashboard).click()
    return this
  }

  /** Click nav link to users */
  clickNavUsers() {
    cy.get(this.selectors.sidebar.nav.users).click()
    return this
  }

  /** Click nav link to teams */
  clickNavTeams() {
    cy.get(this.selectors.sidebar.nav.teams).click()
    return this
  }

  /** Click nav link to team roles */
  clickNavTeamRoles() {
    cy.get(this.selectors.sidebar.nav.teamRoles).click()
    return this
  }

  /** Click nav link to subscriptions */
  clickNavSubscriptions() {
    cy.get(this.selectors.sidebar.nav.subscriptions).click()
    return this
  }

  /** Click nav link to docs */
  clickNavDocs() {
    cy.get(this.selectors.sidebar.nav.docs).click()
    return this
  }

  /** Click exit button to return to main dashboard */
  clickExitButton() {
    cy.get(this.selectors.sidebar.exitButton).click()
    return this
  }

  /** Toggle sidebar collapse */
  toggleSidebarCollapse() {
    cy.get(this.selectors.sidebar.collapseButton).click()
    return this
  }

  // ============================================
  // USERS ACTIONS
  // ============================================

  /** Search users */
  searchUsers(query: string) {
    cy.get(this.selectors.users.filters.search).clear().type(query)
    return this
  }

  /** Clear users search */
  clearUsersSearch() {
    cy.get(this.selectors.users.filters.search).clear()
    return this
  }

  /** Clear all users filters */
  clearUsersFilters() {
    cy.get(this.selectors.users.filters.clearButton).click()
    return this
  }

  /** Switch to regular users tab */
  switchToRegularUsersTab() {
    cy.get(this.selectors.users.tabs.regularUsers).click()
    return this
  }

  /** Switch to superadmins tab */
  switchToSuperadminsTab() {
    cy.get(this.selectors.users.tabs.superadmins).click()
    return this
  }

  /** Click on a user row to view details */
  clickUserRow(id: string) {
    cy.get(this.selectors.users.table.row(id)).click()
    return this
  }

  /** View user details via button */
  viewUser(id: string) {
    cy.get(this.selectors.users.table.viewButton(id)).click()
    return this
  }

  /** Ban a user */
  banUser(id: string) {
    cy.get(this.selectors.users.table.banButton(id)).click()
    return this
  }

  /** Impersonate a user */
  impersonateUser(id: string) {
    cy.get(this.selectors.users.table.impersonateButton(id)).click()
    return this
  }

  // ============================================
  // TEAMS ACTIONS
  // ============================================

  /** Search teams */
  searchTeams(query: string) {
    cy.get(this.selectors.teams.filters.search).clear().type(query)
    return this
  }

  /** Clear teams search */
  clearTeamsSearch() {
    cy.get(this.selectors.teams.filters.search).clear()
    return this
  }

  /** Clear all teams filters */
  clearTeamsFilters() {
    cy.get(this.selectors.teams.filters.clearButton).click()
    return this
  }

  /** Switch to user teams tab */
  switchToUserTeamsTab() {
    cy.get(this.selectors.teams.tabs.userTeams).click()
    return this
  }

  /** Switch to system admin team tab */
  switchToSystemAdminTab() {
    cy.get(this.selectors.teams.tabs.systemAdmin).click()
    return this
  }

  /** Click on a team row to view details */
  clickTeamRow(id: string) {
    cy.get(this.selectors.teams.table.row(id)).click()
    return this
  }

  /** Open team actions menu */
  openTeamMenu(id: string) {
    cy.get(this.selectors.teams.table.menuButton(id)).click()
    return this
  }

  /** View team details via button */
  viewTeam(id: string) {
    cy.get(this.selectors.teams.table.viewButton(id)).click()
    return this
  }

  // ============================================
  // TEAM ROLES ACTIONS
  // ============================================

  /** Switch to RBAC tab */
  switchToRbacTab() {
    cy.get(this.selectors.teamRoles.tabs.rbac).click()
    return this
  }

  /** Switch to Plans tab */
  switchToPlansTab() {
    cy.get(this.selectors.teamRoles.tabs.plans).click()
    return this
  }

  // ============================================
  // PAGINATION (Contextual)
  // ============================================

  /** Get pagination selectors for a specific context */
  getPaginationSelectors(context: PaginationContext) {
    return this.selectors[context].pagination
  }

  /** Go to first page */
  paginateFirst(context: PaginationContext) {
    cy.get(this.selectors[context].pagination.first).click()
    return this
  }

  /** Go to previous page */
  paginatePrev(context: PaginationContext) {
    cy.get(this.selectors[context].pagination.prev).click()
    return this
  }

  /** Go to next page */
  paginateNext(context: PaginationContext) {
    cy.get(this.selectors[context].pagination.next).click()
    return this
  }

  /** Go to last page */
  paginateLast(context: PaginationContext) {
    cy.get(this.selectors[context].pagination.last).click()
    return this
  }

  /** Change page size */
  changePageSize(context: PaginationContext, size: number) {
    cy.get(this.selectors[context].pagination.pageSize).click()
    cy.get(`[data-value="${size}"]`).click()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /** Assert on Superadmin area */
  assertOnSuperadmin() {
    cy.url().should('include', '/superadmin')
    return this
  }

  /** Assert dashboard is visible */
  assertDashboardVisible() {
    cy.get(this.selectors.dashboard.container).should('be.visible')
    return this
  }

  /** Assert sidebar is visible */
  assertSidebarVisible() {
    cy.get(this.selectors.sidebar.nav.dashboard).should('be.visible')
    return this
  }

  /** Assert users page is visible */
  assertUsersVisible() {
    cy.get(this.selectors.users.container).should('be.visible')
    return this
  }

  /** Assert users table is visible */
  assertUsersTableVisible() {
    cy.get(this.selectors.users.table.element).should('be.visible')
    return this
  }

  /** Assert user detail is visible */
  assertUserDetailVisible() {
    cy.get(this.selectors.users.detail.container).should('be.visible')
    return this
  }

  /** Assert user metadata section is visible */
  assertUserMetasVisible() {
    cy.get(this.selectors.users.detail.metas.container).should('be.visible')
    return this
  }

  /** Assert teams page is visible */
  assertTeamsVisible() {
    cy.get(this.selectors.teams.container).should('be.visible')
    return this
  }

  /** Assert teams table is visible */
  assertTeamsTableVisible() {
    cy.get(this.selectors.teams.table.element).should('be.visible')
    return this
  }

  /** Assert team detail is visible */
  assertTeamDetailVisible() {
    cy.get(this.selectors.teams.detail.container).should('be.visible')
    return this
  }

  /** Assert nav items are visible */
  assertNavVisible() {
    cy.get(this.selectors.container).should('be.visible')
    return this
  }

  /** Assert subscriptions page is visible */
  assertSubscriptionsVisible() {
    cy.get(this.selectors.subscriptions.container).should('be.visible')
    return this
  }

  /** Assert team roles page is visible */
  assertTeamRolesVisible() {
    cy.get(this.selectors.teamRoles.container).should('be.visible')
    return this
  }

  /** Assert RBAC matrix is visible */
  assertRbacMatrixVisible() {
    cy.get(this.selectors.teamRoles.rbac.matrix.container).should('be.visible')
    return this
  }

  /** Assert Plans matrix is visible */
  assertPlansMatrixVisible() {
    cy.get(this.selectors.teamRoles.plans.matrix.container).should('be.visible')
    return this
  }

  /** Assert docs index is visible */
  assertDocsVisible() {
    cy.get(this.selectors.docs.container).should('be.visible')
    return this
  }

  /** Assert docs page detail is visible */
  assertDocPageVisible() {
    cy.get(this.selectors.docs.pageDetail).should('be.visible')
    return this
  }

  /** Assert access denied (redirect from superadmin) */
  assertAccessDenied() {
    cy.url().should('not.include', '/superadmin')
    cy.url().should('satisfy', (url: string) => {
      return url.includes('/dashboard') || url.includes('error=access_denied')
    })
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  /** Wait for Superadmin dashboard to load */
  waitForDashboard() {
    cy.url().should('include', '/superadmin')
    cy.get(this.selectors.dashboard.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for users page to load */
  waitForUsers() {
    cy.url().should('include', '/superadmin/users')
    cy.get(this.selectors.users.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for user detail to load */
  waitForUserDetail() {
    cy.url().should('match', /\/superadmin\/users\/[^/]+$/)
    cy.get(this.selectors.users.detail.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for teams page to load */
  waitForTeams() {
    cy.url().should('include', '/superadmin/teams')
    cy.get(this.selectors.teams.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for team detail to load */
  waitForTeamDetail() {
    cy.url().should('match', /\/superadmin\/teams\/[^/]+$/)
    cy.get(this.selectors.teams.detail.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for subscriptions page to load */
  waitForSubscriptions() {
    cy.url().should('include', '/superadmin/subscriptions')
    cy.get(this.selectors.subscriptions.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for team roles page to load */
  waitForTeamRoles() {
    cy.url().should('include', '/superadmin/team-roles')
    cy.get(this.selectors.teamRoles.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for docs index to load */
  waitForDocs() {
    cy.url().should('include', '/superadmin/docs')
    cy.get(this.selectors.docs.container, { timeout: 15000 }).should('be.visible')
    return this
  }

  /** Wait for doc page detail to load */
  waitForDocPage() {
    cy.url().should('match', /\/superadmin\/docs\/[^/]+\/[^/]+$/)
    cy.get(this.selectors.docs.pageDetail, { timeout: 15000 }).should('be.visible')
    return this
  }

  // ============================================
  // DOCS ACTIONS
  // ============================================

  /** Click on a doc page link */
  clickDocPageLink(slug: string) {
    cy.get(this.selectors.docs.pageLink(slug)).click()
    return this
  }
}

export default SuperadminPOM
