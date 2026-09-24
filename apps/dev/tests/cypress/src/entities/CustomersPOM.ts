/**
 * CustomersPOM - Page Object Model for Customers entity
 *
 * Extends DashboardEntityPOM with customer-specific form handling and workflows.
 *
 * @example
 * // Instance usage with chaining
 * CustomersPOM.create()
 *   .visitList()
 *   .waitForList()
 *   .clickAdd()
 *   .fillCustomerForm({ name: 'Acme Inc', account: 'ACC001', office: 'HQ' })
 *   .submitForm()
 *
 * // API-aware workflow
 * const customers = new CustomersPOM()
 * customers.createCustomerWithApiWait({
 *   name: 'Acme Inc',
 *   account: 'ACC001',
 *   office: 'Main Office'
 * })
 */

import { DashboardEntityPOM } from '../core/DashboardEntityPOM'
import entitiesConfig from '../../fixtures/entities.json'

export interface CustomerFormData {
  name: string
  account: string
  office: string
  phone?: string
  salesRep?: string
  visitDays?: string[]
  contactDays?: string[]
}

export class CustomersPOM extends DashboardEntityPOM {
  constructor() {
    super(entitiesConfig.entities.customers.slug)
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): CustomersPOM {
    return new CustomersPOM()
  }

  // ============================================
  // ENTITY-SPECIFIC FORM METHODS
  // ============================================

  /**
   * Fill customer form with provided data
   * Only fills fields that are provided in the data object
   */
  fillCustomerForm(data: CustomerFormData) {
    if (data.name) {
      this.fillTextField('name', data.name)
    }
    if (data.account) {
      this.fillTextField('account', data.account)
    }
    if (data.office) {
      this.fillTextField('office', data.office)
    }
    if (data.phone) {
      this.fillTextField('phone', data.phone)
    }
    if (data.salesRep) {
      this.fillTextField('salesRep', data.salesRep)
    }
    return this
  }

  // ============================================
  // WORKFLOW METHODS
  // ============================================

  /**
   * Complete create flow without API waits
   */
  createCustomer(data: CustomerFormData) {
    this.visitCreate()
    this.waitForForm()
    this.fillCustomerForm(data)
    this.submitForm()
    return this
  }

  /**
   * Create customer with API intercepts and waits
   * Deterministic: waits for actual API responses
   */
  createCustomerWithApiWait(data: CustomerFormData) {
    this.setupApiIntercepts()
    this.clickAdd()
    this.waitForForm()
    this.fillCustomerForm(data)
    this.submitForm()
    this.api.waitForCreate()
    return this
  }

  /**
   * Create customer from list page and wait for refresh
   */
  createCustomerFromListWithApiWait(data: CustomerFormData) {
    this.setupApiIntercepts()
    this.clickAdd()
    this.waitForForm()
    this.fillCustomerForm(data)
    this.submitForm()
    this.api.waitForCreateAndRefresh()
    return this
  }

  /**
   * Update customer with API waits
   */
  updateCustomerWithApiWait(data: Partial<CustomerFormData>) {
    this.fillCustomerForm(data as CustomerFormData)
    this.submitForm()
    this.api.waitForUpdate()
    return this
  }

  /**
   * Delete customer with API waits
   * Flow: Navigate to detail -> Delete -> Confirm
   */
  deleteCustomerWithApiWait(id: string) {
    this.visitDetailWithApiWait(id)
    this.clickDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  /**
   * Delete customer by finding it in the list by name
   */
  deleteCustomerByNameWithApiWait(name: string) {
    this.clickRowByText(name)
    this.waitForDetail()
    this.clickDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  // ============================================
  // ENTITY-SPECIFIC ASSERTIONS
  // ============================================

  /**
   * Assert customer appears in list
   */
  assertCustomerInList(name: string) {
    return this.assertInList(name)
  }

  /**
   * Assert customer does not appear in list
   */
  assertCustomerNotInList(name: string) {
    return this.assertNotInList(name)
  }
}

export default CustomersPOM
