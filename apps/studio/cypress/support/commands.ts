export {}

declare global {
  namespace Cypress {
    interface Chainable {
      mockSession(): Chainable<void>
      mockAPIs(): Chainable<void>
    }
  }
}

/**
 * Stub the Better Auth session cookie so middleware allows navigation.
 */
Cypress.Commands.add('mockSession', () => {
  cy.setCookie('better-auth.session_token', 'mock-session-token-for-e2e')
})

/**
 * Intercept common API calls with default mocked responses.
 */
Cypress.Commands.add('mockAPIs', () => {
  // Sessions list
  cy.intercept('GET', '/api/sessions*', {
    statusCode: 200,
    body: {
      sessions: [
        {
          id: 'test-session-1',
          prompt: 'Build an invoice management app',
          status: 'complete',
          project_slug: 'invoiceflow',
          result: {
            wizardConfig: { projectName: 'InvoiceFlow', projectDescription: 'Invoice management tool' },
            entities: [{ name: 'Invoice' }, { name: 'Client' }],
          },
          pages: [{ slug: 'home' }],
          error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'test-session-2',
          prompt: 'CRM for freelancers',
          status: 'pending',
          project_slug: null,
          result: null,
          pages: null,
          error: null,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    },
  }).as('getSessions')

  // Session create
  cy.intercept('POST', '/api/sessions', {
    statusCode: 201,
    body: { id: 'new-session-id', status: 'pending' },
  }).as('createSession')

  // Single session
  cy.intercept('GET', '/api/sessions/*', {
    statusCode: 200,
    body: {
      id: 'test-session-1',
      prompt: 'Build an invoice management app',
      status: 'complete',
      project_slug: 'invoiceflow',
      result: {
        wizardConfig: { projectName: 'InvoiceFlow', projectDescription: 'Invoice management tool' },
        entities: [{ name: 'Invoice' }, { name: 'Client' }],
      },
      pages: [{ slug: 'home', title: 'Home', blocks: [] }],
      chat_messages: [],
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }).as('getSession')

  // Files tree
  cy.intercept('GET', '/api/files*', {
    statusCode: 200,
    body: {
      tree: [
        { name: 'app', type: 'directory', children: [
          { name: 'page.tsx', type: 'file', children: [] },
          { name: 'layout.tsx', type: 'file', children: [] },
        ]},
        { name: 'package.json', type: 'file', children: [] },
      ],
    },
  }).as('getFiles')

  // File content
  cy.intercept('GET', '/api/file*', {
    statusCode: 200,
    body: { content: '// Sample file content\nexport default function Page() {\n  return <div>Hello</div>\n}' },
  }).as('getFile')

  // Preview
  cy.intercept('POST', '/api/preview', {
    statusCode: 200,
    body: { status: 'running', port: 5500, url: '/p/5500/' },
  }).as('preview')

  // Auth session check (Better Auth)
  cy.intercept('GET', '/api/auth/get-session', {
    statusCode: 200,
    body: { session: { id: 'mock', userId: 'user-1' }, user: { id: 'user-1', name: 'Test User', email: 'test@example.com' } },
  }).as('authSession')
})
