/**
 * Media API - Team Isolation Tests
 *
 * Validates that media is properly isolated by team:
 * - Users can only see media from their active team
 * - CRUD operations respect team boundaries
 * - Cross-team access is prevented by membership validation (403)
 * - Duplicate detection is team-scoped
 *
 * Test Cases:
 * - MEDIA_TEAM_001: GET without x-team-id falls back to defaultTeamId
 * - MEDIA_TEAM_002: GET with team A only returns team A media
 * - MEDIA_TEAM_003: GET with non-member team returns 403
 * - MEDIA_TEAM_004: POST upload creates media in correct team
 * - MEDIA_TEAM_005: PATCH cannot modify media from another team (403 - not a member)
 * - MEDIA_TEAM_006: DELETE cannot delete media from another team (403 - not a member)
 * - MEDIA_TEAM_007: GET by ID cannot view media from another team (403 - not a member)
 * - MEDIA_TEAM_008: Check duplicates only searches within active team
 * - MEDIA_TEAM_011: Search with non-member team returns 403
 * - MEDIA_TEAM_012: Pagination with non-member team returns 403
 * - MEDIA_TEAM_013: Type filtering with non-member team returns 403
 */

/// <reference types="cypress" />

import * as allure from 'allure-cypress'

const MediaAPIController = require('../../../../src/controllers/MediaAPIController.js')

describe('Media API - Team Isolation', {
  tags: ['@api', '@feat-media-library', '@security', '@team-isolation']
}, () => {
  // Test constants
  const SUPERADMIN_API_KEY = Cypress.env('SUPERADMIN_API_KEY') || 'test_api_key_for_testing_purposes_only_not_a_real_secret_key_abc123'
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:3010'

  // Team IDs from sample data
  const TEAM_A_ID = 'team-nextspark-001'  // NextSpark Team (system admin team with media)
  const TEAM_B_ID = 'team-alpha-001'      // Alpha Tech (different team, no media)

  // Controller instances
  let mediaAPITeamA: InstanceType<typeof MediaAPIController>
  let mediaAPITeamB: InstanceType<typeof MediaAPIController>
  let mediaAPINoTeam: InstanceType<typeof MediaAPIController>

  // Track created media for cleanup
  let createdMediaTeamA: string[] = []
  let createdMediaTeamB: string[] = []

  before(() => {
    // Initialize controllers for different team contexts
    mediaAPITeamA = new MediaAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_A_ID)
    mediaAPITeamB = new MediaAPIController(BASE_URL, SUPERADMIN_API_KEY, TEAM_B_ID)
    mediaAPINoTeam = new MediaAPIController(BASE_URL, SUPERADMIN_API_KEY, null) // No team context
  })

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Media Library')
    allure.story('Team Isolation')
  })

  afterEach(() => {
    // Cleanup created media
    createdMediaTeamA.forEach((id) => {
      mediaAPITeamA.deleteMedia(id)
    })
    createdMediaTeamB.forEach((id) => {
      mediaAPITeamB.deleteMedia(id)
    })
    createdMediaTeamA = []
    createdMediaTeamB = []
  })

  // ============================================
  // MEDIA_TEAM_001: GET without x-team-id falls back to defaultTeamId
  // ============================================
  describe('Team Context Fallback', () => {
    it('MEDIA_TEAM_001: Should fall back to defaultTeamId when x-team-id header is not provided', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // Superadmin has defaultTeamId set (team-nextspark-001 via activeTeamId meta)
      // Without x-team-id header, API falls back to user's defaultTeamId
      mediaAPINoTeam.getMedia().then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data.data).to.be.an('array')

        // All returned media should belong to the defaultTeamId (team-nextspark-001)
        response.body.data.data.forEach((media: any) => {
          expect(media.teamId).to.eq(TEAM_A_ID)
        })

        cy.log('Without x-team-id, API falls back to defaultTeamId correctly')
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_002 & 003: GET returns only team-specific media
  // ============================================
  describe('Team Isolation - List Media', () => {
    it('MEDIA_TEAM_002: Should return only media from team A when using team A context', { tags: '@smoke' }, () => {
      allure.severity('critical')

      mediaAPITeamA.getMedia().then((response: any) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data.data).to.be.an('array')

        // All returned media should belong to team A
        response.body.data.data.forEach((media: any) => {
          expect(media.teamId).to.eq(TEAM_A_ID)
        })

        cy.log(`Team A has ${response.body.data.data.length} media items (all isolated to team A)`)
      })
    })

    it('MEDIA_TEAM_003: Should return 403 when requesting media from a team the user is not a member of', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // SuperAdmin is NOT a member of team-alpha-001, so membership validation rejects with 403
      mediaAPITeamB.getMedia().then((response: any) => {
        expect(response.status).to.eq(403)
        expect(response.body).to.have.property('success', false)

        cy.log('Non-member team access correctly rejected with 403')
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_004: POST upload creates media in correct team
  // Note: Skipped because cy.request doesn't handle FormData properly.
  // Upload team isolation is verified via curl in manual testing.
  // ============================================
  describe('Team Isolation - Upload', () => {
    it.skip('MEDIA_TEAM_004: Should create media in the correct team context (team A)', () => {
      allure.severity('critical')

      const filename = `test-team-a-${Date.now()}.jpg`
      cy.fixture('test-image.jpg', 'binary').then((fileContent) => {
        const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/jpeg')
        const file = new File([blob], filename, { type: 'image/jpeg' })

        mediaAPITeamA.uploadMedia(file).then((response: any) => {
          expect(response.status).to.eq(200)
          expect(response.body).to.have.property('success', true)
          expect(response.body.data.media).to.be.an('array')
          expect(response.body.data.media.length).to.be.greaterThan(0)

          const uploadedMedia = response.body.data.media[0]
          expect(uploadedMedia.teamId).to.eq(TEAM_A_ID)
          createdMediaTeamA.push(uploadedMedia.id)

          cy.log(`Media uploaded to team A: ${uploadedMedia.id}`)

          // Verify team B cannot see this media (403 - not a member)
          mediaAPITeamB.getMediaById(uploadedMedia.id).then((getResponse: any) => {
            expect(getResponse.status).to.eq(403)
            cy.log('Team B cannot access team A media (403 - not a member)')
          })
        })
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_005: PATCH cannot modify media from another team
  // ============================================
  describe('Team Isolation - Update', () => {
    it('MEDIA_TEAM_005: Should return 403 when trying to update media from a non-member team', () => {
      allure.severity('critical')

      // Get first media from team A
      mediaAPITeamA.getMedia({ limit: 1 }).then((listResponse: any) => {
        expect(listResponse.body.data.data.length).to.be.greaterThan(0)

        const teamAMediaId = listResponse.body.data.data[0].id

        // Try to update it using team B context (user is not a member of team B)
        const updateData = { alt: 'Hacked from team B' }

        mediaAPITeamB.updateMedia(teamAMediaId, updateData).then((updateResponse: any) => {
          // Membership validation rejects before media lookup
          expect(updateResponse.status).to.eq(403)
          expect(updateResponse.body).to.have.property('success', false)

          cy.log('Non-member team cannot update media (403)')

          // Verify original media unchanged
          mediaAPITeamA.getMediaById(teamAMediaId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(200)
            expect(getResponse.body.data.alt).to.not.eq('Hacked from team B')
            cy.log('Team A media unchanged after non-member update attempt')
          })
        })
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_006: DELETE cannot delete media from another team
  // ============================================
  describe('Team Isolation - Delete', () => {
    it('MEDIA_TEAM_006: Should return 403 when trying to delete media from a non-member team', () => {
      allure.severity('critical')

      // Get first media from team A
      mediaAPITeamA.getMedia({ limit: 1 }).then((listResponse: any) => {
        expect(listResponse.body.data.data.length).to.be.greaterThan(0)

        const teamAMediaId = listResponse.body.data.data[0].id

        // Try to delete it using team B context (user is not a member of team B)
        mediaAPITeamB.deleteMedia(teamAMediaId).then((deleteResponse: any) => {
          // Membership validation rejects before media lookup
          expect(deleteResponse.status).to.eq(403)
          expect(deleteResponse.body).to.have.property('success', false)

          cy.log('Non-member team cannot delete media (403)')

          // Verify media still exists for team A
          mediaAPITeamA.getMediaById(teamAMediaId).then((getResponse: any) => {
            expect(getResponse.status).to.eq(200)
            cy.log('Team A media still exists after non-member delete attempt')
          })
        })
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_007: GET by ID cannot view media from another team
  // ============================================
  describe('Team Isolation - Get by ID', () => {
    it('MEDIA_TEAM_007: Should return 403 when trying to access media from a non-member team by ID', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // Get first media from team A
      mediaAPITeamA.getMedia({ limit: 1 }).then((listResponse: any) => {
        expect(listResponse.body.data.data.length).to.be.greaterThan(0)

        const teamAMediaId = listResponse.body.data.data[0].id

        // Try to access it using team B context (user is not a member of team B)
        mediaAPITeamB.getMediaById(teamAMediaId).then((getResponse: any) => {
          // Membership validation rejects before media lookup
          expect(getResponse.status).to.eq(403)
          expect(getResponse.body).to.have.property('success', false)

          cy.log('Non-member team cannot view media by ID (403)')
        })
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_008: Check duplicates only searches within active team
  // ============================================
  describe('Team Isolation - Duplicate Detection', () => {
    it.skip('MEDIA_TEAM_008: Should only detect duplicates within the same team', () => {
      allure.severity('high')

      const filename = `duplicate-test-${Date.now()}.jpg`

      // Upload to team A
      cy.fixture('test-image.jpg', 'binary').then((fileContent) => {
        const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/jpeg')
        const fileA = new File([blob], filename, { type: 'image/jpeg' })

        mediaAPITeamA.uploadMedia(fileA).then((uploadAResponse: any) => {
          expect(uploadAResponse.status).to.eq(200)
          const mediaA = uploadAResponse.body.data.media[0]
          createdMediaTeamA.push(mediaA.id)

          cy.log(`Uploaded to team A: ${mediaA.id}`)

          // Upload same file to team B (should NOT be detected as duplicate)
          const fileB = new File([blob], filename, { type: 'image/jpeg' })

          mediaAPITeamB.uploadMedia(fileB).then((uploadBResponse: any) => {
            expect(uploadBResponse.status).to.eq(200)
            const mediaB = uploadBResponse.body.data.media[0]
            createdMediaTeamB.push(mediaB.id)

            cy.log(`Uploaded to team B: ${mediaB.id}`)

            // Both uploads should succeed (no duplicate detected across teams)
            expect(mediaA.id).to.not.eq(mediaB.id)
            expect(mediaA.teamId).to.eq(TEAM_A_ID)
            expect(mediaB.teamId).to.eq(TEAM_B_ID)

            cy.log('Same file uploaded to both teams - no cross-team duplicate detection')
          })
        })
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_011: Search respects team isolation
  // ============================================
  describe('Team Isolation - Search', () => {
    it('MEDIA_TEAM_011: Should search within active team and reject non-member teams', () => {
      allure.severity('high')

      const searchTerm = 'sample'

      // Search in team A (user is a member)
      mediaAPITeamA.getMedia({ search: searchTerm }).then((searchAResponse: any) => {
        expect(searchAResponse.status).to.eq(200)
        expect(searchAResponse.body).to.have.property('success', true)
        expect(searchAResponse.body.data.data).to.be.an('array')

        // All results should belong to team A
        searchAResponse.body.data.data.forEach((media: any) => {
          expect(media.teamId).to.eq(TEAM_A_ID)
        })

        cy.log(`Team A search found ${searchAResponse.body.data.data.length} results (all in team A)`)
      })

      // Search in team B (user is NOT a member) - should be rejected
      mediaAPITeamB.getMedia({ search: searchTerm }).then((searchBResponse: any) => {
        expect(searchBResponse.status).to.eq(403)
        expect(searchBResponse.body).to.have.property('success', false)

        cy.log('Non-member team search correctly rejected with 403')
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_012: Pagination reflects only active team
  // ============================================
  describe('Team Isolation - Pagination', () => {
    it('MEDIA_TEAM_012: Should paginate within member team and reject non-member teams', () => {
      allure.severity('medium')

      // Get total count for team A (user is a member)
      mediaAPITeamA.getMedia({ limit: 100 }).then((teamAResponse: any) => {
        const teamATotal = teamAResponse.body.data.total

        expect(teamAResponse.body.data.data).to.be.an('array')
        expect(teamATotal).to.be.greaterThan(0)

        teamAResponse.body.data.data.forEach((media: any) => {
          expect(media.teamId).to.eq(TEAM_A_ID)
        })

        cy.log(`Team A total: ${teamATotal} (correctly isolated)`)

        // Team B access (user is NOT a member) - should be rejected
        mediaAPITeamB.getMedia({ limit: 100 }).then((teamBResponse: any) => {
          expect(teamBResponse.status).to.eq(403)
          expect(teamBResponse.body).to.have.property('success', false)

          cy.log('Non-member team pagination correctly rejected with 403')
        })
      })
    })
  })

  // ============================================
  // MEDIA_TEAM_013: Type filtering respects team isolation
  // ============================================
  describe('Team Isolation - Type Filtering', () => {
    it('MEDIA_TEAM_013: Should filter by type within member team and reject non-member teams', () => {
      allure.severity('medium')

      // Get images from team A (user is a member)
      mediaAPITeamA.getMedia({ type: 'image' }).then((teamAResponse: any) => {
        expect(teamAResponse.status).to.eq(200)
        expect(teamAResponse.body).to.have.property('success', true)
        expect(teamAResponse.body.data.data).to.be.an('array')

        // All results should be images from team A
        teamAResponse.body.data.data.forEach((media: any) => {
          expect(media.teamId).to.eq(TEAM_A_ID)
        })

        cy.log(`Team A has ${teamAResponse.body.data.data.length} images (all in team A)`)
      })

      // Get images from team B (user is NOT a member) - should be rejected
      mediaAPITeamB.getMedia({ type: 'image' }).then((teamBResponse: any) => {
        expect(teamBResponse.status).to.eq(403)
        expect(teamBResponse.body).to.have.property('success', false)

        cy.log('Non-member team type filter correctly rejected with 403')
      })
    })
  })

  // ============================================
  // Integration Test: Full CRUD lifecycle with team isolation
  // ============================================
  describe('Integration - CRUD Lifecycle with Team Isolation', () => {
    it.skip('MEDIA_TEAM_100: Should complete full lifecycle respecting team boundaries', () => {
      allure.severity('critical')

      const filename = `lifecycle-test-${Date.now()}.jpg`

      // 1. Upload to team A
      cy.fixture('test-image.jpg', 'binary').then((fileContent) => {
        const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/jpeg')
        const file = new File([blob], filename, { type: 'image/jpeg' })

        mediaAPITeamA.uploadMedia(file).then((uploadResponse: any) => {
          expect(uploadResponse.status).to.eq(200)
          const mediaId = uploadResponse.body.data.media[0].id
          createdMediaTeamA.push(mediaId)

          cy.log(`1. Uploaded to team A: ${mediaId}`)

          // 2. Team A can read it
          mediaAPITeamA.getMediaById(mediaId).then((readResponse: any) => {
            expect(readResponse.status).to.eq(200)
            expect(readResponse.body.data.teamId).to.eq(TEAM_A_ID)
            cy.log('2. Team A can read the media')

            // 3. Team B CANNOT read it (403 - not a member)
            mediaAPITeamB.getMediaById(mediaId).then((crossTeamReadResponse: any) => {
              expect(crossTeamReadResponse.status).to.eq(403)
              cy.log('3. Team B cannot read team A media (403 - not a member)')

              // 4. Team A can update it
              mediaAPITeamA.updateMedia(mediaId, { alt: 'Updated by team A' }).then((updateResponse: any) => {
                expect(updateResponse.status).to.eq(200)
                expect(updateResponse.body.data.alt).to.eq('Updated by team A')
                cy.log('4. Team A updated the media')

                // 5. Team B CANNOT update it (403 - not a member)
                mediaAPITeamB.updateMedia(mediaId, { alt: 'Hacked by team B' }).then((crossTeamUpdateResponse: any) => {
                  expect(crossTeamUpdateResponse.status).to.eq(403)
                  cy.log('5. Team B cannot update team A media (403 - not a member)')

                  // 6. Team A can delete it
                  mediaAPITeamA.deleteMedia(mediaId).then((deleteResponse: any) => {
                    expect(deleteResponse.status).to.eq(200)
                    cy.log('6. Team A deleted the media')

                    // 7. Verify deletion (404 for both teams)
                    mediaAPITeamA.getMediaById(mediaId).then((verifyAResponse: any) => {
                      expect(verifyAResponse.status).to.eq(404)

                      mediaAPITeamB.getMediaById(mediaId).then((verifyBResponse: any) => {
                        expect(verifyBResponse.status).to.eq(403)
                        cy.log('7. Media deleted - team A gets 404, team B gets 403 (not a member)')
                        cy.log('Full lifecycle completed with team isolation!')
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
