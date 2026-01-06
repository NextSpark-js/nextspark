/**
 * Productivity Theme Configuration
 *
 * A Trello-style task management app with boards, lists, and cards.
 * Collaborative mode: owner can invite team members.
 */

import type { ThemeConfig } from '@nextsparkjs/core/types/theme'

export const productivityThemeConfig: ThemeConfig = {
  name: 'productivity',
  displayName: 'Productivity',
  version: '1.0.0',
  description: 'A collaborative task management app with boards, lists, and cards',
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

  // Modern, clean productivity aesthetic
  config: {
    colors: {
      background: 'oklch(0.98 0.005 240)',
      foreground: 'oklch(0.2 0.02 260)',
      card: 'oklch(1.0 0 0)',
      'card-foreground': 'oklch(0.2 0.02 260)',
      popover: 'oklch(1.0 0 0)',
      'popover-foreground': 'oklch(0.2 0.02 260)',
      // Blue primary for productivity focus
      primary: 'oklch(0.55 0.2 250)',
      'primary-foreground': 'oklch(1.0 0 0)',
      secondary: 'oklch(0.95 0.01 240)',
      'secondary-foreground': 'oklch(0.3 0.02 260)',
      muted: 'oklch(0.96 0.005 240)',
      'muted-foreground': 'oklch(0.45 0.015 260)',
      accent: 'oklch(0.92 0.03 200)',
      'accent-foreground': 'oklch(0.2 0.02 260)',
      destructive: 'oklch(0.55 0.22 25)',
      'destructive-foreground': 'oklch(1.0 0 0)',
      border: 'oklch(0.9 0.01 240)',
      input: 'oklch(0.9 0.01 240)',
      ring: 'oklch(0.55 0.2 250)',

      // Chart colors for analytics
      'chart-1': 'oklch(0.55 0.2 250)',
      'chart-2': 'oklch(0.6 0.18 150)',
      'chart-3': 'oklch(0.65 0.15 50)',
      'chart-4': 'oklch(0.5 0.2 300)',
      'chart-5': 'oklch(0.55 0.15 30)',

      // Sidebar - slightly tinted
      sidebar: 'oklch(0.97 0.01 250)',
      'sidebar-foreground': 'oklch(0.2 0.02 260)',
      'sidebar-primary': 'oklch(0.55 0.2 250)',
      'sidebar-primary-foreground': 'oklch(1.0 0 0)',
      'sidebar-accent': 'oklch(0.92 0.03 200)',
      'sidebar-accent-foreground': 'oklch(0.2 0.02 260)',
      'sidebar-border': 'oklch(0.9 0.01 240)',
      'sidebar-ring': 'oklch(0.55 0.2 250)'
    },

    fonts: {
      sans: 'Inter, system-ui, sans-serif',
      serif: 'Georgia, serif',
      mono: 'JetBrains Mono, monospace'
    },

    spacing: {
      radius: '0.75rem',
      'radius-sm': '0.5rem',
      'radius-md': '0.625rem',
      'radius-lg': '0.75rem',
      'radius-xl': '1rem'
    },

    shadows: {
      'shadow-2xs': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
      'shadow-xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      'shadow-sm': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      'shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      'shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      'shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      'shadow-2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)'
    }
  },

  components: {
    overrides: {},
    custom: {}
  }
}

export default productivityThemeConfig
