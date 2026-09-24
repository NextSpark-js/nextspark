/**
 * Billing Page Object Model
 *
 * Encapsulates interactions with the billing settings page:
 * - /dashboard/settings/billing
 *
 * UI Elements:
 * - Current plan card with usage
 * - Billing history (invoices)
 * - Payment method
 * - Plan features
 *
 * @version 3.0 - Uses centralized selectors from cySelector()
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export class BillingPOM extends BasePOM {
  /**
   * Selectors using centralized cySelector()
   */
  get selectors() {
    return {
      main: cySelector('settings.billing.main'),
      header: cySelector('settings.billing.header'),
      upgradePlan: cySelector('settings.billing.upgradePlan'),
      addPayment: cySelector('settings.billing.addPayment'),
      invoicesTable: cySelector('settings.billing.invoicesTableAlt'),
      invoicesRow: cySelector('settings.billing.invoicesRow'),
      invoicesLoadMore: cySelector('settings.billing.invoicesLoadMore'),
      invoiceStatusBadge: cySelector('settings.billing.invoiceStatusBadge'),
      paymentMethod: cySelector('settings.billing.paymentMethod'),
      usage: cySelector('settings.billing.usage'),
      usageDashboard: cySelector('settings.billing.usageDashboard'),
      pricingTable: cySelector('settings.pricing.table'),
      pricingSettingsTable: cySelector('settings.pricing.settingsTable'),
      featurePlaceholder: (feature: string) => cySelector('settings.features.placeholder', { feature }),
      featureContent: (feature: string) => cySelector('settings.features.content', { feature }),
      placeholderUpgradeBtn: cySelector('settings.features.placeholderUpgradeBtn'),
    }
  }

  // Factory method for clean instantiation
  static create(): BillingPOM {
    return new BillingPOM()
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  /**
   * Visit billing settings page
   * Uses failOnStatusCode: false to handle intermittent 500 errors
   */
  visitBilling(): BillingPOM {
    cy.visit('/dashboard/settings/billing', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/billing')
    return this
  }

  /**
   * Visit pricing page
   */
  visitPricing(): BillingPOM {
    cy.visit('/pricing', { timeout: 30000 })
    return this
  }

  // ============================================================
  // SELECTORS
  // ============================================================

  /**
   * Main billing container
   */
  getBillingMain(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.main)
  }

  /**
   * Billing header
   */
  getBillingHeader(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.header)
  }

  /**
   * Upgrade plan button
   */
  getUpgradeButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.upgradePlan)
  }

  /**
   * Add payment method button
   */
  getAddPaymentButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.addPayment)
  }

  /**
   * Load more invoices button
   */
  getLoadMoreInvoicesButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.invoicesLoadMore)
  }

  /**
   * Invoices table
   */
  getInvoicesTable(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.invoicesTable)
  }

  /**
   * Invoice rows
   */
  getInvoiceRows(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.invoicesRow)
  }

  /**
   * Invoice status badges
   */
  getInvoiceStatusBadge(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.invoiceStatusBadge)
  }

  // ============================================================
  // ASSERTIONS
  // ============================================================

  /**
   * Assert billing page is visible
   */
  assertBillingPageVisible(): BillingPOM {
    this.getBillingMain().should('be.visible')
    this.getBillingHeader().should('be.visible')
    return this
  }

  /**
   * Assert current plan is displayed
   * @param planName Expected plan name (e.g., "Free", "Pro")
   */
  assertCurrentPlan(planName: string): BillingPOM {
    cy.contains(planName).should('be.visible')
    return this
  }

  /**
   * Assert upgrade button is visible
   */
  assertUpgradeButtonVisible(): BillingPOM {
    this.getUpgradeButton().should('be.visible')
    return this
  }

  /**
   * Assert invoices are displayed
   * @param count Expected number of invoices (0 for empty state)
   */
  assertInvoicesCount(count: number): BillingPOM {
    if (count === 0) {
      // Empty state
      cy.contains(/no invoices|sin facturas/i).should('be.visible')
    } else {
      this.getInvoiceRows().should('have.length.at.least', count)
    }
    return this
  }

  /**
   * Assert no payment method message
   */
  assertNoPaymentMethod(): BillingPOM {
    // Match both English and Spanish:
    // EN: "No payment method configured"
    // ES: "No hay método de pago configurado"
    cy.contains(/no payment method configured|no hay método de pago configurado/i).should('be.visible')
    return this
  }

  /**
   * Assert usage is displayed
   */
  assertUsageVisible(): BillingPOM {
    // Check for usage numbers (format: X / Y)
    cy.contains(/\d+\s*\/\s*\d+/).should('be.visible')
    return this
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  /**
   * Click upgrade button
   */
  clickUpgrade(): BillingPOM {
    this.getUpgradeButton().click()
    return this
  }

  /**
   * Click add payment button
   */
  clickAddPayment(): BillingPOM {
    this.getAddPaymentButton().click()
    return this
  }

  /**
   * Load more invoices
   */
  loadMoreInvoices(): BillingPOM {
    this.getLoadMoreInvoicesButton().click()
    return this
  }

  // ============================================================
  // FEATURE GATE ASSERTIONS
  // ============================================================

  /**
   * Assert feature is blocked (shows upgrade message)
   * @param featureName Name of the blocked feature
   */
  assertFeatureBlocked(featureName: string): BillingPOM {
    cy.contains(new RegExp(`(upgrade|plan required|not available)`, 'i')).should('be.visible')
    return this
  }

  /**
   * Assert feature is available
   * @param featureName Name of the feature
   */
  assertFeatureAvailable(featureName: string): BillingPOM {
    // No upgrade message for this feature
    cy.contains(featureName).should('be.visible')
    return this
  }

  // ============================================================
  // PRICING PAGE METHODS
  // ============================================================

  /**
   * Visit pricing settings page
   */
  visitPricingSettings(): BillingPOM {
    cy.visit('/dashboard/settings/pricing', { timeout: 30000 })
    return this
  }

  /**
   * Get pricing table
   */
  getPricingTable(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(`${this.selectors.pricingTable}, ${this.selectors.pricingSettingsTable}`)
  }

  /**
   * Assert pricing table is visible
   */
  assertPricingTableVisible(): BillingPOM {
    this.getPricingTable().should('be.visible')
    return this
  }

  // ============================================================
  // FEATURE PAGES METHODS
  // ============================================================

  /**
   * Visit feature analytics page
   */
  visitAnalyticsFeature(): BillingPOM {
    cy.visit('/dashboard/features/analytics', { timeout: 30000 })
    return this
  }

  /**
   * Visit feature webhooks page
   */
  visitWebhooksFeature(): BillingPOM {
    cy.visit('/dashboard/features/webhooks', { timeout: 30000 })
    return this
  }

  /**
   * Visit feature automation page
   */
  visitAutomationFeature(): BillingPOM {
    cy.visit('/dashboard/features/automation', { timeout: 30000 })
    return this
  }

  /**
   * Get feature placeholder
   */
  getFeaturePlaceholder(feature: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.featurePlaceholder(feature))
  }

  /**
   * Assert feature placeholder is visible
   */
  assertFeaturePlaceholderVisible(feature: string): BillingPOM {
    this.getFeaturePlaceholder(feature).should('be.visible')
    return this
  }

  /**
   * Assert feature content is visible (user has access)
   */
  assertFeatureContentVisible(feature: string): BillingPOM {
    cy.get(this.selectors.featureContent(feature)).should('be.visible')
    return this
  }

  /**
   * Get placeholder upgrade button
   */
  getPlaceholderUpgradeButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(this.selectors.placeholderUpgradeBtn)
  }

  /**
   * Click placeholder upgrade button
   */
  clickPlaceholderUpgrade(): BillingPOM {
    this.getPlaceholderUpgradeButton().click()
    return this
  }

  // ============================================================
  // USAGE METHODS
  // ============================================================

  /**
   * Get usage section
   */
  getUsageSection(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(`${this.selectors.usage}, ${this.selectors.usageDashboard}`)
  }

  /**
   * Assert usage limit is displayed
   * @param limitName Name of the limit (e.g., "tasks", "customers")
   * @param current Current usage (optional, just checks format if not provided)
   * @param max Maximum allowed (optional)
   */
  assertUsageLimit(limitName: string, current?: number, max?: number): BillingPOM {
    if (current !== undefined && max !== undefined) {
      cy.contains(new RegExp(`${current}\\s*/\\s*${max}`, 'i')).should('be.visible')
    } else {
      // Just check for X / Y format
      cy.contains(/\d+\s*\/\s*\d+/).should('be.visible')
    }
    return this
  }

  // ============================================================
  // PAYMENT METHODS
  // ============================================================

  /**
   * Get payment method section
   */
  getPaymentMethodSection(): Cypress.Chainable<JQuery<HTMLElement>> {
    const paymentMethodAlt = cySelector('settings.billing.paymentMethodAlt')
    return cy.get(`${this.selectors.paymentMethod}, ${paymentMethodAlt}`)
  }

  /**
   * Assert payment method exists
   */
  assertPaymentMethodExists(): BillingPOM {
    this.getPaymentMethodSection().should('be.visible')
    return this
  }
}
