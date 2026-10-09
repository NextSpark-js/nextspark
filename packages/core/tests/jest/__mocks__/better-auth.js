/**
 * Mock for better-auth package
 * Resolves ES module import issues in Jest tests
 */

const mockAuth = {
  handler: jest.fn(),
  api: {
    getSession: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn()
  }
}

// Same constructor shape as better-call's APIError (status name, { code, message } body)
class APIError extends Error {
  constructor(status, body) {
    super(body && body.message)
    this.name = 'APIError'
    this.status = status
    this.body = body
  }
}

module.exports = {
  betterAuth: jest.fn(() => mockAuth),
  APIError,
  // Common auth functions
  ...mockAuth
}