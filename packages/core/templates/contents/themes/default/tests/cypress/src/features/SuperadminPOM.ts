/**
 * SuperadminPOM - Page Object Model for Superadmin Area
 *
 * Handles Superadmin Panel pages:
 * - Dashboard with system stats (/superadmin)
 * - All users management (/superadmin/users)
 * - All teams management (/superadmin/teams)
 * - Subscriptions overview (/superadmin/subscriptions)
 * - System configuration (/superadmin/system)
 *
 * Uses selectors from centralized selectors.ts
 *
 * NOTE: For /superadmin/team-roles (permissions matrix), use SuperadminTeamRolesPOM instead.
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

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
      // Navigation
      navContainer: cySelector('superadmin.container'),
      navDashboard: cySelector('superadmin.navigation.dashboard'),
      navUsers: cySelector('superadmin.navigation.users'),
      navTeams: cySelector('superadmin.navigation.teams'),
      navTeamRoles: cySelector('superadmin.navigation.teamRoles'),
      navSubscriptions: cySelector('superadmin.navigation.subscriptions'),
      exitToDashboard: cySelector('superadmin.navigation.exitToDashboard'),

      // Dashboard
      dashboardContainer: cySelector('superadmin.dashboard.container'),

      // Users
      usersContainer: cySelector('superadmin.users.container'),
      usersTable: cySelector('superadmin.users.table'),
      usersSearch: cySelector('superadmin.users.search'),
      userRow: (id: string) => cySelector('superadmin.users.row', { id }),
      userView: (id: string) => cySelector('superadmin.users.viewButton', { id }),
      userEdit: (id: string) => cySelector('superadmin.users.editButton', { id }),
      userBan: (id: string) => cySelector('superadmin.users.banButton', { id }),
      userDelete: (id: string) => cySelector('superadmin.users.deleteButton', { id }),
      userImpersonate: (id: string) => cySelector('superadmin.users.impersonateButton', { id }),

      // Teams
      teamsContainer: cySelector('superadmin.teams.container'),
      teamsTable: cySelector('superadmin.teams.table'),
      teamsSearch: cySelector('superadmin.teams.search'),
      teamRow: (id: string) => cySelector('superadmin.teams.row', { id }),
      teamActionsButton: (id: string) => cySelector('superadmin.teams.actionsButton', { id }),
      teamView: (id: string) => cySelector('superadmin.teams.viewButton', { id }),
      teamEdit: (id: string) => cySelector('superadmin.teams.editButton', { id }),
      teamDelete: (id: string) => cySelector('superadmin.teams.deleteButton', { id }),

      // Pagination (shared across superadmin pages)
      paginationPageSize: cySelector('superadmin.pagination.pageSize'),
      paginationFirst: cySelector('superadmin.pagination.first'),
      paginationPrev: cySelector('superadmin.pagination.prev'),
      paginationNext: cySelector('superadmin.pagination.next'),
      paginationLast: cySelector('superadmin.pagination.last'),

      // Permissions (team-roles page)
      permissionRow: (permission: string) => cySelector('superadmin.permissions.row', { permission: permission.replace(/\./g, '-') }),

      // Subscriptions
      subscriptionsContainer: cySelector('superadmin.subscriptions.container'),
      subscriptionsMrr: cySelector('superadmin.subscriptions.mrr'),
      subscriptionsPlanDistribution: cySelector('superadmin.subscriptions.planDistribution'),
      subscriptionsPlanCount: (plan: string) => cySelector('superadmin.subscriptions.planCount', { plan }),
      subscriptionsActiveCount: cySelector('superadmin.subscriptions.activeCount'),
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Navigate to Superadmin dashboard
   */
  visitDashboard() {
    cy.visit('/superadmin', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to all users page
   */
  visitUsers() {
    cy.visit('/superadmin/users', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to all teams page
   */
  visitTeams() {
    cy.visit('/superadmin/teams', { timeout: 60000 })
    return this
  }

  /**
   * Navigate to subscriptions overview
   */
  visitSubscriptions() {
    cy.visit('/superadmin/subscriptions', { timeout: 60000 })
    return this
  }

  /**
   * Click nav link to dashboard
   */
  clickNavDashboard() {
    cy.get(this.selectors.navDashboard).click()
    return this
  }

  /**
   * Click nav link to users
   */
  clickNavUsers() {
    cy.get(this.selectors.navUsers).click()
    return this
  }

  /**
   * Click nav link to teams
   */
  clickNavTeams() {
    cy.get(this.selectors.navTeams).click()
    return this
  }

  // ============================================
  // USERS ACTIONS
  // ============================================

  /**
   * Search users
   */
  searchUsers(query: string) {
    cy.get(this.selectors.usersSearch).clear().type(query)
    return this
  }

  /**
   * View user details
   */
  viewUser(id: string) {
    cy.get(this.selectors.userView(id)).click()
    return this
  }

  /**
   * Ban a user
   */
  banUser(id: string) {
    cy.get(this.selectors.userBan(id)).click()
    return this
  }

  /**
   * Impersonate a user
   */
  impersonateUser(id: string) {
    cy.get(this.selectors.userImpersonate(id)).click()
    return this
  }

  // ============================================
  // TEAMS ACTIONS
  // ============================================

  /**
   * Search teams
   */
  searchTeams(query: string) {
    cy.get(this.selectors.teamsSearch).clear().type(query)
    return this
  }

  /**
   * View team details
   */
  viewTeam(id: string) {
    cy.get(this.selectors.teamView(id)).click()
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Assert on Superadmin area
   */
  assertOnSuperadmin() {
    cy.url().should('include', '/superadmin')
    return this
  }

  /**
   * Assert dashboard is visible
   */
  assertDashboardVisible() {
    cy.get(this.selectors.dashboardContainer).should('be.visible')
    return this
  }

  /**
   * Assert stats cards are visible
   */
  assertStatsVisible() {
    cy.get(this.selectors.statsUsers).should('be.visible')
    cy.get(this.selectors.statsTeams).should('be.visible')
    return this
  }

  /**
   * Assert users page is visible
   */
  assertUsersVisible() {
    cy.get(this.selectors.usersContainer).should('be.visible')
    return this
  }

  /**
   * Assert users table is visible
   */
  assertUsersTableVisible() {
    cy.get(this.selectors.usersTable).should('be.visible')
    return this
  }

  /**
   * Assert teams page is visible
   */
  assertTeamsVisible() {
    cy.get(this.selectors.teamsContainer).should('be.visible')
    return this
  }

  /**
   * Assert teams table is visible
   */
  assertTeamsTableVisible() {
    cy.get(this.selectors.teamsTable).should('be.visible')
    return this
  }

  /**
   * Assert nav items are visible
   */
  assertNavVisible() {
    cy.get(this.selectors.navContainer).should('be.visible')
    return this
  }

  /**
   * Assert subscriptions page is visible
   */
  assertSubscriptionsVisible() {
    cy.get(this.selectors.subscriptionsContainer).should('be.visible')
    return this
  }

  /**
   * Assert access denied (redirect from superadmin)
   */
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

  /**
   * Wait for Superadmin dashboard to load
   */
  waitForDashboard() {
    cy.url().should('include', '/superadmin')
    cy.get(this.selectors.dashboardContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for users page to load
   */
  waitForUsers() {
    cy.url().should('include', '/superadmin/users')
    cy.get(this.selectors.usersContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for teams page to load
   */
  waitForTeams() {
    cy.url().should('include', '/superadmin/teams')
    cy.get(this.selectors.teamsContainer, { timeout: 15000 }).should('be.visible')
    return this
  }

  /**
   * Wait for subscriptions page to load
   */
  waitForSubscriptions() {
    cy.url().should('include', '/superadmin/subscriptions')
    cy.get(this.selectors.subscriptionsContainer, { timeout: 15000 }).should('be.visible')
    return this
  }
}

export default SuperadminPOM
