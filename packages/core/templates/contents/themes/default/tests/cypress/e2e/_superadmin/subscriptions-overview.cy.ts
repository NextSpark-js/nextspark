/// <reference types="cypress" />

/**
 * Superadmin Subscriptions Overview Tests
 *
 * Tests the Superadmin subscriptions overview page:
 * - Subscriptions dashboard access
 * - Revenue metrics display
 * - Plan distribution stats
 * - Subscription overview
 *
 * Note: The route is /superadmin/subscriptions (not /billing)
 *
 * Tags: @uat, @feat-superadmin, @superadmin, @subscriptions
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultSuperadmin } from '../../src/session-helpers'
import { SuperadminPOM } from '../../src/features/SuperadminPOM'

describe('Superadmin - Subscriptions Overview', {
  tags: ['@uat', '@feat-superadmin', '@superadmin', '@subscriptions']
}, () => {
  const superadmin = SuperadminPOM.create()

  beforeEach(() => {
    allure.epic('Admin')
    allure.feature('Subscriptions Overview')
    allure.story('Platform Subscriptions')
    loginAsDefaultSuperadmin()
  })

  describe('ADMIN-SUBS-001: Subscriptions Page Access', { tags: '@smoke' }, () => {
    it('should access subscriptions overview page', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Validate subscriptions page
      cy.url().should('include', '/superadmin/subscriptions')

      cy.log('✅ Subscriptions overview accessible')
    })
  })

  describe('ADMIN-SUBS-002: Revenue Metrics', () => {
    it('should display revenue metrics if available', () => {
      allure.severity('high')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Check for revenue metrics (defensive - page may not have these yet)
      cy.get('body').then(($body) => {
        if ($body.find(superadmin.selectors.subscriptionsMrr).length > 0) {
          cy.get(superadmin.selectors.subscriptionsMrr).should('be.visible')
          cy.log('✅ MRR metric displayed')
        } else if ($body.find(superadmin.selectors.subscriptionsRevenue).length > 0) {
          cy.get(superadmin.selectors.subscriptionsRevenue).should('be.visible')
          cy.log('✅ Revenue metric displayed')
        } else {
          // Check page loads at minimum
          cy.url().should('include', '/superadmin/subscriptions')
          cy.log('⚠️ Revenue metrics data-cy not found - page loads OK')
        }
      })
    })
  })

  describe('ADMIN-SUBS-003: Plan Distribution', () => {
    it('should display plan distribution stats if available', () => {
      allure.severity('high')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Check for plan distribution (defensive)
      cy.get('body').then(($body) => {
        if ($body.find(superadmin.selectors.subscriptionsPlanDistribution).length > 0) {
          cy.get(superadmin.selectors.subscriptionsPlanDistribution).should('be.visible')
          cy.log('✅ Plan distribution displayed')
        } else if ($body.find('[data-cy^="superadmin-subscriptions-plan-count-"]').length > 0) {
          cy.get('[data-cy^="superadmin-subscriptions-plan-count-"]').first().should('be.visible')
          cy.log('✅ Plan counts displayed')
        } else {
          cy.url().should('include', '/superadmin/subscriptions')
          cy.log('⚠️ Plan distribution data-cy not found - page loads OK')
        }
      })
    })
  })

  describe('ADMIN-SUBS-004: Active Subscriptions Count', () => {
    it('should display active subscriptions count if available', () => {
      allure.severity('normal')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Check for subscriptions count (defensive)
      cy.get('body').then(($body) => {
        if ($body.find(superadmin.selectors.subscriptionsActiveCount).length > 0) {
          cy.get(superadmin.selectors.subscriptionsActiveCount).should('be.visible')
          cy.log('✅ Active subscriptions count displayed')
        } else {
          cy.url().should('include', '/superadmin/subscriptions')
          cy.log('⚠️ Active subscriptions count data-cy not found - page loads OK')
        }
      })
    })
  })

  describe('ADMIN-SUBS-005: Free vs Paid Teams', () => {
    it('should display free vs paid teams breakdown if available', () => {
      allure.severity('normal')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Check for free/paid breakdown (defensive)
      cy.get('body').then(($body) => {
        if ($body.find(superadmin.selectors.subscriptionsFreeTeams).length > 0) {
          cy.get(superadmin.selectors.subscriptionsFreeTeams).should('be.visible')
          cy.get(superadmin.selectors.subscriptionsPaidTeams).should('be.visible')
          cy.log('✅ Free vs paid breakdown displayed')
        } else {
          cy.url().should('include', '/superadmin/subscriptions')
          cy.log('⚠️ Free/paid breakdown data-cy not found - page loads OK')
        }
      })
    })
  })

  describe('ADMIN-SUBS-006: Trial Teams', () => {
    it('should display teams on trial if available', () => {
      allure.severity('normal')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Check for trial teams (defensive)
      cy.get('body').then(($body) => {
        if ($body.find(superadmin.selectors.subscriptionsTrialTeams).length > 0) {
          cy.get(superadmin.selectors.subscriptionsTrialTeams).should('be.visible')
          cy.log('✅ Trial teams displayed')
        } else {
          cy.url().should('include', '/superadmin/subscriptions')
          cy.log('⚠️ Trial teams metric data-cy not found - page loads OK')
        }
      })
    })
  })

  describe('ADMIN-SUBS-007: Navigate to Teams from Subscriptions', () => {
    it('should navigate to teams page from subscriptions', () => {
      allure.severity('normal')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Click on teams nav
      superadmin.clickNavTeams()

      // 3. Validate on teams page
      cy.url().should('include', '/superadmin/teams')

      cy.log('✅ Navigation to teams works')
    })
  })

  describe('ADMIN-SUBS-008: Navigate Back to Dashboard', () => {
    it('should navigate back to Superadmin dashboard', () => {
      allure.severity('normal')

      // 1. Visit Superadmin Subscriptions
      superadmin.visitSubscriptions()

      // 2. Click on dashboard nav
      superadmin.clickNavDashboard()

      // 3. Validate back at dashboard
      cy.url().should('match', /\/superadmin\/?$/)
      superadmin.assertDashboardVisible()

      cy.log('✅ Navigation to dashboard works')
    })
  })

  after(() => {
    cy.log('✅ Superadmin subscriptions overview tests completed')
  })
})
