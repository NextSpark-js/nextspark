/**
 * Mock for jose package
 * Resolves ES module import issues in Jest tests
 */

module.exports = {
  jwtVerify: jest.fn(),
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token')
  })),
  importJWK: jest.fn(),
  generateSecret: jest.fn(),
  createRemoteJWKSet: jest.fn(),
  errors: {
    JWTExpired: class JWTExpired extends Error {},
    JWTInvalid: class JWTInvalid extends Error {},
    JWTClaimValidationFailed: class JWTClaimValidationFailed extends Error {}
  }
}