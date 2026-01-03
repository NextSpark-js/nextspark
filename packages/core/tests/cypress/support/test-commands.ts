/**
 * Custom Cypress Commands for Test Automation
 * 
 * Comandos personalizados que apoyan todos los test cases automatizados
 * usando las clases POM implementadas.
 */

import { User, UserFactory } from '../src/classes/shared'

declare global {
  namespace Cypress {
    interface Chainable {
      // Authentication commands
      login(email?: string, password?: string): Chainable<void>
      logout(): Chainable<void>
      
      // User management commands
      createTestUser(role?: string): Chainable<any>
      createTestTasks(count: number): Chainable<void>
      createTestTask(): Chainable<string>
      createTaskViaAPI(task: any): Chainable<string>
      clearAllTasks(): Chainable<void>
      
      // Mock commands
      mockEmailVerification(email: string): Chainable<void>
      verifyEmailChange(email: string): Chainable<void>
      addCommentViaAPI(taskId: string, comment: string): Chainable<void>
      updateTaskViaAPI(taskId: string, updates: any): Chainable<void>
      
      // Navigation commands
      navigateToPage(page: string): Chainable<void>
      waitForPageLoad(): Chainable<void>
      
      // Data setup commands
      setupTestData(): Chainable<void>
      cleanupTestData(): Chainable<void>
      
      // Accessibility commands
      checkA11y(): Chainable<void>
      tabToElement(selector: string): Chainable<void>
      
      // Performance commands
      measurePerformance(action: () => void): Chainable<number>
      
      // API commands
      apiRequest(method: string, endpoint: string, body?: any): Chainable<any>
    }
  }
}

// Authentication Commands
Cypress.Commands.add('login', (email?: string, password?: string) => {
  const defaultUser = UserFactory.createMember()
  const loginEmail = email || defaultUser.email
  const loginPassword = password || defaultUser.password
  
  cy.visit('/login')
  cy.get('[data-cy="login-email-input"]').type(loginEmail)
  cy.get('[data-cy="login-password-input"]').type(loginPassword)
  cy.get('[data-cy="login-submit"]').click()
  cy.url().should('include', '/dashboard')
  cy.get('[data-cy="dashboard-title"]').should('be.visible')
})

Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="user-menu"]').click()
  cy.get('[data-cy="logout-btn"]').click()
  cy.url().should('include', '/login')
})

// User Management Commands
Cypress.Commands.add('createTestUser', (role = 'member') => {
  const userData = {
    member: () => UserFactory.createMember(),
    admin: () => UserFactory.createAdmin(),
    superadmin: () => UserFactory.createSuperAdmin()
  }
  
  const user = userData[role]()
  
  cy.request({
    method: 'POST',
    url: '/api/test/users',
    body: user
  }).then((response) => {
    expect(response.status).to.eq(201)
    return cy.wrap(response.body.user)
  })
})

Cypress.Commands.add('createTestTasks', (count: number) => {
  const tasks = Array.from({ length: count }, (_, i) => ({
    title: `Test Task ${i + 1}`,
    description: `Description for test task ${i + 1}`,
    priority: ['low', 'medium', 'high'][i % 3],
    status: ['pending', 'in_progress', 'completed'][i % 3]
  }))
  
  cy.request({
    method: 'POST',
    url: '/api/test/tasks/bulk',
    body: { tasks }
  }).then((response) => {
    expect(response.status).to.eq(201)
  })
})

Cypress.Commands.add('createTestTask', () => {
  const task = {
    title: 'Test Task',
    description: 'Test task description',
    priority: 'medium',
    status: 'pending'
  }
  
  cy.request({
    method: 'POST',
    url: '/api/tasks',
    body: task
  }).then((response) => {
    expect(response.status).to.eq(201)
    return cy.wrap(response.body.task.id)
  })
})

Cypress.Commands.add('createTaskViaAPI', (task: any) => {
  cy.request({
    method: 'POST',
    url: '/api/tasks',
    body: task
  }).then((response) => {
    expect(response.status).to.eq(201)
    return cy.wrap(response.body.task.id)
  })
})

Cypress.Commands.add('clearAllTasks', () => {
  cy.request({
    method: 'DELETE',
    url: '/api/test/tasks/all'
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

// Mock Commands
Cypress.Commands.add('mockEmailVerification', (email: string) => {
  cy.request({
    method: 'POST',
    url: '/api/test/verify-email',
    body: { email }
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

Cypress.Commands.add('verifyEmailChange', (email: string) => {
  cy.request({
    method: 'POST',
    url: '/api/test/confirm-email-change',
    body: { email }
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

Cypress.Commands.add('addCommentViaAPI', (taskId: string, comment: string) => {
  cy.request({
    method: 'POST',
    url: `/api/tasks/${taskId}/comments`,
    body: { content: comment }
  }).then((response) => {
    expect(response.status).to.eq(201)
  })
})

Cypress.Commands.add('updateTaskViaAPI', (taskId: string, updates: any) => {
  cy.request({
    method: 'PUT',
    url: `/api/tasks/${taskId}`,
    body: updates
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

// Navigation Commands
Cypress.Commands.add('navigateToPage', (page: string) => {
  const routes = {
    dashboard: '/dashboard',
    tasks: '/dashboard/tasks',
    settings: '/dashboard/settings',
    profile: '/dashboard/settings/profile',
    security: '/dashboard/settings/security',
    admin: '/admin',
    users: '/admin/users',
    style: '/admin/style'
  }
  
  const route = routes[page] || page
  cy.visit(route)
  cy.waitForPageLoad()
})

Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-cy="loading"]').should('not.exist')
  cy.get('[data-cy="page-content"]').should('be.visible')
})

// Data Setup Commands
Cypress.Commands.add('setupTestData', () => {
  cy.request({
    method: 'POST',
    url: '/api/test/setup',
    body: {
      users: 10,
      tasks: 20,
      comments: 50
    }
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

Cypress.Commands.add('cleanupTestData', () => {
  cy.request({
    method: 'DELETE',
    url: '/api/test/cleanup'
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

// Accessibility Commands
Cypress.Commands.add('checkA11y', () => {
  cy.injectAxe()
  cy.checkA11y()
})

Cypress.Commands.add('tabToElement', (selector: string) => {
  cy.get('body').tab()
  cy.focused().should('match', selector)
})

// Performance Commands
Cypress.Commands.add('measurePerformance', (action: () => void) => {
  cy.window().then((win) => {
    const start = win.performance.now()
    
    action()
    
    cy.then(() => {
      const end = win.performance.now()
      const duration = end - start
      return cy.wrap(duration)
    })
  })
})

// API Commands
Cypress.Commands.add('apiRequest', (method: string, endpoint: string, body?: any) => {
  const options: any = {
    method,
    url: `/api${endpoint}`,
    headers: {
      'Content-Type': 'application/json'
    }
  }
  
  if (body) {
    options.body = body
  }
  
  // Add auth token if logged in
  cy.window().then((win) => {
    const token = win.localStorage.getItem('auth_token')
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`
    }
  })
  
  cy.request(options).then((response) => {
    return cy.wrap(response)
  })
})

// Helper functions for complex operations
const createUserWithRole = (role: string) => {
  const factories = {
    member: UserFactory.createMember,
    admin: UserFactory.createAdmin,
    superadmin: UserFactory.createSuperAdmin
  }
  
  return factories[role] ? factories[role]() : factories.member()
}

const waitForNetworkIdle = (timeout = 5000) => {
  cy.window().then((win) => {
    return new Promise((resolve) => {
      let requestCount = 0
      const originalFetch = win.fetch
      const originalXHR = win.XMLHttpRequest
      
      // Monitor fetch requests
      win.fetch = (...args) => {
        requestCount++
        return originalFetch.apply(win, args).finally(() => {
          requestCount--
          if (requestCount === 0) {
            setTimeout(resolve, 100)
          }
        })
      }
      
      // Monitor XHR requests
      const originalOpen = originalXHR.prototype.open
      originalXHR.prototype.open = function(...args) {
        requestCount++
        this.addEventListener('loadend', () => {
          requestCount--
          if (requestCount === 0) {
            setTimeout(resolve, 100)
          }
        })
        return originalOpen.apply(this, args)
      }
      
      // Timeout fallback
      setTimeout(resolve, timeout)
    })
  })
}

// Export helper functions for use in tests
export { createUserWithRole, waitForNetworkIdle }
