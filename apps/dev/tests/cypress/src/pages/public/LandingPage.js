/**
 * LandingPage - Page Object Model Class
 * 
 * Encapsula funcionalidad de la página principal pública
 * Mapea test cases: PUB_001-008 de public-pages.cy.md
 */
export class LandingPage {
  static selectors = {
    // Hero section
    heroSection: '.hero-section',
    heroTitle: 'h1',
    heroSubtitle: '.subtitle',
    ctaButton: '[data-cy="cta-signup"]',
    
    // Navigation
    navbar: '[data-cy="public-navbar"]',
    loginLink: '[data-cy="nav-login"]',
    signupLink: '[data-cy="nav-signup"]',
    
    // Features section
    featuresSection: '.features-section',
    featureCard: '.feature-card',
    
    // Footer
    footer: '[data-cy="public-footer"]',
    footerLinks: '.footer-links a',
  }

  visit() {
    cy.visit('/')
    return this
  }

  validateLandingPageLoaded() {
    cy.get(LandingPage.selectors.heroSection).should('be.visible')
    cy.get(LandingPage.selectors.heroTitle).should('be.visible')
    cy.url().should('eq', Cypress.config().baseUrl + '/')
    return this
  }

  clickSignupCTA() {
    cy.get(LandingPage.selectors.ctaButton).click()
    cy.url().should('include', '/signup')
    return this
  }

  clickSignupButton() {
    // Alias for clickSignupCTA for consistency
    return this.clickSignupCTA()
  }

  navigateToLogin() {
    cy.get(LandingPage.selectors.loginLink).click()
    cy.url().should('include', '/login')
    return this
  }

  validateFeatures() {
    cy.get(LandingPage.selectors.featuresSection).should('be.visible')
    cy.get(LandingPage.selectors.featureCard).should('have.length.at.least', 3)
    return this
  }

  validateFooter() {
    cy.get(LandingPage.selectors.footer).should('be.visible')
    cy.get(LandingPage.selectors.footerLinks).should('have.length.at.least', 1)
    return this
  }
}
