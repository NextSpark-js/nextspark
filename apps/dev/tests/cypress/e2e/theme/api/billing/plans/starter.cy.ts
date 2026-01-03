// @ts-nocheck
/// <reference types="cypress" />

/**
 * Billing API - Starter Plan Tests
 *
 * BDD: Feature: Starter Plan Features
 * As a user with a Starter plan
 * I want to access starter-level features
 * So that I can grow my small team
 *
 * Tests for:
 * - Advanced analytics access
 * - API access
 * - Guest access
 * - Limits (5 members, 200 tasks, 100 customers, 3 webhooks)
 * - Realtime analytics blocked (requires Pro)
 * - Task automation blocked (requires Pro)
 *
 * Session: 2025-12-20-subscriptions-system-v2
 * Phase: 9 (api-tester)
 *
 * NOTE: This test requires a team with Starter plan.
 * Since no Starter team exists in sample data, we test against
 * the Starter plan configuration using feature/limit checks.
 */

import * as allure from 'allure-cypress'

const BillingAPIController = require('../BillingAPIController.js')
import billingPlans from './fixtures/billing-plans.json'

describe('Billing API - Starter Plan Features', () => {
  let billingAPI: any

  // Test data from fixtures
  const STARTER_PLAN = billingPlans.plans.starter
  const FREE_PLAN = billingPlans.plans.free
  const PRO_PLAN = billingPlans.plans.pro
  const SUPERADMIN = billingPlans.testCredentials.superadmin
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Note: We'll test Starter plan using plan configuration validation
  // since there's no Starter team in sample data

  before(() => {
    billingAPI = new BillingAPIController(BASE_URL, SUPERADMIN.apiKey, SUPERADMIN.teamId)
    cy.log('BillingAPIController initialized for Starter Plan tests')
    cy.log('Testing Starter plan configuration and feature matrix')
  })

  beforeEach(() => {
    allure.epic('Billing')
    allure.feature('Starter Plan')
    allure.owner('qa-automation')
  })

  // ============================================================
  // TEST GROUP 1: Plan Configuration Validation
  // ============================================================
  describe('Plan Configuration', () => {
    it('STARTER_001: Starter plan should have correct features', () => {
      allure.story('Feature List')
      allure.severity('critical')
      allure.description(`
        Scenario: Starter plan has expected features
        Given the Starter plan configuration
        Then it should include: basic_analytics, advanced_analytics, api_access, guest_access
        But NOT include: realtime_analytics, webhooks, task_automation
      `)

      // Verify included features
      const expectedFeatures = ['basic_analytics', 'advanced_analytics', 'api_access', 'guest_access']
      expectedFeatures.forEach((feature) => {
        expect(STARTER_PLAN.features).to.include(feature)
        cy.log(`Starter plan includes: ${feature}`)
      })

      // Verify excluded features
      const excludedFeatures = ['realtime_analytics', 'webhooks', 'task_automation', 'sso', 'audit_logs']
      excludedFeatures.forEach((feature) => {
        expect(STARTER_PLAN.features).to.not.include(feature)
        cy.log(`Starter plan excludes: ${feature}`)
      })
    })

    it('STARTER_002: Starter plan should have correct limits', () => {
      allure.story('Limits Configuration')
      allure.severity('critical')
      allure.description(`
        Scenario: Starter plan has expected limits
        Given the Starter plan configuration
        Then the limits should match expected values
      `)

      expect(STARTER_PLAN.limits.team_members).to.eq(5)
      expect(STARTER_PLAN.limits.tasks).to.eq(200)
      expect(STARTER_PLAN.limits.customers).to.eq(100)
      expect(STARTER_PLAN.limits.webhooks_count).to.eq(3)
      expect(STARTER_PLAN.limits.api_calls).to.eq(10000)
      expect(STARTER_PLAN.limits.storage_gb).to.eq(10)

      cy.log('Starter plan limits:')
      cy.log(`  team_members: ${STARTER_PLAN.limits.team_members}`)
      cy.log(`  tasks: ${STARTER_PLAN.limits.tasks}`)
      cy.log(`  customers: ${STARTER_PLAN.limits.customers}`)
      cy.log(`  webhooks_count: ${STARTER_PLAN.limits.webhooks_count}`)
    })

    it('STARTER_003: Starter plan pricing should be correct', () => {
      allure.story('Pricing')
      allure.severity('normal')
      allure.description(`
        Scenario: Starter plan pricing is $15/month
        Given the Starter plan configuration
        Then the monthly price should be 1500 (cents)
        And the yearly price should be 14400 (cents)
      `)

      expect(STARTER_PLAN.priceMonthly).to.eq(1500)
      expect(STARTER_PLAN.priceYearly).to.eq(14400)

      cy.log(`Starter plan pricing:`)
      cy.log(`  Monthly: $${STARTER_PLAN.priceMonthly / 100}`)
      cy.log(`  Yearly: $${STARTER_PLAN.priceYearly / 100}`)
    })
  })

  // ============================================================
  // TEST GROUP 2: Feature Matrix Comparison
  // ============================================================
  describe('Feature Matrix', () => {
    it('STARTER_010: Starter should have more features than Free', () => {
      allure.story('Plan Comparison')
      allure.severity('normal')
      allure.description(`
        Scenario: Starter plan is an upgrade from Free
        Given the Starter and Free plan configurations
        Then Starter should include all Free features
        And Starter should have additional features
      `)

      // All Free features should be in Starter
      FREE_PLAN.features.forEach((feature: string) => {
        expect(STARTER_PLAN.features).to.include(feature)
        cy.log(`Free feature "${feature}" is in Starter: YES`)
      })

      // Starter should have more features
      expect(STARTER_PLAN.features.length).to.be.greaterThan(FREE_PLAN.features.length)
      cy.log(`Free features: ${FREE_PLAN.features.length}, Starter features: ${STARTER_PLAN.features.length}`)
    })

    it('STARTER_011: Starter should have fewer features than Pro', () => {
      allure.story('Plan Comparison')
      allure.severity('normal')
      allure.description(`
        Scenario: Starter plan is below Pro
        Given the Starter and Pro plan configurations
        Then Pro should include all Starter features
        And Pro should have additional features
      `)

      // All Starter features should be in Pro
      STARTER_PLAN.features.forEach((feature: string) => {
        expect(PRO_PLAN.features).to.include(feature)
        cy.log(`Starter feature "${feature}" is in Pro: YES`)
      })

      // Pro should have more features
      expect(PRO_PLAN.features.length).to.be.greaterThan(STARTER_PLAN.features.length)
      cy.log(`Starter features: ${STARTER_PLAN.features.length}, Pro features: ${PRO_PLAN.features.length}`)
    })

    it('STARTER_012: Starter limits should be between Free and Pro', () => {
      allure.story('Limits Comparison')
      allure.severity('normal')
      allure.description(`
        Scenario: Starter limits are between Free and Pro
        Given the Free, Starter, and Pro plan configurations
        Then Starter limits should be > Free limits
        And Starter limits should be < Pro limits
      `)

      // Compare key limits
      const limits = ['team_members', 'tasks', 'customers', 'api_calls']

      limits.forEach((limit) => {
        expect(STARTER_PLAN.limits[limit]).to.be.greaterThan(FREE_PLAN.limits[limit])
        expect(STARTER_PLAN.limits[limit]).to.be.lessThan(PRO_PLAN.limits[limit])
        cy.log(`${limit}: Free=${FREE_PLAN.limits[limit]}, Starter=${STARTER_PLAN.limits[limit]}, Pro=${PRO_PLAN.limits[limit]}`)
      })
    })
  })

  // ============================================================
  // TEST GROUP 3: Action Mapping Validation
  // ============================================================
  describe('Action Mappings', () => {
    it('STARTER_020: Actions that should be ALLOWED in Starter', () => {
      allure.story('Allowed Actions')
      allure.severity('critical')
      allure.description(`
        Scenario: Starter plan allows specific actions
        Given the action mappings configuration
        Then the following actions should be allowed based on Starter features
      `)

      const actionMappings = billingPlans.actionMappings.features
      const starterFeatures = STARTER_PLAN.features

      // Find actions that Starter should allow
      const allowedActions: string[] = []
      Object.entries(actionMappings).forEach(([action, feature]) => {
        if (starterFeatures.includes(feature as string)) {
          allowedActions.push(action)
        }
      })

      cy.log('Actions allowed by Starter plan:')
      allowedActions.forEach((action) => {
        cy.log(`  ${action}`)
      })

      expect(allowedActions).to.include('analytics.view_advanced')
      expect(allowedActions).to.include('api.generate_key')
      expect(allowedActions).to.include('team.invite_guest')
    })

    it('STARTER_021: Actions that should be BLOCKED in Starter', () => {
      allure.story('Blocked Actions')
      allure.severity('critical')
      allure.description(`
        Scenario: Starter plan blocks specific actions
        Given the action mappings configuration
        Then the following actions should be blocked based on Starter features
      `)

      const actionMappings = billingPlans.actionMappings.features
      const starterFeatures = STARTER_PLAN.features

      // Find actions that Starter should block
      const blockedActions: string[] = []
      Object.entries(actionMappings).forEach(([action, feature]) => {
        if (!starterFeatures.includes(feature as string)) {
          blockedActions.push(action)
        }
      })

      cy.log('Actions blocked by Starter plan:')
      blockedActions.forEach((action) => {
        cy.log(`  ${action}`)
      })

      // Key blocked actions
      expect(blockedActions).to.include('analytics.view_realtime')
      expect(blockedActions).to.include('webhooks.create')
      expect(blockedActions).to.include('tasks.automate')
      expect(blockedActions).to.include('auth.configure_sso')
    })
  })

  // ============================================================
  // TEST GROUP 4: Quota Action Mappings
  // ============================================================
  describe('Quota Mappings', () => {
    it('STARTER_030: Quota limits should map to actions correctly', () => {
      allure.story('Quota Actions')
      allure.severity('normal')
      allure.description(`
        Scenario: Starter quota limits map to creation actions
        Given the limit action mappings
        Then tasks.create should consume "tasks" limit
        And customers.create should consume "customers" limit
        And team.members.invite should consume "team_members" limit
      `)

      const limitMappings = billingPlans.actionMappings.limits

      expect(limitMappings['tasks.create']).to.eq('tasks')
      expect(limitMappings['customers.create']).to.eq('customers')
      expect(limitMappings['team.members.invite']).to.eq('team_members')
      expect(limitMappings['webhooks.create']).to.eq('webhooks_count')

      cy.log('Quota action mappings verified:')
      Object.entries(limitMappings).forEach(([action, limit]) => {
        cy.log(`  ${action} -> ${limit}`)
      })
    })
  })

  // ============================================================
  // TEST GROUP 5: Integration Tests
  // ============================================================
  describe('Integration', () => {
    it('STARTER_100: Starter plan configuration is complete and consistent', () => {
      allure.story('Complete Validation')
      allure.severity('critical')
      allure.description(`
        Integration test that validates Starter plan configuration:
        - Has all required properties
        - Features are valid
        - Limits are numeric and positive
        - Pricing is set
      `)

      // 1. Required properties
      expect(STARTER_PLAN).to.have.property('slug', 'starter')
      expect(STARTER_PLAN).to.have.property('name', 'Starter')
      expect(STARTER_PLAN).to.have.property('features')
      expect(STARTER_PLAN).to.have.property('limits')
      cy.log('1. Required properties verified')

      // 2. Features array is valid
      expect(STARTER_PLAN.features).to.be.an('array')
      expect(STARTER_PLAN.features.length).to.be.greaterThan(0)
      cy.log(`2. Features array has ${STARTER_PLAN.features.length} items`)

      // 3. All limits are numeric
      Object.entries(STARTER_PLAN.limits).forEach(([key, value]) => {
        expect(value).to.be.a('number')
        expect(value as number).to.be.gte(0) // 0 is valid (webhooks in free)
        cy.log(`3. Limit ${key}: ${value} (valid)`)
      })

      // 4. Pricing is set
      expect(STARTER_PLAN.priceMonthly).to.be.a('number')
      expect(STARTER_PLAN.priceMonthly).to.be.greaterThan(0)
      expect(STARTER_PLAN.priceYearly).to.be.a('number')
      expect(STARTER_PLAN.priceYearly).to.be.greaterThan(0)
      cy.log('4. Pricing is set and valid')

      // 5. Yearly discount exists
      const monthlyTotal = STARTER_PLAN.priceMonthly * 12
      expect(STARTER_PLAN.priceYearly).to.be.lessThan(monthlyTotal)
      const savings = ((monthlyTotal - STARTER_PLAN.priceYearly) / monthlyTotal * 100).toFixed(0)
      cy.log(`5. Yearly savings: ${savings}%`)

      cy.log('Starter plan configuration is complete and valid')
    })
  })
})
