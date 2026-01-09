// @ts-nocheck
/// <reference types="cypress" />

/**
 * Billing API - Pro Plan Tests
 *
 * BDD: Feature: Pro Plan Features
 * As a user with a Pro plan
 * I want to access professional features
 * So that I can scale my growing business
 *
 * Tests for:
 * - Realtime analytics access
 * - Webhooks access
 * - Custom branding access
 * - Task automation access
 * - Priority support access
 * - Limits (15 members, 1000 tasks, 500 customers, 10 webhooks)
 * - SSO blocked (requires Business)
 * - Customer import blocked (requires Business)
 *
 * Session: 2025-12-20-subscriptions-system-v2
 * Phase: 9 (api-tester)
 */

import * as allure from 'allure-cypress'

const BillingAPIController = require('../BillingAPIController.js')
import billingPlans from './fixtures/billing-plans.json'

describe('Billing API - Pro Plan Features', () => {
  let billingAPI: any

  // Test data from fixtures
  const PRO_PLAN = billingPlans.plans.pro
  const TEST_TEAM = billingPlans.testTeams.pro
  const SUPERADMIN = billingPlans.testCredentials.superadmin
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    billingAPI = new BillingAPIController(BASE_URL, SUPERADMIN.apiKey, TEST_TEAM.teamId)
    cy.log('BillingAPIController initialized for Pro Plan tests')
    cy.log(`Team: ${TEST_TEAM.description}`)
    cy.log(`Team ID: ${TEST_TEAM.teamId}`)
  })

  beforeEach(() => {
    allure.epic('Billing')
    allure.feature('Pro Plan')
    allure.owner('qa-automation')
  })

  // ============================================================
  // TEST GROUP 1: Subscription Verification
  // ============================================================
  describe('Subscription Verification', () => {
    it('PRO_001: Should have Pro plan subscription active', () => {
      allure.story('Subscription Status')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan subscription is active
        Given I am authenticated as a user with Pro plan
        Then my team should have the Pro subscription active
        And the plan slug should be "pro"
      `)

      billingAPI.getSubscription(TEST_TEAM.teamId).then((response: any) => {
        billingAPI.validateSubscriptionResponse(response, {
          status: 'active',
          planSlug: 'pro'
        })

        cy.log('Pro plan subscription verified')
        cy.log(`Plan: ${response.body.data.subscription.plan.name}`)
      })
    })

    it('PRO_002: Pro plan should include all expected features', () => {
      allure.story('Feature List')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan has all expected features
        When I check my subscription details
        Then the plan should include realtime_analytics, webhooks, custom_branding, task_automation
      `)

      billingAPI.getSubscription(TEST_TEAM.teamId).then((response: any) => {
        const features = response.body.data.subscription.plan.features

        PRO_PLAN.features.forEach((feature: string) => {
          expect(features).to.include(feature)
          cy.log(`Feature included: ${feature}`)
        })
      })
    })
  })

  // ============================================================
  // TEST GROUP 2: Allowed Features
  // ============================================================
  describe('Allowed Features', () => {
    it('PRO_010: Should allow advanced_analytics feature', () => {
      allure.story('Analytics Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan includes advanced analytics
        When I check action "analytics.view_advanced"
        Then the action should be allowed
      `)

      billingAPI.checkAction('analytics.view_advanced').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('advanced_analytics allowed for Pro plan')
      })
    })

    it('PRO_011: Should allow realtime_analytics feature', () => {
      allure.story('Analytics Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan includes realtime analytics
        When I check action "analytics.view_realtime"
        Then the action should be allowed
      `)

      billingAPI.checkAction('analytics.view_realtime').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('realtime_analytics allowed for Pro plan')
      })
    })

    it('PRO_012: Should allow webhooks creation', () => {
      allure.story('API Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan includes webhooks
        When I check action "webhooks.create"
        Then the action should be allowed (if within quota)
      `)

      // First check quota
      billingAPI.getUsage(TEST_TEAM.teamId, 'webhooks_count').then((usageResponse: any) => {
        const current = usageResponse.body.data.current
        const max = usageResponse.body.data.max

        billingAPI.checkAction('webhooks.create').then((response: any) => {
          if (current < max) {
            billingAPI.validateActionAllowed(response)
            cy.log('webhooks.create allowed for Pro plan')
          } else {
            // Quota exceeded, but feature is included
            expect(response.body.data.reason).to.eq('quota_exceeded')
            cy.log('webhooks.create blocked by quota, but feature is included')
          }
        })
      })
    })

    it('PRO_013: Should allow custom_branding feature', () => {
      allure.story('Customization Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan includes custom branding
        When I check action "branding.customize"
        Then the action should be allowed
      `)

      billingAPI.checkAction('branding.customize').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('custom_branding allowed for Pro plan')
      })
    })

    it('PRO_014: Should allow task_automation feature', () => {
      allure.story('Domain Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan includes task automation
        When I check action "tasks.automate"
        Then the action should be allowed
      `)

      billingAPI.checkAction('tasks.automate').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('task_automation allowed for Pro plan')
      })
    })

    it('PRO_015: Should allow priority_support feature', () => {
      allure.story('Support Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan includes priority support
        When I check action "support.priority_access"
        Then the action should be allowed
      `)

      billingAPI.checkAction('support.priority_access').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('priority_support allowed for Pro plan')
      })
    })

    it('PRO_016: Should allow api_access feature', () => {
      allure.story('API Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan includes API access
        When I check action "api.generate_key"
        Then the action should be allowed
      `)

      billingAPI.checkAction('api.generate_key').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('api_access allowed for Pro plan')
      })
    })

    it('PRO_017: Should allow guest_access feature', () => {
      allure.story('Collaboration Features')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan includes guest access
        When I check action "team.invite_guest"
        Then the action should be allowed
      `)

      billingAPI.checkAction('team.invite_guest').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('guest_access allowed for Pro plan')
      })
    })
  })

  // ============================================================
  // TEST GROUP 3: Blocked Features (Business only)
  // ============================================================
  describe('Blocked Features (require Business)', () => {
    it('PRO_020: Should block SSO configuration (Business feature)', () => {
      allure.story('Feature Blocking')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan does NOT include SSO
        When I check action "auth.configure_sso"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('auth.configure_sso').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('SSO correctly blocked for Pro plan (requires Business)')
      })
    })

    it('PRO_021: Should block customer_import (Business feature)', () => {
      allure.story('Feature Blocking')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan does NOT include customer import
        When I check action "customers.bulk_import"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('customers.bulk_import').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('customer_import correctly blocked for Pro plan')
      })
    })

    it('PRO_022: Should block recurring_tasks (Business feature)', () => {
      allure.story('Feature Blocking')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan does NOT include recurring tasks
        When I check action "tasks.create_recurring"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('tasks.create_recurring').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('recurring_tasks correctly blocked for Pro plan')
      })
    })

    it('PRO_023: Should block audit_logs (Business feature)', () => {
      allure.story('Feature Blocking')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan does NOT include audit logs
        When I check action "security.view_audit_logs"
        Then the action should be denied
        And the reason should be "feature_not_in_plan"
      `)

      billingAPI.checkAction('security.view_audit_logs').then((response: any) => {
        billingAPI.validateActionDenied(response, 'feature_not_in_plan')

        cy.log('audit_logs correctly blocked for Pro plan')
      })
    })
  })

  // ============================================================
  // TEST GROUP 4: Quota Limits
  // ============================================================
  describe('Quota Limits', () => {
    it('PRO_030: Should have team_members limit of 15', () => {
      allure.story('Team Members Limit')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan limits - 15 team members
        When I check usage for "team_members"
        Then the max should be ${PRO_PLAN.limits.team_members}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'team_members').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: PRO_PLAN.limits.team_members
        })

        cy.log(`Team members limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('PRO_031: Should have tasks limit of 1000', () => {
      allure.story('Tasks Limit')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan limits - 1000 tasks
        When I check usage for "tasks"
        Then the max should be ${PRO_PLAN.limits.tasks}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'tasks').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: PRO_PLAN.limits.tasks
        })

        cy.log(`Tasks limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('PRO_032: Should have customers limit of 500', () => {
      allure.story('Customers Limit')
      allure.severity('critical')
      allure.description(`
        Scenario: Pro plan limits - 500 customers
        When I check usage for "customers"
        Then the max should be ${PRO_PLAN.limits.customers}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'customers').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: PRO_PLAN.limits.customers
        })

        cy.log(`Customers limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('PRO_033: Should have webhooks_count limit of 10', () => {
      allure.story('Webhooks Limit')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan limits - 10 webhooks
        When I check usage for "webhooks_count"
        Then the max should be ${PRO_PLAN.limits.webhooks_count}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'webhooks_count').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: PRO_PLAN.limits.webhooks_count
        })

        cy.log(`Webhooks limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('PRO_034: Should have api_calls limit of 100000', () => {
      allure.story('API Calls Limit')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan limits - 100,000 API calls per month
        When I check usage for "api_calls"
        Then the max should be ${PRO_PLAN.limits.api_calls}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'api_calls').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: PRO_PLAN.limits.api_calls
        })

        cy.log(`API calls limit: ${response.body.data.max}`)
        cy.log(`Current usage: ${response.body.data.current}/${response.body.data.max}`)
      })
    })

    it('PRO_035: Should have storage_gb limit of 50', () => {
      allure.story('Storage Limit')
      allure.severity('normal')
      allure.description(`
        Scenario: Pro plan limits - 50GB storage
        When I check usage for "storage_gb"
        Then the max should be ${PRO_PLAN.limits.storage_gb}
      `)

      billingAPI.getUsage(TEST_TEAM.teamId, 'storage_gb').then((response: any) => {
        billingAPI.validateUsageResponse(response, {
          max: PRO_PLAN.limits.storage_gb
        })

        cy.log(`Storage limit: ${response.body.data.max}GB`)
      })
    })
  })

  // ============================================================
  // TEST GROUP 5: Integration Tests
  // ============================================================
  describe('Integration', () => {
    it('PRO_100: Should correctly enforce all Pro plan features and limits', () => {
      allure.story('Complete Validation')
      allure.severity('critical')
      allure.description(`
        Integration test that validates all Pro plan features:
        - Subscription is active with pro plan
        - All Pro features are allowed
        - Business features are blocked
        - All limits are correctly configured
      `)

      // 1. Verify subscription
      billingAPI.getSubscription(TEST_TEAM.teamId).then((subResponse: any) => {
        billingAPI.validateSubscriptionResponse(subResponse, {
          status: 'active',
          planSlug: 'pro'
        })
        cy.log('1. Subscription verified: Pro plan active')
      })

      // 2. Verify key allowed features
      const allowedActions = [
        'analytics.view_advanced',
        'analytics.view_realtime',
        'tasks.automate',
        'branding.customize'
      ]

      allowedActions.forEach((action) => {
        billingAPI.checkAction(action).then((response: any) => {
          billingAPI.validateActionAllowed(response)
          cy.log(`2. ${action} correctly allowed`)
        })
      })

      // 3. Verify key blocked features
      const blockedActions = [
        'auth.configure_sso',
        'customers.bulk_import'
      ]

      blockedActions.forEach((action) => {
        billingAPI.checkAction(action).then((response: any) => {
          expect(response.body.data.allowed).to.be.false
          cy.log(`3. ${action} correctly blocked`)
        })
      })

      // 4. Verify limits match plan config
      const limitsToCheck = ['tasks', 'customers', 'team_members', 'webhooks_count']
      limitsToCheck.forEach((limit) => {
        billingAPI.getUsage(TEST_TEAM.teamId, limit).then((response: any) => {
          expect(response.body.data.max).to.eq(PRO_PLAN.limits[limit])
          cy.log(`4. ${limit} limit verified: ${response.body.data.max}`)
        })
      })

      cy.log('Integration test completed successfully')
    })
  })
})
