import { defineConfig } from 'tsup'
import { glob } from 'glob'
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, resolve } from 'path'

/**
 * Add .js extension to relative imports in ESM files
 * Required for Node.js native ESM compatibility
 */
function addJsExtensions(dir: string): void {
  const files = readdirSync(dir)
  for (const file of files) {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      addJsExtensions(filePath)
    } else if (file.endsWith('.js')) {
      let content = readFileSync(filePath, 'utf-8')
      const fileDir = dirname(filePath)

      // Add .js to relative imports that don't have extensions
      content = content.replace(
        /from\s+['"](\.[^'"]+)['"]/g,
        (match, importPath) => {
          // Skip if already has extension
          if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
            return match
          }

          // Check if the import is a directory (has index.js)
          const resolvedPath = resolve(fileDir, importPath)
          const isDirectory = existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()

          if (isDirectory) {
            // Import is a directory, add /index.js
            return `from '${importPath}/index.js'`
          }

          // Regular file import, add .js
          return `from '${importPath}.js'`
        }
      )
      writeFileSync(filePath, content)
    }
  }
}

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

  // Add .js extensions after build for Node.js ESM compatibility
  onSuccess: async () => {
    addJsExtensions('./dist')
    console.log('✅ Added .js extensions to imports')
  },
})
