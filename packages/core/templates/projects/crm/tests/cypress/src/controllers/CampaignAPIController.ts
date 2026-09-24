/**
 * CampaignAPIController - TypeScript controller for Campaigns API
 *
 * Handles CRUD operations for /api/v1/campaigns endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface CampaignData {
  name?: string
  type?: string
  status?: string
  startDate?: string
  endDate?: string
  budget?: number
  actualCost?: number
  expectedRevenue?: number
  description?: string
}

export interface CampaignGetAllOptions extends APIRequestOptions {
  type?: string
  status?: string
}

export class CampaignAPIController extends BaseAPIController {
  protected entitySlug = 'campaigns'

  /**
   * GET all campaigns with filtering options
   */
  getAll(options: CampaignGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Activate campaign
   */
  activate(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { status: 'active' }, options)
  }

  /**
   * Complete campaign
   */
  complete(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { status: 'completed' }, options)
  }

  /**
   * Generate random campaign data for testing
   */
  generateRandomData(overrides: Partial<CampaignData> = {}): CampaignData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const types = ['email', 'social_media', 'webinar', 'event', 'content', 'ppc', 'seo']
    const statuses = ['planned', 'active', 'paused', 'completed', 'cancelled']
    const campaignNames = [
      'Q1 Product Launch',
      'Summer Sale',
      'Holiday Promotion',
      'Brand Awareness',
      'Lead Generation',
      'Customer Retention'
    ]

    // Generate dates
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30))
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 90) + 30)

    return {
      name: `${campaignNames[Math.floor(Math.random() * campaignNames.length)]} ${randomId}`,
      type: types[Math.floor(Math.random() * types.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      budget: Math.floor(Math.random() * 100000) + 10000,
      actualCost: Math.floor(Math.random() * 50000) + 5000,
      expectedRevenue: Math.floor(Math.random() * 500000) + 50000,
      description: `Test campaign created at ${new Date(timestamp).toISOString()}`,
      ...overrides
    }
  }

  /**
   * Validate campaign object structure
   */
  validateObject(campaign: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(campaign)

    expect(campaign).to.have.property('name')
    expect(campaign.name).to.be.a('string')

    this.validateOptionalStringFields(campaign, [
      'type', 'status', 'startDate', 'endDate', 'description'
    ])

    const numericFields = ['budget', 'actualCost', 'expectedRevenue']
    numericFields.forEach(field => {
      if (campaign[field] !== null && campaign[field] !== undefined) {
        expect(Number(campaign[field])).to.be.a('number')
      }
    })

    if (allowMetas && Object.prototype.hasOwnProperty.call(campaign, 'metas')) {
      expect(campaign.metas).to.be.an('object')
    }
  }
}

export default CampaignAPIController
