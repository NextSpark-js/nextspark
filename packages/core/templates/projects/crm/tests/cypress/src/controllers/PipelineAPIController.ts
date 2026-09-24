/**
 * PipelineAPIController - TypeScript controller for Pipelines API
 *
 * Handles CRUD operations for /api/v1/pipelines endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface PipelineStage {
  id?: string
  name: string
  probability: number
  order: number
}

export interface PipelineData {
  name?: string
  description?: string
  stages?: PipelineStage[]
  isDefault?: boolean
}

export interface PipelineGetAllOptions extends APIRequestOptions {
  isDefault?: boolean
}

export class PipelineAPIController extends BaseAPIController {
  protected entitySlug = 'pipelines'

  /**
   * GET all pipelines with filtering options
   */
  getAll(options: PipelineGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Set pipeline as default
   */
  setAsDefault(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isDefault: true }, options)
  }

  /**
   * Add stage to pipeline
   */
  addStage(id: string, stage: PipelineStage, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.getById(id).then((response) => {
      if (response.status !== 200) {
        throw new Error(`Failed to get pipeline: ${response.body?.error || 'Unknown error'}`)
      }
      const currentStages = (response.body.data as { stages?: PipelineStage[] }).stages || []
      const newStages = [...currentStages, stage]
      return this.update(id, { stages: newStages }, options)
    })
  }

  /**
   * Generate random pipeline data for testing
   */
  generateRandomData(overrides: Partial<PipelineData> = {}): PipelineData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const pipelineNames = [
      'Sales Pipeline',
      'Enterprise Sales',
      'SMB Pipeline',
      'Partner Pipeline',
      'Renewal Pipeline',
      'Upsell Pipeline'
    ]

    const defaultStages: PipelineStage[] = [
      { name: 'Qualification', probability: 10, order: 1 },
      { name: 'Discovery', probability: 25, order: 2 },
      { name: 'Proposal', probability: 50, order: 3 },
      { name: 'Negotiation', probability: 75, order: 4 },
      { name: 'Closed Won', probability: 100, order: 5 }
    ]

    return {
      name: `${pipelineNames[Math.floor(Math.random() * pipelineNames.length)]} ${randomId}`,
      description: `Test pipeline created at ${new Date(timestamp).toISOString()}`,
      stages: defaultStages,
      isDefault: false,
      ...overrides
    }
  }

  /**
   * Validate pipeline object structure
   */
  validateObject(pipeline: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(pipeline)

    expect(pipeline).to.have.property('name')
    expect(pipeline.name).to.be.a('string')

    this.validateOptionalStringFields(pipeline, ['description'])

    if (pipeline.stages !== null && pipeline.stages !== undefined) {
      expect(pipeline.stages).to.be.an('array')
    }

    if (pipeline.isDefault !== null && pipeline.isDefault !== undefined) {
      expect(pipeline.isDefault).to.be.a('boolean')
    }

    if (allowMetas && Object.prototype.hasOwnProperty.call(pipeline, 'metas')) {
      expect(pipeline.metas).to.be.an('object')
    }
  }
}

export default PipelineAPIController
