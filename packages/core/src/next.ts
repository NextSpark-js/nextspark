/**
 * NextSpark Next.js Configuration Wrapper
 *
 * Wraps Next.js config to provide NextSpark-specific defaults
 *
 * @module core/next
 */

import type { NextConfig } from 'next'

/**
 * NextSpark wrapper for Next.js configuration
 *
 * Provides necessary configuration for NextSpark to work properly,
 * including transpilePackages for npm mode and webpack customizations.
 *
 * @example
 * ```typescript
 * // next.config.ts
 * import { withNextSpark } from '@nextsparkjs/core/next'
 *
 * export default withNextSpark({
 *   // Your custom Next.js config
 * })
 * ```
 */
export function withNextSpark(userConfig: NextConfig = {}): NextConfig {
  return {
    ...userConfig,

    // Transpile NextSpark core package when installed via npm
    transpilePackages: [
      '@nextsparkjs/core',
      ...(userConfig.transpilePackages || [])
    ],

    // Configure webpack for proper resolution
    webpack: (config, options) => {
      // Future: Add any necessary webpack config here
      // Example: Alias configurations, custom loaders, etc.

      // Call user's webpack config if provided
      if (userConfig.webpack) {
        return userConfig.webpack(config, options)
      }

      return config
    },

    // Experimental features
    experimental: {
      ...userConfig.experimental,
      // Add any experimental features needed by NextSpark
    }
  }
}
