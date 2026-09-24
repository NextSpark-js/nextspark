/**
 * FeaturesPage - Page Object Model Class
 */
export class FeaturesPage {
  static selectors = {
    container: '.features-page',
    featuresList: '.features-list',
    featureItem: '.feature-item',
    demoButton: '[data-cy="feature-demo"]'
  }

  validateFeaturesPageLoaded() {
    cy.get(FeaturesPage.selectors.container).should('be.visible')
    cy.url().should('include', '/features')
    return this
  }

  validateFeaturesList() {
    cy.get(FeaturesPage.selectors.featuresList).should('be.visible')
    cy.get(FeaturesPage.selectors.featureItem).should('have.length.at.least', 1)
    return this
  }

  clickFeatureDemo() {
    cy.get(FeaturesPage.selectors.demoButton).first().click()
    return this
  }
}
