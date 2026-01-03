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

module.exports = {
  betterAuth: jest.fn(() => mockAuth),
  // Common auth functions
  ...mockAuth
}