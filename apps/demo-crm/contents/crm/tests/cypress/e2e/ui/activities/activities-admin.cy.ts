/// <reference types="cypress" />

/**
 * Activities CRUD - Admin Role (Full Access)
 *
 * Uses CRM theme-specific POMs with Entity Testing Convention.
 * Selectors follow the pattern: {slug}-{component}-{detail}
 */

import { ActivitiesPOM } from '../../../src/entities/ActivitiesPOM'
import { loginAsCrmAdmin } from '../../../src/session-helpers'

describe('Activities CRUD - Admin Role (Full Access)', () => {
  const activities = new ActivitiesPOM()

  beforeEach(() => {
    loginAsCrmAdmin()
    cy.visit('/dashboard/activities')
    activities.list.validatePageVisible()
  })

  describe('CREATE - Admin can create activities', () => {
    it('ADMIN_ACTIV_CREATE_001: should create new call activity', () => {
      const timestamp = Date.now()
      const subject = `Admin Call ${timestamp}`

      activities.list.clickCreate()
      activities.form.validateFormVisible()

      activities.fillActivityForm({
        type: 'call',
        subject
      })

      activities.submitForm()

      cy.url().should('include', '/dashboard/activities')
      cy.contains(subject).should('be.visible')
    })

    it('ADMIN_ACTIV_CREATE_002: should create meeting activity with all fields', () => {
      const timestamp = Date.now()
      const subject = `Admin Meeting ${timestamp}`

      activities.list.clickCreate()
      activities.form.validateFormVisible()

      activities.fillActivityForm({
        type: 'meeting',
        subject,
        description: 'Q1 planning meeting'
      })

      activities.submitForm()

      cy.url().should('include', '/dashboard/activities')
      cy.contains(subject).should('be.visible')
    })

    it('ADMIN_ACTIV_CREATE_003: should create email activity', () => {
      const timestamp = Date.now()
      const subject = `Admin Email ${timestamp}`

      activities.list.clickCreate()
      activities.form.validateFormVisible()

      activities.fillActivityForm({
        type: 'email',
        subject
      })

      activities.submitForm()

      cy.url().should('include', '/dashboard/activities')
      cy.contains(subject).should('be.visible')
    })

    it('ADMIN_ACTIV_CREATE_004: should create task activity', () => {
      const timestamp = Date.now()
      const subject = `Admin Task ${timestamp}`

      activities.list.clickCreate()
      activities.form.validateFormVisible()

      activities.fillActivityForm({
        type: 'task',
        subject,
        description: 'Review documents'
      })

      activities.submitForm()

      cy.url().should('include', '/dashboard/activities')
      cy.contains(subject).should('be.visible')
    })

    it('ADMIN_ACTIV_CREATE_005: should validate required fields', () => {
      activities.list.clickCreate()
      activities.form.validateFormVisible()

      // Try to submit without filling required fields
      activities.submitForm()

      // Form should still be visible (validation failed)
      activities.form.validateFormVisible()
    })

    it('ADMIN_ACTIV_CREATE_006: should cancel activity creation', () => {
      activities.list.clickCreate()
      activities.form.validateFormVisible()

      activities.fillActivityForm({
        type: 'call',
        subject: 'Should not be created'
      })

      activities.form.cancel()
      cy.url().should('not.include', '/create')
    })
  })

  describe('READ - Admin can read activities', () => {
    it('ADMIN_ACTIV_READ_001: should view activity list', () => {
      activities.list.validatePageVisible()
      activities.list.validateTableVisible()
    })

    it('ADMIN_ACTIV_READ_002: should view activity details', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)
          cy.url().should('match', /\/dashboard\/activities\/[a-z0-9-]+/)
        }
      })
    })

    it('ADMIN_ACTIV_READ_003: should search activities', () => {
      activities.list.search('test')
      cy.wait(500)
      activities.list.clearSearch()
    })
  })

  describe('UPDATE - Admin can update activities', () => {
    it('ADMIN_ACTIV_UPDATE_001: should edit activity subject', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          activities.list.clickRowByIndex(0)

          cy.url().then(url => {
            const activityId = url.split('/').pop()
            activities.form.visitEdit(activityId!)
            activities.form.validateFormVisible()

            const updatedSubject = `Admin Updated ${Date.now()}`
            activities.form.typeInField('subject', updatedSubject)

            activities.submitForm()

            cy.url().should('include', '/dashboard/activities')
            cy.contains(updatedSubject).should('be.visible')
          })
        }
      })
    })

    it('ADMIN_ACTIV_UPDATE_002: should update activity type', () => {
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

    it('ADMIN_ACTIV_UPDATE_003: should cancel update without saving', () => {
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

  describe('DELETE - Admin can delete activities', () => {
    it('ADMIN_ACTIV_DELETE_001: should delete activity successfully', () => {
      const timestamp = Date.now()
      const subject = `Admin Delete Test ${timestamp}`

      activities.list.clickCreate()
      activities.fillActivityForm({
        type: 'task',
        subject
      })
      activities.submitForm()

      cy.contains(subject).should('be.visible')

      activities.list.search(subject)

      cy.get(activities.list.selectors.rowGeneric).first().within(() => {
        cy.get('[data-cy*="delete"]').click()
      })

      activities.list.confirmDelete()

      cy.wait(1000)
      activities.list.search(subject)
      cy.get(activities.list.selectors.emptyState).should('be.visible')
    })

    it('ADMIN_ACTIV_DELETE_002: should cancel deletion', () => {
      cy.get(activities.list.selectors.rowGeneric).then($rows => {
        if ($rows.length > 0) {
          cy.get(activities.list.selectors.rowGeneric).first().within(() => {
            cy.get('[data-cy*="delete"]').click()
          })

          activities.list.cancelDelete()
          activities.list.validateTableVisible()
        }
      })
    })
  })

  describe('PERMISSIONS - Admin role capabilities', () => {
    it('ADMIN_ACTIV_PERM_001: should have full CRUD access', () => {
      activities.list.validatePageVisible()

      // Check for create button
      cy.get(activities.list.selectors.createButton).should('be.visible')
    })

    it('ADMIN_ACTIV_PERM_002: should have edit access', () => {
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
  })
})
