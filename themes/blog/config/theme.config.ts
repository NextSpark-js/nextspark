/**
 * Blog Theme Configuration
 *
 * A simple personal blog theme with single-user mode.
 * No collaboration, just a writer and their content.
 */

import type { ThemeConfig } from '@nextsparkjs/core/types/theme'

export const blogThemeConfig: ThemeConfig = {
  name: 'blog',
  displayName: 'Personal Blog',
  version: '2.0.0',
  description: 'A multi-author blog platform with single-user mode',
  author: 'NextSpark Team',

  // Teams configuration for multi-author platform with single-user mode
  teams: {
    mode: 'single-user',
    options: {
      maxTeamsPerUser: 1,
      maxMembersPerTeam: 1,
      allowLeaveAllTeams: false
    }
  },

  plugins: [],

  // Styles configuration
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

  // Google Fonts for editorial typography
  fonts: [
    { family: 'Oxanium', weights: ['400', '500', '600', '700'] },
    { family: 'Merriweather', weights: ['400', '700'], styles: ['normal', 'italic'] },
    { family: 'Fira Code', weights: ['400', '500'] }
  ],

  // Theme configuration - warm amber/orange editorial aesthetic
  config: {
    colors: {
      // Warm cream background
      background: 'oklch(0.9885 0.0057 84.5659)',
      foreground: 'oklch(0.3660 0.0251 49.6085)',
      card: 'oklch(0.9686 0.0091 78.2818)',
      'card-foreground': 'oklch(0.3660 0.0251 49.6085)',
      popover: 'oklch(0.9686 0.0091 78.2818)',
      'popover-foreground': 'oklch(0.3660 0.0251 49.6085)',
      // Warm amber primary
      primary: 'oklch(0.5553 0.1455 48.9975)',
      'primary-foreground': 'oklch(1.0000 0 0)',
      secondary: 'oklch(0.8276 0.0752 74.4400)',
      'secondary-foreground': 'oklch(0.4444 0.0096 73.6390)',
      muted: 'oklch(0.9363 0.0218 83.2637)',
      'muted-foreground': 'oklch(0.5534 0.0116 58.0708)',
      accent: 'oklch(0.9000 0.0500 74.9889)',
      'accent-foreground': 'oklch(0.4444 0.0096 73.6390)',
      destructive: 'oklch(0.4437 0.1613 26.8994)',
      'destructive-foreground': 'oklch(1.0000 0 0)',
      border: 'oklch(0.8866 0.0404 89.6994)',
      input: 'oklch(0.8866 0.0404 89.6994)',
      ring: 'oklch(0.5553 0.1455 48.9975)',

      // Chart colors
      'chart-1': 'oklch(0.5553 0.1455 48.9975)',
      'chart-2': 'oklch(0.5534 0.0116 58.0708)',
      'chart-3': 'oklch(0.5538 0.1207 66.4416)',
      'chart-4': 'oklch(0.5534 0.0116 58.0708)',
      'chart-5': 'oklch(0.6806 0.1423 75.8340)',

      // Sidebar
      sidebar: 'oklch(0.9363 0.0218 83.2637)',
      'sidebar-foreground': 'oklch(0.3660 0.0251 49.6085)',
      'sidebar-primary': 'oklch(0.5553 0.1455 48.9975)',
      'sidebar-primary-foreground': 'oklch(1.0000 0 0)',
      'sidebar-accent': 'oklch(0.5538 0.1207 66.4416)',
      'sidebar-accent-foreground': 'oklch(1.0000 0 0)',
      'sidebar-border': 'oklch(0.8866 0.0404 89.6994)',
      'sidebar-ring': 'oklch(0.5553 0.1455 48.9975)'
    },

    // Typography - Oxanium for UI, Merriweather for content
    fonts: {
      sans: 'Oxanium, sans-serif',
      serif: 'Merriweather, serif',
      mono: 'Fira Code, monospace'
    },

    // Small radius for clean look
    spacing: {
      radius: '0.3rem',
      'radius-sm': 'calc(0.3rem - 4px)',
      'radius-md': 'calc(0.3rem - 2px)',
      'radius-lg': '0.3rem',
      'radius-xl': 'calc(0.3rem + 4px)'
    },

    // Warm shadows
    breakpoints: {
      'shadow-2xs': '0px 2px 3px 0px hsl(28 18% 25% / 0.09)',
      'shadow-xs': '0px 2px 3px 0px hsl(28 18% 25% / 0.09)',
      'shadow-sm': '0px 2px 3px 0px hsl(28 18% 25% / 0.18), 0px 1px 2px -1px hsl(28 18% 25% / 0.18)',
      shadow: '0px 2px 3px 0px hsl(28 18% 25% / 0.18), 0px 1px 2px -1px hsl(28 18% 25% / 0.18)',
      'shadow-md': '0px 2px 3px 0px hsl(28 18% 25% / 0.18), 0px 2px 4px -1px hsl(28 18% 25% / 0.18)',
      'shadow-lg': '0px 2px 3px 0px hsl(28 18% 25% / 0.18), 0px 4px 6px -1px hsl(28 18% 25% / 0.18)',
      'shadow-xl': '0px 2px 3px 0px hsl(28 18% 25% / 0.18), 0px 8px 10px -1px hsl(28 18% 25% / 0.18)',
      'shadow-2xl': '0px 2px 3px 0px hsl(28 18% 25% / 0.45)'
    }
  },

  components: {
    overrides: {},
    custom: {}
  }
}

export default blogThemeConfig
