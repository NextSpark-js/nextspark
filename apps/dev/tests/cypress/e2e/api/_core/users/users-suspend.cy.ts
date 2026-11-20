/**
 * Superadmin suspend / unsuspend
 *
 * Suspending a user signs out their sessions, deactivates their API keys and refuses them a new session; unsuspending
 * lets them sign in again (their keys stay deactivated). Nobody suspends a superadmin or themselves.
 *
 * Users: superadmin@nextspark.dev (superadmin) and developer@nextspark.dev (developer) use the password of the core sample
 * data (Pandora1234, or CYPRESS_SUPERADMIN_PASSWORD / CYPRESS_DEVELOPER_PASSWORD); sarah.davis@nextspark.dev (usr-sarah-008, member) uses Test1234
 *
 * Tags: @api, @superadmin, @permissions
 */

/// <reference types="cypress" />

describe('Superadmin - suspend users', { tags: ['@api', '@superadmin', '@permissions'] }, () => {
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:3010'
  const SUPERADMIN = 'superadmin@nextspark.dev'
  const TARGET = { id: 'usr-sarah-008', email: 'sarah.davis@nextspark.dev' }

  const passwordOf = (email: string) =>
    email === TARGET.email ? 'Test1234'
      : email === SUPERADMIN ? Cypress.env('SUPERADMIN_PASSWORD') || 'Pandora1234'
      : Cypress.env('DEVELOPER_PASSWORD') || 'Pandora1234'
  const signIn = (email: string) =>
    cy.request({ method: 'POST', url: `${BASE_URL}/api/auth/sign-in/email`, body: { email, password: passwordOf(email) }, failOnStatusCode: false })
  const action = (userId: string, body: object) =>
    cy.request({ method: 'PATCH', url: `${BASE_URL}/api/superadmin/users/${userId}`, body, failOnStatusCode: false })

  after(() => {
    cy.clearCookies()
    signIn('developer@nextspark.dev')
    action(TARGET.id, { action: 'unsuspend' })
    action(TARGET.id, { action: 'change-role', role: 'member' })
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

  // The sample data has one superadmin (the last one cannot be suspended) and one developer, so the elevated round trip
  // uses a member made a developer for the test: a suspended developer comes back as a developer (#486).
  it('SUSPEND_003: a suspended developer comes back as a developer, and only a developer brings them back', () => {
    const DEVELOPER = 'developer@nextspark.dev'
    cy.clearCookies()
    signIn(DEVELOPER).its('status').should('eq', 200)
    action(TARGET.id, { action: 'change-role', role: 'developer' }).its('status').should('eq', 200)
    action(TARGET.id, { action: 'suspend' }).its('status').should('eq', 200)

    // a superadmin cannot bring back a developer
    cy.clearCookies()
    signIn(SUPERADMIN).its('status').should('eq', 200)
    action(TARGET.id, { action: 'unsuspend' }).its('status').should('eq', 403)

    // a developer does, and the role is the one before the suspension, not member
    cy.clearCookies()
    signIn(DEVELOPER).its('status').should('eq', 200)
    action(TARGET.id, { action: 'unsuspend' }).then(response => {
      expect(response.status).to.eq(200)
      expect(response.body.role).to.eq('developer')
    })
    cy.request(`${BASE_URL}/api/superadmin/users/${TARGET.id}`).its('body.user.role').should('eq', 'developer')
    action(TARGET.id, { action: 'change-role', role: 'member' }).its('status').should('eq', 200)
  })
})
