/**
 * OpportunityAPIController - TypeScript controller for Opportunities API
 *
 * Handles CRUD operations for /api/v1/opportunities endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface OpportunityData {
  name?: string
  companyId?: string
  contactId?: string
  pipelineId?: string
  stageId?: string
  amount?: number
  currency?: string
  closeDate?: string
  probability?: number
  type?: string
  source?: string
  competitor?: string
  status?: string
  lostReason?: string
  assignedTo?: string
}

export interface OpportunityGetAllOptions extends APIRequestOptions {
  pipelineId?: string
  stageId?: string
  companyId?: string
  status?: string
  type?: string
  source?: string
  assignedTo?: string
}

export class OpportunityAPIController extends BaseAPIController {
  protected entitySlug = 'opportunities'

  /**
   * GET all opportunities with filtering options
   */
  getAll(options: OpportunityGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Move opportunity to a different stage
   */
  moveToStage(id: string, stageId: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { stageId }, options)
  }

  /**
   * Close opportunity as won
   */
  closeAsWon(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { status: 'won', probability: 100 }, options)
  }

  /**
   * Close opportunity as lost
   */
  closeAsLost(id: string, lostReason: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { status: 'lost', probability: 0, lostReason }, options)
  }

  /**
   * Generate random opportunity data for testing
   */
  generateRandomData(overrides: Partial<OpportunityData> = {}): OpportunityData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const types = ['new_business', 'upgrade', 'renewal', 'existing_business']
    const sources = ['web', 'referral', 'social_media', 'trade_show', 'cold_call', 'inbound']
    const statuses = ['open', 'won', 'lost']
    const currencies = ['USD', 'EUR', 'GBP']

    const opportunityNames = [
      'Enterprise License Deal',
      'Professional Package',
      'Annual Renewal',
      'Premium Upgrade',
      'Custom Implementation',
      'Multi-Year Contract'
    ]

    // Generate future close date (30-180 days from now)
    const daysFromNow = Math.floor(Math.random() * 150) + 30
    const closeDate = new Date()
    closeDate.setDate(closeDate.getDate() + daysFromNow)

    return {
      name: `${opportunityNames[Math.floor(Math.random() * opportunityNames.length)]} ${randomId}`,
      amount: Math.floor(Math.random() * 200000) + 10000,
      currency: currencies[Math.floor(Math.random() * currencies.length)],
      closeDate: closeDate.toISOString().split('T')[0],
      probability: Math.floor(Math.random() * 80) + 10,
      type: types[Math.floor(Math.random() * types.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      status: statuses[0], // Default to 'open'
      ...overrides
    }
  }

  /**
   * Validate opportunity object structure
   */
  validateObject(opportunity: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(opportunity)

    expect(opportunity).to.have.property('name')
    expect(opportunity.name).to.be.a('string')

    this.validateOptionalStringFields(opportunity, [
      'companyId', 'contactId', 'pipelineId', 'stageId', 'currency',
      'closeDate', 'type', 'source', 'competitor', 'status', 'lostReason', 'assignedTo'
    ])

    const numericFields = ['amount', 'probability']
    numericFields.forEach(field => {
      if (opportunity[field] !== null && opportunity[field] !== undefined) {
        expect(Number(opportunity[field])).to.be.a('number')
      }
    })

    if (allowMetas && Object.prototype.hasOwnProperty.call(opportunity, 'metas')) {
      expect(opportunity.metas).to.be.an('object')
    }
  }
}

export default OpportunityAPIController
