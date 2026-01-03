/**
 * Contacts API - CRUD Tests
 *
 * Comprehensive test suite for Contact API endpoints.
 * Tests GET, POST, PATCH, DELETE operations.
 *
 * Entity characteristics:
 * - Required fields: firstName, lastName, email
 * - Optional fields: phone, mobile, companyId, position, department, isPrimary, birthDate, linkedin, twitter, preferredChannel, timezone
 * - Access: shared within team (all team members see all contacts)
 * - Team context: required (x-team-id header)
 * - Special: Can be linked to companies via companyId
 */

/// <reference types="cypress" />

import { ContactAPIController } from '../../../src/controllers'

describe('Contacts API - CRUD Operations', () => {
  // Test constants
  const SUPERADMIN_API_KEY = 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const TEAM_ID = 'team-tmt-001'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

  // Controller instance
  let contactAPI: InstanceType<typeof ContactAPIController>

  // Track created contacts for cleanup
  let createdContacts: any[] = []

  before(() => {
    // Initialize controller with superadmin credentials
    contactAPI = new ContactAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_ID)
  })

  afterEach(() => {
    // Cleanup created contacts after each test
    createdContacts.forEach((contact) => {
      if (contact?.id) {
        contactAPI.delete(contact.id)
      }
    })
    createdContacts = []
  })

  // ============================================
  // GET /api/v1/contacts - List Contacts
  // ============================================
  describe('GET /api/v1/contacts - List Contacts', () => {
    it('CONT_API_001: Should list contacts with valid API key', () => {
      contactAPI.getAll().then((response: any) => {
        contactAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        expect(response.body.info).to.have.property('page')
        expect(response.body.info).to.have.property('limit')
        expect(response.body.info).to.have.property('total')
        expect(response.body.info).to.have.property('totalPages')

        cy.log(`Found ${response.body.data.length} contacts`)
      })
    })

    it('CONT_API_002: Should list contacts with pagination', () => {
      contactAPI.getAll({ page: 1, limit: 5 }).then((response: any) => {
        contactAPI.validateSuccessResponse(response, 200)
        expect(response.body.info.page).to.eq(1)
        expect(response.body.info.limit).to.eq(5)
        expect(response.body.data.length).to.be.at.most(5)

        cy.log(`Page 1 with limit 5: ${response.body.data.length} contacts`)
      })
    })

    it('CONT_API_003: Should filter contacts by companyId', () => {
      // First create a contact with a specific companyId
      const testCompanyId = `company-${Date.now()}`
      const contactData = contactAPI.generateRandomData({ companyId: testCompanyId })

      contactAPI.create(contactData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdContacts.push(createResponse.body.data)

        // Now filter by that companyId
        contactAPI.getAll({ companyId: testCompanyId }).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned contacts should have the specified companyId
          response.body.data.forEach((contact: any) => {
            expect(contact.companyId).to.eq(testCompanyId)
          })

          cy.log(`Found ${response.body.data.length} contacts with companyId '${testCompanyId}'`)
        })
      })
    })

    it('CONT_API_004: Should filter contacts by position', () => {
      // First create a contact with a specific position
      const testPosition = 'CEO'
      const contactData = contactAPI.generateRandomData({ position: testPosition })

      contactAPI.create(contactData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdContacts.push(createResponse.body.data)

        // Now filter by that position
        contactAPI.getAll({ position: testPosition }).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')

          // All returned contacts should have the specified position
          response.body.data.forEach((contact: any) => {
            expect(contact.position).to.eq(testPosition)
          })

          cy.log(`Found ${response.body.data.length} contacts with position '${testPosition}'`)
        })
      })
    })

    it('CONT_API_005: Should search contacts by name/email', () => {
      // Create a contact with a unique searchable term
      const uniqueTerm = `SearchContact${Date.now()}`
      const contactData = contactAPI.generateRandomData({
        firstName: `Contact${uniqueTerm}`,
        email: `${uniqueTerm.toLowerCase()}@test.com`
      })

      contactAPI.create(contactData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdContacts.push(createResponse.body.data)

        // Search for the unique term
        contactAPI.getAll({ search: uniqueTerm }).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.be.an('array')
          expect(response.body.data.length).to.be.greaterThan(0)

          // Verify the found contact contains our search term
          const foundContact = response.body.data.find(
            (c: any) => c.id === createResponse.body.data.id
          )
          expect(foundContact).to.exist
          expect(foundContact.firstName + foundContact.email).to.include(uniqueTerm)

          cy.log(`Search found ${response.body.data.length} contacts matching '${uniqueTerm}'`)
        })
      })
    })

    it('CONT_API_006: Should return results or empty array for search', () => {
      // Generate a truly unique search term unlikely to match anything
      const nonExistentTerm = `ZZZYYY${Date.now()}XXXNONEXISTENT`

      contactAPI.getAll({ search: nonExistentTerm }).then((response: any) => {
        contactAPI.validateSuccessResponse(response, 200)
        expect(response.body.data).to.be.an('array')
        // Search should work correctly - total can be string or number
        expect(Number(response.body.info.total)).to.be.at.least(0)

        cy.log(`Search returned ${response.body.data.length} contacts for term '${nonExistentTerm}'`)
      })
    })

    it('CONT_API_007: Should reject request without API key', () => {
      const noAuthAPI = new ContactAPIController(BASE_URL, null, TEAM_ID)

      noAuthAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('success', false)

        cy.log('Request without API key rejected with 401')
      })
    })

    it('CONT_API_008: Should reject request without x-team-id', () => {
      const noTeamAPI = new ContactAPIController(BASE_URL, SUPERADMIN_API_KEY, null)

      noTeamAPI.getAll().then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Request without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // POST /api/v1/contacts - Create Contact
  // ============================================
  describe('POST /api/v1/contacts - Create Contact', () => {
    it('CONT_API_010: Should create contact with valid data', () => {
      const contactData = contactAPI.generateRandomData({
        phone: '+1-555-1234',
        position: 'VP Sales',
        department: 'Sales',
        preferredChannel: 'email',
        isPrimary: false
      })

      contactAPI.create(contactData).then((response: any) => {
        contactAPI.validateSuccessResponse(response, 201)
        createdContacts.push(response.body.data)

        const contact = response.body.data
        contactAPI.validateObject(contact)

        // Verify provided data
        expect(contact.firstName).to.eq(contactData.firstName)
        expect(contact.email).to.eq(contactData.email)
        expect(contact.lastName).to.eq(contactData.lastName)
        expect(contact.phone).to.eq(contactData.phone)
        expect(contact.position).to.eq(contactData.position)
        expect(contact.department).to.eq(contactData.department)
        expect(contact.preferredChannel).to.eq(contactData.preferredChannel)

        cy.log(`Created contact: ${contact.firstName} ${contact.lastName} (ID: ${contact.id})`)
      })
    })

    it('CONT_API_011: Should create contact with minimal data (firstName, lastName, email)', () => {
      const minimalData = {
        firstName: `MinimalContact${Date.now()}`,
        lastName: `LastName${Date.now()}`,
        email: `minimal-${Date.now()}@test.com`
      }

      contactAPI.create(minimalData).then((response: any) => {
        contactAPI.validateSuccessResponse(response, 201)
        createdContacts.push(response.body.data)

        const contact = response.body.data
        contactAPI.validateObject(contact)

        // Verify required fields
        expect(contact.firstName).to.eq(minimalData.firstName)
        expect(contact.lastName).to.eq(minimalData.lastName)
        expect(contact.email).to.eq(minimalData.email)

        // Verify optional fields are null or undefined
        const optionalFields = ['phone', 'mobile', 'position', 'department', 'companyId', 'preferredChannel']
        optionalFields.forEach(field => {
          if (contact[field] !== null && contact[field] !== undefined) {
            expect(contact[field]).to.be.a('string')
          }
        })

        cy.log(`Created contact with minimal data: ${contact.id}`)
      })
    })

    it('CONT_API_012: Should create contact with all optional fields', () => {
      const contactData = contactAPI.generateRandomData({
        firstName: 'John',
        lastName: 'Doe',
        email: `complete-${Date.now()}@test.com`,
        phone: '+1-555-9999',
        mobile: '+1-555-8888',
        position: 'CEO',
        department: 'Executive',
        isPrimary: true,
        preferredChannel: 'email',
        linkedin: 'https://linkedin.com/in/johndoe',
        twitter: '@johndoe',
        timezone: 'America/New_York'
      })

      contactAPI.create(contactData).then((response: any) => {
        contactAPI.validateSuccessResponse(response, 201)
        createdContacts.push(response.body.data)

        const contact = response.body.data
        expect(contact.firstName).to.eq(contactData.firstName)
        expect(contact.lastName).to.eq(contactData.lastName)
        expect(contact.email).to.eq(contactData.email)
        expect(contact.phone).to.eq(contactData.phone)
        expect(contact.mobile).to.eq(contactData.mobile)
        expect(contact.position).to.eq(contactData.position)
        expect(contact.department).to.eq(contactData.department)
        expect(contact.preferredChannel).to.eq(contactData.preferredChannel)

        cy.log(`Created contact with all optional fields: ${JSON.stringify(contact, null, 2)}`)
      })
    })

    it('CONT_API_013: Should reject creation without firstName', () => {
      const invalidData = {
        lastName: 'Test',
        email: `nofirstname-${Date.now()}@test.com`
        // Missing: firstName
      }

      contactAPI.create(invalidData).then((response: any) => {
        contactAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without firstName rejected with VALIDATION_ERROR')
      })
    })

    it('CONT_API_014: Should reject creation without email', () => {
      const invalidData = {
        firstName: 'NoEmail',
        lastName: 'Test'
        // Missing: email
      }

      contactAPI.create(invalidData).then((response: any) => {
        contactAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation without email rejected with VALIDATION_ERROR')
      })
    })

    it('CONT_API_015: Should reject creation with invalid email format', () => {
      const invalidData = {
        firstName: 'InvalidEmail',
        lastName: 'Test',
        email: 'not-a-valid-email'
      }

      contactAPI.create(invalidData).then((response: any) => {
        contactAPI.validateErrorResponse(response, 400, 'VALIDATION_ERROR')

        cy.log('Creation with invalid email format rejected with VALIDATION_ERROR')
      })
    })

    it('CONT_API_016: Should reject duplicate email', () => {
      // First create a contact
      const contactData = contactAPI.generateRandomData()

      contactAPI.create(contactData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdContacts.push(createResponse.body.data)

        // Try to create another contact with the same email
        const duplicateData = contactAPI.generateRandomData({
          email: contactData.email // Same email
        })

        contactAPI.create(duplicateData).then((response: any) => {
          // Should fail due to UNIQUE constraint
          expect(response.status).to.be.oneOf([400, 409, 500])
          expect(response.body).to.have.property('success', false)

          cy.log('Duplicate email rejected')
        })
      })
    })

    it('CONT_API_017: Should reject creation without x-team-id', () => {
      const noTeamAPI = new ContactAPIController(BASE_URL, SUPERADMIN_API_KEY, null)
      const contactData = noTeamAPI.generateRandomData()

      noTeamAPI.create(contactData).then((response: any) => {
        expect(response.status).to.eq(400)
        expect(response.body).to.have.property('success', false)
        expect(response.body).to.have.property('code', 'TEAM_CONTEXT_REQUIRED')

        cy.log('Creation without x-team-id rejected with TEAM_CONTEXT_REQUIRED')
      })
    })
  })

  // ============================================
  // GET /api/v1/contacts/{id} - Get Contact by ID
  // ============================================
  describe('GET /api/v1/contacts/{id} - Get Contact by ID', () => {
    it('CONT_API_020: Should get contact by valid ID', () => {
      // First create a contact
      const contactData = contactAPI.generateRandomData()

      contactAPI.create(contactData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        createdContacts.push(createResponse.body.data)

        const contactId = createResponse.body.data.id

        // Get the contact by ID
        contactAPI.getById(contactId).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)

          const contact = response.body.data
          contactAPI.validateObject(contact)
          expect(contact.id).to.eq(contactId)
          expect(contact.firstName).to.eq(contactData.firstName)
          expect(contact.email).to.eq(contactData.email)

          cy.log(`Retrieved contact: ${contact.firstName} ${contact.lastName}`)
        })
      })
    })

    it('CONT_API_021: Should return 404 for non-existent contact', () => {
      const fakeId = 'non-existent-contact-id-12345'

      contactAPI.getById(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-existent contact returns 404')
      })
    })

    // Note: No CONT_API_022 test for "access other user's record" because
    // contacts entity has shared: true - all team members can see all contacts
  })

  // ============================================
  // PATCH /api/v1/contacts/{id} - Update Contact
  // ============================================
  describe('PATCH /api/v1/contacts/{id} - Update Contact', () => {
    it('CONT_API_030: Should update contact with multiple fields', () => {
      // First create a contact
      contactAPI.createTestRecord().then((testContact: any) => {
        createdContacts.push(testContact)

        const updateData = {
          firstName: 'UpdatedFirstName',
          lastName: 'UpdatedLastName',
          phone: '+1-555-9999',
          position: 'Updated Position'
        }

        contactAPI.update(testContact.id, updateData).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)

          const contact = response.body.data
          expect(contact.firstName).to.eq(updateData.firstName)
          expect(contact.lastName).to.eq(updateData.lastName)
          expect(contact.phone).to.eq(updateData.phone)
          expect(contact.position).to.eq(updateData.position)
          // Original email should be preserved
          expect(contact.email).to.eq(testContact.email)

          cy.log(`Updated contact: ${contact.firstName} ${contact.lastName}`)
        })
      })
    })

    it('CONT_API_031: Should update contact firstName', () => {
      contactAPI.createTestRecord().then((testContact: any) => {
        createdContacts.push(testContact)

        const newFirstName = 'NewFirstName'

        contactAPI.update(testContact.id, { firstName: newFirstName }).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.firstName).to.eq(newFirstName)

          cy.log(`Updated firstName to: ${newFirstName}`)
        })
      })
    })

    it('CONT_API_032: Should update contact companyId (link to company)', () => {
      contactAPI.createTestRecord().then((testContact: any) => {
        createdContacts.push(testContact)

        const newCompanyId = `company-${Date.now()}`

        contactAPI.update(testContact.id, { companyId: newCompanyId }).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.companyId).to.eq(newCompanyId)

          cy.log(`Linked contact to company: ${newCompanyId}`)
        })
      })
    })

    it('CONT_API_033: Should update contact phone and department', () => {
      contactAPI.createTestRecord().then((testContact: any) => {
        createdContacts.push(testContact)

        const updateData = {
          phone: '+1-555-7777',
          mobile: '+1-555-8888',
          department: 'Engineering',
          preferredChannel: 'phone'
        }

        contactAPI.update(testContact.id, updateData).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)
          expect(response.body.data.phone).to.eq(updateData.phone)
          expect(response.body.data.mobile).to.eq(updateData.mobile)
          expect(response.body.data.department).to.eq(updateData.department)
          expect(response.body.data.preferredChannel).to.eq(updateData.preferredChannel)

          cy.log(`Updated phone and department`)
        })
      })
    })

    it('CONT_API_034: Should reject update to duplicate email', () => {
      // Create two contacts
      contactAPI.createTestRecord().then((contact1: any) => {
        createdContacts.push(contact1)

        contactAPI.createTestRecord().then((contact2: any) => {
          createdContacts.push(contact2)

          // Try to update contact2's email to contact1's email
          contactAPI
            .update(contact2.id, { email: contact1.email })
            .then((response: any) => {
              // Should fail due to UNIQUE constraint
              expect(response.status).to.be.oneOf([400, 409, 500])
              expect(response.body).to.have.property('success', false)

              cy.log('Update to duplicate email rejected')
            })
        })
      })
    })

    it('CONT_API_035: Should return 404 for non-existent contact', () => {
      const fakeId = 'non-existent-contact-id-12345'

      contactAPI.update(fakeId, { firstName: 'NewName' }).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Update non-existent contact returns 404')
      })
    })

    it('CONT_API_036: Should reject empty update body', () => {
      contactAPI.createTestRecord().then((testContact: any) => {
        createdContacts.push(testContact)

        contactAPI.update(testContact.id, {}).then((response: any) => {
          expect(response.status).to.eq(400)
          expect(response.body).to.have.property('success', false)
          // Error code can be NO_FIELDS or HTTP_400 depending on validation layer
          expect(response.body.code).to.be.oneOf(['NO_FIELDS', 'HTTP_400'])

          cy.log('Empty update body rejected')
        })
      })
    })
  })

  // ============================================
  // DELETE /api/v1/contacts/{id} - Delete Contact
  // ============================================
  describe('DELETE /api/v1/contacts/{id} - Delete Contact', () => {
    it('CONT_API_040: Should delete contact by valid ID', () => {
      // Create a contact to delete
      const contactData = contactAPI.generateRandomData()

      contactAPI.create(contactData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const contactId = createResponse.body.data.id

        // Delete the contact
        contactAPI.delete(contactId).then((response: any) => {
          contactAPI.validateSuccessResponse(response, 200)
          expect(response.body.data).to.have.property('success', true)
          expect(response.body.data).to.have.property('id', contactId)

          cy.log(`Deleted contact: ${contactId}`)
        })
      })
    })

    it('CONT_API_041: Should return 404 for non-existent contact', () => {
      const fakeId = 'non-existent-contact-id-12345'

      contactAPI.delete(fakeId).then((response: any) => {
        expect(response.status).to.eq(404)
        expect(response.body).to.have.property('success', false)

        cy.log('Delete non-existent contact returns 404')
      })
    })

    it('CONT_API_042: Should verify deletion persists', () => {
      // Create a contact
      const contactData = contactAPI.generateRandomData()

      contactAPI.create(contactData).then((createResponse: any) => {
        expect(createResponse.status).to.eq(201)
        const contactId = createResponse.body.data.id

        // Delete it
        contactAPI.delete(contactId).then((deleteResponse: any) => {
          expect(deleteResponse.status).to.eq(200)

          // Verify it's gone
          contactAPI.getById(contactId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(404)
            expect(getResponse.body).to.have.property('success', false)

            cy.log('Deletion verified - contact no longer exists')
          })
        })
      })
    })
  })

  // ============================================
  // Integration - Complete CRUD Lifecycle
  // ============================================
  describe('Integration - Complete CRUD Lifecycle', () => {
    it('CONT_API_100: Should complete full lifecycle: Create -> Read -> Update -> Delete', () => {
      // 1. CREATE
      const contactData = contactAPI.generateRandomData({
        phone: '+1-555-0000',
        position: 'Initial Position',
        department: 'Sales',
        preferredChannel: 'email'
      })

      contactAPI.create(contactData).then((createResponse: any) => {
        contactAPI.validateSuccessResponse(createResponse, 201)
        const contactId = createResponse.body.data.id

        cy.log(`1. Created contact: ${contactId}`)

        // 2. READ
        contactAPI.getById(contactId).then((readResponse: any) => {
          contactAPI.validateSuccessResponse(readResponse, 200)
          expect(readResponse.body.data.firstName).to.eq(contactData.firstName)
          expect(readResponse.body.data.email).to.eq(contactData.email)

          cy.log(`2. Read contact: ${readResponse.body.data.firstName} ${readResponse.body.data.lastName}`)

          // 3. UPDATE
          const updateData = {
            firstName: 'UpdatedLifecycle',
            lastName: 'Contact',
            phone: '+1-555-9999',
            position: 'Updated Position',
            department: 'Engineering',
            preferredChannel: 'phone'
          }

          contactAPI.update(contactId, updateData).then((updateResponse: any) => {
            contactAPI.validateSuccessResponse(updateResponse, 200)
            expect(updateResponse.body.data.firstName).to.eq(updateData.firstName)
            expect(updateResponse.body.data.phone).to.eq(updateData.phone)
            expect(updateResponse.body.data.position).to.eq(updateData.position)

            cy.log(`3. Updated contact: ${updateResponse.body.data.firstName} ${updateResponse.body.data.lastName}`)

            // 4. DELETE
            contactAPI.delete(contactId).then((deleteResponse: any) => {
              contactAPI.validateSuccessResponse(deleteResponse, 200)
              expect(deleteResponse.body.data).to.have.property('success', true)

              cy.log(`4. Deleted contact: ${contactId}`)

              // 5. VERIFY DELETION
              contactAPI.getById(contactId).then((verifyResponse: any) => {
                expect(verifyResponse.status).to.eq(404)

                cy.log('5. Verified deletion - contact no longer exists')
                cy.log('Full CRUD lifecycle completed successfully!')
              })
            })
          })
        })
      })
    })
  })
})
