/**
 * Superadmin suspend / unsuspend
 *
 * Suspending a user signs out their sessions, deactivates their API keys and refuses them a new session; unsuspending
 * lets them sign in again (their keys stay deactivated). Nobody suspends a superadmin or themselves.
 *
 * Users (password Test1234): superadmin@nextspark.dev (superadmin), sarah.davis@nextspark.dev (usr-sarah-008, member)
 *
 * Tags: @api, @superadmin, @permissions
 */

/// <reference types="cypress" />

describe('Superadmin - suspend users', { tags: ['@api', '@superadmin', '@permissions'] }, () => {
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:3010'
  const SUPERADMIN = 'superadmin@nextspark.dev'
  const TARGET = { id: 'usr-sarah-008', email: 'sarah.davis@nextspark.dev' }

  const signIn = (email: string) =>
    cy.request({ method: 'POST', url: `${BASE_URL}/api/auth/sign-in/email`, body: { email, password: 'Test1234' }, failOnStatusCode: false })
  const action = (userId: string, body: object) =>
    cy.request({ method: 'PATCH', url: `${BASE_URL}/api/superadmin/users/${userId}`, body, failOnStatusCode: false })

  after(() => {
    cy.clearCookies()
    signIn(SUPERADMIN)
    action(TARGET.id, { action: 'unsuspend' })
  })

  it('SUSPEND_001: a suspended user loses their session and cannot sign in again; unsuspending lets them back', () => {
    cy.clearCookies()
    signIn(TARGET.email).its('status').should('eq', 200)
    cy.getCookies().then(targetCookies => {
      cy.clearCookies()
      signIn(SUPERADMIN).its('status').should('eq', 200)
      action(TARGET.id, { action: 'suspend' }).then(response => {
        expect(response.status).to.eq(200)
        expect(response.body.revoked.sessions).to.be.at.least(1)
      })

      // The target's earlier cookies no longer authenticate
      cy.clearCookies()
      targetCookies.forEach(c => cy.setCookie(c.name, c.value))
      cy.request({ url: `${BASE_URL}/api/v1/users/me`, failOnStatusCode: false }).its('status').should('eq', 401)

      cy.clearCookies()
      signIn(TARGET.email).its('status').should('eq', 403)

      signIn(SUPERADMIN)
      action(TARGET.id, { action: 'unsuspend' }).its('status').should('eq', 200)
      cy.clearCookies()
      signIn(TARGET.email).its('status').should('eq', 200)
    })
  })

  it('SUSPEND_002: a superadmin cannot suspend themselves; change-role offers schema roles only', () => {
    cy.clearCookies()
    signIn(SUPERADMIN).then(response => {
      const selfId = response.body.user.id
      action(selfId, { action: 'suspend' }).its('status').should('eq', 400)
    })
    action(TARGET.id, { action: 'change-role', role: 'admin' }).its('status').should('eq', 400)
  })
})
