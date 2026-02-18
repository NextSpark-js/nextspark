/**
 * WalkMe Plugin Configuration
 *
 * Guided tours and onboarding system for NextSpark applications.
 * Provides declarative tour definitions, multi-step tooltips, modals,
 * spotlights, beacons, cross-page navigation, and full persistence.
 */

import type { PluginConfig } from '@nextsparkjs/core/types/plugin'

export const walkmePluginConfig: PluginConfig = {
  name: 'walkme',
  displayName: 'WalkMe',
  version: '1.0.0',
  description: 'Guided tours and onboarding system for NextSpark applications',
  enabled: true,
  dependencies: [],
  api: {},
  hooks: {
    onLoad: async () => {
      console.log('[WalkMe Plugin] Loaded - guided tours system ready')
    },
  },
}

export default walkmePluginConfig
