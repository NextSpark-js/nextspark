/**
 * Public Page POM
 *
 * Page Object Model for testing public page rendering.
 * Validates that pages created with the Block Editor render correctly
 * on the public-facing site.
 *
 * Convention: block-{slug} for rendered blocks
 * Based on data-cy attributes added to block components.
 */

import { cySelector } from '../selectors'

export interface PageData {
  slug: string
  locale?: 'en' | 'es'
}

export class PublicPagePOM {
  // ============================================
  // SELECTORS - Navbar (using centralized cySelector)
  // ============================================

  static get navbarSelectors() {
    return {
      container: cySelector('public.navbar.container'),
      logo: cySelector('public.navbar.logo'),
      loginButton: cySelector('public.navbar.loginButton'),
      signupButton: cySelector('public.navbar.signupButton'),
    }
  }

  // ============================================
  // SELECTORS - Footer (using centralized cySelector)
  // ============================================

  static get footerSelectors() {
    return {
      container: cySelector('public.footer.container'),
      logo: cySelector('public.footer.logo'),
    }
  }

  // ============================================
  // SELECTORS - Page Container
  // ============================================

  static get pageSelectors() {
    return {
      // Page wrapper (from PageRenderer)
      page: '[data-page-id]',
      pageById: (id: string) => `[data-page-id="${id}"]`,
      pageBySlug: (slug: string) => `[data-page-slug="${slug}"]`,

      // Generic block wrapper
      blockWrapper: '[data-block-id]',
      blockById: (id: string) => `[data-block-id="${id}"]`,
      blockBySlug: (slug: string) => `[data-block-slug="${slug}"]`,

      // Empty page state
      emptyPage: '[data-cy="page-empty"]',
    }
  }

  // ============================================
  // SELECTORS - Block Components
  // ============================================

  static get blockSelectors() {
    return {
      // Core blocks (from contents/themes/default/blocks/)
      hero: '[data-cy="block-hero"]',
      ctaSection: '[data-cy="block-cta-section"]',
      featuresGrid: '[data-cy="block-features-grid"]',
      testimonials: '[data-cy="block-testimonials"]',
      textContent: '[data-cy="block-text-content"]',
      benefits: '[data-cy="block-benefits"]',

      // Generic block selector
      block: (slug: string) => `[data-cy="block-${slug}"]`,
    }
  }

  // ============================================
  // SELECTORS - Block Internal Elements
  // ============================================

  static get heroElements() {
    return {
      section: '[data-cy="block-hero"]',
      title: '[data-cy="block-hero"] h1',
      subtitle: '[data-cy="block-hero"] p',
      ctaButton: '[data-cy="block-hero"] a[href]',
      backgroundImage: '[data-cy="block-hero"] img',
    }
  }

  static get ctaElements() {
    return {
      section: '[data-cy="block-cta-section"]',
      title: '[data-cy="block-cta-section"] h2',
      description: '[data-cy="block-cta-section"] p',
      primaryButton: '[data-cy="block-cta-section"] a:first-of-type',
      secondaryButton: '[data-cy="block-cta-section"] a:last-of-type',
    }
  }

  static get featuresElements() {
    return {
      section: '[data-cy="block-features-grid"]',
      title: '[data-cy="block-features-grid"] h2',
      featureItem: '[data-cy="block-features-grid"] [class*="feature"]',
      featureIcon: '[data-cy="block-features-grid"] svg',
      featureTitle: '[data-cy="block-features-grid"] h3',
      featureDescription: '[data-cy="block-features-grid"] p',
    }
  }

  static get testimonialsElements() {
    return {
      section: '[data-cy="block-testimonials"]',
      title: '[data-cy="block-testimonials"] h2',
      testimonialItem: '[data-cy="block-testimonials"] [class*="testimonial"]',
      quote: '[data-cy="block-testimonials"] blockquote, [data-cy="block-testimonials"] p',
      authorName: '[data-cy="block-testimonials"] [class*="author"]',
      authorAvatar: '[data-cy="block-testimonials"] img',
    }
  }

  static get textContentElements() {
    return {
      section: '[data-cy="block-text-content"]',
      content: '[data-cy="block-text-content"] [class*="prose"], [data-cy="block-text-content"] div',
    }
  }

  static get benefitsElements() {
    return {
      section: '[data-cy="block-benefits"]',
      title: '[data-cy="block-benefits"] h2',
      benefitItem: '[data-cy="block-benefits"] [class*="benefit"]',
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  static visit(slug: string, locale?: string) {
    const path = locale && locale !== 'en' ? `/${locale}/${slug}` : `/${slug}`
    cy.visit(path)
    return this
  }

  static visitEnglish(slug: string) {
    cy.visit(`/${slug}`)
    return this
  }

  static visitSpanish(slug: string) {
    cy.visit(`/es/${slug}`)
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  static waitForPageLoad() {
    cy.get(this.pageSelectors.page, { timeout: 15000 }).should('exist')
    return this
  }

  static waitForBlockLoad(slug: string) {
    cy.get(this.blockSelectors.block(slug), { timeout: 10000 }).should('be.visible')
    return this
  }

  static waitForHeroLoad() {
    cy.get(this.blockSelectors.hero, { timeout: 10000 }).should('be.visible')
    return this
  }

  // ============================================
  // INTERACTIONS
  // ============================================

  static clickHeroCta() {
    cy.get(this.heroElements.ctaButton).first().click()
    return this
  }

  static clickCtaPrimaryButton() {
    cy.get(this.ctaElements.primaryButton).click()
    return this
  }

  static clickCtaSecondaryButton() {
    cy.get(this.ctaElements.secondaryButton).click()
    return this
  }

  // ============================================
  // ASSERTIONS - Page Level
  // ============================================

  static assertPageExists() {
    cy.get(this.pageSelectors.page).should('exist')
    return this
  }

  static assertPageHasSlug(slug: string) {
    cy.get(this.pageSelectors.pageBySlug(slug)).should('exist')
    return this
  }

  static assertPageNotFound() {
    cy.contains('404').should('exist')
    return this
  }

  static assertPageEmpty() {
    cy.get(this.pageSelectors.emptyPage).should('be.visible')
    return this
  }

  static assertBlockCount(count: number) {
    cy.get(this.pageSelectors.blockWrapper).should('have.length', count)
    return this
  }

  // ============================================
  // ASSERTIONS - Block Visibility
  // ============================================

  static assertHeroVisible() {
    cy.get(this.blockSelectors.hero).should('be.visible')
    return this
  }

  static assertCtaVisible() {
    cy.get(this.blockSelectors.ctaSection).should('be.visible')
    return this
  }

  static assertFeaturesVisible() {
    cy.get(this.blockSelectors.featuresGrid).should('be.visible')
    return this
  }

  static assertTestimonialsVisible() {
    cy.get(this.blockSelectors.testimonials).should('be.visible')
    return this
  }

  static assertTextContentVisible() {
    cy.get(this.blockSelectors.textContent).should('be.visible')
    return this
  }

  static assertBenefitsVisible() {
    cy.get(this.blockSelectors.benefits).should('be.visible')
    return this
  }

  static assertBlockVisible(slug: string) {
    cy.get(this.blockSelectors.block(slug)).should('be.visible')
    return this
  }

  static assertBlockNotVisible(slug: string) {
    cy.get(this.blockSelectors.block(slug)).should('not.exist')
    return this
  }

  // ============================================
  // ASSERTIONS - Hero Block Content
  // ============================================

  static assertHeroTitle(title: string) {
    cy.get(this.heroElements.title).should('contain.text', title)
    return this
  }

  static assertHeroSubtitle(subtitle: string) {
    cy.get(this.heroElements.subtitle).should('contain.text', subtitle)
    return this
  }

  static assertHeroCtaText(text: string) {
    cy.get(this.heroElements.ctaButton).should('contain.text', text)
    return this
  }

  static assertHeroCtaLink(href: string) {
    cy.get(this.heroElements.ctaButton).should('have.attr', 'href', href)
    return this
  }

  static assertHeroHasBackgroundImage() {
    cy.get(this.heroElements.backgroundImage).should('exist')
    return this
  }

  // ============================================
  // ASSERTIONS - CTA Block Content
  // ============================================

  static assertCtaTitle(title: string) {
    cy.get(this.ctaElements.title).should('contain.text', title)
    return this
  }

  static assertCtaDescription(description: string) {
    cy.get(this.ctaElements.description).should('contain.text', description)
    return this
  }

  static assertCtaPrimaryButtonText(text: string) {
    cy.get(this.ctaElements.primaryButton).should('contain.text', text)
    return this
  }

  // ============================================
  // ASSERTIONS - Features Block Content
  // ============================================

  static assertFeaturesTitle(title: string) {
    cy.get(this.featuresElements.title).should('contain.text', title)
    return this
  }

  static assertFeatureCount(count: number) {
    cy.get(this.featuresElements.featureItem).should('have.length', count)
    return this
  }

  static assertFeatureHasTitle(index: number, title: string) {
    cy.get(this.featuresElements.featureTitle).eq(index).should('contain.text', title)
    return this
  }

  // ============================================
  // ASSERTIONS - Testimonials Block Content
  // ============================================

  static assertTestimonialsTitle(title: string) {
    cy.get(this.testimonialsElements.title).should('contain.text', title)
    return this
  }

  static assertTestimonialCount(count: number) {
    cy.get(this.testimonialsElements.testimonialItem).should('have.length', count)
    return this
  }

  // ============================================
  // ASSERTIONS - Text Content Block
  // ============================================

  static assertTextContentContains(text: string) {
    cy.get(this.textContentElements.content).should('contain.text', text)
    return this
  }

  // ============================================
  // ASSERTIONS - SEO & Metadata
  // ============================================

  static assertMetaTitle(title: string) {
    cy.title().should('contain', title)
    return this
  }

  static assertMetaDescription(description: string) {
    cy.get('meta[name="description"]').should('have.attr', 'content').and('contain', description)
    return this
  }

  static assertOgTitle(title: string) {
    cy.get('meta[property="og:title"]').should('have.attr', 'content').and('contain', title)
    return this
  }

  static assertOgDescription(description: string) {
    cy.get('meta[property="og:description"]').should('have.attr', 'content').and('contain', description)
    return this
  }

  static assertCanonicalUrl(url: string) {
    cy.get('link[rel="canonical"]').should('have.attr', 'href').and('contain', url)
    return this
  }

  // ============================================
  // COMPLETE VALIDATION WORKFLOWS
  // ============================================

  /**
   * Validate a complete page with expected blocks
   */
  static validatePage(slug: string, expectedBlocks: string[]) {
    this.visit(slug)
    this.waitForPageLoad()
    this.assertPageHasSlug(slug)
    this.assertBlockCount(expectedBlocks.length)

    expectedBlocks.forEach((blockSlug) => {
      this.assertBlockVisible(blockSlug)
    })

    return this
  }

  /**
   * Validate hero block has all expected content
   */
  static validateHeroBlock(expectedContent: { title?: string; subtitle?: string; ctaText?: string; ctaLink?: string }) {
    this.assertHeroVisible()

    if (expectedContent.title) this.assertHeroTitle(expectedContent.title)
    if (expectedContent.subtitle) this.assertHeroSubtitle(expectedContent.subtitle)
    if (expectedContent.ctaText) this.assertHeroCtaText(expectedContent.ctaText)
    if (expectedContent.ctaLink) this.assertHeroCtaLink(expectedContent.ctaLink)

    return this
  }

  /**
   * Validate page SEO metadata
   */
  static validateSeo(expected: { title?: string; description?: string }) {
    if (expected.title) {
      this.assertMetaTitle(expected.title)
      this.assertOgTitle(expected.title)
    }

    if (expected.description) {
      this.assertMetaDescription(expected.description)
      this.assertOgDescription(expected.description)
    }

    return this
  }
}

export default PublicPagePOM
