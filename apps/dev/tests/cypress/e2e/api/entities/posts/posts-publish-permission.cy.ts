/**
 * Posts API - publish permission
 *
 * Moving a post into or out of `published` needs `posts.publish` (owner and admin in config/permissions.config.ts),
 * on top of `posts.create` / `posts.update`. A member can still write drafts and edit a published post's content.
 *
 * Test users from dev.config.ts (password: Test1234), all in Ironvale Global:
 * - Michael Brown (member), Sofia López (admin)
 *
 * Tags: @api, @feat-posts, @permissions
 */

/// <reference types="cypress" />

import * as allure from 'allure-cypress'

describe('Posts API - publish permission', {
  tags: ['@api', '@feat-posts', '@permissions']
}, () => {
  const BASE_URL = Cypress.config('baseUrl') || 'http://localhost:3010'
  const TEAM_ID = 'team-ironvale-002'
  const MEMBER = 'michael.brown@nextspark.dev'
  const ADMIN = 'sofia.lopez@nextspark.dev'
  const headers = { 'x-team-id': TEAM_ID }

  const signIn = (email: string) => {
    cy.session([email, 'Test1234'], () => {
      cy.request({ method: 'POST', url: `${BASE_URL}/api/auth/sign-in/email`, body: { email, password: 'Test1234' } })
        .its('status').should('eq', 200)
    })
  }

  const createPost = (status: string) =>
    cy.request({
      method: 'POST',
      url: `${BASE_URL}/api/v1/posts`,
      headers,
      body: { title: `Publish permission ${status} ${Date.now()}`, slug: `publish-perm-${status}-${Date.now()}`, status },
      failOnStatusCode: false
    })

  const setStatus = (id: string, status: string) =>
    cy.request({ method: 'PATCH', url: `${BASE_URL}/api/v1/posts/${id}`, headers, body: { status }, failOnStatusCode: false })

  const created: string[] = []

  beforeEach(() => {
    allure.epic('API')
    allure.feature('Posts')
    allure.story('Publish permission')
  })

  after(() => {
    signIn(ADMIN)
    created.forEach(id => cy.request({ method: 'DELETE', url: `${BASE_URL}/api/v1/posts/${id}`, headers, failOnStatusCode: false }))
  })

  it('POST_PUBLISH_001: a member cannot create a published post (403)', () => {
    signIn(MEMBER)
    createPost('published').then(response => {
      expect(response.status).to.eq(403)
      expect(response.body).to.have.property('code', 'PERMISSION_DENIED')
    })
  })

  it('POST_PUBLISH_002: a member creates a draft, cannot publish it, and can still edit it', () => {
    signIn(MEMBER)
    createPost('draft').then(response => {
      expect(response.status).to.eq(201)
      const id = response.body.data.id
      created.push(id)
      setStatus(id, 'published').its('status').should('eq', 403)
      cy.request({ method: 'PATCH', url: `${BASE_URL}/api/v1/posts/${id}`, headers, body: { title: 'Edited by the member' } })
        .its('status').should('eq', 200)
    })
  })

  it('POST_PUBLISH_003: an admin publishes; a member cannot unpublish it but can edit its content', () => {
    signIn(ADMIN)
    createPost('published').then(response => {
      expect(response.status).to.eq(201)
      const id = response.body.data.id
      created.push(id)
      signIn(MEMBER)
      setStatus(id, 'draft').its('status').should('eq', 403)
      cy.request({ method: 'PATCH', url: `${BASE_URL}/api/v1/posts/${id}`, headers, body: { excerpt: 'Edited by the member' } })
        .its('status').should('eq', 200)
      signIn(ADMIN)
      setStatus(id, 'draft').its('status').should('eq', 200)
    })
  })
})
