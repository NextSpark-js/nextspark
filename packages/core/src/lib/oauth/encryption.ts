/**
 * OAuth Token Encryption Service
 *
 * Provides AES-256-GCM encryption for OAuth access/refresh tokens.
 * Uses Web Crypto API for secure, standards-compliant encryption.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Random IV (Initialization Vector) per encryption
 * - Key versioning for rotation support
 * - Base64 encoding for database storage
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
 */

import { EncryptedToken, OAuthError, OAuthErrorType } from './types';

/**
 * Encryption configuration
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12, // 96 bits recommended for GCM
  tagLength: 128, // 128 bits authentication tag
} as const;

/**
 * Token Encryption Service
 */
export class TokenEncryption {
  private static cachedKey: CryptoKey | null = null;
  private static currentKeyId: string = process.env.OAUTH_ENCRYPTION_KEY_ID || 'v1';

  /**
   * Get or create the encryption key from environment variable
   */
  private static async getEncryptionKey(): Promise<CryptoKey> {
    // Return cached key if available
    if (this.cachedKey) {
      return this.cachedKey;
    }

    const keyString = process.env.OAUTH_ENCRYPTION_KEY;
    if (!keyString) {
      throw new OAuthError(
        OAuthErrorType.ENCRYPTION_FAILED,
        'OAUTH_ENCRYPTION_KEY environment variable is not set'
      );
    }

    try {
      // Convert base64 key string to ArrayBuffer
      const keyData = this.base64ToBuffer(keyString);

      // Import the key for AES-GCM
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: ENCRYPTION_CONFIG.algorithm, length: ENCRYPTION_CONFIG.keyLength },
        false, // not extractable
        ['encrypt', 'decrypt']
      );

      this.cachedKey = key;
      return key;
    } catch (error) {
      throw new OAuthError(
        OAuthErrorType.ENCRYPTION_FAILED,
        'Failed to import encryption key',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate a new encryption key (for initial setup or rotation)
   * Returns a base64-encoded key suitable for environment variables
   */
  static async generateKey(): Promise<string> {
    const key = await crypto.subtle.generateKey(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    const keyData = await crypto.subtle.exportKey('raw', key);
    return this.bufferToBase64(keyData);
  }

  /**
   * Encrypt an OAuth token
   *
   * @param token - The plain text token to encrypt
   * @returns Encrypted token data with IV and key ID
   */
  static async encrypt(token: string): Promise<EncryptedToken> {
    try {
      const key = await this.getEncryptionKey();

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));

      // Encode the token
      const encoder = new TextEncoder();
      const data = encoder.encode(token);

      // Encrypt
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: ENCRYPTION_CONFIG.algorithm,
          iv: iv,
          tagLength: ENCRYPTION_CONFIG.tagLength,
        },
        key,
        data
      );

      return {
        encrypted: this.bufferToBase64(encryptedBuffer),
        iv: this.bufferToBase64(iv.buffer),
        keyId: this.currentKeyId,
      };
    } catch (error) {
      throw new OAuthError(
        OAuthErrorType.ENCRYPTION_FAILED,
        'Failed to encrypt token',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Decrypt an OAuth token
   *
   * @param encrypted - Base64-encoded encrypted data
   * @param iv - Base64-encoded initialization vector
   * @param keyId - Encryption key version ID
   * @returns Decrypted plain text token
   */
  static async decrypt(encrypted: string, iv: string, keyId: string): Promise<string> {
    try {
      // Verify key ID matches current key
      if (keyId !== this.currentKeyId) {
        console.warn(`Token encrypted with old key ID: ${keyId}, current: ${this.currentKeyId}`);
        // Note: In production, you'd want to support multiple keys for rotation
        // For now, we'll attempt decryption anyway
      }

      const key = await this.getEncryptionKey();

      // Convert from base64
      const encryptedBuffer = this.base64ToBuffer(encrypted);
      const ivBuffer = this.base64ToBuffer(iv);

      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: ENCRYPTION_CONFIG.algorithm,
          iv: ivBuffer,
          tagLength: ENCRYPTION_CONFIG.tagLength,
        },
        key,
        encryptedBuffer
      );

      // Decode to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      throw new OAuthError(
        OAuthErrorType.DECRYPTION_FAILED,
        'Failed to decrypt token',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Encrypt both access and refresh tokens
   *
   * @param accessToken - OAuth access token
   * @param refreshToken - OAuth refresh token (optional)
   * @returns Encrypted token pair
   */
  static async encryptTokenPair(
    accessToken: string,
    refreshToken?: string
  ): Promise<{
    encryptedAccessToken: EncryptedToken;
    encryptedRefreshToken?: EncryptedToken;
  }> {
    const encryptedAccessToken = await this.encrypt(accessToken);
    const encryptedRefreshToken = refreshToken
      ? await this.encrypt(refreshToken)
      : undefined;

    return {
      encryptedAccessToken,
      encryptedRefreshToken,
    };
  }

  /**
   * Decrypt both access and refresh tokens
   *
   * @param encryptedAccessToken - Encrypted access token data
   * @param encryptedRefreshToken - Encrypted refresh token data (optional)
   * @returns Decrypted token pair
   */
  static async decryptTokenPair(
    encryptedAccessToken: EncryptedToken,
    encryptedRefreshToken?: EncryptedToken
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
  }> {
    const accessToken = await this.decrypt(
      encryptedAccessToken.encrypted,
      encryptedAccessToken.iv,
      encryptedAccessToken.keyId
    );

    const refreshToken = encryptedRefreshToken
      ? await this.decrypt(
          encryptedRefreshToken.encrypted,
          encryptedRefreshToken.iv,
          encryptedRefreshToken.keyId
        )
      : undefined;

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotate encryption keys
   * This would be called during a key rotation process
   *
   * @param newKeyId - New key version ID
   * @param newKey - New encryption key (base64-encoded)
   */
  static async rotateKey(newKeyId: string, newKey: string): Promise<void> {
    // Clear cached key
    this.cachedKey = null;

    // Update environment (in production, this would update secrets manager)
    process.env.OAUTH_ENCRYPTION_KEY = newKey;
    process.env.OAUTH_ENCRYPTION_KEY_ID = newKeyId;
    this.currentKeyId = newKeyId;

    console.log(`Encryption key rotated to version: ${newKeyId}`);
  }

  /**
   * Helper: Convert ArrayBuffer to Base64
   */
  private static bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Convert Base64 to ArrayBuffer
   */
  private static base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Clear cached encryption key (for testing or key rotation)
   */
  static clearCache(): void {
    this.cachedKey = null;
  }
}
