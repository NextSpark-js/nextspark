/**
 * OAuth Helper for Social Media Publishing
 *
 * Handles OAuth flow for connecting social accounts (NOT for authentication)
 * This is separate from Better Auth providers which are for user login
 *
 * Supports:
 * - Facebook OAuth (for Facebook Pages)
 * - Instagram Graph API (via Facebook Pages - requires Instagram Business Account linked to Page)
 */

// Facebook OAuth endpoints (for Facebook Page + Instagram Graph API publishing)
// Must match the Graph API version used in providers/facebook.ts
const FACEBOOK_API_VERSION = 'v21.0'
const FACEBOOK_OAUTH_URL = `https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth`
const FACEBOOK_TOKEN_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token`

export interface OAuthConfig {
  // Facebook OAuth credentials (used for both Facebook Pages and Instagram Graph API)
  facebookClientId: string
  facebookClientSecret: string
  // Shared redirect URI
  redirectUri: string
}

/**
 * Generate OAuth authorization URL for Facebook/Instagram publishing
 *
 * Both facebook_page and instagram_business use Facebook OAuth
 * Instagram Graph API requires Facebook Pages with Instagram Business Account linked
 *
 * @param platform - 'facebook_page' or 'instagram_business'
 * @param config - OAuth configuration
 * @param state - CSRF protection state (store in session)
 * @returns Authorization URL to redirect user to
 */
export function generateAuthorizationUrl(
  platform: 'facebook_page' | 'instagram_business',
  config: OAuthConfig,
  state: string
): string {
  // Both platforms use Facebook OAuth
  // instagram_business requires additional Instagram scopes
  // business_management required for pages managed via Meta Business Suite
  const scopes = [
    'pages_show_list',
    'pages_manage_posts',
    'business_management',
  ]

  // Add Instagram scopes for Instagram Graph API
  if (platform === 'instagram_business') {
    scopes.push(
      'instagram_basic',
      'instagram_content_publish'
    )
  }

  const params = new URLSearchParams({
    client_id: config.facebookClientId,
    redirect_uri: config.redirectUri,
    state,
    scope: scopes.join(','),
    response_type: 'code',
  })

  return `${FACEBOOK_OAUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 *
 * Both facebook_page and instagram_business use Facebook OAuth endpoint
 *
 * @param code - Authorization code from callback
 * @param config - OAuth configuration
 * @param platform - Platform type (both use same endpoint now)
 * @returns Access token data
 */
export async function exchangeCodeForToken(
  code: string,
  config: OAuthConfig,
  platform: 'facebook_page' | 'instagram_business'
): Promise<{
  accessToken: string
  expiresIn: number
  tokenType: string
  userId?: string
}> {
  // Both platforms use Facebook OAuth - GET with query params
  const params = new URLSearchParams({
    client_id: config.facebookClientId,
    client_secret: config.facebookClientSecret,
    redirect_uri: config.redirectUri,
    code,
  })

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Facebook token exchange failed: ${errorText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(
      `Facebook OAuth error: ${data.error.message || data.error_description || data.error}`
    )
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
    tokenType: data.token_type || 'Bearer',
  }
}

/**
 * Get OAuth configuration from environment
 *
 * Only requires Facebook credentials as Instagram Graph API uses same app
 */
export function getOAuthConfig(): OAuthConfig {
  const facebookClientId = process.env.FACEBOOK_CLIENT_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim()
  const facebookClientSecret = process.env.FACEBOOK_CLIENT_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim()
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173').trim()

  if (!facebookClientId || !facebookClientSecret) {
    throw new Error(
      'FACEBOOK_CLIENT_ID (or FACEBOOK_APP_ID) and FACEBOOK_CLIENT_SECRET (or FACEBOOK_APP_SECRET) environment variables are required'
    )
  }

  return {
    facebookClientId,
    facebookClientSecret,
    redirectUri: `${baseUrl}/api/v1/plugin/social-media-publisher/social/connect/callback`,
  }
}

/**
 * Generate secure random state for CSRF protection
 */
export function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Validate state parameter to prevent CSRF attacks
 * State should be stored in session and compared here
 *
 * @param receivedState - State from OAuth callback
 * @param sessionState - State stored in session
 * @returns true if states match
 */
export function validateState(receivedState: string, sessionState?: string): boolean {
  if (!sessionState) {
    console.warn('[oauth-helper] No session state found for validation')
    return false
  }

  return receivedState === sessionState
}
