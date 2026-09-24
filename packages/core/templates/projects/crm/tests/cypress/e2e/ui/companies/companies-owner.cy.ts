/// <reference types="cypress" />

/**
 * Companies CRUD - Owner Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { CompaniesPOM } from '../../../src/entities/CompaniesPOM'
import { loginAsCrmOwner } from '../../../src/session-helpers'

describe('Companies CRUD - Owner Role (Full Access)', () => {
  const companies = new CompaniesPOM()

  beforeEach(() => {
    loginAsCrmOwner()
    cy.visit('/dashboard/companies')
    companies.list.validatePageVisible()
  })

  describe('CREATE - Owner can create companies', () => {
    it('OWNER_COMPANY_CREATE_001: should create new company with required fields', () => {
      const timestamp = Date.now()
      const companyName = `Test Company ${timestamp}`

      companies.list.clickCreate()
      companies.form.validateFormVisible()

      companies.fillCompanyForm({
        name: companyName,
        industry: 'technology'
      })

      companies.submitForm()

      cy.url().should('include', '/dashboard/companies')
      cy.contains(companyName).should('be.visible')
    })

    it('OWNER_COMPANY_CREATE_002: should create company with all fields', () => {
      const timestamp = Date.now()
      const companyName = `Full Company ${timestamp}`

      companies.list.clickCreate()
      companies.form.validateFormVisible()

      companies.fillCompanyForm({
        name: companyName,
        industry: 'healthcare',
        website: 'https://example.com',
        phone: '+1-555-0123'
      })

      companies.submitForm()

      cy.url().should('include', '/dashboard/companies')
      cy.contains(companyName).should('be.visible')
    })
  })

  describe('READ - Owner can read companies', () => {
    it('OWNER_COMPANY_READ_001: should view company list', () => {
      companies.list.validatePageVisible()
      companies.list.validateTableVisible()
    })

    it('OWNER_COMPANY_READ_002: should view company details', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          companies.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/companies\/[a-z0-9-]+/)
        }
      })
    })

    it('OWNER_COMPANY_READ_003: should search companies', () => {
      companies.list.search('test')
      cy.wait(500)
      companies.list.clearSearch()
    })
  })

  describe('UPDATE - Owner can update companies', () => {
    it('OWNER_COMPANY_UPDATE_001: should edit company', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          companies.list.clickRowByIndex(0)

          cy.url().then(url => {
            const companyId = url.split('/').pop()
            companies.form.visitEdit(companyId!)
            companies.form.validateFormVisible()

            const updatedName = `Updated Company ${Date.now()}`
            companies.form.typeInField('name', updatedName)

            companies.submitForm()

            cy.url().should('include', '/dashboard/companies')
            cy.contains(updatedName).should('be.visible')
          })
        }
      })
    })

    it('OWNER_COMPANY_UPDATE_002: should update company with optional fields', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          companies.list.clickRowByIndex(0)

          cy.url().then(url => {
            const companyId = url.split('/').pop()
            companies.form.visitEdit(companyId!)
            companies.form.validateFormVisible()

            const timestamp = Date.now()
            companies.form.typeInField('website', `https://updated-${timestamp}.com`)
            companies.form.typeInField('phone', '+1-555-9999')

            companies.submitForm()

            cy.url().should('include', '/dashboard/companies')
          })
        }
      })
    })

    it('OWNER_COMPANY_UPDATE_003: should cancel update without saving', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          companies.list.clickRowByIndex(0)

          cy.url().then(url => {
            const companyId = url.split('/').pop()
            companies.form.visitEdit(companyId!)
            companies.form.validateFormVisible()

            companies.form.typeInField('name', 'ShouldNotSave')

            companies.form.cancel()
            cy.url().should('not.include', '/edit')
          })
        }
      })
    })
  })

  describe('DELETE - Owner can delete companies', () => {
    it('OWNER_COMPANY_DELETE_001: should delete company successfully', () => {
      const timestamp = Date.now()
      const companyName = `Delete Test ${timestamp}`

      companies.list.clickCreate()
      companies.fillCompanyForm({
        name: companyName,
        industry: 'technology'
      })
      companies.submitForm()

      cy.contains(companyName).should('be.visible')

      companies.list.search(companyName)

      cy.get(companies.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      companies.list.confirmDelete()

      cy.wait(1000)
      companies.list.search(companyName)
      cy.get(companies.list.selectors.emptyState).should('be.visible')
    })

    it('OWNER_COMPANY_DELETE_002: should cancel deletion', () => {
      cy.get(companies.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(companies.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').click()
          })

          companies.list.cancelDelete()
          companies.list.validateTableVisible()
        }
      })
    })
  })
})
