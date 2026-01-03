/**
 * SuperadminTeamRolesPOM - Page Object Model for Admin Team Roles Matrix
 *
 * Tests the consolidated permissions matrix that shows:
 * - All team roles with hierarchy levels
 * - Permissions grouped by category
 * - Visual indicators for permission grants (checkmarks)
 * - Dangerous permissions highlighted
 *
 * @version 3.0 - Uses centralized selectors from cySelector()
 *
 * @example
 * // Verify matrix displays all roles
 * SuperadminTeamRolesPOM.create()
 *   .visit()
 *   .verifyRolesDisplayed(['owner', 'admin', 'member', 'editor', 'viewer'])
 *
 * // Check editor permissions
 * SuperadminTeamRolesPOM.create()
 *   .visit()
 *   .verifyHasPermission('editor', 'customers.list')
 *   .verifyNoPermission('editor', 'customers.create')
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export interface RoleHierarchy {
  role: string
  level: number
}

export class SuperadminTeamRolesPOM extends BasePOM {
  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): SuperadminTeamRolesPOM {
    return new SuperadminTeamRolesPOM()
  }

  // ============================================
  // SELECTORS using centralized cySelector()
  // ============================================

  get selectors() {
    return {
      // Page structure
      pageTitle: 'h1',
      backButton: cySelector('superadmin.teamRoles.backButton'),

      // Stats cards (use contains since no specific data-cy)
      statsCard: '.grid-cols-1 .border',

      // Role cards in hierarchy section
      roleCard: (role: string) => cySelector('superadmin.teamRoles.roleCard', { role }),
      roleHierarchyBadge: '.font-semibold',

      // Permissions matrix table
      matrixTable: '.rounded-md.border table',
      permissionRow: (permission: string) =>
        cySelector('superadmin.permissions.row', { permission: permission.replace(/\./g, '-') }),

      // Category headers
      categoryHeader: '.bg-muted\\/50',

      // Permission checkmarks and X marks (Lucide icons with Tailwind classes)
      // Note: These are SVG elements with the class applied
      checkmark: 'svg.lucide-check, .text-green-600',
      xMark: 'svg.lucide-x',

      // Dangerous permission badge (Badge component with variant="destructive")
      dangerousBadge: '[class*="destructive"]',

      // Legend section
      legend: '.bg-muted\\/30',
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Navigate to Team Roles page
   */
  visit() {
    cy.visit('/superadmin/team-roles')
    this.waitForPageLoad()
    return this
  }

  /**
   * Wait for page to fully load
   */
  waitForPageLoad() {
    cy.get(this.selectors.matrixTable, { timeout: 15000 }).should('be.visible')
    return this
  }

  // ============================================
  // ROLE CARDS (HIERARCHY SECTION)
  // ============================================

  /**
   * Get a role card by role name
   */
  getRoleCard(role: string) {
    return cy.get(this.selectors.roleCard(role))
  }

  /**
   * Verify all expected roles are displayed
   */
  verifyRolesDisplayed(expectedRoles: string[]) {
    for (const role of expectedRoles) {
      this.getRoleCard(role).should('be.visible')
    }
    return this
  }

  /**
   * Verify role hierarchy level
   */
  verifyRoleHierarchy(role: string, expectedLevel: number) {
    this.getRoleCard(role)
      .find('.font-semibold')
      .first()
      .should('contain', expectedLevel.toString())
    return this
  }

  /**
   * Get permission count text for a role
   */
  getPermissionCount(role: string) {
    return this.getRoleCard(role).find('.text-muted-foreground')
  }

  /**
   * Verify role has expected permission count
   */
  verifyPermissionCount(role: string, expectedCount: number) {
    this.getPermissionCount(role).should('contain', `${expectedCount} permissions`)
    return this
  }

  // ============================================
  // PERMISSIONS MATRIX
  // ============================================

  /**
   * Get a permission row by permission ID
   */
  getPermissionRow(permission: string) {
    return cy.get(this.selectors.permissionRow(permission))
  }

  /**
   * Get column index for a role in the matrix
   * Roles are sorted by hierarchy: owner, admin, member, editor, viewer
   */
  private getRoleColumnIndex(role: string): number {
    const roleOrder = ['owner', 'admin', 'member', 'editor', 'viewer']
    const index = roleOrder.indexOf(role)
    // +2 because first column is permission name
    return index >= 0 ? index + 2 : -1
  }

  /**
   * Verify a role has a specific permission (green checkmark)
   */
  verifyHasPermission(role: string, permission: string) {
    const colIndex = this.getRoleColumnIndex(role)
    this.getPermissionRow(permission)
      .find(`td:nth-child(${colIndex})`)
      .find(this.selectors.checkmark)
      .should('exist')
    return this
  }

  /**
   * Verify a role does NOT have a specific permission (red X)
   */
  verifyNoPermission(role: string, permission: string) {
    const colIndex = this.getRoleColumnIndex(role)
    this.getPermissionRow(permission)
      .find(`td:nth-child(${colIndex})`)
      .find(this.selectors.xMark)
      .should('exist')
    return this
  }

  /**
   * Verify a permission is marked as dangerous
   * The dangerous badge contains text "dangerous" with destructive styling
   */
  verifyDangerousPermission(permission: string) {
    this.getPermissionRow(permission)
      .scrollIntoView()
      .contains('dangerous')
      .should('be.visible')
    return this
  }

  /**
   * Verify permission row shows permission ID with dangerous styling
   */
  verifyDangerousPermissionText(permission: string) {
    this.getPermissionRow(permission)
      .find('.text-red-600')
      .should('contain', permission)
    return this
  }

  // ============================================
  // CATEGORY HEADERS
  // ============================================

  /**
   * Get all category headers
   */
  getCategoryHeaders() {
    return cy.get(this.selectors.categoryHeader)
  }

  /**
   * Verify expected categories are present
   */
  verifyCategoriesPresent(categories: string[]) {
    for (const category of categories) {
      this.getCategoryHeaders().should('contain', category)
    }
    return this
  }

  // ============================================
  // STATS CARDS
  // ============================================

  /**
   * Verify stats card shows expected value
   */
  verifyStatsCard(title: string, value: string) {
    cy.contains('.font-medium', title)
      .parents('.border')
      .find('.text-2xl')
      .should('contain', value)
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  /**
   * Verify owner has all permissions (all checkmarks)
   */
  verifyOwnerHasAllPermissions() {
    // Owner column should have no X marks
    cy.get(this.selectors.matrixTable)
      .find('tbody tr:not(.bg-muted\\/50)')
      .each(($row) => {
        cy.wrap($row)
          .find('td:nth-child(2)') // Owner is first role column
          .find(this.selectors.checkmark)
          .should('exist')
      })
    return this
  }

  /**
   * Verify editor has specific permission set
   */
  verifyEditorPermissions(expected: { permission: string; hasAccess: boolean }[]) {
    for (const { permission, hasAccess } of expected) {
      if (hasAccess) {
        this.verifyHasPermission('editor', permission)
      } else {
        this.verifyNoPermission('editor', permission)
      }
    }
    return this
  }
}
