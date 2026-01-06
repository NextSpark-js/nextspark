/**
 * ApiInterceptor - Helper para waits determinísticos en Cypress
 *
 * Reemplaza cy.wait(ms) poco fiables con waits basados en cy.intercept()
 * que esperan respuestas reales de la API.
 *
 * Uso básico:
 *   const api = new ApiInterceptor('customers')
 *   api.setupCrudIntercepts()
 *   cy.visit('/dashboard/customers')
 *   api.waitForList()
 *
 * Uso con ruta custom:
 *   const api = new ApiInterceptor({
 *     slug: 'categories',
 *     customPath: '/api/v1/post-categories'
 *   })
 */

export interface ApiInterceptorConfig {
  /** Entity slug - usado para generar aliases */
  slug: string
  /** Ruta API custom (ej: '/api/v1/post-categories') */
  customPath?: string
}

export class ApiInterceptor {
  private slug: string
  private endpoint: string

  constructor(slugOrConfig: string | ApiInterceptorConfig) {
    if (typeof slugOrConfig === 'string') {
      this.slug = slugOrConfig
      this.endpoint = `/api/v1/${slugOrConfig}`
    } else {
      this.slug = slugOrConfig.slug
      this.endpoint = slugOrConfig.customPath || `/api/v1/${slugOrConfig.slug}`
    }
  }

  // ============================================
  // ACCESSORS
  // ============================================

  /** Get the API endpoint path */
  get path(): string {
    return this.endpoint
  }

  /** Get the entity slug */
  get entitySlug(): string {
    return this.slug
  }

  /** Get alias names for all operations */
  get aliases() {
    return {
      list: `${this.slug}List`,
      create: `${this.slug}Create`,
      update: `${this.slug}Update`,
      delete: `${this.slug}Delete`
    }
  }

  // ============================================
  // INTERCEPT SETUP
  // ============================================

  /**
   * Setup intercepts for all CRUD operations
   * Call this BEFORE navigation in beforeEach or at test start
   *
   * Note: We intercept both PUT and PATCH for updates since different
   * APIs may use different HTTP methods for updates.
   */
  setupCrudIntercepts(): this {
    cy.intercept('GET', `${this.endpoint}*`).as(this.aliases.list)
    cy.intercept('POST', this.endpoint).as(this.aliases.create)
    // Intercept both PUT and PATCH for updates (APIs may use either)
    cy.intercept('PUT', `${this.endpoint}/*`).as(this.aliases.update)
    cy.intercept('PATCH', `${this.endpoint}/*`).as(`${this.aliases.update}Patch`)
    cy.intercept('DELETE', `${this.endpoint}/*`).as(this.aliases.delete)
    return this
  }

  /**
   * Setup only list + create intercepts
   * Useful for list pages with inline create
   */
  setupListIntercepts(): this {
    cy.intercept('GET', `${this.endpoint}*`).as(this.aliases.list)
    cy.intercept('POST', this.endpoint).as(this.aliases.create)
    return this
  }

  // ============================================
  // WAIT METHODS
  // ============================================

  /**
   * Wait for list response (GET)
   * Use after navigation or after mutations to wait for refresh
   */
  waitForList(timeout = 10000): Cypress.Chainable {
    return cy.wait(`@${this.aliases.list}`, { timeout })
  }

  /**
   * Wait for create response (POST) and validate success status
   */
  waitForCreate(timeout = 10000): Cypress.Chainable {
    return cy.wait(`@${this.aliases.create}`, { timeout })
      .its('response.statusCode')
      .should('be.oneOf', [200, 201])
  }

  /**
   * Wait for update response (PATCH or PUT) and validate success status
   * Waits for PATCH first (more common), falls back to PUT
   */
  waitForUpdate(timeout = 10000): Cypress.Chainable {
    // Try PATCH first (more common in modern APIs), fall back to PUT
    return cy.wait(`@${this.aliases.update}Patch`, { timeout })
      .its('response.statusCode')
      .should('be.oneOf', [200, 201])
  }

  /**
   * Wait for delete response (DELETE) and validate success status
   */
  waitForDelete(timeout = 10000): Cypress.Chainable {
    return cy.wait(`@${this.aliases.delete}`, { timeout })
      .its('response.statusCode')
      .should('be.oneOf', [200, 204])
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  /**
   * Wait for list refresh (alias for waitForList)
   * Semantic name for use after create/update/delete
   */
  waitForRefresh(timeout = 10000): Cypress.Chainable {
    return this.waitForList(timeout)
  }

  /**
   * Wait for create + list refresh
   * Common pattern: create entity, wait for success, wait for list to refresh
   */
  waitForCreateAndRefresh(timeout = 10000): Cypress.Chainable {
    this.waitForCreate(timeout)
    return this.waitForList(timeout)
  }

  /**
   * Wait for update + list refresh
   * Common pattern: update entity, wait for success, wait for list to refresh
   */
  waitForUpdateAndRefresh(timeout = 10000): Cypress.Chainable {
    this.waitForUpdate(timeout)
    return this.waitForList(timeout)
  }

  /**
   * Wait for delete + list refresh
   * Common pattern: delete entity, wait for success, wait for list to refresh
   */
  waitForDeleteAndRefresh(timeout = 10000): Cypress.Chainable {
    this.waitForDelete(timeout)
    return this.waitForList(timeout)
  }
}

export default ApiInterceptor
