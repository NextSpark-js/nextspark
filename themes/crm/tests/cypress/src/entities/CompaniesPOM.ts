/**
 * Companies Page Object Model for CRM Theme
 *
 * Entity-specific POM for Companies.
 *
 * Usage:
 *   const companies = new CompaniesPOM()
 *   companies.list.validateTableVisible()
 *   companies.form.typeInField('name', 'Acme Inc')
 */

import { EntityList } from '../components/EntityList'
import { EntityForm } from '../components/EntityForm'
import { EntityDetail } from '../components/EntityDetail'

export class CompaniesPOM {
  /** Generic list POM for companies */
  readonly list: EntityList

  /** Generic form POM for companies */
  readonly form: EntityForm

  /** Generic detail POM for companies */
  readonly detail: EntityDetail

  /** Company entity slug */
  readonly slug = 'companies'

  constructor() {
    this.list = EntityList.for('companies')
    this.form = EntityForm.for('companies')
    this.detail = new EntityDetail('companies', 'company', ['contacts', 'opportunities', 'notes'])
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Visit the companies list page
   */
  visitList() {
    cy.visit('/dashboard/companies')
    this.list.waitForPageLoad()
    return this
  }

  /**
   * Visit company detail page
   */
  visitDetail(companyId: string) {
    this.detail.visit(companyId)
    return this
  }

  /**
   * Visit create company page
   */
  visitCreate() {
    this.form.visitCreate()
    return this
  }

  /**
   * Visit edit company page
   */
  visitEdit(companyId: string) {
    this.form.visitEdit(companyId)
    return this
  }

  // ============================================
  // FORM HELPERS
  // ============================================

  /**
   * Fill company form with common fields
   */
  fillCompanyForm(data: {
    name?: string
    website?: string
    industry?: string
    size?: string
    phone?: string
    address?: string
  }) {
    if (data.name) {
      this.form.typeInField('name', data.name)
    }
    if (data.website) {
      this.form.typeInField('website', data.website)
    }
    if (data.industry) {
      this.form.selectOption('industry', data.industry)
    }
    if (data.size) {
      this.form.selectOption('size', data.size)
    }
    if (data.phone) {
      this.form.typeInField('phone', data.phone)
    }
    if (data.address) {
      this.form.typeInTextarea('address', data.address)
    }
    return this
  }

  /**
   * Submit the company form
   */
  submitForm() {
    this.form.submit()
    return this
  }
}

export default CompaniesPOM
