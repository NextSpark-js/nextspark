/**
 * API Presets for Social Accounts Endpoint
 *
 * Endpoint: GET /api/v1/plugin/social-media-publisher/social/accounts
 * Purpose: Fetch available accounts from existing OAuth tokens
 */

export const apiPresets = {
  name: 'social-accounts',
  description: 'Fetch available social media accounts using existing OAuth tokens',
  methods: ['GET'],
  auth: {
    required: true,
    type: 'dual' as const, // Session + API Key
  },
  rateLimit: {
    tier: 'read' as const,
  },
}
