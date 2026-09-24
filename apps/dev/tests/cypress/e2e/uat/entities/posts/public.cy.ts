/// <reference types="cypress" />

/**
 * Public Post Display - UAT Tests
 *
 * Tests for public post rendering at /blog/[slug].
 * Validates post display, blocks rendering, categories, and SEO.
 *
 * Tags: @uat, @feat-posts, @public, @regression
 */

import * as allure from 'allure-cypress'
import { PublicPostPOM } from '../../../../src'

describe('Public Post Display - UAT', {
  tags: ['@uat', '@feat-posts', '@public', '@regression']
}, () => {
  beforeEach(() => {
    allure.epic('Posts System')
    allure.feature('Public Post Display')
  })

  // ============================================================
  // Post Rendering Tests
  // ============================================================
  describe('Post Rendering', () => {
    it('POST-PUB-001: Should render a published post', { tags: '@smoke' }, () => {
      allure.story('Post Rendering')
      allure.severity('critical')

      // Visit a sample post (from sample data: 'welcome-to-our-blog')
      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()
      PublicPostPOM.assertPostVisible()

      cy.log('Published post rendered successfully')
    })

    it('POST-PUB-002: Should display post header', () => {
      allure.story('Post Rendering')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      PublicPostPOM.assertHeaderVisible()
      PublicPostPOM.assertTitle('Welcome')

      cy.log('Post header displayed')
    })

    it('POST-PUB-003: Should display post excerpt', () => {
      allure.story('Post Rendering')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Check that excerpt is visible
      cy.get(PublicPostPOM.postSelectors.excerpt).should('be.visible')

      cy.log('Post excerpt displayed')
    })
  })

  // ============================================================
  // Block Rendering Tests
  // ============================================================
  describe('Block Rendering', () => {
    it('POST-PUB-004: Should render post blocks', () => {
      allure.story('Block Rendering')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Sample posts have hero blocks - check that blocks are rendered
      cy.get(PublicPostPOM.postSelectors.content).within(() => {
        // Look for block content (hero block typically has heading and text)
        cy.get('h1, h2, h3').should('exist')
      })

      cy.log('Post blocks rendered')
    })

    it('POST-PUB-005: Should render hero block correctly', () => {
      allure.story('Block Rendering')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Hero block should render with its content
      cy.get(PublicPostPOM.postSelectors.content).within(() => {
        // Hero typically has heading, description, and CTA
        cy.contains('Welcome', { matchCase: false }).should('exist')
      })

      cy.log('Hero block rendered correctly')
    })
  })

  // ============================================================
  // Category Display Tests
  // ============================================================
  describe('Category Display', () => {
    it('POST-PUB-006: Should display category badges', () => {
      allure.story('Categories')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Sample post has "News" category
      PublicPostPOM.assertCategoryVisible('News')

      cy.log('Category badges displayed')
    })

    it('POST-PUB-007: Should display category badges with colors', () => {
      allure.story('Categories')
      allure.severity('minor')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Check that categories have color styling
      cy.get(PublicPostPOM.postSelectors.categoriesDisplay).within(() => {
        cy.get('[style*="background"], [style*="color"]').should('exist')
      })

      cy.log('Category badges with colors displayed')
    })
  })

  // ============================================================
  // SEO Tests
  // ============================================================
  describe('SEO Meta Tags', () => {
    // SEO meta tags implementation pending
    it.skip('POST-PUB-008: Should have correct page title', () => {
      allure.story('SEO')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Check that page title includes post title
      PublicPostPOM.assertMetaTitle('Welcome')

      cy.log('SEO title correct')
    })

    // SEO meta tags implementation pending
    it.skip('POST-PUB-009: Should have meta description', () => {
      allure.story('SEO')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Check for meta description
      cy.get('head meta[name="description"]').should('exist')

      cy.log('Meta description exists')
    })

    // SEO meta tags implementation pending
    it.skip('POST-PUB-010: Should have OG tags for social sharing', () => {
      allure.story('SEO')
      allure.severity('normal')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Check for Open Graph tags
      cy.get('head meta[property^="og:"]').should('have.length.at.least', 1)

      cy.log('OG tags present')
    })
  })

  // ============================================================
  // Unpublished Post Tests
  // ============================================================
  describe('Unpublished Posts', () => {
    it('POST-PUB-011: Should not display unpublished posts', () => {
      allure.story('Access Control')
      allure.severity('critical')

      // Sample data has 'typescript-best-practices' as draft
      PublicPostPOM.visit('typescript-best-practices', { failOnStatusCode: false })

      // Wait for page to render then check for 404 content
      cy.get('body', { timeout: 10000 }).should('be.visible').then(($body) => {
        // Either URL changed to 404 or page shows error/not found content
        const bodyText = $body.text().toLowerCase()
        const hasNotFound = bodyText.includes('404') || bodyText.includes('not found') || bodyText.includes('page not found')
        expect(hasNotFound).to.be.true
      })

      cy.log('Unpublished post not accessible')
    })
  })

  // ============================================================
  // 404 Tests
  // ============================================================
  describe('404 Not Found', () => {
    it('POST-PUB-012: Should show 404 for non-existent post', () => {
      allure.story('Error Handling')
      allure.severity('normal')

      PublicPostPOM.visit('non-existent-post-slug-12345', { failOnStatusCode: false })

      // Wait for page to render then check for 404 content
      cy.get('body', { timeout: 10000 }).should('be.visible').then(($body) => {
        const bodyText = $body.text().toLowerCase()
        const hasNotFound = bodyText.includes('404') || bodyText.includes('not found') || bodyText.includes('page not found')
        expect(hasNotFound).to.be.true
      })

      cy.log('404 shown for non-existent post')
    })
  })

  // ============================================================
  // Featured Image Tests
  // ============================================================
  describe('Featured Image', () => {
    it('POST-PUB-013: Should display featured image when present', () => {
      allure.story('Media')
      allure.severity('minor')

      PublicPostPOM.visit('welcome-to-our-blog')
      PublicPostPOM.waitForPostLoad()

      // Check if featured image is present (may or may not be in sample data)
      cy.get(PublicPostPOM.postSelectors.header).then(($header) => {
        if ($header.find(PublicPostPOM.postSelectors.featuredImage).length > 0) {
          PublicPostPOM.assertFeaturedImageVisible()
          cy.log('Featured image displayed')
        } else {
          cy.log('No featured image in this post (optional field)')
        }
      })
    })
  })
})
