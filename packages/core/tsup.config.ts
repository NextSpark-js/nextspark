import { defineConfig } from 'tsup'
import { cp, readFile, writeFile, readdir, stat } from 'fs/promises'
import { join, resolve, dirname } from 'path'
import { glob } from 'glob'
import { existsSync } from 'fs'

/**
 * Fix ESM imports by adding .js extensions to relative imports
 * Required because bundle: false doesn't add extensions, but ESM requires them
 *
 * If the import points to a directory (with index.js), appends /index.js
 * If the import points to a file, appends .js
 */
async function fixEsmImports(dir: string): Promise<void> {
  const entries = await readdir(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stats = await stat(fullPath)

    if (stats.isDirectory()) {
      await fixEsmImports(fullPath)
    } else if (entry.endsWith('.js')) {
      let content = await readFile(fullPath, 'utf-8')
      const fileDir = dirname(fullPath)

      // Fix relative imports: from "./foo" or from '../foo' -> add .js or /index.js
      // Match: from "./path" or from '../path' (without extension)
      // Don't match: from "./path.js" or from "package"
      content = content.replace(
        /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
        (match, prefix, path, suffix) => {
          // Skip if already has extension
          if (path.endsWith('.js') || path.endsWith('.json') || path.endsWith('.css')) {
            return match
          }

          // Resolve the path to check if it's a directory
          const resolvedPath = resolve(fileDir, path)

          // Check if it's a directory with index.js
          if (existsSync(resolvedPath) && existsSync(join(resolvedPath, 'index.js'))) {
            return `${prefix}${path}/index.js${suffix}`
          }

          // Otherwise append .js
          return `${prefix}${path}.js${suffix}`
        }
      )

      // Also fix dynamic imports: import("./foo") -> import("./foo.js")
      content = content.replace(
        /(import\s*\(\s*['"])(\.\.?\/[^'"]+?)(['"]\s*\))/g,
        (match, prefix, path, suffix) => {
          if (path.endsWith('.js') || path.endsWith('.json') || path.endsWith('.css')) {
            return match
          }

          // Resolve the path to check if it's a directory
          const resolvedPath = resolve(fileDir, path)

          // Check if it's a directory with index.js
          if (existsSync(resolvedPath) && existsSync(join(resolvedPath, 'index.js'))) {
            return `${prefix}${path}/index.js${suffix}`
          }

          return `${prefix}${path}.js${suffix}`
        }
      )

      await writeFile(fullPath, content)
    }
  }
}

// Normalize paths to forward slashes (Windows compatibility)
const normalizePathSeparators = (paths: string[]): string[] =>
  paths.map(p => p.replace(/\\/g, '/'))

export default defineConfig({
  // Use glob to get all source files - preserves module structure
  // Note: glob on Windows returns backslashes, but tsup expects forward slashes
  entry: normalizePathSeparators(await glob('src/**/*.{ts,tsx}', {
    ignore: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      // Exclude files with duplicate names (prefer .tsx)
      'src/lib/user-data-client.ts',
      // Jest test helpers (not needed at runtime)
      'src/testing/**',
    ],
  })),

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

  // Copy non-compiled assets after build and fix ESM imports
  async onSuccess() {
    const distDir = join(process.cwd(), 'dist')

    // Fix ESM imports by adding .js extensions
    console.log('🔧 Fixing ESM imports...')
    await fixEsmImports(distDir)
    console.log('✅ ESM imports fixed')

    // Copy messages/ directory
    await cp(
      join(process.cwd(), 'src/messages'),
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
