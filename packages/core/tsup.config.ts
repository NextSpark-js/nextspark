import { defineConfig } from 'tsup'
import { cp } from 'fs/promises'
import { join, resolve } from 'path'
import { glob } from 'glob'

export default defineConfig({
  // Use glob to get all source files - preserves module structure
  entry: await glob('src/**/*.{ts,tsx}', {
    ignore: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      // Exclude files with duplicate names (prefer .tsx)
      'src/lib/user-data-client.ts',
    ],
  }),

  // Output format
  format: ['esm'],

  // Disable DTS for now (causes memory issues with large codebases)
  // Using ambient declarations in consuming projects instead
  dts: false,

  // Source maps for debugging
  sourcemap: false,

  // Clean dist before build
  clean: true,

  // NO bundling - transpile only, preserves module structure
  // This approach keeps relative imports intact
  bundle: false,

  // Keep registry imports external - they will be resolved by the consuming project
  external: [/^@nextspark\/registries\/.*/],

  // Use tsconfig for path resolution
  tsconfig: './tsconfig.build.json',

  // Configure esbuild for automatic JSX transform (React 17+)
  // This avoids "React is not defined" errors
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxImportSource = 'react'
  },

  // Copy non-compiled assets after build
  async onSuccess() {
    const distDir = join(process.cwd(), 'dist')

    // Copy messages/ directory
    await cp(
      join(process.cwd(), 'messages'),
      join(distDir, 'messages'),
      { recursive: true }
    ).catch(() => console.log('No messages directory to copy'))

    // Copy presets/ directory
    await cp(
      join(process.cwd(), 'presets'),
      join(distDir, 'presets'),
      { recursive: true }
    ).catch(() => console.log('No presets directory to copy'))

    // Copy templates/ directory
    await cp(
      join(process.cwd(), 'templates'),
      join(distDir, 'templates'),
      { recursive: true }
    ).catch(() => console.log('No templates directory to copy'))

    // Copy bin/ directory
    await cp(
      join(process.cwd(), 'bin'),
      join(distDir, 'bin'),
      { recursive: true }
    ).catch(() => console.log('No bin directory to copy'))

    // Copy migrations/ directory
    await cp(
      join(process.cwd(), 'migrations'),
      join(distDir, 'migrations'),
      { recursive: true }
    ).catch(() => console.log('No migrations directory to copy'))

    // Copy config/ directory
    await cp(
      join(process.cwd(), 'config'),
      join(distDir, 'config'),
      { recursive: true }
    ).catch(() => console.log('No config directory to copy'))

    // Copy registry type declarations
    await cp(
      join(process.cwd(), 'nextspark-registries.d.ts'),
      join(distDir, 'nextspark-registries.d.ts')
    ).catch(() => console.log('No registry declarations to copy'))

    console.log('✅ Assets copied successfully')
  },
})
