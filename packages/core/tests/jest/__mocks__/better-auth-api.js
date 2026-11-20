/**
 * Mock for better-auth/api package
 * Resolves ES module import issues in Jest tests (a plugin's hooks are tested against a real Better Auth in the node tests)
 */

module.exports = {
  createAuthMiddleware: jest.fn(handler => handler),
}
