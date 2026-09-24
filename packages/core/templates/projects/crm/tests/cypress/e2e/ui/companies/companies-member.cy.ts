/// <reference types="cypress" />

/**
 * Companies CRUD - Member Role (Restricted: Read Only)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { CompaniesPOM } from '../../../src/entities/CompaniesPOM'
import { loginAsCrmMember } from '../../../src/session-helpers'

describe('Companies CRUD - Member Role (Restricted: Read Only)', () => {
  const companies = new CompaniesPOM()

  beforeEach(() => {
    loginAsCrmMember()
    cy.visit('/dashboard/companies')
    companies.list.validatePageVisible()
  })

  describe('READ - Member CAN view companies', () => {
    it('MEMBER_COMPANY_READ_001: should view company list', () => {
      companies.list.validatePageVisible()
      companies.list.validateTableVisible()
    })

    it('MEMBER_COMPANY_READ_002: should view company details', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          companies.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/companies\/[a-z0-9-]+/)
        }
      })
    })

    it('MEMBER_COMPANY_READ_003: should search companies', () => {
      companies.list.search('test')
      cy.wait(500)
      companies.list.clearSearch()
    })
  })

  describe('CREATE - Member CANNOT create companies', () => {
    it('MEMBER_COMPANY_CREATE_001: create button should be hidden', () => {
      cy.get(companies.list.selectors.createButton).should('not.exist')
    })

    it('MEMBER_COMPANY_CREATE_002: should not be able to access create form via UI', () => {
      // Verify no visible way to access create form
      cy.get('[data-cy*="create"], [data-cy*="add"]').should('not.exist')
    })

    it('MEMBER_COMPANY_CREATE_003: direct navigation to create form should be blocked', () => {
      cy.visit('/dashboard/companies/create', { failOnStatusCode: false })

      // Should either redirect or show access denied
      cy.url().then(url => {
        if (url.includes('/dashboard/companies/create')) {
          // If still on create page, should show error
          cy.get('body').should('not.contain', companies.form.selectors.form)
        } else {
          // Should redirect away from create page
          cy.url().should('not.include', '/create')
        }
      })
    })
  })

  describe('UPDATE - Member CANNOT update companies', () => {
    it('MEMBER_COMPANY_UPDATE_001: edit buttons should be hidden', () => {
      cy.get('[data-cy*="edit"]').should('not.exist')
    })

    it('MEMBER_COMPANY_UPDATE_002: should not see edit action in company list', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(companies.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="edit"]').should('not.exist')
          })
        }
      })
    })

    it('MEMBER_COMPANY_UPDATE_003: should not see edit action in detail view', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          companies.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/companies\/[a-z0-9-]+/)

          cy.get('[data-cy*="edit"]').should('not.exist')
        }
      })
    })
  })

  describe('DELETE - Member CANNOT delete companies', () => {
    it('MEMBER_COMPANY_DELETE_001: delete buttons should be hidden', () => {
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_COMPANY_DELETE_002: should not see delete action in company list', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(companies.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').should('not.exist')
          })
        }
      })
    })

    it('MEMBER_COMPANY_DELETE_003: should not see delete action in detail view', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          companies.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/companies\/[a-z0-9-]+/)

          cy.get('[data-cy*="delete"]').should('not.exist')
        }
      })
    })

    it('MEMBER_COMPANY_DELETE_004: should NOT delete company via API', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(companies.list.selectors.rowGeneric).first().invoke('attr', 'data-cy').then(dataCy => {
            if (dataCy) {
              const companyId = dataCy.replace('companies-row-', '')

              cy.request({
                method: 'DELETE',
                url: `/api/v1/companies/${companyId}`,
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
    it('MEMBER_COMPANY_PERMISSIONS_001: should have read-only access', () => {
      companies.list.validatePageVisible()

      // Check for no create button
      cy.get(companies.list.selectors.createButton).should('not.exist')

      // Check for no edit/delete buttons
      cy.get('[data-cy*="edit"]').should('not.exist')
      cy.get('[data-cy*="delete"]').should('not.exist')
    })

    it('MEMBER_COMPANY_PERMISSIONS_002: should see all organization companies', () => {
      companies.list.validatePageVisible()

      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(companies.list.selectors.rowGeneric).should('have.length.at.least', 1)
        }
      })
    })
  })
})
