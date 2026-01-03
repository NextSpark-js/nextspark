# Component Overrides

Themes can override core components to customize appearance and behavior while maintaining interface compatibility. This guide covers component override patterns, implementation, and best practices.

## Overview

Component overrides allow you to:

- Replace core UI components with theme-specific versions
- Customize component styling and behavior
- Add theme-specific features
- Maintain type safety and interface compatibility

**Override Strategy:**
1. Core provides base components (shadcn/ui)
2. Theme overrides specific components
3. Application uses theme version (if exists) or falls back to core

## Configuration

### Declaring Overrides

**Location:** `contents/themes/[theme]/theme.config.ts`

```typescript
import type { ThemeConfig } from '@/core/types/theme'

export const myThemeConfig: ThemeConfig = {
  name: 'my-theme',
  displayName: 'My Theme',
  version: '1.0.0',
  
  components: {
    overrides: {
      // Override Button component
      '@/core/components/ui/button': () =>
        import('./components/overrides/Button').then(m => m.Button),
      
      // Override Card with multiple exports
      '@/core/components/ui/card': () =>
        import('./components/overrides/Card').then(m => ({
          Card: m.Card,
          CardHeader: m.CardHeader,
          CardTitle: m.CardTitle,
          CardDescription: m.CardDescription,
          CardContent: m.CardContent,
          CardFooter: m.CardFooter
        }))
    },
    
    custom: {
      // Custom theme-specific components
      BrandLogo: () =>
        import('./components/custom/BrandLogo').then(m => m.BrandLogo),
      CustomHeader: () =>
        import('./components/custom/CustomHeader').then(m => m.CustomHeader)
    }
  }
}
```

### Dynamic Imports

All component overrides use dynamic imports for code splitting:

```typescript
// ✅ Correct - Dynamic import
'@/core/components/ui/button': () => import('./components/Button')

// ❌ Wrong - Static import
'@/core/components/ui/button': Button  // This won't work
```

**Benefits:**
- Lazy loading
- Reduced initial bundle size
- Better performance

## Overriding Components

### Example 1: Button Component

**Core Interface:**

```typescript
// core/components/ui/button.tsx
export interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Implementation
  }
)
```

**Theme Override:**

```typescript
// contents/themes/my-theme/components/overrides/Button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/core/lib/utils'

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 
          'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground',
        link:
          'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-9 rounded-md px-4',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

**Key Changes:**
- Added gradient background for `default` variant
- Enhanced hover effects (`hover:scale-105`)
- Customized border styles
- Maintained interface compatibility

### Example 2: Card Component

**Core Interface:**

```typescript
// core/components/ui/card.tsx
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  // Implementation
})

export const CardHeader, CardTitle, CardDescription, CardContent, CardFooter
// ... multiple exports
```

**Theme Override:**

```typescript
// contents/themes/my-theme/components/overrides/Card.tsx
import * as React from 'react'
import { cn } from '@/core/lib/utils'

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border border-border bg-card text-card-foreground shadow-md transition-all hover:shadow-xl hover:-translate-y-1',
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-2 p-8', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-2xl font-bold leading-none tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground leading-relaxed', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-8 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-8 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

**Key Changes:**
- Enhanced hover effects (shadow, translate)
- Gradient text for CardTitle
- Increased padding
- Rounded corners

### Example 3: Input Component

```typescript
// contents/themes/my-theme/components/overrides/Input.tsx
import * as React from 'react'
import { cn } from '@/core/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  icon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-all',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:ring-destructive',
            icon && 'pl-10',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-destructive">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
```

**Enhancements:**
- Added `error` prop for validation messages
- Added `icon` prop for input icons
- Enhanced focus states
- Error styling

## Custom Components

### Creating Theme-Specific Components

**Example: BrandLogo Component**

```typescript
// contents/themes/my-theme/components/custom/BrandLogo.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  href?: string
  showText?: boolean
}

export function BrandLogo({ 
  size = 'md', 
  href = '/',
  showText = true 
}: BrandLogoProps) {
  const { theme } = useTheme()
  
  const sizes = {
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 56, height: 56 }
  }
  
  const logo = theme === 'dark' 
    ? '/theme/brand/logo-dark.svg'
    : '/theme/brand/logo.svg'
  
  const LogoImage = (
    <div className="flex items-center gap-3">
      <Image
        src={logo}
        alt="Logo"
        width={sizes[size].width}
        height={sizes[size].height}
        priority
      />
      {showText && (
        <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          My Brand
        </span>
      )}
    </div>
  )
  
  if (href) {
    return (
      <Link href={href} className="transition-opacity hover:opacity-80">
        {LogoImage}
      </Link>
    )
  }
  
  return LogoImage
}
```

**Usage:**

```tsx
import { BrandLogo } from '@/contents/themes/my-theme/components/custom/BrandLogo'

<BrandLogo size="lg" showText={true} />
```

### Custom Header Component

```typescript
// contents/themes/my-theme/components/custom/CustomHeader.tsx
'use client'

import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from '@/core/components/app/misc/ThemeToggle'
import { Button } from '@/core/components/ui/button'
import Link from 'next/link'

export function CustomHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <BrandLogo />
        
        <nav className="flex items-center gap-6">
          <Link href="/features" className="text-sm font-medium hover:text-primary transition-colors">
            Features
          </Link>
          <Link href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">
            Pricing
          </Link>
          <Link href="/docs" className="text-sm font-medium hover:text-primary transition-colors">
            Docs
          </Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
```

## Override Precedence

### Resolution Order

When a component is imported:

```text
1. Check theme overrides (theme.config.ts)
2. If found, use theme version
3. If not found, use core version
4. If core not found, throw error
```

### Example Resolution

```typescript
// Application imports Button
import { Button } from '@/core/components/ui/button'

// System checks:
// 1. Does theme override Button? 
//    → Yes: Use theme version
// 2. No override?
//    → Use core version
```

## Interface Compatibility

### Maintaining Compatibility

Theme overrides **must maintain the core interface**:

```typescript
// ✅ Good - Same interface
export interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

// ✅ Good - Extended interface (backward compatible)
export interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'gradient'  // Added
  size?: 'default' | 'sm' | 'lg'
  loading?: boolean  // Added optional prop
}

// ❌ Bad - Breaking change
export interface ButtonProps {
  // Missing required props from core
  text: string  // Different interface
}
```

### Type Safety

TypeScript ensures interface compatibility:

```typescript
// If your override doesn't match the core interface,
// TypeScript will show an error during build
```

## Best Practices

### 1. Extend, Don't Replace

```typescript
// ✅ Good - Extends core functionality
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <CoreButton
        className={cn('enhanced-styles', className)}
        variant={variant}
        size={size}
        {...props}
        ref={ref}
      />
    )
  }
)

// ❌ Bad - Complete rewrite
const Button = ({ children }) => <button>{children}</button>
```

### 2. Maintain Accessibility

```typescript
// ✅ Good - Preserves ARIA attributes
<button
  ref={ref}
  aria-label={props['aria-label']}
  {...props}
>
  {children}
</button>
```

### 3. Use CVA for Variants

```typescript
import { cva } from 'class-variance-authority'

const buttonVariants = cva(
  'base-classes',
  {
    variants: {
      variant: {
        default: 'default-classes',
        outline: 'outline-classes'
      }
    }
  }
)
```

### 4. Document Changes

```typescript
/**
 * Custom Button Component
 * 
 * Extends core Button with:
 * - Gradient backgrounds
 * - Enhanced hover effects
 * - Loading state
 * 
 * @example
 * <Button variant="gradient" loading>Submit</Button>
 */
export const Button = // ...
```

## Testing Overrides

### Component Testing

```typescript
// tests/components/Button.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from '@/contents/themes/my-theme/components/overrides/Button'

describe('Theme Button Override', () => {
  it('renders with gradient variant', () => {
    render(<Button variant="gradient">Click me</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gradient-to-r')
  })
  
  it('maintains core interface', () => {
    render(<Button onClick={() => {}}>Click</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })
})
```

## Troubleshooting

### Override Not Loading

```bash
# Rebuild registry
pnpm build:registry

# Rebuild theme
pnpm theme:build

# Clear Next.js cache
rm -rf .next
pnpm dev
```

### Type Errors

```typescript
// Ensure interface matches core
export interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // ... props must match core
}
```

### Import Errors

```typescript
// Use dynamic imports
components: {
  overrides: {
    '@/core/components/ui/button': () =>
      import('./components/overrides/Button').then(m => m.Button)
  }
}
```

## Next Steps

1. **[Asset Management](./06-asset-management.md)** - Managing theme assets
2. **[Dark Mode Support](./07-dark-mode.md)** - Implementing dark mode
3. **[Creating Custom Themes](./09-creating-custom-themes.md)** - Complete guide

---

> 💡 **Tip**: Start by overriding a few key components (Button, Card, Input) rather than all components. This maintains consistency while adding theme personality.
