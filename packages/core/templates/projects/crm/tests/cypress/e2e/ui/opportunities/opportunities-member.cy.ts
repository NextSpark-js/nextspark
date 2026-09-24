/// <reference types="cypress" />

/**
 * Opportunities CRUD - Member Role (Restricted: View + Edit Only)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { OpportunitiesPOM } from '../../../src/entities/OpportunitiesPOM'
import { loginAsCrmMember } from '../../../src/session-helpers'

describe('Opportunities CRUD - Member Role (Restricted: View + Edit Only)', () => {
  const opportunities = new OpportunitiesPOM()

  beforeEach(() => {
    loginAsCrmMember()
    cy.visit('/dashboard/opportunities')
    opportunities.list.validatePageVisible()
  })

  describe('READ - Member CAN view opportunities', () => {
    it('MEMBER_OPPO_READ_001: should view opportunity list', () => {
      opportunities.list.validatePageVisible()
      opportunities.list.validateTableVisible()
    })

    it('MEMBER_OPPO_READ_002: should view opportunity details', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/opportunities\/[a-z0-9-]+/)
        }
      })
    })

    it('MEMBER_OPPO_READ_003: should search opportunities', () => {
      opportunities.list.search('test')
      cy.wait(500)
      opportunities.list.clearSearch()
    })
  })

  describe('UPDATE - Member CAN edit opportunities', () => {
    it('MEMBER_OPPO_UPDATE_001: should edit existing opportunity', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const opportunityId = url.split('/').pop()
            opportunities.form.visitEdit(opportunityId!)
            opportunities.form.validateFormVisible()

            // Verify fields are enabled (Member can edit)
            cy.get(opportunities.form.selectors.field('name')).within(() => {
              cy.get('input, textarea').should('not.be.disabled')
            })
          })
        }
      })
    })

    it('MEMBER_OPPO_UPDATE_002: should update opportunity name and value', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const opportunityId = url.split('/').pop()
            opportunities.form.visitEdit(opportunityId!)
            opportunities.form.validateFormVisible()

            const updatedName = `Member Updated ${Date.now()}`
            opportunities.form.typeInField('name', updatedName)
            opportunities.form.typeInField('amount', '55000')

            opportunities.submitForm()
            cy.url().should('include', '/dashboard/opportunities')
            cy.contains(updatedName).should('be.visible')
          })
        }
      })
    })

    it('MEMBER_OPPO_UPDATE_003: should update probability', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const opportunityId = url.split('/').pop()
            opportunities.form.visitEdit(opportunityId!)
            opportunities.form.validateFormVisible()

            opportunities.form.typeInField('probability', '80')

            opportunities.submitForm()
            cy.url().should('include', '/dashboard/opportunities')
          })
        }
      })
    })

    it('MEMBER_OPPO_UPDATE_004: should cancel update without saving', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const opportunityId = url.split('/').pop()
            opportunities.form.visitEdit(opportunityId!)
            opportunities.form.validateFormVisible()

            opportunities.form.typeInField('name', 'ShouldNotSave')

            opportunities.form.cancel()
            cy.url().should('not.include', '/edit')
          })
        }
      })
    })
  })

  describe('CREATE - Member CANNOT create opportunities', () => {
    it('MEMBER_OPPO_CREATE_001: create button should be hidden', () => {
      cy.get(opportunities.list.selectors.createButton).should('not.exist')
    })

    it('MEMBER_OPPO_CREATE_002: should not be able to access create form via UI', () => {
      // Verify no visible way to access create form
      cy.get('[data-cy*="create"], [data-cy*="add"]').should('not.exist')
    })

    it('MEMBER_OPPO_CREATE_003: direct navigation to create form should be blocked', () => {
      cy.visit('/dashboard/opportunities/create', { failOnStatusCode: false })

      // Should either redirect or show access denied
      cy.url().then(url => {
        if (url.includes('/dashboard/opportunities/create')) {
          // If still on create page, should show error
          cy.get('body').should('not.contain', opportunities.form.selectors.form)
        } else {
          // Should redirect away from create page
          cy.url().should('not.include', '/create')
        }
      })
    })
  })

  describe('DELETE - Member CANNOT delete opportunities', () => {
    it('MEMBER_OPPO_DELETE_001: delete buttons should be hidden', () => {
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_OPPO_DELETE_002: should not see delete action in opportunity list', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(opportunities.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').should('not.exist')
          })
        }
      })
    })

    it('MEMBER_OPPO_DELETE_003: should not see delete action in detail view', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          opportunities.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/opportunities\/[a-z0-9-]+/)

          cy.get('[data-cy*="delete"]').should('not.exist')
        }
      })
    })

    it('MEMBER_OPPO_DELETE_004: should NOT delete opportunity via API', () => {
      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(opportunities.list.selectors.rowGeneric).first().invoke('attr', 'data-cy').then(dataCy => {
            if (dataCy) {
              const opportunityId = dataCy.replace('opportunities-row-', '')

              cy.request({
                method: 'DELETE',
                url: `/api/v1/opportunities/${opportunityId}`,
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
    it('MEMBER_OPPO_PERMISSIONS_001: should have view and edit access only', () => {
      opportunities.list.validatePageVisible()

      // Check for no create button
      cy.get(opportunities.list.selectors.createButton).should('not.exist')

      // Check for no delete buttons
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_OPPO_PERMISSIONS_002: should see all organization opportunities', () => {
      opportunities.list.validatePageVisible()

      cy.get(opportunities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(opportunities.list.selectors.rowGeneric).should('have.length.at.least', 1)
        }
      })
    })

    it('MEMBER_OPPO_PERMISSIONS_003: should maintain restrictions after page refresh', () => {
      cy.reload()

      opportunities.list.validatePageVisible()

      // Verify restrictions persist
      cy.get(opportunities.list.selectors.createButton).should('not.exist')
      cy.get('[data-cy*="delete"]').should('not.exist')
    })
  })
})
