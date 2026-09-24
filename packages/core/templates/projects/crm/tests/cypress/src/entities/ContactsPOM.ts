/**
 * Contacts Page Object Model for CRM Theme
 *
 * Entity-specific POM for Contacts.
 *
 * Usage:
 *   const contacts = new ContactsPOM()
 *   contacts.list.validateTableVisible()
 *   contacts.form.typeInField('firstName', 'John')
 */

import { EntityList } from '../components/EntityList'
import { EntityForm } from '../components/EntityForm'
import { EntityDetail } from '../components/EntityDetail'

export class ContactsPOM {
  /** Generic list POM for contacts */
  readonly list: EntityList

  /** Generic form POM for contacts */
  readonly form: EntityForm

  /** Generic detail POM for contacts */
  readonly detail: EntityDetail

  /** Contact entity slug */
  readonly slug = 'contacts'

  constructor() {
    this.list = EntityList.for('contacts')
    this.form = EntityForm.for('contacts')
    this.detail = new EntityDetail('contacts', 'contact', ['activities', 'notes', 'opportunities'])
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Visit the contacts list page
   */
  visitList() {
    cy.visit('/dashboard/contacts')
    this.list.waitForPageLoad()
    return this
  }

  /**
   * Visit contact detail page
   */
  visitDetail(contactId: string) {
    this.detail.visit(contactId)
    return this
  }

  /**
   * Visit create contact page
   */
  visitCreate() {
    this.form.visitCreate()
    return this
  }

  /**
   * Visit edit contact page
   */
  visitEdit(contactId: string) {
    this.form.visitEdit(contactId)
    return this
  }

  // ============================================
  // FORM HELPERS
  // ============================================

  /**
   * Fill contact form with common fields
   */
  fillContactForm(data: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    companyId?: string
    title?: string
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
    if (data.companyId) {
      this.form.selectOption('companyId', data.companyId)
    }
    if (data.title) {
      this.form.typeInField('title', data.title)
    }
    return this
  }

  /**
   * Submit the contact form
   */
  submitForm() {
    this.form.submit()
    return this
  }
}

export default ContactsPOM
