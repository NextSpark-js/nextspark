/// <reference types="cypress" />

/**
 * Public Page Rendering Tests
 *
 * Tests for public page rendering including block visibility,
 * content validation, SEO metadata, and i18n support.
 *
 * Tags: @uat, @feat-pages, @public, @page-builder
 */

import * as allure from 'allure-cypress'
import { PublicPagePOM } from '../../../../src/components'
import pageBuilderFixtures from '../../../../fixtures/page-builder.json'

describe('Public Page Rendering', {
  tags: ['@uat', '@feat-pages', '@public', '@page-builder']
}, () => {
  beforeEach(() => {
    allure.epic('Page Builder')
    allure.feature('Public Rendering')
  })

  // ============================================================
  // Published Page Tests
  // ============================================================
  describe('Published Page Rendering', () => {
    it('PB_PUBLIC_001: Should render published page with HTTP 200', { tags: '@smoke' }, () => {
      allure.story('Page Rendering')
      allure.severity('critical')

      // Visit about-us page (exists from sample data)
      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      // Visit the page directly - cy.visit() already validates the page loads successfully
      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()
      PublicPagePOM.assertPageExists()

      // Verify page has correct slug attribute
      cy.get(`[data-page-slug="${slug}"]`).should('exist')

      cy.log('Published page rendered successfully')
    })

    it('PB_PUBLIC_002: Should display Hero block with content', () => {
      allure.story('Block Rendering')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      // Hero block should be visible
      PublicPagePOM.assertHeroVisible()

      // Verify hero has content
      cy.get(PublicPagePOM.heroElements.title).should('exist')

      cy.log('Hero block rendered with content')
    })

    it('PB_PUBLIC_003: Should display Features Grid block', () => {
      allure.story('Block Rendering')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      PublicPagePOM.assertFeaturesVisible()

      cy.log('Features Grid block rendered')
    })

    it('PB_PUBLIC_004: Should display CTA Section block', () => {
      allure.story('Block Rendering')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      PublicPagePOM.assertCtaVisible()

      cy.log('CTA Section block rendered')
    })

    it('PB_PUBLIC_005: Should display Testimonials block', () => {
      allure.story('Block Rendering')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      PublicPagePOM.assertTestimonialsVisible()

      cy.log('Testimonials block rendered')
    })

    it('PB_PUBLIC_006: Should display all expected blocks', () => {
      allure.story('Block Rendering')

      const { slug, expectedBlocks } = pageBuilderFixtures.existingPages.aboutUs

      if (expectedBlocks) {
        PublicPagePOM.validatePage(slug, expectedBlocks)
        cy.log(`All ${expectedBlocks.length} expected blocks rendered`)
      } else {
        PublicPagePOM.visit(slug)
        PublicPagePOM.waitForPageLoad()
        cy.log('Page rendered (no specific blocks expected)')
      }
    })
  })

  // ============================================================
  // Draft Page Tests
  // ============================================================
  describe('Draft Page Handling', () => {
    it('PB_PUBLIC_007: Should return 404 for draft page', () => {
      allure.story('Access Control')

      // Create a draft page via API
      const timestamp = Date.now()
      const draftSlug = `draft-test-${timestamp}`

      cy.request({
        method: 'POST',
        url: '/api/v1/pages',
        headers: {
          'x-api-key': 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123',
          'Content-Type': 'application/json'
        },
        body: {
          title: `Draft Test ${timestamp}`,
          slug: draftSlug,
          locale: 'en',
          published: false, // Draft
          blocks: []
        }
      }).then((createResponse) => {
        const pageId = createResponse.body.data.id

        // Try to access draft page publicly
        cy.request({
          url: `/${draftSlug}`,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(404)
          cy.log('Draft page correctly returns 404')
        })

        // Cleanup
        cy.request({
          method: 'DELETE',
          url: `/api/v1/pages/${pageId}`,
          headers: {
            'x-api-key': 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
          }
        })
      })
    })
  })

  // ============================================================
  // SEO Metadata Tests
  // ============================================================
  describe('SEO Metadata', () => {
    it('PB_PUBLIC_008: Should have correct meta title', () => {
      allure.story('SEO')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      // Check page title exists
      cy.title().should('not.be.empty')

      cy.log('Meta title present')
    })

    it('PB_PUBLIC_009: Should have meta description', () => {
      allure.story('SEO')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      // Check meta description exists
      cy.get('meta[name="description"]').should('exist')

      cy.log('Meta description present')
    })
  })

  // ============================================================
  // i18n Tests
  // ============================================================
  describe('Internationalization', () => {
    it('PB_PUBLIC_010: Should render Spanish version of page', { tags: '@i18n' }, () => {
      allure.story('i18n')

      const spanishSlug = pageBuilderFixtures.existingPages.sobreNosotros?.slug

      if (spanishSlug) {
        // Try Spanish locale path
        cy.request({
          url: `/es/${spanishSlug}`,
          failOnStatusCode: false
        }).then((response) => {
          if (response.status === 200) {
            PublicPagePOM.visitSpanish(spanishSlug)
            PublicPagePOM.waitForPageLoad()
            PublicPagePOM.assertPageExists()

            cy.log('Spanish page rendered successfully')
          } else {
            // Try without locale prefix (might be default locale)
            cy.request({
              url: `/${spanishSlug}`,
              failOnStatusCode: false
            }).then((altResponse) => {
              expect(altResponse.status).to.eq(200)
              cy.log('Spanish page rendered at root path')
            })
          }
        })
      } else {
        cy.log('No Spanish page configured in fixtures - skipping')
      }
    })
  })

  // ============================================================
  // Block Interaction Tests
  // ============================================================
  describe('Block Interactions', () => {
    it('PB_PUBLIC_011: Should have clickable CTA button', () => {
      allure.story('Block Interactions')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      // Check if CTA section has clickable links
      cy.get(PublicPagePOM.ctaElements.section).then(($section) => {
        if ($section.length > 0) {
          cy.get(PublicPagePOM.ctaElements.primaryButton).then(($btn) => {
            if ($btn.length > 0) {
              cy.wrap($btn).should('have.attr', 'href')
              cy.log('CTA button is clickable with href')
            }
          })
        }
      })
    })

    it('PB_PUBLIC_012: Should have clickable Hero CTA', () => {
      allure.story('Block Interactions')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      cy.get(PublicPagePOM.heroElements.ctaButton).then(($btn) => {
        if ($btn.length > 0) {
          cy.wrap($btn).should('have.attr', 'href')
          cy.log('Hero CTA is clickable')
        } else {
          cy.log('Hero CTA not present on this page')
        }
      })
    })
  })

  // ============================================================
  // Page Structure Tests
  // ============================================================
  describe('Page Structure', () => {
    it('PB_PUBLIC_013: Should have correct page data attributes', () => {
      allure.story('Page Structure')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      // Verify page has data attributes
      cy.get('[data-page-id]').should('exist')
      cy.get('[data-page-slug]').should('have.attr', 'data-page-slug', slug)

      cy.log('Page data attributes correct')
    })

    it('PB_PUBLIC_014: Should have block data attributes', () => {
      allure.story('Page Structure')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      // Verify blocks have data attributes
      cy.get('[data-block-id]').should('have.length.at.least', 1)
      cy.get('[data-block-slug]').should('have.length.at.least', 1)

      cy.log('Block data attributes present')
    })
  })

  // ============================================================
  // Performance Tests
  // ============================================================
  describe('Performance', () => {
    it('PB_PUBLIC_015: Should load page within reasonable time', () => {
      allure.story('Performance')

      const slug = pageBuilderFixtures.existingPages.aboutUs.slug
      const startTime = Date.now()

      PublicPagePOM.visit(slug)
      PublicPagePOM.waitForPageLoad()

      cy.then(() => {
        const loadTime = Date.now() - startTime

        // Page should load within 5 seconds
        expect(loadTime).to.be.lessThan(5000)

        cy.log(`Page loaded in ${loadTime}ms`)
      })
    })
  })
})
