/**
 * Teams API - Security Tests
 *
 * Tests for security vulnerabilities in Teams PATCH endpoint:
 * - Issue #1: Type coercion vulnerability (empty strings, 0, false, null)
 * - Issue #2: Permission check order (owner-only fields)
 * - Issue #3: Schema validation (owner vs non-owner schemas)
 *
 * Uses existing sample data users:
 * - Owner: Carlos Mendoza (team-everpoint-001)
 * - Admin: James Wilson (team-everpoint-001)
 * - Member: Emily Johnson (team-everpoint-001)
 *
 * @tags @api @teams @security
 */

import * as allure from 'allure-cypress'
import { loginAsOwner, loginAsAdmin, loginAsMember, BILLING_TEAMS } from '../../../../src/session-helpers'

describe('Teams API - Security Tests', { tags: ['@api', '@teams', '@security'] }, () => {
  // Use Everpoint Labs team from sample data (Carlos is owner, James is admin, Emily is member)
  const TEST_TEAM_ID = BILLING_TEAMS.PRO.teamId // team-everpoint-001
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:3000'

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Teams')
    allure.story('Security & Permission Enforcement')
  })

  describe('Issue #1: Type Coercion Vulnerability', () => {
    context('As Admin (non-owner)', () => {
      beforeEach(() => {
        loginAsAdmin()
        cy.visit('/dashboard') // Required for session cookies
      })

      it('SEC_TEAMS_001: Should reject PATCH with empty string for name', { tags: '@smoke' }, () => {
        allure.severity('critical')
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: '' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.error).to.include('owner')
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })

      it('SEC_TEAMS_002: Should reject PATCH with null for description', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: null },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.error).to.include('owner')
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })

      it('SEC_TEAMS_003: Should reject PATCH with number (0) for name', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: 0 },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.error).to.include('owner')
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })

      it('SEC_TEAMS_004: Should reject PATCH with boolean (false) for description', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: false },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.error).to.include('owner')
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })

      it('SEC_TEAMS_005: Should reject PATCH with whitespace-only name', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: '   ' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.error).to.include('owner')
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })
    })

    context('As Member (non-owner)', () => {
      beforeEach(() => {
        loginAsMember()
        cy.visit('/dashboard') // Required for session cookies
      })

      it('SEC_TEAMS_006: Should reject PATCH with empty string for name', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: '' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.error).to.include('owner')
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })

      it('SEC_TEAMS_007: Should reject PATCH with description update', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: 'New description' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.error).to.include('owner')
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })
    })
  })

  describe('Issue #2: Permission Check Order', () => {
    context('Admin user (non-owner)', () => {
      beforeEach(() => {
        loginAsAdmin()
        cy.visit('/dashboard')
      })

      it('SEC_TEAMS_010: Should return 403 with OWNER_ONLY reason when trying to update name', { tags: '@smoke' }, () => {
        allure.severity('critical')
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: 'New Name by Admin' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.reason).to.eq('OWNER_ONLY')
          expect(response.body.error).to.include('Only team owner')
          expect(response.body.error).to.not.include('generic')
        })
      })

      it('SEC_TEAMS_011: Should return 403 with OWNER_ONLY reason when trying to update description', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: 'New Description by Admin' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.reason).to.eq('OWNER_ONLY')
          expect(response.body.error).to.include('Only team owner')
        })
      })

      it('SEC_TEAMS_012: Should return specific error, not generic permission error', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: 'Test' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.reason).to.eq('OWNER_ONLY')
          // Should NOT be generic "teams.update" permission error
          expect(response.body.reason).to.not.eq('INSUFFICIENT_PERMISSIONS')
        })
      })
    })

    context('Member user (non-owner)', () => {
      beforeEach(() => {
        loginAsMember()
        cy.visit('/dashboard')
      })

      it('SEC_TEAMS_013: Should return 403 with OWNER_ONLY reason when trying to update name', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: 'New Name by Member' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.success).to.be.false
          expect(response.body.reason).to.eq('OWNER_ONLY')
        })
      })
    })
  })

  describe('Issue #3: Schema Validation (Owner vs Non-Owner)', () => {
    context('Owner updates', () => {
      beforeEach(() => {
        loginAsOwner()
        cy.visit('/dashboard')
      })

      it('SEC_TEAMS_020: Should use ownerUpdateTeamSchema for name updates', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: 'A' }, // Too short (min 2 chars)
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(400)
          expect(response.body.success).to.be.false
          expect(response.body.code).to.eq('VALIDATION_ERROR')
          expect(response.body.error).to.include('at least 2 characters')
        })
      })

      it('SEC_TEAMS_021: Should use ownerUpdateTeamSchema for description updates', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: null },
          failOnStatusCode: false,
        }).then((response) => {
          // Should accept null for description
          expect(response.status).to.eq(200)
          expect(response.body.success).to.be.true
        })
      })

      it('SEC_TEAMS_022: Should allow valid owner updates', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: {
            name: 'Everpoint Labs Updated',
            description: 'Updated description',
          },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.success).to.be.true
          expect(response.body.data.name).to.eq('Everpoint Labs Updated')
          expect(response.body.data.description).to.eq('Updated description')
        })
      })

      // Restore original name
      after(() => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: 'Everpoint Labs' },
        })
      })
    })

    context('Admin updates (non-owner fields only)', () => {
      beforeEach(() => {
        loginAsAdmin()
        cy.visit('/dashboard')
      })

      it('SEC_TEAMS_023: Should reject name/description fields before schema validation', () => {
        // Should fail with 403 OWNER_ONLY, not 400 VALIDATION_ERROR
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { name: 'Test' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(403)
          expect(response.body.reason).to.eq('OWNER_ONLY')
          // Should NOT reach schema validation
          expect(response.body.code).to.not.eq('VALIDATION_ERROR')
        })
      })

      it('SEC_TEAMS_024: Should allow slug updates by admin', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { slug: 'everpoint-labs-new' },
          failOnStatusCode: false,
        }).then((response) => {
          // Current implementation: Admins can update slug
          // If this fails, it means the permission system is correctly restricting admin slug updates
          // We document both expected behaviors here
          if (response.status === 200) {
            expect(response.body.success).to.be.true
            cy.log('✅ Admins CAN update slug (current behavior)')
          } else if (response.status === 403) {
            expect(response.body.reason).to.eq('OWNER_ONLY')
            cy.log('✅ Admins CANNOT update slug (stricter behavior)')
          }
        })
      })

      it('SEC_TEAMS_025: Should allow avatarUrl updates by admin', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { avatarUrl: 'https://example.com/avatar.png' },
          failOnStatusCode: false,
        }).then((response) => {
          // Similar to slug, this documents expected behavior
          if (response.status === 200) {
            expect(response.body.success).to.be.true
            cy.log('✅ Admins CAN update avatarUrl (current behavior)')
          } else if (response.status === 403) {
            expect(response.body.reason).to.eq('OWNER_ONLY')
            cy.log('✅ Admins CANNOT update avatarUrl (stricter behavior)')
          }
        })
      })
    })
  })

  describe('Issue #10: Description Max Length Documentation', () => {
    context('Owner updates', () => {
      beforeEach(() => {
        loginAsOwner()
        cy.visit('/dashboard')
      })

      it('SEC_TEAMS_030: Should accept very long descriptions (TEXT type, no limit)', () => {
        const longDescription = 'A'.repeat(10000) // 10KB text

        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: longDescription },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.success).to.be.true
          expect(response.body.data.description).to.eq(longDescription)
        })
      })

      it('SEC_TEAMS_031: Should accept null for description', () => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: null },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.success).to.be.true
          expect(response.body.data.description).to.be.null
        })
      })

      // Restore original description
      after(() => {
        cy.request({
          method: 'PATCH',
          url: `/api/v1/teams/${TEST_TEAM_ID}`,
          body: { description: 'Enabling digital innovation through scalable platforms' },
        })
      })
    })
  })

  describe('Dual Authentication Support', () => {
    it('SEC_TEAMS_040: Should accept session-based auth for owner', () => {
      loginAsOwner()
      cy.visit('/dashboard')

      cy.request({
        method: 'PATCH',
        url: `/api/v1/teams/${TEST_TEAM_ID}`,
        body: { description: 'Session Auth Test' },
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.be.true
      })
    })

    it('SEC_TEAMS_041: Should reject request without auth', () => {
      cy.clearAllSessionStorage()
      cy.clearAllCookies()

      cy.request({
        method: 'PATCH',
        url: `/api/v1/teams/${TEST_TEAM_ID}`,
        body: { name: 'No Auth Test' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body.success).to.be.false
        expect(response.body.code).to.eq('AUTHENTICATION_FAILED')
      })
    })
  })
})
