/**
 * OAuth Provider Metadata Manager
 *
 * Handles fetching and storing provider-specific metadata:
 * - Facebook: Pages, page access tokens, page info
 * - Instagram: Business accounts, usernames, profile info
 * - Google: Email, name, profile picture (for future Drive/Calendar)
 *
 * Metadata is stored in the account.metadata JSONB field
 */

import {
  OAuthProvider,
  FacebookMetadata,
  InstagramMetadata,
  GoogleMetadata,
  ProviderMetadata,
  OAuthError,
  OAuthErrorType,
} from './types';

/**
 * Provider API endpoints
 */
const PROVIDER_ENDPOINTS = {
  facebook: {
    userInfo: 'https://graph.facebook.com/v18.0/me',
    pages: 'https://graph.facebook.com/v18.0/me/accounts',
    pageInfo: (pageId: string) => `https://graph.facebook.com/v18.0/${pageId}`,
  },
  instagram: {
    userInfo: 'https://graph.facebook.com/v18.0/me',
    businessAccounts: 'https://graph.facebook.com/v18.0/me/accounts',
    instagramAccount: (pageId: string) =>
      `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account`,
    accountInfo: (igAccountId: string) =>
      `https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,profile_picture_url,followers_count`,
  },
  google: {
    userInfo: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
} as const;

/**
 * Metadata Manager
 */
export class MetadataManager {
  /**
   * Fetch metadata from provider API
   *
   * @param provider - OAuth provider
   * @param accessToken - Valid access token with appropriate scopes
   * @returns Provider-specific metadata
   */
  static async fetchMetadata(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<ProviderMetadata> {
    try {
      switch (provider) {
        case 'facebook':
          return await this.fetchFacebookMetadata(accessToken);
        case 'instagram':
          return await this.fetchInstagramMetadata(accessToken);
        case 'google':
          return await this.fetchGoogleMetadata(accessToken);
        default:
          throw new OAuthError(
            OAuthErrorType.PROVIDER_ERROR,
            `Unsupported provider: ${provider}`,
            provider
          );
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }

      throw new OAuthError(
        OAuthErrorType.PROVIDER_ERROR,
        `Failed to fetch metadata from ${provider}`,
        provider,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fetch Facebook metadata (pages, page info)
   */
  private static async fetchFacebookMetadata(
    accessToken: string
  ): Promise<FacebookMetadata> {
    try {
      // Fetch user's pages
      const pagesResponse = await fetch(
        `${PROVIDER_ENDPOINTS.facebook.pages}?access_token=${accessToken}&fields=id,name,category,access_token,picture`,
        { method: 'GET' }
      );

      if (!pagesResponse.ok) {
        throw new Error(`Facebook API error: ${pagesResponse.statusText}`);
      }

      const pagesData = await pagesResponse.json();

      // Use the first page (or let user select later)
      const firstPage = pagesData.data?.[0];
      if (!firstPage) {
        throw new Error('No Facebook pages found for this account');
      }

      return {
        pageId: firstPage.id,
        pageName: firstPage.name,
        pageAccessToken: firstPage.access_token,
        pageCategory: firstPage.category,
        pageProfilePictureUrl: firstPage.picture?.data?.url,
      };
    } catch (error) {
      throw new OAuthError(
        OAuthErrorType.PROVIDER_ERROR,
        'Failed to fetch Facebook metadata',
        'facebook',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fetch Instagram metadata (business account info)
   */
  private static async fetchInstagramMetadata(
    accessToken: string
  ): Promise<InstagramMetadata> {
    try {
      // Step 1: Get Facebook pages
      const pagesResponse = await fetch(
        `${PROVIDER_ENDPOINTS.instagram.businessAccounts}?access_token=${accessToken}`,
        { method: 'GET' }
      );

      if (!pagesResponse.ok) {
        throw new Error(`Facebook API error: ${pagesResponse.statusText}`);
      }

      const pagesData = await pagesResponse.json();
      const firstPage = pagesData.data?.[0];
      if (!firstPage) {
        throw new Error('No Facebook pages found');
      }

      // Step 2: Get Instagram Business Account linked to the page
      const igAccountResponse = await fetch(
        PROVIDER_ENDPOINTS.instagram.instagramAccount(firstPage.id) +
          `&access_token=${accessToken}`,
        { method: 'GET' }
      );

      if (!igAccountResponse.ok) {
        throw new Error(`Instagram API error: ${igAccountResponse.statusText}`);
      }

      const igAccountData = await igAccountResponse.json();
      const igBusinessAccountId = igAccountData.instagram_business_account?.id;

      if (!igBusinessAccountId) {
        throw new Error('No Instagram Business Account linked to this Facebook page');
      }

      // Step 3: Get Instagram account details
      const igInfoResponse = await fetch(
        PROVIDER_ENDPOINTS.instagram.accountInfo(igBusinessAccountId) +
          `&access_token=${accessToken}`,
        { method: 'GET' }
      );

      if (!igInfoResponse.ok) {
        throw new Error(`Instagram API error: ${igInfoResponse.statusText}`);
      }

      const igInfo = await igInfoResponse.json();

      return {
        instagramBusinessId: igInfo.id,
        instagramUsername: igInfo.username,
        profilePictureUrl: igInfo.profile_picture_url,
        followersCount: igInfo.followers_count,
      };
    } catch (error) {
      throw new OAuthError(
        OAuthErrorType.PROVIDER_ERROR,
        'Failed to fetch Instagram metadata',
        'instagram',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fetch Google metadata (basic profile info)
   */
  private static async fetchGoogleMetadata(
    accessToken: string
  ): Promise<GoogleMetadata> {
    try {
      const response = await fetch(PROVIDER_ENDPOINTS.google.userInfo, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    } catch (error) {
      throw new OAuthError(
        OAuthErrorType.PROVIDER_ERROR,
        'Failed to fetch Google metadata',
        'google',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate metadata structure
   *
   * @param provider - OAuth provider
   * @param metadata - Metadata to validate
   * @returns true if valid
   */
  static validateMetadata(provider: OAuthProvider, metadata: ProviderMetadata): boolean {
    try {
      switch (provider) {
        case 'facebook':
          const fbMeta = metadata as FacebookMetadata;
          return !!(fbMeta.pageId && fbMeta.pageName);

        case 'instagram':
          const igMeta = metadata as InstagramMetadata;
          return !!(igMeta.instagramBusinessId && igMeta.instagramUsername);

        case 'google':
          const googleMeta = metadata as GoogleMetadata;
          return !!(googleMeta.email && googleMeta.name);

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Refresh metadata (re-fetch from provider)
   *
   * @param provider - OAuth provider
   * @param accessToken - Current access token
   * @returns Updated metadata
   */
  static async refreshMetadata(
    provider: OAuthProvider,
    accessToken: string
  ): Promise<ProviderMetadata> {
    console.log(`Refreshing metadata for provider: ${provider}`);
    return await this.fetchMetadata(provider, accessToken);
  }

  /**
   * Merge existing metadata with new metadata (for partial updates)
   *
   * @param existing - Existing metadata
   * @param updates - New metadata to merge
   * @returns Merged metadata
   */
  static mergeMetadata(
    existing: ProviderMetadata,
    updates: Partial<ProviderMetadata>
  ): ProviderMetadata {
    return {
      ...existing,
      ...updates,
    };
  }

  /**
   * Extract display name from metadata (for UI)
   *
   * @param provider - OAuth provider
   * @param metadata - Provider metadata
   * @returns Display name
   */
  static getDisplayName(provider: OAuthProvider, metadata: ProviderMetadata): string {
    switch (provider) {
      case 'facebook':
        return (metadata as FacebookMetadata).pageName || 'Facebook Page';
      case 'instagram':
        return `@${(metadata as InstagramMetadata).instagramUsername || 'instagram'}`;
      case 'google':
        return (metadata as GoogleMetadata).name || (metadata as GoogleMetadata).email;
      default:
        return provider;
    }
  }

  /**
   * Extract profile picture URL from metadata (for UI)
   *
   * @param provider - OAuth provider
   * @param metadata - Provider metadata
   * @returns Profile picture URL or undefined
   */
  static getProfilePicture(
    provider: OAuthProvider,
    metadata: ProviderMetadata
  ): string | undefined {
    switch (provider) {
      case 'facebook':
        return (metadata as FacebookMetadata).pageProfilePictureUrl;
      case 'instagram':
        return (metadata as InstagramMetadata).profilePictureUrl;
      case 'google':
        return (metadata as GoogleMetadata).picture;
      default:
        return undefined;
    }
  }
}
