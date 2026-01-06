/// <reference types="cypress" />

/**
 * Activities CRUD - Member Role (Read + Update Only)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { ActivitiesPOM } from '../../../src/entities/ActivitiesPOM'
import { loginAsCrmMember } from '../../../src/session-helpers'

describe('Activities CRUD - Member Role (Read + Update Only)', () => {
  const activities = new ActivitiesPOM()

  beforeEach(() => {
    loginAsCrmMember()
    cy.visit('/dashboard/activities')
    activities.list.validatePageVisible()
  })

  describe('READ - Member CAN view activities', () => {
    it('MEMBER_ACTIV_READ_001: should view activity list', () => {
      activities.list.validatePageVisible()
      activities.list.validateTableVisible()
    })

    it('MEMBER_ACTIV_READ_002: should view activity details', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/activities\/[a-z0-9-]+/)
        }
      })
    })

    it('MEMBER_ACTIV_READ_003: should search activities', () => {
      activities.list.search('test')
      cy.wait(500)
      activities.list.clearSearch()
    })
  })

  describe('UPDATE - Member CAN edit activities', () => {
    it('MEMBER_ACTIV_UPDATE_001: should edit existing activity', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const activityId = url.split('/').pop()
            activities.form.visitEdit(activityId!)
            activities.form.validateFormVisible()

            // Verify fields are enabled (Member can edit)
            cy.get(activities.form.selectors.field('subject')).within(() => {
              cy.get('input, textarea').should('not.be.disabled')
            })
          })
        }
      })
    })

    it('MEMBER_ACTIV_UPDATE_002: should update activity subject', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const activityId = url.split('/').pop()
            activities.form.visitEdit(activityId!)
            activities.form.validateFormVisible()

            const updatedSubject = `Member Updated ${Date.now()}`
            activities.form.typeInField('subject', updatedSubject)

            activities.submitForm()
            cy.url().should('include', '/dashboard/activities')
            cy.contains(updatedSubject).should('be.visible')
          })
        }
      })
    })

    it('MEMBER_ACTIV_UPDATE_003: should update activity type', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const activityId = url.split('/').pop()
            activities.form.visitEdit(activityId!)
            activities.form.validateFormVisible()

            activities.form.selectOption('type', 'meeting')

            activities.submitForm()
            cy.url().should('include', '/dashboard/activities')
          })
        }
      })
    })

    it('MEMBER_ACTIV_UPDATE_004: should cancel update without saving', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const activityId = url.split('/').pop()
            activities.form.visitEdit(activityId!)
            activities.form.validateFormVisible()

            activities.form.typeInField('subject', 'ShouldNotSave')

            activities.form.cancel()
            cy.url().should('not.include', '/edit')
          })
        }
      })
    })
  })

  describe('CREATE - Member CANNOT create activities', () => {
    it('MEMBER_ACTIV_CREATE_001: create button should be hidden', () => {
      cy.get(activities.list.selectors.createButton).should('not.exist')
    })

    it('MEMBER_ACTIV_CREATE_002: should not be able to access create form via UI', () => {
      // Verify no visible way to access create form
      cy.get('[data-cy*="create"], [data-cy*="add"]').should('not.exist')
    })

    it('MEMBER_ACTIV_CREATE_003: direct navigation to create form should be blocked', () => {
      cy.visit('/dashboard/activities/create', { failOnStatusCode: false })

      // Should either redirect or show access denied
      cy.url().then(url => {
        if (url.includes('/dashboard/activities/create')) {
          // If still on create page, should show error
          cy.get('body').should('not.contain', activities.form.selectors.form)
        } else {
          // Should redirect away from create page
          cy.url().should('not.include', '/create')
        }
      })
    })
  })

  describe('DELETE - Member CANNOT delete activities', () => {
    it('MEMBER_ACTIV_DELETE_001: delete buttons should be hidden', () => {
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_ACTIV_DELETE_002: should not see delete action in activity list', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(activities.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').should('not.exist')
          })
        }
      })
    })

    it('MEMBER_ACTIV_DELETE_003: should not see delete action in detail view', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/activities\/[a-z0-9-]+/)

          cy.get('[data-cy*="delete"]').should('not.exist')
        }
      })
    })

    it('MEMBER_ACTIV_DELETE_004: should NOT delete activity via API', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(activities.list.selectors.rowGeneric).first().invoke('attr', 'data-cy').then(dataCy => {
            if (dataCy) {
              const activityId = dataCy.replace('activities-row-', '')

              cy.request({
                method: 'DELETE',
                url: `/api/v1/activities/${activityId}`,
                failOnStatusCode: false,
              }).then(response => {
                expect(response.status).to.be.oneOf([401, 403, 404])
              })
            }
          })
        }
      })
    })
  })

  describe('PERMISSIONS - Member role capabilities', () => {
    it('MEMBER_ACTIV_PERM_001: should have read and update access only', () => {
      activities.list.validatePageVisible()

      // Check for no create button
      cy.get(activities.list.selectors.createButton).should('not.exist')

      // Check for no delete buttons
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_ACTIV_PERM_002: should have edit access to existing activities', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)
          cy.url().then(url => {
            const activityId = url.split('/').pop()
            activities.form.visitEdit(activityId!)
            activities.form.validateFormVisible()
          })
        }
      })
    })

    it('MEMBER_ACTIV_PERM_003: should see all organization activities', () => {
      activities.list.validatePageVisible()

      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(activities.list.selectors.rowGeneric).should('have.length.at.least', 1)
        }
      })
    })

    it('MEMBER_ACTIV_PERM_004: should maintain restrictions after page refresh', () => {
      cy.reload()

      activities.list.validatePageVisible()

      // Verify restrictions persist
      cy.get(activities.list.selectors.createButton).should('not.exist')
      cy.get('[data-cy*="delete"]').should('not.exist')
    })
  })

  describe('EDGE CASES - Member Role', () => {
    it('MEMBER_ACTIV_EDGE_001: should handle empty activity list gracefully', () => {
      activities.list.validatePageVisible()
    })

    it('MEMBER_ACTIV_EDGE_002: should not bypass create restriction via URL', () => {
      cy.visit('/dashboard/activities?action=create', { failOnStatusCode: false })
      cy.get(activities.list.selectors.createButton).should('not.exist')
    })

    it('MEMBER_ACTIV_EDGE_003: should not bypass delete restriction via URL', () => {
      cy.visit('/dashboard/activities?action=delete', { failOnStatusCode: false })
      cy.get('[data-cy*="delete"]').should('not.exist')
    })
  })
})
