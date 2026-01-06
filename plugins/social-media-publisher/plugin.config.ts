/**
 * Social Media Publisher Plugin Configuration
 *
 * Enables publishing to Instagram Business & Facebook Pages
 * with OAuth token management and multi-account support
 */

import type { PluginConfig } from '@nextsparkjs/core/types/plugin'

// OAuth Providers configuration (plugin-specific metadata)
const OAUTH_PROVIDERS = {
  facebook: {
    name: 'Facebook',
    authEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
    apiVersion: 'v18.0',
    scopes: {
      minimal: ['email', 'public_profile'],
      publishing: [
        'pages_show_list',
        'pages_manage_posts',
        'pages_read_engagement'
      ]
    }
  },
  instagram: {
    name: 'Instagram Business',
    authEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth', // Uses Facebook OAuth
    tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
    apiVersion: 'v18.0',
    scopes: {
      minimal: ['instagram_basic'],
      publishing: [
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights'
      ]
    }
  }
} as const

// Feature flags (plugin-specific metadata)
const PLUGIN_FEATURES = {
  multiAccountSupport: true,
  tokenAutoRefresh: true,
  auditLogging: true,
  permissionValidation: true
} as const

/**
 * Social Media Publisher Plugin Configuration
 * Follows PluginConfig interface for registry compatibility
 */
export const socialMediaPublisherPluginConfig: PluginConfig = {
  name: 'social-media-publisher',
  displayName: 'Social Media Publisher',
  version: '1.0.0',
  description: 'Publish content to Instagram Business & Facebook Pages with OAuth integration',
  enabled: true,
  dependencies: [], // No plugin dependencies (uses core OAuth infrastructure)

  // Plugin API - exports metadata for themes/plugins to use
  api: {
    providers: OAUTH_PROVIDERS,
    features: PLUGIN_FEATURES,
    entities: ['audit-logs']
  },

  // Plugin lifecycle hooks
  hooks: {
    onLoad: async () => {
      console.log('[Social Media Publisher] Plugin loaded - OAuth publishing ready')
    }
  }
}

// Default export for compatibility
export default socialMediaPublisherPluginConfig

// Type exports
export type SocialMediaPublisherConfig = typeof socialMediaPublisherPluginConfig
