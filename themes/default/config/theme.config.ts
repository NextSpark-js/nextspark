/**
 * Boilerplate Theme Configuration
 *
 */

import type { ThemeConfig } from '@nextsparkjs/core/types/theme'

export const boilerplateThemeConfig: ThemeConfig = {
  name: 'default',
  displayName: 'Default',
  version: '1.0.0',
  description: 'Default neutral theme - black and white',
  author: 'NextSpark Team',

  plugins: ['langchain', 'walkme'],

  // Styles configuration - colors come from globals.css only
  styles: {
    globals: 'globals.css',
    components: 'components.css',
    variables: {
      // Custom spacing
      '--spacing-xs': '0.125rem',
      '--spacing-sm': '0.25rem',
      '--spacing-md': '0.5rem',
      '--spacing-lg': '1rem',
      '--spacing-xl': '1.5rem',
      '--spacing-2xl': '2rem'
    }
  },

  // Theme configuration - NO colors here, they come from globals.css
  config: {
    // Typography
    fonts: {
      sans: 'system-ui, -apple-system, sans-serif',
      serif: 'Georgia, serif',
      mono: 'ui-monospace, monospace'
    },

    // Border radius
    spacing: {
      radius: '0.5rem',
      'radius-sm': 'calc(0.5rem - 4px)',
      'radius-md': 'calc(0.5rem - 2px)',
      'radius-lg': '0.5rem',
      'radius-xl': 'calc(0.5rem + 4px)'
    }
  },
  
  // Component overrides and custom components
  components: {
    overrides: {
      // Override core shadcn/ui components with theme-specific versions
      // '@nextsparkjs/core/components/ui/button': () => import('../components/overrides/Button').then(m => m.Button),
      // '@nextsparkjs/core/components/ui/card': () => import('../components/overrides/Card').then(m => ({
      //   Card: m.Card,
      //   CardHeader: m.CardHeader,
      //   CardTitle: m.CardTitle,
      //   CardDescription: m.CardDescription,
      //   CardContent: m.CardContent,
      //   CardFooter: m.CardFooter
      // }))
    },
    custom: {
      // Custom theme-specific components
      // CustomHeader: () => import('../components/custom/CustomHeader').then(m => m.CustomHeader),
      // CustomFooter: () => import('../components/custom/CustomFooter').then(m => m.CustomFooter),
      // BrandLogo: () => import('../components/custom/BrandLogo').then(m => m.BrandLogo)
    }
  }
}

export default boilerplateThemeConfig