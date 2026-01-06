/**
 * Notes API - CRUD Tests
 *
 * Comprehensive test suite for Note API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: content
 * - Optional fields: contactId, companyId, opportunityId
 * - Access: shared within team (all team members see all notes)
 * - Team context: required (x-team-id header)
 * - Type: Simple entity (typically lower test count)
 */

/// <reference types="cypress" />

import { NoteAPIController } from '../../../src/controllers'

describe('Notes API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let noteAPI: InstanceType<typeof NoteAPIController>

  // Track created notes for cleanup
  let createdNotes: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    noteAPI = new NoteAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created notes after each test
    createdNotes.forEach((note) => {
      if (note?.id) {
        noteAPI.delete(note.id)
      }
    })
    createdNotes = []
    // Small delay to allow database connections to be released
    cy.wait(200)
  })

  // ============================================
  // GET /api/v1/notes - List Notes
  // ============================================
  describe('GET /api/v1/notes - List Notes', () => {
    it('NOTE_API_001: Should list notes with valid API key', () => {
      noteAPI.getAll().then((response: any) => {
        noteAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} notes`)
      })
    })

    it('NOTE_API_002: Should list notes with pagination', () => {
      noteAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        noteAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} notes`)
      })
    })

    it('NOTE_API_003: Should filter notes by type', () => {
      // Create a note with a specific type
      const noteData = noteAPI.generateRandomData({ type: 'call' })

      noteAPI.create(noteData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdNotes.push(createResponse.body.data)

        // Now filter by that type
        noteAPI.getAll({ type: 'call' }).then((response: any) => {
          noteAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned notes should have the specified type
          response.body.data.forEach((note: any) => {
            expect(note.type).to.eq('call')
          })

          cy.log(`Found ${response.body.data.length} notes with type 'call'`)
        })
      })
    })

    it('NOTE_API_004: Should filter notes by isPinned', () => {
      // Create a pinned note
      const noteData = noteAPI.generateRandomData({ isPinned: true })

      noteAPI.create(noteData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdNotes.push(createResponse.body.data)

        // Now filter by isPinned
        noteAPI.getAll({ isPinned: true }).then((response: any) => {
          noteAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned notes should be pinned
          response.body.data.forEach((note: any) => {
            expect(note.isPinned).to.eq(true)
          })

          cy.log(`Found ${response.body.data.length} pinned notes`)
        })
      })
    })
  })

  // ============================================
  // POST /api/v1/notes - Create Note
  // ============================================
  describe('POST /api/v1/notes - Create Note', () => {
    it('NOTE_API_010: Should create note with valid data', () => {
      const noteData = noteAPI.generateRandomData({
        content: 'Great meeting today. Customer is very interested in our Enterprise plan.',
        type: 'meeting',
        isPinned: true
      })

      noteAPI.create(noteData).then((response: any) => {
        noteAPI.validateSuccessResponse(response, 201)
        createdNotes.push(response.body.data)

        const note = response.body.data
        noteAPI.validateObject(note)

        // Verify provided data
        expect(note.content).to.eq(noteData.content)
        expect(note.type).to.eq(noteData.type)
        expect(note.isPinned).to.eq(noteData.isPinned)

        cy.log(`Created note: ${note.id}`)
      })
    })

    it('NOTE_API_011: Should create note with minimal data (content only)', () => {
      const minimalData = {
        content: `Minimal note created at ${new Date().toISOString()}`
      }

      noteAPI.create(minimalData).then((response: any) => {
        noteAPI.validateSuccessResponse(response, 201)
        createdNotes.push(response.body.data)

        const note = response.body.data
        noteAPI.validateObject(note)

        // Verify required fields
        expect(note.content).to.eq(minimalData.content)

        // Verify optional fields are null or undefined or default
        expect(note.type).to.satisfy((val: any) => val === null || val === undefined || typeof val === 'string')
        expect(note.isPinned).to.satisfy((val: any) => val === null || val === undefined || typeof val === 'boolean')

        cy.log(`Created note with minimal data: ${note.id}`)
      })
    })

    it('NOTE_API_012: Should create note with all optional fields', () => {
      // Note: entityType/entityId fields may cause issues without valid references
      noteAPI.createTestRecord({
        title: 'Complete Note Title',
        content: 'Complete note with all fields populated',
        type: 'feedback',
        isPinned: true,
        isPrivate: false
      }, { withRetry: true }).then((note: any) => {
        createdNotes.push(note)

        // Verify all fields
        expect(note.content).to.eq('Complete note with all fields populated')
        expect(note.title).to.eq('Complete Note Title')
        expect(note.type).to.eq('feedback')
        expect(note.isPinned).to.eq(true)

        cy.log(`Created note with all fields: ${note.id}`)
      })
    })

    it('NOTE_API_013: Should reject creation without content', () => {
      const invalidData = {
        type: 'general'
        // Missing: content
      }

      noteAPI.create(invalidData).then((response: any) => {
        noteAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without content rejected with VALIDATION_ERROR')
      })
    })
  })

  // ============================================
  // GET /api/v1/notes/{id} - Get Note by ID
  // ============================================
  describe('GET /api/v1/notes/{id} - Get Note by ID', () => {
    it('NOTE_API_020: Should get note by valid ID', () => {
      // First create a note
      const noteData = noteAPI.generateRandomData()

      noteAPI.create(noteData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdNotes.push(createResponse.body.data)

        const noteId = createResponse.body.data.id

        // Get the note by ID
        noteAPI.getById(noteId).then((response: any) => {
          noteAPI.validateSuccessResponse(response, 200)

          const note = response.body.data
          noteAPI.validateObject(note)
          expect(note.id).to.eq(noteId)
          expect(note.content).to.eq(noteData.content)

          cy.log(`Retrieved note: ${note.id}`)
        })
      })
    })

    it('NOTE_API_021: Should return 404 for non-existent note', () => {
      const fakeId = 'non-existent-note-id-12345'

      noteAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent note returns 404')
      })
    })
  })

  // ============================================
  // PATCH /api/v1/notes/{id} - Update Note
  // ============================================
  describe('PATCH /api/v1/notes/{id} - Update Note', () => {
    it('NOTE_API_030: Should update note with multiple fields', () => {
      // First create a note
      noteAPI.createTestRecord({}, { withRetry: true }).then((testNote: any) => {
        createdNotes.push(testNote)

        const updateData = {
          content: 'Updated note content with new information',
          type: 'call',
          isPinned: true
        }

        noteAPI.update(testNote.id, updateData).then((response: any) => {
          noteAPI.validateSuccessResponse(response, 200)

          const note = response.body.data
          expect(note.content).to.eq(updateData.content)
          expect(note.type).to.eq(updateData.type)
          expect(note.isPinned).to.eq(updateData.isPinned)

          cy.log(`Updated note: ${note.id}`)
        })
      })
    })

    it('NOTE_API_031: Should update note content', () => {
      noteAPI.createTestRecord({}, { withRetry: true }).then((testNote: any) => {
        createdNotes.push(testNote)

        const newContent = 'This is the updated content for the note'

        noteAPI.update(testNote.id, { content: newContent }).then((response: any) => {
          noteAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.content).to.eq(newContent)

          cy.log(`Updated content`)
        })
      })
    })

    it('NOTE_API_032: Should update note type and pinned status', () => {
      noteAPI.createTestRecord({}, { withRetry: true }).then((testNote: any) => {
        createdNotes.push(testNote)

        const updateData = {
          type: 'reminder',
          isPinned: true,
          isPrivate: true
        }

        noteAPI.update(testNote.id, updateData).then((response: any) => {
          noteAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.type).to.eq(updateData.type)
          expect(response.body.data.isPinned).to.eq(updateData.isPinned)
          expect(response.body.data.isPrivate).to.eq(updateData.isPrivate)

          cy.log(`Updated note type and status`)
        })
      })
    })

    it('NOTE_API_033: Should return 404 for non-existent note', () => {
      const fakeId = 'non-existent-note-id-12345'

      noteAPI.update(fakeId, { content: 'New Content' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent note returns 404')
      })
    })
  })

  // ============================================
  // DELETE /api/v1/notes/{id} - Delete Note
  // ============================================
  describe('DELETE /api/v1/notes/{id} - Delete Note', () => {
    it('NOTE_API_040: Should delete note by valid ID', () => {
      // Create a note to delete
      const noteData = noteAPI.generateRandomData()

      noteAPI.create(noteData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const noteId = createResponse.body.data.id

        // Delete the note
        noteAPI.delete(noteId).then((response: any) => {
          noteAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', noteId)

          cy.log(`Deleted note: ${noteId}`)
        })
      })
    })

    it('NOTE_API_041: Should return 404 for non-existent note', () => {
      const fakeId = 'non-existent-note-id-12345'

      noteAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent note returns 404')
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('NOTE_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE
      const noteData = noteAPI.generateRandomData({
        title: 'Lifecycle Test Note',
        content: 'Initial note for lifecycle testing',
        type: 'meeting',
        isPinned: false
      })

      noteAPI.create(noteData).then((createResponse: any) => {
        noteAPI.validateSuccessResponse(createResponse, 201)
        const noteId = createResponse.body.data.id

        cy.log(`1. Created note: ${noteId}`)

        // 2. READ
        noteAPI.getById(noteId).then((readResponse: any) => {
          noteAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.content).to.eq(noteData.content)
          expect(readResponse.body.data.type).to.eq(noteData.type)

          cy.log(`2. Read note: ${noteId}`)

          // 3. UPDATE
          const updateData = {
            title: 'Updated Lifecycle Note',
            content: 'Updated lifecycle note content',
            type: 'followup',
            isPinned: true,
            isPrivate: true
          }

          noteAPI.update(noteId, updateData).then((updateResponse: any) => {
            noteAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.content).to.eq(updateData.content)
            expect(updateResponse.body.data.title).to.eq(updateData.title)
            expect(updateResponse.body.data.type).to.eq(updateData.type)
            expect(updateResponse.body.data.isPinned).to.eq(updateData.isPinned)

            cy.log(`3. Updated note`)

            // 4. DELETE
            noteAPI.delete(noteId).then((deleteResponse: any) => {
              noteAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted note: ${noteId}`)

              // 5. VERIFY DELETION
              noteAPI.getById(noteId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - note no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
