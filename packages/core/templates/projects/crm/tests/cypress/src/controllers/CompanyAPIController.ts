/**
 * CompanyAPIController - TypeScript controller for Companies API
 *
 * Handles CRUD operations for /api/v1/companies endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface CompanyData {
  name?: string
  legalName?: string
  website?: string
  email?: string
  industry?: string
  size?: string
  type?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  description?: string
  rating?: string
}

export interface CompanyGetAllOptions extends APIRequestOptions {
  industry?: string
  size?: string
  type?: string
  rating?: string
}

export class CompanyAPIController extends BaseAPIController {
  protected entitySlug = 'companies'

  /**
   * GET all companies with filtering options
   */
  getAll(options: CompanyGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Update company rating
   */
  updateRating(id: string, rating: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { rating }, options)
  }

  /**
   * Generate random company data for testing
   */
  generateRandomData(overrides: Partial<CompanyData> = {}): CompanyData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const industries = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education']
    const sizes = ['1-10', '11-50', '51-200', '201-500', '500+']
    const types = ['prospect', 'customer', 'partner', 'vendor', 'competitor']
    const ratings = ['hot', 'warm', 'cold']
    const cities = ['New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Boston', 'Seattle']
    const countries = ['USA', 'UK', 'Canada', 'Germany', 'France', 'Australia']

    const companyNames = [
      'Tech Solutions',
      'Global Industries',
      'Innovate Corp',
      'Digital Dynamics',
      'Enterprise Systems',
      'Cloud Networks'
    ]

    return {
      name: `${companyNames[Math.floor(Math.random() * companyNames.length)]} ${randomId}`,
      legalName: `${companyNames[Math.floor(Math.random() * companyNames.length)]} LLC`,
      website: `https://www.company-${randomId}.com`,
      email: `contact@company-${randomId}.com`,
      industry: industries[Math.floor(Math.random() * industries.length)],
      size: sizes[Math.floor(Math.random() * sizes.length)],
      type: types[Math.floor(Math.random() * types.length)],
      phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`,
      address: `${Math.floor(Math.random() * 9000) + 100} Business Ave`,
      city: cities[Math.floor(Math.random() * cities.length)],
      country: countries[Math.floor(Math.random() * countries.length)],
      description: `Test company created at ${new Date(timestamp).toISOString()}`,
      rating: ratings[Math.floor(Math.random() * ratings.length)],
      ...overrides
    }
  }

  /**
   * Validate company object structure
   */
  validateObject(company: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(company)

    expect(company).to.have.property('name')
    expect(company.name).to.be.a('string')

    this.validateOptionalStringFields(company, [
      'legalName', 'website', 'email', 'industry', 'size', 'type',
      'phone', 'address', 'city', 'state', 'country', 'postalCode', 'description', 'rating'
    ])

    if (allowMetas && Object.prototype.hasOwnProperty.call(company, 'metas')) {
      expect(company.metas).to.be.an('object')
    }
  }
}

export default CompanyAPIController
