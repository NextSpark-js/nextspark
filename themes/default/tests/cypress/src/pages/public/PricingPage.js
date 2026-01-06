/**
 * PricingPage - Page Object Model Class
 */
export class PricingPage {
  static selectors = {
    container: '.pricing-page',
    pricingCards: '.pricing-card',
    selectPlanButton: '[data-cy="select-plan"]',
    monthlyToggle: '[data-cy="monthly-toggle"]',
    yearlyToggle: '[data-cy="yearly-toggle"]'
  }

  validatePricingPageLoaded() {
    cy.get(PricingPage.selectors.container).should('be.visible')
    cy.url().should('include', '/pricing')
    return this
  }

  validatePricingCards() {
    cy.get(PricingPage.selectors.pricingCards).should('have.length.at.least', 2)
    return this
  }

  selectPlan(planIndex = 0) {
    cy.get(PricingPage.selectors.selectPlanButton).eq(planIndex).click()
    return this
  }

  toggleToYearly() {
    cy.get(PricingPage.selectors.yearlyToggle).click()
    return this
  }
}
