/**
 * Opportunities Page Object Model for CRM Theme
 *
 * Entity-specific POM for Opportunities (Deals).
 * Includes support for both list view and kanban board integration.
 *
 * Usage:
 *   const opportunities = new OpportunitiesPOM()
 *   opportunities.list.validateTableVisible()
 *   opportunities.validateDealCard('deal-123')
 */

import { EntityList } from '../components/EntityList'
import { EntityForm } from '../components/EntityForm'
import { EntityDetail } from '../components/EntityDetail'

export class OpportunitiesPOM {
  /** Generic list POM for opportunities */
  readonly list: EntityList

  /** Generic form POM for opportunities */
  readonly form: EntityForm

  /** Generic detail POM for opportunities */
  readonly detail: EntityDetail

  /** Opportunity entity slug */
  readonly slug = 'opportunities'

  constructor() {
    this.list = EntityList.for('opportunities')
    this.form = EntityForm.for('opportunities')
    this.detail = new EntityDetail('opportunities', 'opportunity', ['activities', 'notes'])
  }

  // ============================================
  // DEAL CARD SELECTORS (Kanban)
  // ============================================

  /**
   * Deal card selectors (used in Kanban board)
   */
  get dealSelectors() {
    return {
      card: (dealId: string) => `[data-cy="deal-card-${dealId}"]`,
      cardName: (dealId: string) => `[data-cy="deal-card-name-${dealId}"]`,
      cardCompany: (dealId: string) => `[data-cy="deal-card-company-${dealId}"]`,
      cardAmount: (dealId: string) => `[data-cy="deal-card-amount-${dealId}"]`,
    }
  }

  // ============================================
  // DEAL CARD METHODS
  // ============================================

  /**
   * Validate deal card is visible
   */
  validateDealCardVisible(dealId: string) {
    cy.get(this.dealSelectors.card(dealId)).should('be.visible')
    return this
  }

  /**
   * Validate deal card displays correct name
   */
  validateDealName(dealId: string, name: string) {
    cy.get(this.dealSelectors.cardName(dealId)).should('contain.text', name)
    return this
  }

  /**
   * Validate deal card displays correct company
   */
  validateDealCompany(dealId: string, companyName: string) {
    cy.get(this.dealSelectors.cardCompany(dealId)).should('contain.text', companyName)
    return this
  }

  /**
   * Validate deal card displays correct amount
   */
  validateDealAmount(dealId: string, amount: string) {
    cy.get(this.dealSelectors.cardAmount(dealId)).should('contain.text', amount)
    return this
  }

  /**
   * Click on a deal card
   */
  clickDealCard(dealId: string) {
    cy.get(this.dealSelectors.card(dealId)).click()
    return this
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Visit the opportunities list page
   */
  visitList() {
    cy.visit('/dashboard/opportunities')
    this.list.waitForPageLoad()
    return this
  }

  /**
   * Visit opportunity detail page
   */
  visitDetail(opportunityId: string) {
    this.detail.visit(opportunityId)
    return this
  }

  /**
   * Visit create opportunity page
   */
  visitCreate() {
    this.form.visitCreate()
    return this
  }

  /**
   * Visit edit opportunity page
   */
  visitEdit(opportunityId: string) {
    this.form.visitEdit(opportunityId)
    return this
  }

  // ============================================
  // FORM HELPERS
  // ============================================

  /**
   * Fill opportunity form with common fields
   */
  fillOpportunityForm(data: {
    name: string
    amount?: string
    probability?: string
    company?: string
    contact?: string
    stage?: string
  }) {
    if (data.name) {
      this.form.typeInField('name', data.name)
    }
    if (data.amount) {
      this.form.typeInField('amount', data.amount)
    }
    if (data.probability) {
      this.form.typeInField('probability', data.probability)
    }
    if (data.company) {
      this.form.selectOption('companyId', data.company)
    }
    if (data.contact) {
      this.form.selectOption('contactId', data.contact)
    }
    if (data.stage) {
      this.form.selectOption('stageId', data.stage)
    }
    return this
  }

  /**
   * Submit the opportunity form
   */
  submitForm() {
    this.form.submit()
    return this
  }
}

export default OpportunitiesPOM
