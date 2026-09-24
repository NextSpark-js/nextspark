# Theme Asset Management

Theme assets (logos, images, fonts, icons) are served from the Next.js app's public directory. This guide covers asset organization, usage, and optimization.

## Asset Directory Structure

```text
public/
├── brand/              # Brand identity assets
│   ├── logo.svg
│   ├── logo-dark.svg
│   ├── logo-text.svg
│   ├── logo-icon.svg
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── apple-touch-icon.png
│   └── og-image.png
│
├── images/             # General theme images
│   ├── hero-bg.jpg
│   ├── feature-1.png
│   ├── feature-2.png
│   └── patterns/
│       ├── dots.svg
│       └── grid.svg
│
├── fonts/              # Custom web fonts
│   ├── custom-font.woff2
│   ├── custom-font.woff
│   ├── custom-font-bold.woff2
│   └── font-license.txt
│
└── docs/               # Documentation images
    ├── screenshot-1.png
    ├── architecture.svg
    └── tutorial/
        └── step-1.png
```

## Assets Served by the Monorepo App

### Build Process

The root `pnpm dev` and `pnpm build` commands do not run a theme asset copier. Source assets live with the theme, while the copies served by `apps/dev` live under its public directory:

```text
Source: public/
Served: apps/dev/public/theme/
```

Keep the served files in sync when adding or replacing theme assets. The application build validates references but does not copy these files.

### Destination Structure

```text
apps/dev/public/theme/
├── brand/
│   ├── logo.svg
│   └── ...
├── images/
│   ├── hero-bg.jpg
│   └── ...
├── fonts/
│   ├── custom-font.woff2
│   └── ...
└── docs/
    ├── screenshot-1.png
    └── ...
```

## Brand Assets

### Logo Files

**Standard logo files:**

| File | Purpose | Recommended Size |
|------|---------|------------------|
| `logo.svg` | Primary logo (light mode) | Vector |
| `logo-dark.svg` | Dark mode logo | Vector |
| `logo-text.svg` | Logo with text | Vector |
| `logo-icon.svg` | Icon only (square) | Vector |

**Usage:**

```tsx
import Image from 'next/image'
import { useTheme } from 'next-themes'

export function Logo() {
  const { theme } = useTheme()
  
  return (
    <Image
      src={theme === 'dark' ? '/theme/brand/logo-dark.svg' : '/theme/brand/logo.svg'}
      alt="Logo"
      width={120}
      height={40}
      priority
    />
  )
}
```

### Favicon Files

**Required favicon files:**

| File | Size | Format | Purpose |
|------|------|--------|---------|
| `favicon.ico` | 32x32 | ICO | Legacy browsers |
| `favicon.svg` | Vector | SVG | Modern browsers |
| `apple-touch-icon.png` | 180x180 | PNG | iOS home screen |

**Configuration:**

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/theme/brand/favicon.ico' },
      { url: '/theme/brand/favicon.svg', type: 'image/svg+xml' }
    ],
    apple: '/theme/brand/apple-touch-icon.png'
  }
}
```

### Social Media Images

**Open Graph image:**

| File | Size | Purpose |
|------|------|---------|
| `og-image.png` | 1200x630 | Social media previews |

**Usage:**

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  openGraph: {
    images: ['/theme/brand/og-image.png']
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/theme/brand/og-image.png']
  }
}
```

## Images

### Hero Images

**Location:** `public/images/`

**Example: Hero Background**

```tsx
// Hero component
export function Hero() {
  return (
    <section 
      className="relative h-screen bg-cover bg-center"
      style={{ backgroundImage: 'url(/theme/images/hero-bg.jpg)' }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 container">
        <h1 className="text-6xl font-bold text-white">Welcome</h1>
      </div>
    </section>
  )
}
```

### Feature Images

**Using Next.js Image:**

```tsx
import Image from 'next/image'

export function Feature() {
  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <h2>Amazing Feature</h2>
        <p>Description</p>
      </div>
      <Image
        src="/theme/images/feature-1.png"
        alt="Feature 1"
        width={600}
        height={400}
        className="rounded-lg shadow-lg"
      />
    </div>
  )
}
```

### Background Patterns

```tsx
<div 
  className="relative"
  style={{
    backgroundImage: 'url(/theme/images/patterns/dots.svg)',
    backgroundSize: '20px 20px'
  }}
>
  Content with pattern background
</div>
```

## Custom Fonts

### Font File Setup

**Font files:**

```text
public/fonts/
├── my-font-regular.woff2
├── my-font-regular.woff
├── my-font-bold.woff2
├── my-font-bold.woff
└── my-font-license.txt
```

### Loading Fonts

**Method 1: In CSS**

```css
/* styles/globals.css */

@font-face {
  font-family: 'My Custom Font';
  src: url('/theme/fonts/my-font-regular.woff2') format('woff2'),
       url('/theme/fonts/my-font-regular.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'My Custom Font';
  src: url('/theme/fonts/my-font-bold.woff2') format('woff2'),
       url('/theme/fonts/my-font-bold.woff') format('woff');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

**Method 2: Using next/font**

```typescript
// app/layout.tsx
import localFont from 'next/font/local'

const customFont = localFont({
  src: [
    {
      path: '../public/theme/fonts/my-font-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/theme/fonts/my-font-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-custom',
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={customFont.variable}>
      <body>{children}</body>
    </html>
  )
}
```

### Configuring in Theme

```typescript
// theme.config.ts
config: {
  fonts: {
    sans: 'My Custom Font, system-ui, sans-serif',
    serif: 'Georgia, serif',
    mono: 'Fira Code, monospace'
  }
}
```

### Using Custom Fonts

```tsx
<h1 className="font-sans">Uses My Custom Font</h1>
<code className="font-mono">Uses Fira Code</code>
```

## Documentation Images

### Screenshot Organization

```text
public/docs/
├── getting-started/
│   ├── step-1.png
│   ├── step-2.png
│   └── step-3.png
├── features/
│   ├── dashboard.png
│   └── analytics.png
└── architecture/
    ├── system-diagram.svg
    └── data-flow.svg
```

### Usage in Markdown

```markdown
# Getting Started

Follow these steps:

1. Install dependencies

![Installation Step](/theme/docs/getting-started/step-1.png)

2. Configure settings

![Configuration](/theme/docs/getting-started/step-2.png)
```

### Usage in Components

```tsx
import Image from 'next/image'

export function Documentation() {
  return (
    <div className="prose">
      <h2>Architecture Overview</h2>
      <Image
        src="/theme/docs/architecture/system-diagram.svg"
        alt="System Architecture"
        width={800}
        height={600}
      />
    </div>
  )
}
```

## Asset Optimization

### Image Optimization

**Recommended formats:**

| Type | Format | Quality | Use Case |
|------|--------|---------|----------|
| Photos | WebP | 80-85% | Photos, screenshots |
| Graphics | SVG | - | Logos, icons, diagrams |
| Fallback | PNG | - | Compatibility |

**Optimization tools:**

```bash
# Install optimization tools
npm install -g sharp-cli svgo

# Optimize images
npx sharp -i input.jpg -o output.webp --webp

# Optimize SVGs
npx svgo input.svg -o output.svg
```

### Font Optimization

**Best practices:**

1. **Use WOFF2** - Best compression
2. **Include WOFF** - Fallback format
3. **Subset fonts** - Include only needed characters
4. **font-display: swap** - Prevent flash of invisible text

**Subsetting example:**

```bash
# Install pyftsubset
pip install fonttools brotli

# Subset font (Latin characters only)
pyftsubset MyFont.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --output-file=MyFont-subset.woff2 \
  --flavor=woff2
```

### SVG Optimization

**SVGO configuration:**

```json
// svgo.config.json
{
  "plugins": [
    {
      "name": "preset-default",
      "params": {
        "overrides": {
          "removeViewBox": false,
          "cleanupIDs": false
        }
      }
    },
    "removeDimensions"
  ]
}
```

## Dynamic Asset Loading

### Conditional Logo Loading

```tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'

export function DynamicLogo() {
  const { theme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => setMounted(true), [])
  
  if (!mounted) return null
  
  const currentTheme = theme === 'system' ? systemTheme : theme
  const logo = currentTheme === 'dark' 
    ? '/theme/brand/logo-dark.svg'
    : '/theme/brand/logo.svg'
  
  return (
    <Image
      src={logo}
      alt="Logo"
      width={120}
      height={40}
      priority
    />
  )
}
```

### Responsive Images

```tsx
import Image from 'next/image'

export function ResponsiveHero() {
  return (
    <picture>
      <source
        media="(min-width: 1024px)"
        srcSet="/theme/images/hero-desktop.webp"
      />
      <source
        media="(min-width: 768px)"
        srcSet="/theme/images/hero-tablet.webp"
      />
      <Image
        src="/theme/images/hero-mobile.webp"
        alt="Hero"
        width={800}
        height={600}
        className="w-full h-auto"
      />
    </picture>
  )
}
```

## Asset Preloading

### Critical Assets

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link
          rel="preload"
          href="/theme/brand/logo.svg"
          as="image"
        />
        <link
          rel="preload"
          href="/theme/fonts/custom-font.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## Asset Versioning

### Cache Busting

Next.js automatically handles asset versioning, but for manual cache busting:

```tsx
// Add query parameter with theme version
<Image
  src={`/theme/brand/logo.svg?v=${process.env.NEXT_PUBLIC_THEME_VERSION}`}
  alt="Logo"
  width={120}
  height={40}
/>
```

## Best Practices

### 1. Organize by Type

```text
✅ Good structure:
public/
├── brand/
├── images/
├── fonts/
└── docs/

❌ Bad structure:
public/
├── logo.svg
├── hero.jpg
├── font.woff2
└── screenshot.png
```

### 2. Use Appropriate Formats

- **Logos**: SVG
- **Photos**: WebP with PNG fallback
- **Icons**: SVG or PNG sprites
- **Fonts**: WOFF2 with WOFF fallback

### 3. Optimize Before Adding

Optimize images and fonts with the tooling used by your team before committing them; the monorepo does not define `optimize:images` or `optimize:fonts` scripts.

### 4. Document Asset Requirements

```typescript
// assets-config.ts
export const ASSET_REQUIREMENTS = {
  logo: {
    format: 'SVG',
    maxSize: '50KB',
    dimensions: '120x40 (aspect ratio 3:1)'
  },
  ogImage: {
    format: 'PNG',
    dimensions: '1200x630',
    maxSize: '500KB'
  }
}
```

## Troubleshooting

### Assets Not Available

```bash
# Check the theme source directory
ls -la public/

# Check the app-served directory
ls -la apps/dev/public/theme/
```

### Images Not Loading

```tsx
// ✅ Correct path
<Image src="/theme/brand/logo.svg" />

// ❌ Wrong paths
<Image src="/public/brand/logo.svg" />
<Image src="theme/brand/logo.svg" />  // Missing leading slash
```

### Font Not Loading

```css
/* ✅ Correct path */
src: url('/theme/fonts/font.woff2')

/* ❌ Wrong paths */
src: url('../public/theme/fonts/font.woff2')
src: url('theme/fonts/font.woff2')
```

## Next Steps

1. **[Dark Mode Support](./07-dark-mode.md)** - Implement dark mode
2. **[Theme Registry](./08-theme-registry.md)** - Understanding the registry
3. **[Creating Custom Themes](./09-creating-custom-themes.md)** - Complete guide

---

> 💡 **Tip**: Always optimize assets before committing. Use WebP for photos and SVG for graphics to minimize bundle size.
