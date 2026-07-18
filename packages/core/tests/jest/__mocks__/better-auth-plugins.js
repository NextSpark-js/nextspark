/**
 * Mock for better-auth/plugins package
 * Resolves ES module import issues in Jest tests
 */

module.exports = {
  emailOTP: jest.fn(() => ({})),
}
