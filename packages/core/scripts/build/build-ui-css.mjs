#!/usr/bin/env node
/**
 * Build UI CSS
 *
 * This script extracts all Tailwind CSS classes used in UI components
 * and generates a pre-compiled CSS file for npm distribution.
 *
 * Problem: When @nextsparkjs/core is installed via npm, the components
 * live in node_modules/ which Tailwind doesn't scan by default.
 *
 * Solution: Pre-compile all necessary utility classes during build,
 * so users just import the pre-compiled CSS.
 *
 * Usage: node scripts/build/build-ui-css.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = resolve(__dirname, '../..')

// Directories to scan for Tailwind classes
const SCAN_DIRS = [
  join(ROOT_DIR, 'src/components'),
  join(ROOT_DIR, 'src/lib'),
]

// Output paths
const DIST_STYLES_DIR = join(ROOT_DIR, 'dist/styles')
const OUTPUT_CSS = join(DIST_STYLES_DIR, 'ui.css')
const TEMP_DIR = join(ROOT_DIR, '.temp-tailwind')
const TEMP_CONTENT_FILE = join(TEMP_DIR, 'content.html')
const TEMP_CSS_INPUT = join(TEMP_DIR, 'input.css')

// Regex patterns for extracting class names
const CLASS_PATTERNS = [
  // className="..." and className='...'
  /className\s*=\s*["']([^"']+)["']/g,
  // className={`...`} template literals
  /className\s*=\s*\{`([^`]+)`\}/g,
  // cn(...) function calls - common pattern with shadcn/ui
  /cn\s*\(\s*["']([^"']+)["']/g,
  /cn\s*\(\s*[^,]*,\s*["']([^"']+)["']/g,
  // cva base classes
  /cva\s*\(\s*["']([^"']+)["']/g,
  // variants object values
  /variants\s*:\s*\{[^}]*["']([^"']+)["']/g,
  // tw` tagged template
  /tw`([^`]+)`/g,
  // clsx/classnames
  /clsx\s*\(\s*["']([^"']+)["']/g,
  /classnames\s*\(\s*["']([^"']+)["']/g,
]

// Additional classes that might be computed dynamically
const SAFELIST_CLASSES = [
  // Widths commonly used
  'w-80', 'w-72', 'w-64', 'w-56', 'w-48', 'w-40', 'w-32', 'w-full', 'w-auto',
  // Padding variations
  'p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-8',
  'px-0', 'px-1', 'px-2', 'px-3', 'px-4', 'py-0', 'py-1', 'py-2', 'py-3', 'py-4',
  // Margins
  'm-0', 'm-1', 'm-2', 'm-3', 'm-4',
  'mx-0', 'mx-1', 'mx-2', 'mx-auto', 'my-0', 'my-1', 'my-2',
  // Heights
  'h-full', 'h-auto', 'h-screen', 'h-8', 'h-9', 'h-10', 'h-11', 'h-12',
  'min-h-0', 'min-h-full', 'min-h-screen', 'max-h-96', 'max-h-[300px]', 'max-h-[400px]',
  // Overflow (critical for scrolling)
  'overflow-auto', 'overflow-hidden', 'overflow-scroll', 'overflow-visible',
  'overflow-x-auto', 'overflow-x-hidden', 'overflow-y-auto', 'overflow-y-hidden',
  // Positioning
  'relative', 'absolute', 'fixed', 'sticky',
  'top-0', 'right-0', 'bottom-0', 'left-0',
  'inset-0', 'inset-x-0', 'inset-y-0',
  // Z-index
  'z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50',
  // Flexbox
  'flex', 'flex-col', 'flex-row', 'flex-wrap', 'flex-1', 'flex-shrink-0', 'flex-grow',
  'items-start', 'items-center', 'items-end', 'items-stretch',
  'justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around',
  'gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4',
  // Grid
  'grid', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4',
  // Display
  'block', 'inline-block', 'inline', 'hidden', 'invisible', 'visible',
  // Text
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl',
  'font-normal', 'font-medium', 'font-semibold', 'font-bold',
  'text-left', 'text-center', 'text-right',
  'truncate', 'line-clamp-1', 'line-clamp-2', 'whitespace-nowrap',
  // Colors (using CSS variables)
  'bg-background', 'bg-foreground', 'bg-card', 'bg-popover', 'bg-primary', 'bg-secondary',
  'bg-muted', 'bg-accent', 'bg-destructive', 'bg-transparent',
  'text-foreground', 'text-primary', 'text-secondary', 'text-muted-foreground',
  'text-accent-foreground', 'text-destructive', 'text-popover-foreground',
  'border-border', 'border-input', 'border-primary', 'border-destructive', 'border-transparent',
  // Border
  'border', 'border-0', 'border-2', 'border-t', 'border-b', 'border-l', 'border-r',
  'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full', 'rounded-none',
  // Shadow
  'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-none',
  // Transitions
  'transition', 'transition-all', 'transition-colors', 'transition-opacity', 'transition-transform',
  'duration-75', 'duration-100', 'duration-150', 'duration-200', 'duration-300',
  // Hover states
  'hover:bg-accent', 'hover:bg-primary', 'hover:bg-secondary', 'hover:bg-muted',
  'hover:text-accent-foreground', 'hover:text-primary-foreground',
  'hover:opacity-80', 'hover:opacity-90',
  // Focus states
  'focus:outline-none', 'focus:ring-2', 'focus:ring-ring', 'focus:ring-offset-2',
  'focus-visible:outline-none', 'focus-visible:ring-2', 'focus-visible:ring-ring',
  // Disabled states
  'disabled:opacity-50', 'disabled:pointer-events-none', 'disabled:cursor-not-allowed',
  // Data states (Radix)
  'data-[state=open]:animate-in', 'data-[state=closed]:animate-out',
  'data-[state=open]:fade-in-0', 'data-[state=closed]:fade-out-0',
  'data-[state=open]:zoom-in-95', 'data-[state=closed]:zoom-out-95',
  'data-[side=bottom]:slide-in-from-top-2', 'data-[side=top]:slide-in-from-bottom-2',
  'data-[side=left]:slide-in-from-right-2', 'data-[side=right]:slide-in-from-left-2',
  // Animations
  'animate-in', 'animate-out', 'fade-in', 'fade-out', 'zoom-in', 'zoom-out',
  'slide-in-from-top', 'slide-in-from-bottom', 'slide-in-from-left', 'slide-in-from-right',
  // Ring
  'ring-offset-background', 'ring-offset-2',
  // Outline
  'outline-none', 'outline', 'outline-2',
  // Cursor
  'cursor-pointer', 'cursor-default', 'cursor-not-allowed',
  // Pointer events
  'pointer-events-none', 'pointer-events-auto',
  // Select
  'select-none', 'select-text', 'select-all',
  // Opacity
  'opacity-0', 'opacity-50', 'opacity-70', 'opacity-80', 'opacity-90', 'opacity-100',
  // Aspect ratio
  'aspect-square', 'aspect-video',
  // Object fit
  'object-cover', 'object-contain', 'object-fill',
  // Sizing
  'size-4', 'size-5', 'size-6', 'size-8', 'size-10',
  // Space
  'space-x-1', 'space-x-2', 'space-x-3', 'space-x-4',
  'space-y-1', 'space-y-2', 'space-y-3', 'space-y-4',
  // Divide
  'divide-y', 'divide-x', 'divide-border',
  // Peer/Group
  'peer', 'group', 'peer-disabled:opacity-70', 'group-hover:opacity-100',
  // SR only
  'sr-only', 'not-sr-only',
]

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js']) {
  const files = []

  if (!existsSync(dir)) {
    return files
  }

  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, extensions))
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Extract Tailwind classes from a file
 */
function extractClasses(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const classes = new Set()

  for (const pattern of CLASS_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0

    let match
    while ((match = pattern.exec(content)) !== null) {
      // Split by whitespace to get individual classes
      const classString = match[1]
      const individualClasses = classString.split(/\s+/).filter(Boolean)

      for (const cls of individualClasses) {
        // Skip template literals placeholders like ${...}
        if (!cls.includes('${') && !cls.includes('{') && cls.trim()) {
          classes.add(cls.trim())
        }
      }
    }
  }

  return classes
}

/**
 * Main build function
 */
async function buildUiCss() {
  console.log('🎨 Building UI CSS...\n')

  // 1. Collect all classes from components
  console.log('📖 Scanning components for Tailwind classes...')
  const allClasses = new Set()

  for (const dir of SCAN_DIRS) {
    const files = getAllFiles(dir)
    console.log(`   Found ${files.length} files in ${dir.replace(ROOT_DIR, '.')}`)

    for (const file of files) {
      const classes = extractClasses(file)
      for (const cls of classes) {
        allClasses.add(cls)
      }
    }
  }

  // Add safelist classes
  for (const cls of SAFELIST_CLASSES) {
    allClasses.add(cls)
  }

  console.log(`   Total unique classes found: ${allClasses.size}`)

  // 2. Create temp directory
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true })
  }
  mkdirSync(TEMP_DIR, { recursive: true })

  // 3. Create content file with all classes
  console.log('\n📝 Creating content file...')
  const classesArray = Array.from(allClasses).sort()
  const contentHtml = `<!DOCTYPE html>
<html>
<body>
  <!-- Auto-generated content for Tailwind CSS class extraction -->
  <!-- Classes: ${classesArray.length} -->
  <div class="${classesArray.join(' ')}"></div>
</body>
</html>`
  writeFileSync(TEMP_CONTENT_FILE, contentHtml)

  // 4. Create input CSS that imports Tailwind and references the content
  console.log('📄 Creating Tailwind input...')
  const inputCss = `@import "tailwindcss";

/* Source the content file to extract classes */
@source "${TEMP_CONTENT_FILE}";

/* Theme configuration (same as globals.css) */
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar-background);
  --color-sidebar-background: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
`
  writeFileSync(TEMP_CSS_INPUT, inputCss)

  // 5. Create output directory
  if (!existsSync(DIST_STYLES_DIR)) {
    mkdirSync(DIST_STYLES_DIR, { recursive: true })
  }

  // 6. Run Tailwind CLI
  console.log('\n⚙️  Running Tailwind CLI...')
  try {
    execSync(
      `pnpm exec tailwindcss -i "${TEMP_CSS_INPUT}" -o "${OUTPUT_CSS}" --minify`,
      {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      }
    )
    console.log('\n✅ Generated:', OUTPUT_CSS.replace(ROOT_DIR, '.'))

    // Show file size
    const stat = statSync(OUTPUT_CSS)
    const sizeKb = (stat.size / 1024).toFixed(2)
    console.log(`   Size: ${sizeKb} KB`)
  } catch (error) {
    console.error('\n❌ Tailwind CLI failed:', error.message)
    process.exit(1)
  }

  // 7. Cleanup temp files
  console.log('\n🧹 Cleaning up...')
  rmSync(TEMP_DIR, { recursive: true })

  // 8. Generate class manifest (for debugging)
  const manifestPath = join(DIST_STYLES_DIR, 'classes.json')
  writeFileSync(manifestPath, JSON.stringify({
    generated: new Date().toISOString(),
    totalClasses: classesArray.length,
    classes: classesArray,
  }, null, 2))
  console.log('📋 Class manifest:', manifestPath.replace(ROOT_DIR, '.'))

  console.log('\n🎉 UI CSS build complete!')
}

// Run
buildUiCss().catch(error => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})
