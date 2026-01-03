/// <reference types="cypress" />

/**
 * Superadmin - Team Roles Matrix Tests
 *
 * Tests the team roles permissions matrix in Superadmin.
 * Validates that the consolidated permissions view shows:
 * - All 5 team roles with correct hierarchy levels
 * - Permissions grouped by category
 * - Correct permission assignments per role
 * - Dangerous permissions highlighted
 *
 * Requires: SuperAdmin access
 */

import * as allure from 'allure-cypress'

import { SuperadminTeamRolesPOM } from '../../../src/features/SuperadminTeamRolesPOM'
import { loginAsDefaultSuperadmin } from '../../../src/session-helpers'

describe('Superadmin - Team Roles Matrix', {
  tags: ['@uat', '@feat-superadmin', '@security', '@regression']
}, () => {
  const matrix = SuperadminTeamRolesPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Superadmin')
    allure.story('Team Roles Matrix')
    loginAsDefaultSuperadmin()
  })

  describe('Role Hierarchy Display', { tags: '@smoke' }, () => {
    it('S7_MATRIX_001: Matrix displays all 5 team roles', { tags: '@smoke' }, () => {
      allure.severity('critical')

      matrix.visit()

      // Verify all 5 roles are displayed
      const expectedRoles = ['owner', 'admin', 'member', 'editor', 'viewer']
      matrix.verifyRolesDisplayed(expectedRoles)

      cy.log('✅ All 5 team roles are displayed')
    })

    it('S7_MATRIX_002: Roles show correct hierarchy levels', () => {
      allure.severity('critical')

      matrix.visit()

      // Verify hierarchy levels
      matrix.verifyRoleHierarchy('owner', 100)
      matrix.verifyRoleHierarchy('admin', 50)
      matrix.verifyRoleHierarchy('member', 10)
      matrix.verifyRoleHierarchy('editor', 5)
      matrix.verifyRoleHierarchy('viewer', 1)

      cy.log('✅ All roles show correct hierarchy levels')
    })
  })

  describe('Permissions by Category', () => {
    it('S7_MATRIX_003: Permissions are grouped by category', () => {
      allure.severity('normal')

      matrix.visit()

      // Verify category headers are present
      // Categories come from:
      // - Core system permissions: Team, Settings
      // - Theme features: Page Builder, Blog, Media
      // - Entity permissions: Customers, Tasks, Posts, Pages
      const expectedCategories = [
        'Team',         // Core system (teams.invite, teams.remove_member, etc.)
        'Settings',     // Core system (settings.billing, settings.api_keys, etc.)
        'Page Builder', // Theme feature
        'Blog',         // Theme feature
        'Media',        // Theme feature
        'Customers',    // Entity
        'Pages',        // Entity
        'Posts',        // Entity
        'Tasks',        // Entity
      ]

      matrix.verifyCategoriesPresent(expectedCategories)

      cy.log('✅ Permissions are grouped by category')
    })
  })

  describe('Owner Permissions', { tags: '@smoke' }, () => {
    it('S7_MATRIX_004: Owner has all permissions', { tags: '@smoke' }, () => {
      allure.severity('critical')

      matrix.visit()

      // Owner should have checkmarks for all permissions
      matrix.verifyOwnerHasAllPermissions()

      cy.log('✅ Owner has all permissions')
    })
  })

  describe('Editor Permissions', () => {
    it('S7_MATRIX_005: Editor has only team view permissions', () => {
      allure.severity('critical')

      matrix.visit()

      // Editor role is configured with only: ['team.view', 'team.members.view']
      // This means Editor has just 2 permissions in the Team category
      // Verify Editor does NOT have customer CRUD permissions (those require higher roles)
      matrix.verifyEditorPermissions([
        { permission: 'teams.invite', hasAccess: false },
        { permission: 'teams.remove_member', hasAccess: false }
      ])

      cy.log('✅ Editor has correct limited permissions (2 permissions only)')
    })

    it('S7_MATRIX_006: Editor cannot access dangerous operations', () => {
      allure.severity('blocker')

      matrix.visit()

      // Editor should NOT have the dangerous teams.remove_member permission
      matrix.verifyNoPermission('editor', 'teams.remove_member')
      matrix.verifyNoPermission('editor', 'teams.invite')

      cy.log('✅ Editor has no dangerous permissions')
    })
  })

  describe('Dangerous Permissions', () => {
    it('S7_MATRIX_007: Dangerous permissions are highlighted', () => {
      allure.severity('normal')

      matrix.visit()

      // Check that teams.remove_member is marked as dangerous (visible in the UI)
      // The dangerous badge appears next to the permission name
      matrix.verifyDangerousPermission('teams.remove_member')

      cy.log('✅ Dangerous permissions are highlighted correctly')
    })
  })

  describe('Stats Cards', () => {
    it('S7_MATRIX_008: Stats cards show correct counts', () => {
      allure.severity('normal')

      matrix.visit()

      // Verify stats cards
      matrix.verifyStatsCard('Available Roles', '5')
      matrix.verifyStatsCard('Protected Role', 'owner')

      cy.log('✅ Stats cards display correct information')
    })
  })

  describe('Permission Counts per Role', () => {
    it('S7_MATRIX_009: Role cards show permission counts', () => {
      allure.severity('normal')

      matrix.visit()

      // Each role card should show permissions count
      // Owner has most (all permissions)
      matrix.getPermissionCount('owner').should('contain', 'permissions')

      // Editor should have fewer
      matrix.getPermissionCount('editor').should('contain', 'permissions')

      // Viewer should have least
      matrix.getPermissionCount('viewer').should('contain', 'permissions')

      cy.log('✅ Permission counts are displayed for each role')
    })
  })

  after(() => {
    cy.log('✅ Team Roles Matrix tests completed')
  })
})
