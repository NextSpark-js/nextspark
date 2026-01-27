import { defineConfig } from 'tsup'
import { glob } from 'glob'

export default defineConfig({
  // All source files - preserves module structure
  entry: await glob('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
  }),

  // Output format
  format: ['esm'],

  // Generate type declarations
  dts: true,

  // Source maps
  sourcemap: true,

  // Clean dist before build
  clean: true,

  // NO bundling - transpile only (preserves relative imports)
  bundle: false,

  // JSX transform
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxImportSource = 'react'
  },
})
