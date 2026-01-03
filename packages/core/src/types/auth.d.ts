/**
 * Authentication provider types
 */
export type AuthProvider = 'email' | 'google';
export type AuthProviderWithNull = AuthProvider | null;
/**
 * Error code mapping for authentication errors
 */
export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'EMAIL_NOT_VERIFIED' | 'ACCOUNT_LOCKED' | 'RATE_LIMITED' | 'OAUTH_ERROR' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'UNKNOWN_ERROR';
/**
 * Authentication error with code mapping
 */
export interface AuthError extends Error {
    code?: AuthErrorCode;
}
/**
 * Authentication method type (alias for AuthProviderWithNull for backward compatibility)
 */
export type AuthMethod = AuthProviderWithNull;
//# sourceMappingURL=auth.d.ts.map