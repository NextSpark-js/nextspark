/**
 * AI Plugin Configuration
 *
 * Ultra-dynamic AI plugin - provides only core utilities
 * Users create their own endpoints, components, and hooks
 */

import type { PluginConfig } from '@nextsparkjs/core/types/plugin'

// Core utilities for user endpoints
import {
  selectModel,
  calculateCost,
  validatePlugin,
  extractTokens,
  handleAIError,
  COST_CONFIG
} from './lib/core-utils'

// Types are available for import: './types/ai.types'

/**
 * Ultra-dynamic AI plugin configuration
 */
export const aiPluginConfig: PluginConfig = {
  name: 'ai',
  displayName: 'AI Core Utilities',
  version: '1.0.0',
  description: 'Core AI utilities for building custom endpoints and integrations',
  enabled: true,
  dependencies: [],

  // Core API - users import these functions directly
  api: {
    selectModel,
    calculateCost,
    validatePlugin,
    extractTokens,
    handleAIError,
    COST_CONFIG
  },

  // TypeScript types available for import
  // Import from: '@/contents/plugins/ai/types/ai.types'

  // Plugin lifecycle hooks
  hooks: {
    onLoad: async () => {
      console.log('[AI Plugin] Core utilities loaded - ready for custom endpoints')
    }
  }
}

// Default export for compatibility
export default aiPluginConfig