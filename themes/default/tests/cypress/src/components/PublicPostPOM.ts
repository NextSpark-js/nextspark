/**
 * Public Post POM
 *
 * Page Object Model for public post display pages (/blog/[slug]).
 * Covers post rendering, blocks, categories, and SEO verification.
 *
 * Convention: post-{component}-{element}
 * Based on selectors documented in tests.md
 */

export class PublicPostPOM {
  // ============================================
  // SELECTORS - Public Post
  // ============================================

  static get postSelectors() {
    return {
      content: '[data-cy="post-content"]',
      header: '[data-cy="post-header"]',
      title: '[data-cy="post-title"]',
      excerpt: '[data-cy="post-excerpt"]',
      featuredImage: '[data-cy="post-featured-image-display"]',
      categoriesDisplay: '[data-cy="post-categories-display"]',
      categoryBadge: (name: string) => `[data-cy="post-categories-display"] :contains("${name}")`,
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  static visit(slug: string, options?: Partial<Cypress.VisitOptions>) {
    cy.visit(`/blog/${slug}`, options)
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  static waitForPostLoad() {
    cy.get(this.postSelectors.content, { timeout: 15000 }).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTIONS
  // ============================================

  static assertPostVisible() {
    cy.get(this.postSelectors.content).should('be.visible')
    return this
  }

  static assertHeaderVisible() {
    cy.get(this.postSelectors.header).should('be.visible')
    return this
  }

  static assertTitle(title: string) {
    cy.get(this.postSelectors.title).should('contain', title)
    return this
  }

  static assertExcerpt(excerpt: string) {
    cy.get(this.postSelectors.excerpt).should('contain', excerpt)
    return this
  }

  static assertFeaturedImageVisible() {
    cy.get(this.postSelectors.featuredImage).should('be.visible')
    return this
  }

  static assertCategoryVisible(categoryName: string) {
    cy.get(this.postSelectors.categoriesDisplay).should('contain', categoryName)
    return this
  }

  static assertCategoryBadgeColor(categoryName: string, color: string) {
    // Check that category badge has the expected color in its styling
    cy.get(this.postSelectors.categoryBadge(categoryName))
      .should('exist')
      .and('have.attr', 'style')
      .and('include', color)
    return this
  }

  static assertBlockRendered(blockType: string) {
    // Check for block rendering (blocks typically have a wrapper with block-specific data)
    cy.get(this.postSelectors.content).within(() => {
      cy.contains(blockType, { matchCase: false }).should('exist')
    })
    return this
  }

  static assert404() {
    cy.contains('404').should('be.visible')
    return this
  }

  static assertUnpublishedNotAccessible() {
    // Should redirect to 404 or show error
    cy.url().should('match', /404|not-found/)
    return this
  }

  // ============================================
  // SEO VERIFICATION
  // ============================================

  static assertMetaTitle(title: string) {
    cy.get('head title').should('contain', title)
    return this
  }

  static assertMetaDescription(description: string) {
    cy.get('head meta[name="description"]')
      .should('have.attr', 'content')
      .and('include', description)
    return this
  }

  static assertOgImage(imageUrl: string) {
    cy.get('head meta[property="og:image"]')
      .should('have.attr', 'content')
      .and('include', imageUrl)
    return this
  }

  static assertNoIndex() {
    cy.get('head meta[name="robots"]')
      .should('have.attr', 'content')
      .and('include', 'noindex')
    return this
  }

  static assertNoFollow() {
    cy.get('head meta[name="robots"]')
      .should('have.attr', 'content')
      .and('include', 'nofollow')
    return this
  }
}

export default PublicPostPOM
