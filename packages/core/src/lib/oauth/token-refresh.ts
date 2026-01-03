/**
 * OAuth Token Refresh Service
 *
 * Handles automatic token refresh for OAuth providers:
 * - Detects expired or expiring tokens
 * - Refreshes tokens using provider refresh token endpoints
 * - Updates encrypted tokens in database
 * - Handles refresh failures gracefully
 *
 * Can be triggered:
 * 1. On-demand before API calls
 * 2. Via cron job for proactive refresh
 * 3. Via Next.js middleware for automatic background refresh
 */

import { Pool } from 'pg';
import { TokenEncryption } from './encryption';
import {
  OAuthProvider,
  OAuthTokens,
  TokenRefreshResult,
  OAuthError,
  OAuthErrorType,
  EncryptedToken,
  ConnectionStatus,
} from './types';

/**
 * Provider token endpoints
 */
const TOKEN_ENDPOINTS = {
  facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
  instagram: 'https://graph.facebook.com/v18.0/oauth/access_token', // Uses Facebook
  google: 'https://oauth2.googleapis.com/token',
} as const;

/**
 * Token refresh configuration
 */
const REFRESH_CONFIG = {
  // Refresh tokens when they expire within this window
  expirationWindowMinutes: 10,
  // Retry failed refreshes
  maxRetries: 3,
  retryDelayMs: 1000,
} as const;

/**
 * Database connection pool
 * Note: In production, this would use the same pool as Better Auth
 */
const databaseUrl = process.env.DATABASE_URL!;
const connectionString = databaseUrl.includes('?')
  ? `${databaseUrl}&pgbouncer=true`
  : `${databaseUrl}?pgbouncer=true`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
});

/**
 * Token Refresh Service
 */
export class TokenRefreshService {
  /**
   * Check if a token needs refresh based on expiration
   *
   * @param expiresAt - Token expiration date
   * @returns true if token needs refresh
   */
  static needsRefresh(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) {
      return false; // No expiration date, assume long-lived token
    }

    const now = new Date();
    const expirationWindow = new Date(
      now.getTime() + REFRESH_CONFIG.expirationWindowMinutes * 60 * 1000
    );

    return expiresAt <= expirationWindow;
  }

  /**
   * Refresh an OAuth token
   *
   * @param provider - OAuth provider
   * @param refreshToken - Current refresh token
   * @param clientId - OAuth client ID
   * @param clientSecret - OAuth client secret
   * @returns Refresh result with new tokens
   */
  static async refreshToken(
    provider: OAuthProvider,
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<TokenRefreshResult> {
    try {
      const endpoint = TOKEN_ENDPOINTS[provider];
      const params = this.buildRefreshParams(provider, refreshToken, clientId, clientSecret);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token refresh failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build provider-specific refresh parameters
   */
  private static buildRefreshParams(
    provider: OAuthProvider,
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Record<string, string> {
    const baseParams = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    };

    // Provider-specific parameters
    switch (provider) {
      case 'facebook':
      case 'instagram':
        return baseParams;

      case 'google':
        return baseParams;

      default:
        return baseParams;
    }
  }

  /**
   * Refresh expired tokens for a specific account
   *
   * @param accountId - Account ID from Better Auth account table
   * @returns true if refresh succeeded
   */
  static async refreshAccountTokens(accountId: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      // Fetch account data
      const accountResult = await client.query(
        `SELECT
          id,
          "providerId",
          "userId",
          "encryptedAccessToken",
          "encryptedRefreshToken",
          "encryptionKeyId",
          "accessTokenExpiresAt",
          "connectionStatus"
        FROM account
        WHERE id = $1`,
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        console.error(`Account not found: ${accountId}`);
        return false;
      }

      const account = accountResult.rows[0];
      const provider = account.providerId as OAuthProvider;

      // Check if refresh is needed
      if (!this.needsRefresh(account.accessTokenExpiresAt)) {
        console.log(`Token for account ${accountId} does not need refresh`);
        return true;
      }

      // Decrypt refresh token
      if (!account.encryptedRefreshToken) {
        console.error(`No refresh token available for account ${accountId}`);
        await this.markAccountStatus(accountId, 'expired');
        return false;
      }

      const encryptedRefreshToken: EncryptedToken = JSON.parse(
        account.encryptedRefreshToken
      );
      const refreshToken = await TokenEncryption.decrypt(
        encryptedRefreshToken.encrypted,
        encryptedRefreshToken.iv,
        encryptedRefreshToken.keyId
      );

      // Get OAuth credentials from environment
      const clientId = this.getClientId(provider);
      const clientSecret = this.getClientSecret(provider);

      if (!clientId || !clientSecret) {
        throw new OAuthError(
          OAuthErrorType.PROVIDER_ERROR,
          `Missing OAuth credentials for ${provider}`,
          provider
        );
      }

      // Refresh the token
      const refreshResult = await this.refreshToken(
        provider,
        refreshToken,
        clientId,
        clientSecret
      );

      if (!refreshResult.success) {
        console.error(`Token refresh failed for account ${accountId}: ${refreshResult.error}`);
        await this.markAccountStatus(accountId, 'expired');
        return false;
      }

      // Encrypt new tokens
      const { encryptedAccessToken, encryptedRefreshToken: newEncryptedRefreshToken } =
        await TokenEncryption.encryptTokenPair(
          refreshResult.accessToken!,
          refreshResult.refreshToken
        );

      // Update account with new tokens
      await client.query(
        `UPDATE account
        SET
          "encryptedAccessToken" = $1,
          "encryptedRefreshToken" = $2,
          "encryptionKeyId" = $3,
          "accessTokenExpiresAt" = $4,
          "connectionStatus" = 'active',
          "updatedAt" = NOW()
        WHERE id = $5`,
        [
          JSON.stringify(encryptedAccessToken),
          newEncryptedRefreshToken ? JSON.stringify(newEncryptedRefreshToken) : null,
          encryptedAccessToken.keyId,
          refreshResult.expiresAt || null,
          accountId,
        ]
      );

      console.log(`Successfully refreshed tokens for account ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error refreshing tokens for account ${accountId}:`, error);
      await this.markAccountStatus(accountId, 'error');
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Refresh expired tokens for all accounts of a user
   *
   * @param userId - User ID
   * @returns Number of accounts successfully refreshed
   */
  static async refreshUserTokens(userId: string): Promise<number> {
    const client = await pool.connect();

    try {
      // Find accounts with expired or expiring tokens
      const accountsResult = await client.query(
        `SELECT id, "accessTokenExpiresAt"
        FROM account
        WHERE "userId" = $1
        AND "encryptedRefreshToken" IS NOT NULL
        AND "connectionStatus" IN ('active', 'expired')`,
        [userId]
      );

      let refreshedCount = 0;

      for (const account of accountsResult.rows) {
        if (this.needsRefresh(account.accessTokenExpiresAt)) {
          const success = await this.refreshAccountTokens(account.id);
          if (success) {
            refreshedCount++;
          }
        }
      }

      return refreshedCount;
    } finally {
      client.release();
    }
  }

  /**
   * Refresh all expired tokens in the system (for cron job)
   *
   * @returns Number of accounts successfully refreshed
   */
  static async refreshAllExpiredTokens(): Promise<number> {
    const client = await pool.connect();

    try {
      // Find all accounts with expired or expiring tokens
      const expirationWindow = new Date(
        Date.now() + REFRESH_CONFIG.expirationWindowMinutes * 60 * 1000
      );

      const accountsResult = await client.query(
        `SELECT id
        FROM account
        WHERE "encryptedRefreshToken" IS NOT NULL
        AND "accessTokenExpiresAt" <= $1
        AND "connectionStatus" IN ('active', 'expired')`,
        [expirationWindow]
      );

      let refreshedCount = 0;

      for (const account of accountsResult.rows) {
        const success = await this.refreshAccountTokens(account.id);
        if (success) {
          refreshedCount++;
        }

        // Rate limiting: wait between refreshes to avoid overwhelming provider APIs
        await new Promise((resolve) => setTimeout(resolve, REFRESH_CONFIG.retryDelayMs));
      }

      console.log(`Refreshed ${refreshedCount} accounts out of ${accountsResult.rows.length}`);
      return refreshedCount;
    } finally {
      client.release();
    }
  }

  /**
   * Mark account connection status
   */
  private static async markAccountStatus(
    accountId: string,
    status: ConnectionStatus
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE account SET "connectionStatus" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [status, accountId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get OAuth client ID from environment
   */
  private static getClientId(provider: OAuthProvider): string | undefined {
    switch (provider) {
      case 'facebook':
        return process.env.FACEBOOK_CLIENT_ID;
      case 'instagram':
        return process.env.FACEBOOK_CLIENT_ID; // Instagram uses Facebook app
      case 'google':
        return process.env.GOOGLE_CLIENT_ID;
      default:
        return undefined;
    }
  }

  /**
   * Get OAuth client secret from environment
   */
  private static getClientSecret(provider: OAuthProvider): string | undefined {
    switch (provider) {
      case 'facebook':
        return process.env.FACEBOOK_CLIENT_SECRET;
      case 'instagram':
        return process.env.FACEBOOK_CLIENT_SECRET; // Instagram uses Facebook app
      case 'google':
        return process.env.GOOGLE_CLIENT_SECRET;
      default:
        return undefined;
    }
  }

  /**
   * Get decrypted access token for an account (refreshes if needed)
   *
   * @param accountId - Account ID
   * @returns Decrypted access token
   */
  static async getAccessToken(accountId: string): Promise<string> {
    // Check if refresh is needed
    const needsRefresh = await this.checkAndRefreshIfNeeded(accountId);

    if (!needsRefresh) {
      throw new OAuthError(
        OAuthErrorType.TOKEN_EXPIRED,
        'Token refresh failed',
        undefined
      );
    }

    // Fetch and decrypt token
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT "encryptedAccessToken", "encryptionKeyId" FROM account WHERE id = $1`,
        [accountId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Account not found: ${accountId}`);
      }

      const encryptedToken: EncryptedToken = JSON.parse(result.rows[0].encryptedAccessToken);
      return await TokenEncryption.decrypt(
        encryptedToken.encrypted,
        encryptedToken.iv,
        encryptedToken.keyId
      );
    } finally {
      client.release();
    }
  }

  /**
   * Check if account needs refresh and refresh if necessary
   */
  private static async checkAndRefreshIfNeeded(accountId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT "accessTokenExpiresAt" FROM account WHERE id = $1`,
        [accountId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const expiresAt = result.rows[0].accessTokenExpiresAt;

      if (this.needsRefresh(expiresAt)) {
        return await this.refreshAccountTokens(accountId);
      }

      return true;
    } finally {
      client.release();
    }
  }
}
