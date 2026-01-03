/**
 * OAuth Type Definitions
 * Common types for OAuth integration across all providers
 */

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'google' | 'facebook' | 'instagram';

/**
 * Connection status for OAuth accounts
 */
export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

/**
 * Base interface for provider-specific metadata
 */
export interface ProviderMetadata {
  [key: string]: unknown;
}

/**
 * Facebook-specific metadata
 */
export interface FacebookMetadata extends ProviderMetadata {
  pageId: string;
  pageName: string;
  pageAccessToken?: string; // If different from user token
  pageCategory?: string;
  pageProfilePictureUrl?: string;
}

/**
 * Instagram-specific metadata
 */
export interface InstagramMetadata extends ProviderMetadata {
  instagramBusinessId: string;
  instagramUsername: string;
  profilePictureUrl?: string;
  followersCount?: number;
}

/**
 * Google-specific metadata (for future Drive/Calendar integration)
 */
export interface GoogleMetadata extends ProviderMetadata {
  email: string;
  name: string;
  picture?: string;
}

/**
 * Encrypted token data structure
 */
export interface EncryptedToken {
  encrypted: string;  // Base64-encoded encrypted data
  iv: string;         // Initialization vector
  keyId: string;      // Encryption key version ID
}

/**
 * OAuth token pair
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Connected account interface (matches Better Auth account schema)
 */
export interface ConnectedAccount {
  id: string;
  accountId: string;
  providerId: OAuthProvider;
  userId: string;
  scope?: string;
  accessToken?: string;
  refreshToken?: string;
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  encryptionKeyId?: string;
  accessTokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
  metadata?: ProviderMetadata;
  connectionStatus?: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OAuth connection request
 */
export interface OAuthConnectionRequest {
  provider: OAuthProvider;
  scopes: string[];
  redirectUri?: string;
}

/**
 * OAuth token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Provider API configuration
 */
export interface ProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  revokeUrl?: string;
  scopes: {
    authentication: string[];
    publishing: string[];
  };
}

/**
 * OAuth error types
 */
export enum OAuthErrorType {
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_REVOKED = 'token_revoked',
  REFRESH_FAILED = 'refresh_failed',
  ENCRYPTION_FAILED = 'encryption_failed',
  DECRYPTION_FAILED = 'decryption_failed',
  PROVIDER_ERROR = 'provider_error',
  NETWORK_ERROR = 'network_error',
}

/**
 * OAuth error class
 */
export class OAuthError extends Error {
  constructor(
    public type: OAuthErrorType,
    message: string,
    public provider?: OAuthProvider,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}
