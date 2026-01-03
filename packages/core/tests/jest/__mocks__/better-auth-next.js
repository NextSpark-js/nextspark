/**
 * Mock for better-auth/next-js package
 * Resolves ES module import issues in Jest tests
 */

module.exports = {
  nextCookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  })),
  toNextJsHandler: jest.fn()
}