/**
 * Leads Page Object Model for CRM Theme
 *
 * Entity-specific POM for Leads.
 *
 * Usage:
 *   const leads = new LeadsPOM()
 *   leads.list.validateTableVisible()
 *   leads.form.typeInField('firstName', 'John')
 */

import { EntityList } from '../components/EntityList'
import { EntityForm } from '../components/EntityForm'
import { EntityDetail } from '../components/EntityDetail'

export class LeadsPOM {
  /** Generic list POM for leads */
  readonly list: EntityList

  /** Generic form POM for leads */
  readonly form: EntityForm

  /** Generic detail POM for leads */
  readonly detail: EntityDetail

  /** Lead entity slug */
  readonly slug = 'leads'

  constructor() {
    this.list = EntityList.for('leads')
    this.form = EntityForm.for('leads')
    this.detail = new EntityDetail('leads', 'lead', ['activities', 'notes'])
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Visit the leads list page
   */
  visitList() {
    cy.visit('/dashboard/leads')
    this.list.waitForPageLoad()
    return this
  }

  /**
   * Visit lead detail page
   */
  visitDetail(leadId: string) {
    this.detail.visit(leadId)
    return this
  }

  /**
   * Visit create lead page
   */
  visitCreate() {
    this.form.visitCreate()
    return this
  }

  /**
   * Visit edit lead page
   */
  visitEdit(leadId: string) {
    this.form.visitEdit(leadId)
    return this
  }

  // ============================================
  // FORM HELPERS
  // ============================================

  /**
   * Fill lead form with common fields
   */
  fillLeadForm(data: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    company?: string
    source?: string
    status?: string
  }) {
    if (data.firstName) {
      this.form.typeInField('firstName', data.firstName)
    }
    if (data.lastName) {
      this.form.typeInField('lastName', data.lastName)
    }
    if (data.email) {
      this.form.typeInField('email', data.email)
    }
    if (data.phone) {
      this.form.typeInField('phone', data.phone)
    }
    if (data.company) {
      this.form.typeInField('company', data.company)
    }
    if (data.source) {
      this.form.selectOption('source', data.source)
    }
    if (data.status) {
      this.form.selectOption('status', data.status)
    }
    return this
  }

  /**
   * Submit the lead form
   */
  submitForm() {
    this.form.submit()
    return this
  }

  /**
   * Convert lead to contact
   */
  convertToContact() {
    cy.get('[data-cy="lead-convert-btn"]').click()
    return this
  }
}

export default LeadsPOM
