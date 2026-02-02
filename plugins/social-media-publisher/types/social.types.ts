/**
 * Social Media Publisher - TypeScript Types
 *
 * These types are designed to be theme-agnostic and extensible.
 * The plugin currently implements Meta (Facebook/Instagram) providers,
 * but the type system supports additional platforms for future expansion.
 */

// ============================================
// PLATFORM TYPES
// ============================================

/**
 * All supported social media platforms.
 * Aligned with the database CHECK constraint in migrations.
 */
export const SUPPORTED_PLATFORMS = [
  'instagram_business',
  'facebook_page',
  'twitter',
  'linkedin',
  'youtube',
  'tiktok',
  'pinterest',
  'snapchat',
  'threads',
  'bluesky',
  'mastodon',
  'other',
] as const

export type SocialPlatform = typeof SUPPORTED_PLATFORMS[number]

/**
 * Platforms that currently have implemented providers.
 * Use this for UI dropdowns where only working platforms should be shown.
 */
export const IMPLEMENTED_PLATFORMS = [
  'instagram_business',
  'facebook_page',
] as const

export type ImplementedPlatform = typeof IMPLEMENTED_PLATFORMS[number]

/**
 * Platforms that require an image for posting.
 * Text-only posts are not allowed on these platforms.
 */
export const IMAGE_REQUIRED_PLATFORMS: SocialPlatform[] = [
  'instagram_business',
  'tiktok',
  'pinterest',
  'snapchat',
]

export type FacebookScope =
  | 'email'
  | 'public_profile'
  | 'pages_show_list'
  | 'pages_manage_posts'
  | 'pages_read_engagement'
  | 'read_insights'

export type InstagramScope =
  | 'instagram_business_basic'
  | 'instagram_business_content_publish'
  | 'instagram_manage_insights'

export type OAuthScope = FacebookScope | InstagramScope

// ============================================
// ACCOUNT TYPES
// ============================================

export interface SocialAccount {
  id: string
  userId: string
  platform: SocialPlatform
  platformAccountId: string
  username: string
  accessToken: string // Encrypted
  tokenExpiresAt: Date
  permissions: OAuthScope[]
  accountMetadata: SocialAccountMetadata
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SocialAccountMetadata {
  profilePictureUrl?: string
  followersCount?: number
  postsCount?: number
  lastSyncAt?: string
  additionalData?: Record<string, unknown>
}

// ============================================
// OAUTH TYPES
// ============================================

export interface OAuthCallbackParams {
  code: string
  state: string
  error?: string
  error_description?: string
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

export interface FacebookPageInfo {
  id: string
  name: string
  category: string
  access_token: string
  tasks: string[]
}

export interface InstagramBusinessAccount {
  id: string
  username: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
}

// ============================================
// PUBLISHING TYPES
// ============================================

export interface PublishRequest {
  accountId: string
  content: PublishContent
}

export interface PublishContent {
  // Common fields
  caption?: string

  // Media
  imageUrl?: string
  videoUrl?: string

  // Scheduling
  scheduledAt?: Date

  // Platform-specific
  platformOptions?: Record<string, unknown>
}

export interface PublishResult {
  success: boolean
  platform: SocialPlatform
  postId?: string
  postUrl?: string
  error?: string
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export type AuditAction =
  | 'account_connected'
  | 'account_disconnected'
  | 'post_published'
  | 'post_failed'
  | 'token_refreshed'
  | 'token_refresh_failed'

export interface AuditLog {
  id: string
  userId: string
  accountId?: string
  action: AuditAction
  details: AuditLogDetails
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface AuditLogDetails {
  platform?: SocialPlatform
  success: boolean
  errorMessage?: string
  metadata?: Record<string, unknown>
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ConnectAccountResponse {
  success: boolean
  account?: SocialAccount
  error?: string
}

export interface DisconnectAccountResponse {
  success: boolean
  accountId: string
  message?: string
}

export interface GetAccountsResponse {
  success: boolean
  accounts: SocialAccount[]
  total: number
}
