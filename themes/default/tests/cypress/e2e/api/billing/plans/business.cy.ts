// @ts-nocheck
/// <reference types="cypress" />

/**
 * Billing API - Business Plan Tests
 *
 * BDD: Feature: Business Plan Features
 * As a user with a Business plan
 * I want to access enterprise-grade features
 * So that I can run my large organization
 *
 * Tests for:
 * - SSO access
 * - Audit logs access
 * - Customer import access
 * - Recurring tasks access
 * - All Pro features included
 * - Limits (50 members, 5000 tasks, 2000 customers, 50 webhooks)
 *
 * Session: 2025-12-20-subscriptions-system-v2
 * Phase: 9 (api-tester)
 *
 * NOTE: This test validates Business plan configuration and compares
 * against Enterprise plan (team-ironvale-002).
 */

import * as allure from 'allure-cypress'

const BillingAPIController = require('../BillingAPIController.js')
import billingPlans from './fixtures/billing-plans.json'

describe('Billing API - Business Plan Features', () => {
  let billingAPI: any

  // Test data from fixtures
  const BUSINESS_PLAN = billingPlans.plans.business
  const PRO_PLAN = billingPlans.plans.pro
  const ENTERPRISE_TEAM = billingPlans.testTeams.enterprise
  const SUPERADMIN = billingPlans.testCredentials.superadmin
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  before(() => {
    // Use Enterprise team to test "all features" scenario
    billingAPI = new BillingAPIController(BASE_URL, SUPERADMIN.apiKey, ENTERPRISE_TEAM.teamId)
    cy.log('BillingAPIController initialized for Business Plan tests')
    cy.log(`Using Enterprise team to validate all-features access: ${ENTERPRISE_TEAM.description}`)
  })

  beforeEach(() => {
    allure.epic('Billing')
    allure.feature('Business Plan')
    allure.owner('qa-automation')
  })

  // ============================================================
  // TEST GROUP 1: Plan Configuration Validation
  // ============================================================
  describe('Plan Configuration', () => {
    it('BUSINESS_001: Business plan should have all expected features', () => {
      allure.story('Feature List')
      allure.severity('critical')
      allure.description(`
        Scenario: Business plan has expected features
        Given the Business plan configuration
        Then it should include: sso, audit_logs, customer_import, recurring_tasks
        And all Pro features
      `)

      // Business-exclusive features
      const businessExclusiveFeatures = ['sso', 'audit_logs', 'customer_import', 'recurring_tasks']
      businessExclusiveFeatures.forEach((feature) => {
        expect(BUSINESS_PLAN.features).to.include(feature)
        cy.log(`Business plan includes: ${feature}`)
      })

      // All Pro features should be included
      PRO_PLAN.features.forEach((feature: string) => {
        expect(BUSINESS_PLAN.features).to.include(feature)
        cy.log(`Pro feature "${feature}" is in Business: YES`)
      })
    })

    it('BUSINESS_002: Business plan should have correct limits', () => {
      allure.story('Limits Configuration')
      allure.severity('critical')
      allure.description(`
        Scenario: Business plan has expected limits
        Given the Business plan configuration
        Then the limits should match expected values
      `)

      expect(BUSINESS_PLAN.limits.team_members).to.eq(50)
      expect(BUSINESS_PLAN.limits.tasks).to.eq(5000)
      expect(BUSINESS_PLAN.limits.customers).to.eq(2000)
      expect(BUSINESS_PLAN.limits.webhooks_count).to.eq(50)
      expect(BUSINESS_PLAN.limits.api_calls).to.eq(500000)
      expect(BUSINESS_PLAN.limits.storage_gb).to.eq(200)

      cy.log('Business plan limits:')
      cy.log(`  team_members: ${BUSINESS_PLAN.limits.team_members}`)
      cy.log(`  tasks: ${BUSINESS_PLAN.limits.tasks}`)
      cy.log(`  customers: ${BUSINESS_PLAN.limits.customers}`)
      cy.log(`  webhooks_count: ${BUSINESS_PLAN.limits.webhooks_count}`)
      cy.log(`  api_calls: ${BUSINESS_PLAN.limits.api_calls}`)
      cy.log(`  storage_gb: ${BUSINESS_PLAN.limits.storage_gb}`)
    })

    it('BUSINESS_003: Business plan pricing should be correct', () => {
      allure.story('Pricing')
      allure.severity('normal')
      allure.description(`
        Scenario: Business plan pricing is $79/month
        Given the Business plan configuration
        Then the monthly price should be 7900 (cents)
        And the yearly price should be 79000 (cents)
      `)

      expect(BUSINESS_PLAN.priceMonthly).to.eq(7900)
      expect(BUSINESS_PLAN.priceYearly).to.eq(79000)

      cy.log(`Business plan pricing:`)
      cy.log(`  Monthly: $${BUSINESS_PLAN.priceMonthly / 100}`)
      cy.log(`  Yearly: $${BUSINESS_PLAN.priceYearly / 100}`)
    })
  })

  // ============================================================
  // TEST GROUP 2: Business-Exclusive Features (via Enterprise)
  // ============================================================
  describe('Business-Exclusive Features (via Enterprise)', () => {
    it('BUSINESS_010: Should allow SSO configuration', () => {
      allure.story('Security Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Business plan includes SSO
        When I check action "auth.configure_sso"
        Then the action should be allowed
        (Tested via Enterprise team which has all features)
      `)

      billingAPI.checkAction('auth.configure_sso').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('SSO allowed for Enterprise (includes all Business features)')
      })
    })

    it('BUSINESS_011: Should allow audit logs access', () => {
      allure.story('Security Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Business plan includes audit logs
        When I check action "security.view_audit_logs"
        Then the action should be allowed
      `)

      billingAPI.checkAction('security.view_audit_logs').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('Audit logs allowed for Enterprise')
      })
    })

    it('BUSINESS_012: Should allow customer import', () => {
      allure.story('Domain Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Business plan includes customer import
        When I check action "customers.bulk_import"
        Then the action should be allowed
      `)

      billingAPI.checkAction('customers.bulk_import').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('Customer import allowed for Enterprise')
      })
    })

    it('BUSINESS_013: Should allow recurring tasks', () => {
      allure.story('Domain Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Business plan includes recurring tasks
        When I check action "tasks.create_recurring"
        Then the action should be allowed
      `)

      billingAPI.checkAction('tasks.create_recurring').then((response: any) => {
        billingAPI.validateActionAllowed(response)

        cy.log('Recurring tasks allowed for Enterprise')
      })
    })
  })

  // ============================================================
  // TEST GROUP 3: All Pro Features Included
  // ============================================================
  describe('Pro Features (inherited)', () => {
    it('BUSINESS_020: Should allow all Pro features', () => {
      allure.story('Inherited Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Business plan includes all Pro features
        When I check Pro-level actions
        Then all should be allowed
      `)

      const proActions = [
        'analytics.view_advanced',
        'analytics.view_realtime',
        'branding.customize',
        'tasks.automate',
        'support.priority_access',
        'api.generate_key',
        'team.invite_guest'
      ]

      proActions.forEach((action) => {
        billingAPI.checkAction(action).then((response: any) => {
          billingAPI.validateActionAllowed(response)
          cy.log(`${action}: ALLOWED`)
        })
      })
    })
  })

  // ============================================================
  // TEST GROUP 4: Limits Comparison
  // ============================================================
  describe('Limits Comparison', () => {
    it('BUSINESS_030: Business limits should be greater than Pro', () => {
      allure.story('Limits Comparison')
      allure.severity('normal')
      allure.description(`
        Scenario: Business limits exceed Pro limits
        Given the Pro and Business plan configurations
        Then Business limits should be > Pro limits
      `)

      const limits = ['team_members', 'tasks', 'customers', 'webhooks_count', 'api_calls', 'storage_gb']

      limits.forEach((limit) => {
        expect(BUSINESS_PLAN.limits[limit]).to.be.greaterThan(PRO_PLAN.limits[limit])
        cy.log(`${limit}: Pro=${PRO_PLAN.limits[limit]}, Business=${BUSINESS_PLAN.limits[limit]}`)
      })
    })

    it('BUSINESS_031: Business plan has significant limit increases', () => {
      allure.story('Limits Scaling')
      allure.severity('normal')
      allure.description(`
        Scenario: Business limits are significantly higher
        Given the Pro and Business plan limits
        Then Business should have at least 3x more capacity for key limits
      `)

      // Key limits should be at least 3x higher
      expect(BUSINESS_PLAN.limits.team_members / PRO_PLAN.limits.team_members).to.be.gte(3)
      expect(BUSINESS_PLAN.limits.tasks / PRO_PLAN.limits.tasks).to.be.gte(5)
      expect(BUSINESS_PLAN.limits.customers / PRO_PLAN.limits.customers).to.be.gte(4)
      expect(BUSINESS_PLAN.limits.webhooks_count / PRO_PLAN.limits.webhooks_count).to.be.gte(5)

      cy.log('Business plan multipliers vs Pro:')
      cy.log(`  team_members: ${BUSINESS_PLAN.limits.team_members / PRO_PLAN.limits.team_members}x`)
      cy.log(`  tasks: ${BUSINESS_PLAN.limits.tasks / PRO_PLAN.limits.tasks}x`)
      cy.log(`  customers: ${BUSINESS_PLAN.limits.customers / PRO_PLAN.limits.customers}x`)
      cy.log(`  webhooks: ${BUSINESS_PLAN.limits.webhooks_count / PRO_PLAN.limits.webhooks_count}x`)
    })
  })

  // ============================================================
  // TEST GROUP 5: Enterprise Subscription Verification
  // ============================================================
  describe('Enterprise Subscription (for validation)', () => {
    it('BUSINESS_040: Enterprise subscription should be active', () => {
      allure.story('Subscription Status')
      allure.severity('critical')
      allure.description(`
        Scenario: Enterprise subscription is active
        Given I have an Enterprise team
        Then the subscription should be active
        And the plan should be enterprise
      `)

      billingAPI.getSubscription(ENTERPRISE_TEAM.teamId).then((response: any) => {
        billingAPI.validateSubscriptionResponse(response, {
          status: 'active',
          planSlug: 'enterprise'
        })

        cy.log('Enterprise subscription verified')
        cy.log(`Plan: ${response.body.data.subscription.plan.name}`)
      })
    })

    it('BUSINESS_041: Enterprise should have unlimited limits', () => {
      allure.story('Unlimited Limits')
      allure.severity('critical')
      allure.description(`
        Scenario: Enterprise has unlimited limits (-1)
        Given the Enterprise plan configuration
        Then all limits should be -1 (unlimited)
      `)

      const ENTERPRISE_PLAN = billingPlans.plans.enterprise

      Object.entries(ENTERPRISE_PLAN.limits).forEach(([key, value]) => {
        expect(value).to.eq(-1)
        cy.log(`${key}: unlimited (-1)`)
      })
    })

    it('BUSINESS_042: Enterprise should have wildcard features', () => {
      allure.story('Wildcard Features')
      allure.severity('critical')
      allure.description(`
        Scenario: Enterprise has wildcard (*) for all features
        Given the Enterprise plan configuration
        Then features should include "*"
      `)

      const ENTERPRISE_PLAN = billingPlans.plans.enterprise

      expect(ENTERPRISE_PLAN.features).to.include('*')
      cy.log('Enterprise has wildcard (*) feature access')
    })
  })

  // ============================================================
  // TEST GROUP 6: Integration Tests
  // ============================================================
  describe('Integration', () => {
    it('BUSINESS_100: Business plan configuration is complete and valid', () => {
      allure.story('Complete Validation')
      allure.severity('critical')
      allure.description(`
        Integration test that validates Business plan configuration:
        - Has all required properties
        - All Pro features are included
        - Business-exclusive features are included
        - Limits are greater than Pro
        - Pricing is set correctly
      `)

      // 1. Required properties
      expect(BUSINESS_PLAN).to.have.property('slug', 'business')
      expect(BUSINESS_PLAN).to.have.property('name', 'Business')
      expect(BUSINESS_PLAN).to.have.property('features')
      expect(BUSINESS_PLAN).to.have.property('limits')
      cy.log('1. Required properties verified')

      // 2. All Pro features included
      const missingProFeatures = PRO_PLAN.features.filter(
        (f: string) => !BUSINESS_PLAN.features.includes(f)
      )
      expect(missingProFeatures.length).to.eq(0)
      cy.log(`2. All ${PRO_PLAN.features.length} Pro features are included`)

      // 3. Business-exclusive features
      const businessExclusive = ['sso', 'audit_logs', 'customer_import', 'recurring_tasks']
      businessExclusive.forEach((feature) => {
        expect(BUSINESS_PLAN.features).to.include(feature)
      })
      cy.log(`3. Business-exclusive features verified: ${businessExclusive.join(', ')}`)

      // 4. All limits are greater than Pro
      Object.keys(PRO_PLAN.limits).forEach((key) => {
        expect(BUSINESS_PLAN.limits[key]).to.be.greaterThan(PRO_PLAN.limits[key])
      })
      cy.log('4. All limits are greater than Pro')

      // 5. Pricing
      expect(BUSINESS_PLAN.priceMonthly).to.be.greaterThan(PRO_PLAN.priceMonthly)
      cy.log(`5. Pricing verified: $${BUSINESS_PLAN.priceMonthly / 100}/mo`)

      cy.log('Business plan configuration is complete and valid')
    })

    it('BUSINESS_101: All Business features are accessible via Enterprise', () => {
      allure.story('Feature Access')
      allure.severity('critical')
      allure.description(`
        Scenario: All Business features work via Enterprise team
        Given an Enterprise team (with wildcard features)
        Then all Business-level actions should be allowed
      `)

      // All Business features should be accessible
      const businessActions = [
        'auth.configure_sso',
        'security.view_audit_logs',
        'customers.bulk_import',
        'tasks.create_recurring',
        'analytics.view_advanced',
        'analytics.view_realtime',
        'branding.customize',
        'tasks.automate'
      ]

      businessActions.forEach((action) => {
        billingAPI.checkAction(action).then((response: any) => {
          billingAPI.validateActionAllowed(response)
          cy.log(`${action}: ALLOWED via Enterprise`)
        })
      })

      cy.log('All Business features verified accessible via Enterprise')
    })
  })
})
