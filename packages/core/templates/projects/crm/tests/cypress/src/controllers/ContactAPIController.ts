/**
 * ContactAPIController - TypeScript controller for Contacts API
 *
 * Handles CRUD operations for /api/v1/contacts endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface ContactData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  mobile?: string
  companyId?: string
  position?: string
  department?: string
  isPrimary?: boolean
  birthDate?: string
  linkedin?: string
  twitter?: string
  preferredChannel?: string
  timezone?: string
}

export interface ContactGetAllOptions extends APIRequestOptions {
  companyId?: string
  position?: string
  department?: string
  isPrimary?: boolean
}

export class ContactAPIController extends BaseAPIController {
  protected entitySlug = 'contacts'

  /**
   * GET all contacts with filtering options
   */
  getAll(options: ContactGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Set contact as primary for company
   */
  setAsPrimary(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isPrimary: true }, options)
  }

  /**
   * Generate random contact data for testing
   */
  generateRandomData(overrides: Partial<ContactData> = {}): ContactData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Maria']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']
    const positions = ['CEO', 'CTO', 'CFO', 'VP Sales', 'VP Marketing', 'Director', 'Manager', 'Engineer']
    const departments = ['Executive', 'Sales', 'Marketing', 'Engineering', 'Finance', 'Operations', 'HR']
    const channels = ['email', 'phone', 'linkedin', 'twitter']

    return {
      firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: `${lastNames[Math.floor(Math.random() * lastNames.length)]}_${randomId}`,
      email: `contact_${timestamp}_${randomId}@test.com`,
      phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`,
      mobile: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`,
      position: positions[Math.floor(Math.random() * positions.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      preferredChannel: channels[Math.floor(Math.random() * channels.length)],
      isPrimary: false,
      ...overrides
    }
  }

  /**
   * Validate contact object structure
   */
  validateObject(contact: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(contact)

    expect(contact).to.have.property('firstName')
    expect(contact.firstName).to.be.a('string')

    expect(contact).to.have.property('email')
    expect(contact.email).to.be.a('string')

    this.validateOptionalStringFields(contact, [
      'lastName', 'phone', 'mobile', 'companyId', 'position',
      'department', 'birthDate', 'linkedin', 'twitter', 'preferredChannel', 'timezone'
    ])

    if (contact.isPrimary !== null && contact.isPrimary !== undefined) {
      expect(contact.isPrimary).to.be.a('boolean')
    }

    if (allowMetas && Object.prototype.hasOwnProperty.call(contact, 'metas')) {
      expect(contact.metas).to.be.an('object')
    }
  }
}

export default ContactAPIController
