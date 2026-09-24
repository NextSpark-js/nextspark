/**
 * NoteAPIController - TypeScript controller for Notes API
 *
 * Handles CRUD operations for /api/v1/notes endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface NoteData {
  title?: string
  content?: string
  type?: string
  isPinned?: boolean
  isPrivate?: boolean
  contactId?: string
  companyId?: string
  opportunityId?: string
  entityType?: string
  entityId?: string
}

export interface NoteGetAllOptions extends APIRequestOptions {
  type?: string
  isPinned?: boolean
  isPrivate?: boolean
  contactId?: string
  companyId?: string
  opportunityId?: string
}

export class NoteAPIController extends BaseAPIController {
  protected entitySlug = 'notes'

  /**
   * GET all notes with filtering options
   */
  getAll(options: NoteGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Pin a note
   */
  pin(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isPinned: true }, options)
  }

  /**
   * Unpin a note
   */
  unpin(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isPinned: false }, options)
  }

  /**
   * Make note private
   */
  makePrivate(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isPrivate: true }, options)
  }

  /**
   * Make note public
   */
  makePublic(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isPrivate: false }, options)
  }

  /**
   * Generate random note data for testing
   */
  generateRandomData(overrides: Partial<NoteData> = {}): NoteData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const types = ['general', 'meeting', 'call', 'email', 'task', 'followup', 'feedback', 'reminder']
    const titles = [
      'Meeting Notes',
      'Follow-up Required',
      'Important Information',
      'Customer Feedback',
      'Action Items',
      'Project Update'
    ]
    const contents = [
      'Discussed product roadmap and upcoming features.',
      'Customer expressed interest in enterprise plan.',
      'Follow up needed regarding pricing discussion.',
      'Technical requirements gathered during call.',
      'Positive feedback on demo presentation.',
      'Next steps defined for implementation.'
    ]

    return {
      title: `${titles[Math.floor(Math.random() * titles.length)]} ${randomId}`,
      content: `${contents[Math.floor(Math.random() * contents.length)]} Created at ${new Date(timestamp).toISOString()}`,
      type: types[Math.floor(Math.random() * types.length)],
      isPinned: Math.random() > 0.8,
      isPrivate: Math.random() > 0.9,
      ...overrides
    }
  }

  /**
   * Validate note object structure
   */
  validateObject(note: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(note)

    expect(note).to.have.property('content')
    expect(note.content).to.be.a('string')

    this.validateOptionalStringFields(note, [
      'title', 'type', 'contactId', 'companyId', 'opportunityId', 'entityType', 'entityId'
    ])

    const booleanFields = ['isPinned', 'isPrivate']
    booleanFields.forEach(field => {
      if (note[field] !== null && note[field] !== undefined) {
        expect(note[field]).to.be.a('boolean')
      }
    })

    if (allowMetas && Object.prototype.hasOwnProperty.call(note, 'metas')) {
      expect(note.metas).to.be.an('object')
    }
  }
}

export default NoteAPIController
