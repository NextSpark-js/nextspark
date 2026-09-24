// @ts-nocheck
/// <reference types="cypress" />

/**
 * Billing API - Free Plan Tests
 *
 * BDD: Feature: Free Plan Restrictions
 * As a user with a Free plan
 * I want to understand my plan limitations
 * So that I can decide if I need to upgrade
 *
 * Tests for:
 * - Auto-subscription on team creation
 * - Basic analytics access
 * - Advanced analytics blocked
 * - Team members limit (3)
 * - Tasks limit (50)
 * - Customers limit (25)
 * - API calls monthly tracking
 * - Domain features blocked
 *
 * Session: 2025-12-20-subscriptions-system-v2
 * Phase: 9 (api-tester)
 */

import * as allure from 'allure-cypress'

const BillingAPIController = require('../BillingAPIController.js')
import billingPlans from './fixtures/billing-plans.json'

describe('Billing API - Free Plan Restrictions', () => {
  let billingAPI: any

  // Test data from fixtures
  const FREE_PLAN = billingPlans.plans.free
  const TEST_TEAM = billingPlans.testTeams.free
  const SUPERADMIN = billingPlans.testCredentials.superadmin
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    billingAPI = new BillingAPIController(BASE_URL, SUPERADMIN.apiKey, TEST_TEAM.teamId)
    cy.log('BillingAPIController initialized for Free Plan tests')
    cy.log(`Team: ${TEST_TEAM.description}`)
    cy.log(`Team ID: ${TEST_TEAM.teamId}`)
  })

  beforeEach(() => {
    allure.epic('Billing')
    allure.feature('Free Plan')
    allure.owner('qa-automation')
  })

  // ============================================================
  // TEST GROUP 1: Subscription Verification
  // ============================================================
  describe('Subscription Verification', () => {
    it('FREE_001: New team should have Free plan automatically assigned', () => {
      allure.story('Auto-subscription')
      allure.severity('critical')
      allure.description(`
        Scenario: New team gets Free plan automatically
        Given I create a new team
        Then the team should have an active Free subscription
        And the plan slug should be "free"
      `)

      billingAPI.getSubscription(TEST_TEAM.teamId).then((response: any) => {
        billingAPI.validateSubscriptionResponse(response, {
          status: 'active',
          planSlug: 'free'
        })

        cy.log('Free plan subscription verified')
        cy.log(`Plan: ${response.body.data.subscription.plan.name}`)
      })
    })

    it('FREE_002: Free plan should include basic_analytics feature', () => {
      allure.story('Basic Features')
      allure.severity('normal')
      allure.description(`
        Scenario: User can access basic analytics
        When I check my subscription details
        Then the plan features should include "basic_analytics"
      `)

      billingAPI.getSubscription(TEST_TEAM.teamId).then((response: any) => {
        expect(response.body.data.subscription.plan.features).to.include('basic_analytics')

        cy.log('basic_analytics feature is included in Free plan')
      })
    })
  })

  // ============================================================
  // TEST GROUP 2: Feature Restrictions
  // ============================================================
  describe('Feature Restrictions', () => {
    it('FREE_010: Should block advanced_analytics feature', () => {
      allure.story('Feature Blocking')
      allure.severity('critical')
      allure.description(`
        Scenario: User cannot access advanced analytics
        When I check action "analytics.view_advanced"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('analytics.view_advanced').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('advanced_analytics correctly blocked for Free plan')
      })
    })

    it('FREE_011: Should block realtime_analytics feature', () => {
      allure.story('Feature Blocking')
      allure.severity('normal')
      allure.description(`
        Scenario: User cannot access realtime analytics
        When I check action "analytics.view_realtime"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('analytics.view_realtime').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('realtime_analytics correctly blocked for Free plan')
      })
    })

    it('FREE_012: Should block task_automation feature', () => {
      allure.story('Domain Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Domain-specific features are not available
        When I check action "tasks.automate"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('tasks.automate').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('task_automation correctly blocked for Free plan')
      })
    })

    it('FREE_013: Should block customer_import feature', () => {
      allure.story('Domain Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Customer bulk import is not available
        When I check action "customers.bulk_import"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('customers.bulk_import').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('customer_import correctly blocked for Free plan')
      })
    })

    it('FREE_014: Should block recurring_tasks feature', () => {
      allure.story('Domain Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Recurring tasks are not available
        When I check action "tasks.create_recurring"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('tasks.create_recurring').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('recurring_tasks correctly blocked for Free plan')
      })
    })

    it('FREE_015: Should block webhooks feature', () => {
      allure.story('API Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Webhooks are not available in Free plan
        When I check action "webhooks.create"
        Then the action should be denied
        Note: Can be blocked by feature, quota, or permission depending on plan configuration
      `)

      billingAPI.checkAction('webhooks.create').then((response: any) => {
        // webhooks.create can be blocked by:
        // - 'webhooks' feature (not in Free plan)
        // - 'webhooks_count' limit (0 in Free plan)
        // - 'no_permission' if RBAC check fails first
        expect(response.body.data.allowed).to.be.false
        expect(response.body.data.reason).to.be.oneOf([
          'feature_not_in_plan',
          'quota_exceeded',
          'no_permission'
        ])

        cy.log('Webhooks correctly blocked for Free plan')
        cy.log(`Reason: ${response.body.data.reason}`)
      })
    })

    it('FREE_016: Should block SSO configuration', () => {
      allure.story('Security Features')
      allure.severity('normal')
      allure.description(`
        Scenario: SSO configuration is not available
        When I check action "auth.configure_sso"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('auth.configure_sso').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('SSO correctly blocked for Free plan')
      })
    })
  })

  // ============================================================
  // TEST GROUP 3: Quota Limits
  // ============================================================
  describe('Quota Limits', () => {
    it('FREE_020: Should have team_members limit of 3', () => {
      allure.story('Team Members Limit')
      allure.severity('critical')
      allure.description(`
        Scenario: Team members limit of 3 is enforced
        When I check usage for "team_members"
        Then the max should be ${FREE_PLAN.limits.team_members}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'team_members').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: FREE_PLAN.limits.team_members
        })

        cy.log(`Team members limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('FREE_021: Should have tasks limit of 50', () => {
      allure.story('Tasks Limit')
      allure.severity('critical')
      allure.description(`
        Scenario: Tasks limit of ${FREE_PLAN.limits.tasks} is enforced
        When I check usage for "tasks"
        Then the max should be ${FREE_PLAN.limits.tasks}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'tasks').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: FREE_PLAN.limits.tasks
        })

        cy.log(`Tasks limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('FREE_022: Should have customers limit of 25', () => {
      allure.story('Customers Limit')
      allure.severity('critical')
      allure.description(`
        Scenario: Customers limit of ${FREE_PLAN.limits.customers} is enforced
        When I check usage for "customers"
        Then the max should be ${FREE_PLAN.limits.customers}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'customers').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: FREE_PLAN.limits.customers
        })

        cy.log(`Customers limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('FREE_023: Should have api_calls limit of 1000 per month', () => {
      allure.story('API Calls Limit')
      allure.severity('normal')
      allure.description(`
        Scenario: API calls are tracked monthly
        When I check usage for "api_calls"
        Then the max should be ${FREE_PLAN.limits.api_calls}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'api_calls').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: FREE_PLAN.limits.api_calls
        })

        cy.log(`API calls limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('FREE_024: Should have storage_gb limit of 1', () => {
      allure.story('Storage Limit')
      allure.severity('normal')
      allure.description(`
        Scenario: Storage limit of ${FREE_PLAN.limits.storage_gb}GB is enforced
        When I check usage for "storage_gb"
        Then the max should be ${FREE_PLAN.limits.storage_gb}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'storage_gb').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: FREE_PLAN.limits.storage_gb
        })

        cy.log(`Storage limit: ${response.body.data.max}GB`)
      })
    })

    it('FREE_025: Should have webhooks_count limit of 0', () => {
      allure.story('Webhooks Limit')
      allure.severity('normal')
      allure.description(`
        Scenario: Webhooks count is 0 for Free plan
        When I check usage for "webhooks_count"
        Then the max should be ${FREE_PLAN.limits.webhooks_count}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'webhooks_count').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: FREE_PLAN.limits.webhooks_count
        })

        cy.log(`Webhooks limit: ${response.body.data.max}`)
      })
    })
  })

  // ============================================================
  // TEST GROUP 4: Action Blocking at Quota
  // ============================================================
  describe('Quota Enforcement', () => {
    it('FREE_030: Should block tasks.create when at limit', () => {
      allure.story('Quota Blocking')
      allure.severity('critical')
      allure.description(`
        Scenario: Tasks creation blocked when at limit
        Given my team has reached the tasks limit
        When I check action "tasks.create"
        Then the action should be denied if at limit
        And the reason should be "quota_exceeded" if at limit
      `)

      // First check current usage
      billingAPI.getUsage(TEST_TEAM.teamId, 'tasks').then((response: any) => {
        const currentUsage = response.body.data.current
        const maxLimit = response.body.data.max

        cy.log(`Tasks usage: ${currentUsage}/${maxLimit}`)

        // Then check the action
        billingAPI.checkAction('tasks.create').then((actionResponse: any) => {
          if (currentUsage >= maxLimit) {
            billingAPI.validateQuotaExceeded(actionResponse, {
              current: currentUsage,
              max: maxLimit
            })
            cy.log('tasks.create correctly blocked - quota exceeded')
          } else {
            billingAPI.validateActionAllowed(actionResponse)
            cy.log(`tasks.create allowed - ${maxLimit - currentUsage} remaining`)
          }
        })
      })
    })

    it('FREE_031: Should block customers.create when at limit', () => {
      allure.story('Quota Blocking')
      allure.severity('critical')
      allure.description(`
        Scenario: Customer creation blocked when at limit
        Given my team has reached the customers limit
        When I check action "customers.create"
        Then the action should be denied if at limit
      `)

      // First check current usage
      billingAPI.getUsage(TEST_TEAM.teamId, 'customers').then((response: any) => {
        const currentUsage = response.body.data.current
        const maxLimit = response.body.data.max

        cy.log(`Customers usage: ${currentUsage}/${maxLimit}`)

        // Then check the action
        billingAPI.checkAction('customers.create').then((actionResponse: any) => {
          if (currentUsage >= maxLimit) {
            billingAPI.validateQuotaExceeded(actionResponse, {
              current: currentUsage,
              max: maxLimit
            })
            cy.log('customers.create correctly blocked - quota exceeded')
          } else {
            billingAPI.validateActionAllowed(actionResponse)
            cy.log(`customers.create allowed - ${maxLimit - currentUsage} remaining`)
          }
        })
      })
    })

    it('FREE_032: Should block team.members.invite when at limit', () => {
      allure.story('Quota Blocking')
      allure.severity('critical')
      allure.description(`
        Scenario: Team member invitation blocked when at limit
        Given my team has reached the team_members limit
        When I check action "team.members.invite"
        Then the action should be denied if at limit
      `)

      // First check current usage
      billingAPI.getUsage(TEST_TEAM.teamId, 'team_members').then((response: any) => {
        const currentUsage = response.body.data.current
        const maxLimit = response.body.data.max

        cy.log(`Team members usage: ${currentUsage}/${maxLimit}`)

        // Then check the action
        billingAPI.checkAction('team.members.invite').then((actionResponse: any) => {
          if (currentUsage >= maxLimit) {
            billingAPI.validateQuotaExceeded(actionResponse, {
              current: currentUsage,
              max: maxLimit
            })
            cy.log('team.members.invite correctly blocked - quota exceeded')
          } else {
            billingAPI.validateActionAllowed(actionResponse)
            cy.log(`team.members.invite allowed - ${maxLimit - currentUsage} remaining`)
          }
        })
      })
    })
  })

  // ============================================================
  // TEST GROUP 5: Integration Tests
  // ============================================================
  describe('Integration', () => {
    it('FREE_100: Should correctly enforce all Free plan restrictions', () => {
      allure.story('Complete Validation')
      allure.severity('critical')
      allure.description(`
        Integration test that validates all Free plan restrictions:
        - Subscription is active with free plan
        - All Pro/Business features are blocked
        - All limits are correctly configured
      `)

      // 1. Verify subscription
      billingAPI.getSubscription(TEST_TEAM.teamId).then((subResponse: any) => {
        billingAPI.validateSubscriptionResponse(subResponse, {
          status: 'active',
          planSlug: 'free'
        })
        cy.log('1. Subscription verified: Free plan active')
      })

      // 2. Verify key blocked features
      const blockedActions = [
        'analytics.view_advanced',
        'tasks.automate',
        'customers.bulk_import'
      ]

      blockedActions.forEach((action) => {
        billingAPI.checkAction(action).then((response: any) => {
          expect(response.body.data.allowed).to.be.false
          cy.log(`2. ${action} correctly blocked`)
        })
      })

      // 3. Verify limits match plan config
      const limitsToCheck = ['tasks', 'customers', 'team_members']
      limitsToCheck.forEach((limit) => {
        billingAPI.getUsage(TEST_TEAM.teamId, limit).then((response: any) => {
          expect(response.body.data.max).to.eq(FREE_PLAN.limits[limit])
          cy.log(`3. ${limit} limit verified: ${response.body.data.max}`)
        })
      })

      cy.log('Integration test completed successfully')
    })
  })
})
