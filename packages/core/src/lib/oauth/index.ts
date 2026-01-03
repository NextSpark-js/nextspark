/**
 * OAuth Integration Module
 *
 * Core OAuth infrastructure for Content Buddy
 * Provides encryption, token refresh, and metadata management
 * for all OAuth providers (Facebook, Instagram, Google, etc.)
 *
 * @module core/lib/oauth
 */

// Export types
export type {
  OAuthProvider,
  ConnectionStatus,
  ProviderMetadata,
  FacebookMetadata,
  InstagramMetadata,
  GoogleMetadata,
  EncryptedToken,
  OAuthTokens,
  ConnectedAccount,
  OAuthConnectionRequest,
  TokenRefreshResult,
  ProviderConfig,
} from './types';

export { OAuthError, OAuthErrorType } from './types';

// Export services
export { TokenEncryption } from './encryption';
export { TokenRefreshService } from './token-refresh';
export { MetadataManager } from './metadata';
