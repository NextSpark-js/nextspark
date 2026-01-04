/**
 * Starter Theme Configuration
 *
 * Theme visual configuration: colors, typography, spacing, and component overrides.
 * This file defines the look and feel of your theme.
 */

import type { ThemeConfig } from '@nextsparkjs/core/types/theme'

export const starterThemeConfig: ThemeConfig = {
  // ==========================================
  // BASIC IDENTIFICATION
  // ==========================================
  name: 'starter',
  displayName: 'Starter',
  version: '1.0.0',
  description: 'Minimal starter theme for NextSpark',
  author: 'NextSpark Team',

  // ==========================================
  // PLUGINS (Optional)
  // ==========================================
  plugins: [],

  // ==========================================
  // STYLES CONFIGURATION
  // ==========================================
  styles: {
    globals: 'globals.css',
    components: 'components.css',
    variables: {
      '--spacing-xs': '0.125rem',
      '--spacing-sm': '0.25rem',
      '--spacing-md': '0.5rem',
      '--spacing-lg': '1rem',
      '--spacing-xl': '1.5rem',
      '--spacing-2xl': '2rem',
    },
  },

  // ==========================================
  // THEME CONFIGURATION
  // ==========================================
  // Colors come from globals.css - no need to define here
  // This section is for typography and spacing overrides
  config: {
    // ------------------------------------------
    // TYPOGRAPHY
    // ------------------------------------------
    fonts: {
      sans: 'system-ui, -apple-system, sans-serif',
      serif: 'Georgia, serif',
      mono: 'ui-monospace, monospace',
    },

    // ------------------------------------------
    // SPACING (Border Radius)
    // ------------------------------------------
    spacing: {
      radius: '0.5rem',
      'radius-sm': 'calc(0.5rem - 4px)',
      'radius-md': 'calc(0.5rem - 2px)',
      'radius-lg': '0.5rem',
      'radius-xl': 'calc(0.5rem + 4px)',
    },
  },

  // ==========================================
  // COMPONENT OVERRIDES (Optional)
  // ==========================================
  components: {
    overrides: {
      // Override core shadcn/ui components with theme-specific versions:
      // '@nextsparkjs/core/components/ui/button': () => import('../components/overrides/Button').then(m => m.Button),
    },
    custom: {
      // Custom theme-specific components:
      // CustomHeader: () => import('../components/custom/CustomHeader').then(m => m.CustomHeader),
    },
  },
}

export default starterThemeConfig
