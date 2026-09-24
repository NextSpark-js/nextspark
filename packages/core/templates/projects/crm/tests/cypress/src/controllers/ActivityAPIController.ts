/**
 * ActivityAPIController - TypeScript controller for Activities API
 *
 * Handles CRUD operations for /api/v1/activities endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface ActivityData {
  type?: string
  subject?: string
  description?: string
  dueDate?: string
  contactId?: string
  companyId?: string
  opportunityId?: string
  completedAt?: string
  assignedTo?: string
  status?: string
}

export interface ActivityGetAllOptions extends APIRequestOptions {
  type?: string
  status?: string
  contactId?: string
  companyId?: string
  opportunityId?: string
  assignedTo?: string
  completed?: boolean
}

export class ActivityAPIController extends BaseAPIController {
  protected entitySlug = 'activities'

  /**
   * GET all activities with filtering options
   */
  getAll(options: ActivityGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Mark activity as complete
   */
  complete(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    const completedAt = new Date().toISOString()
    return this.update(id, { completedAt }, options)
  }

  /**
   * Reschedule activity to new date
   */
  reschedule(id: string, newDate: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { dueDate: newDate }, options)
  }

  /**
   * Generate random activity data for testing
   */
  generateRandomData(overrides: Partial<ActivityData> = {}): ActivityData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const types = ['call', 'email', 'meeting', 'task', 'note', 'demo', 'presentation']
    const subjects = [
      'Initial Discovery Call',
      'Product Demo',
      'Follow-up Email',
      'Contract Review Meeting',
      'Proposal Presentation',
      'Stakeholder Introduction'
    ]

    const daysFromNow = Math.floor(Math.random() * 30) + 1
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + daysFromNow)

    const type = types[Math.floor(Math.random() * types.length)]
    const subject = subjects[Math.floor(Math.random() * subjects.length)]

    return {
      type,
      subject: `${subject} - ${randomId}`,
      description: `Test activity created at ${new Date(timestamp).toISOString()}`,
      dueDate: dueDate.toISOString(),
      ...overrides
    }
  }

  /**
   * Validate activity object structure
   */
  validateObject(activity: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(activity)

    expect(activity).to.have.property('type')
    expect(activity.type).to.be.a('string')

    expect(activity).to.have.property('subject')
    expect(activity.subject).to.be.a('string')

    this.validateOptionalStringFields(activity, [
      'description', 'dueDate', 'contactId', 'companyId',
      'opportunityId', 'completedAt', 'assignedTo'
    ])

    if (allowMetas && Object.prototype.hasOwnProperty.call(activity, 'metas')) {
      expect(activity.metas).to.be.an('object')
    }
  }
}

export default ActivityAPIController
