/**
 * LeadAPIController - TypeScript controller for Leads API
 *
 * Handles CRUD operations for /api/v1/leads endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface LeadData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  source?: string
  status?: string
  rating?: string
  notes?: string
  assignedTo?: string
}

export interface LeadGetAllOptions extends APIRequestOptions {
  status?: string
  source?: string
  rating?: string
  assignedTo?: string
}

export class LeadAPIController extends BaseAPIController {
  protected entitySlug = 'leads'

  /**
   * GET all leads with filtering options
   */
  getAll(options: LeadGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Convert lead to contact
   */
  convertToContact(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { status: 'converted' }, options)
  }

  /**
   * Generate random lead data for testing
   */
  generateRandomData(overrides: Partial<LeadData> = {}): LeadData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const sources = ['website', 'referral', 'social_media', 'trade_show', 'cold_call', 'advertisement']
    const statuses = ['new', 'contacted', 'qualified', 'unqualified', 'converted']
    const ratings = ['hot', 'warm', 'cold']

    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia']
    const companies = ['Acme Corp', 'Tech Solutions', 'Global Industries', 'Innovate LLC', 'StartUp Inc']

    return {
      firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: `${lastNames[Math.floor(Math.random() * lastNames.length)]}_${randomId}`,
      email: `lead_${timestamp}_${randomId}@test.com`,
      phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`,
      company: companies[Math.floor(Math.random() * companies.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      rating: ratings[Math.floor(Math.random() * ratings.length)],
      ...overrides
    }
  }

  /**
   * Validate lead object structure
   */
  validateObject(lead: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(lead)

    expect(lead).to.have.property('firstName')
    expect(lead.firstName).to.be.a('string')

    expect(lead).to.have.property('email')
    expect(lead.email).to.be.a('string')

    this.validateOptionalStringFields(lead, [
      'lastName', 'phone', 'company', 'source', 'status', 'rating', 'notes', 'assignedTo'
    ])

    if (allowMetas && Object.prototype.hasOwnProperty.call(lead, 'metas')) {
      expect(lead.metas).to.be.an('object')
    }
  }
}

export default LeadAPIController
