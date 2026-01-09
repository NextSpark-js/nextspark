/**
 * BasePOMCore - Base class with common utilities for all Page Object Models
 *
 * This is the CORE version that provides generic methods.
 * Themes should extend this class and implement the abstract `cySelector` method
 * to provide theme-specific selector resolution.
 *
 * @example Theme extension:
 * ```ts
 * // theme/tests/cypress/src/core/BasePOM.ts
 * import { BasePOMCore } from '@nextsparkjs/testing/pom'
 * import { cySelector } from '../selectors'
 *
 * export abstract class BasePOM extends BasePOMCore {
 *   protected cySelector(path: string, replacements?: Record<string, string>): string {
 *     return cySelector(path, replacements)
 *   }
 * }
 * ```
 */

import { type Replacements } from '../selectors'

// Re-export for convenience
export type { Replacements }

export abstract class BasePOMCore {
  /**
   * Abstract method - themes must implement to provide their cySelector
   * This allows themes to use their extended THEME_SELECTORS
   *
   * @param path - Dot-notation path to the selector (e.g., "auth.login.form")
   * @param replacements - Optional placeholder replacements
   * @returns Cypress selector string like [data-cy="selector-value"]
   */
  protected abstract cySelector(path: string, replacements?: Replacements): string

  /**
   * Get a Cypress selector using the centralized selectors
   * Wrapper for cySelector with a shorter name
   *
   * @example
   * this.cy('auth.login.form')
   * // Returns: '[data-cy="login-form"]'
   *
   * this.cy('entities.table.row', { slug: 'tasks', id: '123' })
   * // Returns: '[data-cy="tasks-row-123"]'
   */
  protected cy(path: string, replacements?: Replacements): string {
    return this.cySelector(path, replacements)
  }

  /**
   * Replaces placeholders in a selector pattern and wraps with data-cy attribute
   *
   * @param pattern - Selector pattern with {placeholder} syntax
   * @param replacements - Object with placeholder values
   * @returns Formatted data-cy selector string
   *
   * @example
   * selector('{slug}-row-{id}', { slug: 'tasks', id: '123' })
   * // Returns: '[data-cy="tasks-row-123"]'
   */
  protected selector(pattern: string, replacements: Replacements = {}): string {
    let result = pattern
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replaceAll(`{${key}}`, String(value))
    }
    return `[data-cy="${result}"]`
  }

  /**
   * Wrapper for cy.get with selector pattern support
   * @param pattern - Selector pattern or direct selector
   * @param replacements - Optional placeholder replacements
   */
  protected get(pattern: string, replacements: Replacements = {}) {
    return cy.get(this.selector(pattern, replacements))
  }

  /**
   * Generic wait with configurable timeout
   * @param selector - CSS selector to wait for
   * @param timeout - Max wait time in ms (default: 15000)
   */
  protected waitFor(selector: string, timeout = 15000) {
    cy.get(selector, { timeout }).should('be.visible')
    return this
  }

  /**
   * Wait for URL to contain a specific path
   * @param path - Path segment to check for
   */
  protected waitForUrl(path: string) {
    cy.url().should('include', path)
    return this
  }

  /**
   * Wait for URL to match a regex pattern
   * @param pattern - RegExp to match against URL
   */
  protected waitForUrlMatch(pattern: RegExp) {
    cy.url().should('match', pattern)
    return this
  }

  /**
   * Visit a URL and return self for chaining
   * @param url - URL to visit
   */
  visit(url: string) {
    cy.visit(url)
    return this
  }

  /**
   * Wait for page to load (checks for body visible)
   */
  waitForPageLoad() {
    cy.get('body').should('be.visible')
    return this
  }

  /**
   * Get an element by selector
   * @param selector - CSS selector
   */
  getElement(selector: string) {
    return cy.get(selector)
  }

  /**
   * Click on an element
   * @param selector - CSS selector
   */
  click(selector: string) {
    cy.get(selector).click()
    return this
  }

  /**
   * Type text into an input
   * @param selector - CSS selector
   * @param text - Text to type
   */
  type(selector: string, text: string) {
    cy.get(selector).clear().type(text)
    return this
  }

  /**
   * Check if element exists
   * @param selector - CSS selector
   */
  exists(selector: string) {
    return cy.get(selector).should('exist')
  }

  /**
   * Check if element is visible
   * @param selector - CSS selector
   */
  isVisible(selector: string) {
    return cy.get(selector).should('be.visible')
  }

  /**
   * Check if element does not exist
   * @param selector - CSS selector
   */
  notExists(selector: string) {
    return cy.get(selector).should('not.exist')
  }
}

export default BasePOMCore
