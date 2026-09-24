/**
 * CRM Theme Configuration
 *
 * Enterprise CRM for sales and marketing teams.
 * Single-tenant mode with differentiated permissions.
 */

import type { ThemeConfig } from '@nextsparkjs/core/types/theme'

export const crmThemeConfig: ThemeConfig = {
  name: 'crm',
  displayName: 'CRM Enterprise',
  version: '2.0.0',
  description: 'Complete CRM solution for sales and marketing teams',
  author: 'NextSpark Team',

  plugins: [],

  styles: {
    globals: 'globals.css',
    components: 'components.css',
    variables: {
      '--spacing-xs': '0.125rem',
      '--spacing-sm': '0.25rem',
      '--spacing-md': '0.5rem',
      '--spacing-lg': '1rem',
      '--spacing-xl': '1.5rem',
      '--spacing-2xl': '2rem'
    }
  },

  // Professional CRM aesthetic - Purple/Violet theme with modern typography
  config: {
    colors: {
      // Core colors - Purple/Violet Theme
      background: 'oklch(0.9940 0 0)',
      foreground: 'oklch(0 0 0)',
      card: 'oklch(0.9940 0 0)',
      'card-foreground': 'oklch(0 0 0)',
      popover: 'oklch(0.9911 0 0)',
      'popover-foreground': 'oklch(0 0 0)',
      // Purple/Violet primary for modern professional look
      primary: 'oklch(0.5393 0.2713 286.7462)',
      'primary-foreground': 'oklch(1.0000 0 0)',
      secondary: 'oklch(0.9540 0.0063 255.4755)',
      'secondary-foreground': 'oklch(0.1344 0 0)',
      muted: 'oklch(0.9702 0 0)',
      'muted-foreground': 'oklch(0.4386 0 0)',
      accent: 'oklch(0.9393 0.0288 266.3680)',
      'accent-foreground': 'oklch(0.5445 0.1903 259.4848)',
      destructive: 'oklch(0.6290 0.1902 23.0704)',
      'destructive-foreground': 'oklch(1.0000 0 0)',
      border: 'oklch(0.9300 0.0094 286.2156)',
      input: 'oklch(0.9401 0 0)',
      ring: 'oklch(0 0 0)',

      // Chart colors for analytics
      'chart-1': 'oklch(0.7459 0.1483 156.4499)',
      'chart-2': 'oklch(0.5393 0.2713 286.7462)',
      'chart-3': 'oklch(0.7336 0.1758 50.5517)',
      'chart-4': 'oklch(0.5828 0.1809 259.7276)',
      'chart-5': 'oklch(0.5590 0 0)',

      // Sidebar - light with subtle violet tint
      sidebar: 'oklch(0.9777 0.0051 247.8763)',
      'sidebar-foreground': 'oklch(0 0 0)',
      'sidebar-primary': 'oklch(0 0 0)',
      'sidebar-primary-foreground': 'oklch(1.0000 0 0)',
      'sidebar-accent': 'oklch(0.9401 0 0)',
      'sidebar-accent-foreground': 'oklch(0 0 0)',
      'sidebar-border': 'oklch(0.9401 0 0)',
      'sidebar-ring': 'oklch(0 0 0)'
    },

    fonts: {
      sans: "'Plus Jakarta Sans', system-ui, sans-serif",
      serif: "'Lora', Georgia, serif",
      mono: "'IBM Plex Mono', monospace"
    },

    spacing: {
      radius: '1.4rem',
      'radius-sm': 'calc(1.4rem - 4px)',
      'radius-md': 'calc(1.4rem - 2px)',
      'radius-lg': '1.4rem',
      'radius-xl': 'calc(1.4rem + 4px)'
    },

    shadows: {
      'shadow-2xs': '0px 2px 3px 0px hsl(0 0% 0% / 0.08)',
      'shadow-xs': '0px 2px 3px 0px hsl(0 0% 0% / 0.08)',
      'shadow-sm': '0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16)',
      shadow: '0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16)',
      'shadow-md': '0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 2px 4px -1px hsl(0 0% 0% / 0.16)',
      'shadow-lg': '0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 4px 6px -1px hsl(0 0% 0% / 0.16)',
      'shadow-xl': '0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 8px 10px -1px hsl(0 0% 0% / 0.16)',
      'shadow-2xl': '0px 2px 3px 0px hsl(0 0% 0% / 0.40)'
    },

    tracking: {
      normal: '-0.025em'
    }
  },

  components: {
    overrides: {},
    custom: {}
  }
}

export default crmThemeConfig
