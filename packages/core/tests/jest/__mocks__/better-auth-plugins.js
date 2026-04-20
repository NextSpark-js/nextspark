/**
 * Mock for better-auth/plugins package
 * Resolves ES module import issues in Jest tests (rou3 ESM-only dependency)
 */

module.exports = {
  emailOTP: jest.fn(() => ({})),
  twoFactor: jest.fn(() => ({})),
  magicLink: jest.fn(() => ({})),
  passkey: jest.fn(() => ({})),
  anonymous: jest.fn(() => ({})),
  username: jest.fn(() => ({})),
  phoneNumber: jest.fn(() => ({})),
  admin: jest.fn(() => ({})),
  organization: jest.fn(() => ({})),
  multiSession: jest.fn(() => ({})),
}
