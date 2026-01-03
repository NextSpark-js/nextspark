# Dark Mode Support

The theme system includes comprehensive dark mode support with next-themes integration, system preference detection, and user preference persistence.

## Overview

Dark mode features:

- **Automatic detection** - Respects system preferences
- **Manual toggle** - User-controlled theme switching
- **Persistence** - Preferences saved to localStorage and user profile
- **Zero flicker** - Prevents flash of unstyled content (FOUC)
- **CSS Variables** - Seamless color scheme switching

## Architecture

### next-themes Integration

The application uses `next-themes` for dark mode management:

```text
next-themes Provider
  ↓
ThemeProvider (core/providers/theme-provider.tsx)
  ↓
Application Components
  ↓
CSS Variables (.dark class applied to <html>)
```

## Setup

### Provider Configuration

**Location:** `app/layout.tsx`

```typescript
import { ThemeProvider as NextThemeProvider } from '@/core/providers/theme-provider'

export default async function RootLayout({ children }) {
  const defaultTheme = await getDefaultThemeMode()
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NextThemeProvider
          attribute="class"
          defaultTheme={defaultTheme}
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </NextThemeProvider>
      </body>
    </html>
  )
}
```

**Provider Props:**

| Prop | Value | Purpose |
|------|-------|---------|
| `attribute` | `"class"` | Use `.dark` class for styling |
| `defaultTheme` | `"light"` \| `"dark"` \| `"system"` | Initial theme |
| `enableSystem` | `true` | Detect system preference |
| `disableTransitionOnChange` | `true` | Prevent jarring animations |

### Preventing FOUC

**`suppressHydrationWarning` attribute:**

```tsx
<html lang="en" suppressHydrationWarning>
```

**Purpose:** Prevents React hydration warnings when next-themes modifies the DOM before React loads.

## CSS Variable Strategy

### Light Mode Variables

```css
/* contents/themes/my-theme/styles/globals.css */

:root {
  /* Background & Foreground */
  --background: 0 0% 100%;          /* White */
  --foreground: 240 10% 3.9%;       /* Near black */
  
  /* Primary */
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  
  /* Secondary */
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  
  /* ... more variables */
}
```

### Dark Mode Overrides

```css
.dark {
  /* Background & Foreground (inverted) */
  --background: 240 10% 3.9%;       /* Dark gray */
  --foreground: 0 0% 98%;           /* Off white */
  
  /* Primary (adjusted) */
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  
  /* Secondary (darkened) */
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  
  /* ... more dark mode variables */
}
```

### How It Works

```tsx
// Component uses CSS variables
<div className="bg-background text-foreground">
  Content
</div>

// Light mode: bg-background resolves to white
// Dark mode: .dark class applied, bg-background resolves to dark gray
```

## Theme Toggle Component

### Using the Theme Toggle

**Location:** `core/components/app/misc/ThemeToggle.tsx`

```tsx
import { ThemeToggle } from '@/core/components/app/misc/ThemeToggle'

export function Header() {
  return (
    <header>
      <nav>
        {/* Other navigation items */}
        <ThemeToggle />
      </nav>
    </header>
  )
}
```

### ThemeToggle Implementation

```typescript
'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/core/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Sun className="h-5 w-5" />
      </Button>
    )
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Key Features:**
- Icon animation on theme change
- Three modes: light, dark, system
- Dropdown menu interface
- Accessible with keyboard navigation

## System Preference Detection

### How It Works

When `enableSystem` is true:

```text
1. Check localStorage for saved preference
2. If no preference, detect system theme
3. Listen for system theme changes
4. Update theme automatically
```

**Media Query:**

```javascript
// Automatically handled by next-themes
window.matchMedia('(prefers-color-scheme: dark)')
```

### User Experience

| User Setting | System Setting | Result |
|--------------|----------------|--------|
| Light | Dark | Light (user preference wins) |
| Dark | Light | Dark (user preference wins) |
| System | Dark | Dark (follows system) |
| System | Light | Light (follows system) |

## Persistence

### localStorage

Theme preference is automatically saved to `localStorage`:

```javascript
// Automatically saved by next-themes
localStorage.setItem('theme', 'dark')
```

**Key:** `theme`  
**Values:** `'light'`, `'dark'`, `'system'`

### User Profile

For logged-in users, theme preference is also saved to their profile:

```typescript
// Handled by ThemeToggle component
async function handleThemeChange(newTheme: string) {
  setTheme(newTheme)
  
  if (user?.id) {
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meta: {
          uiPreferences: {
            theme: newTheme
          }
        }
      }),
    })
  }
}
```

**Benefit:** Theme preference syncs across devices for logged-in users.

## Default Theme Mode

### Server-Side Detection

**Function:** `getDefaultThemeMode()`

**Location:** `core/lib/theme/get-default-theme-mode.ts`

```typescript
export async function getDefaultThemeMode(): Promise<ThemeMode> {
  // 1. Check user preference (logged in users)
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (session?.user?.id) {
    const profile = await getUserProfile(session.user.id)
    if (profile.meta?.uiPreferences?.theme) {
      return profile.meta.uiPreferences.theme
    }
  }
  
  // 2. Fallback to theme config
  const themeConfig = getTheme(process.env.NEXT_PUBLIC_ACTIVE_THEME)
  return themeConfig?.defaultMode || 'system'
}
```

**Priority:**
1. User preference (from profile metadata)
2. Theme config `defaultMode`
3. Fallback to `'system'`

## useTheme Hook

### Using the Hook

```tsx
'use client'

import { useTheme } from 'next-themes'

export function MyComponent() {
  const { theme, setTheme, systemTheme } = useTheme()
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <p>System theme: {systemTheme}</p>
      <button onClick={() => setTheme('dark')}>
        Switch to Dark
      </button>
    </div>
  )
}
```

### Hook API

| Property | Type | Description |
|----------|------|-------------|
| `theme` | `string` | Current theme (`'light'`, `'dark'`, `'system'`) |
| `setTheme` | `function` | Change theme |
| `systemTheme` | `string` | System preference (`'light'` or `'dark'`) |
| `themes` | `string[]` | Available themes |
| `resolvedTheme` | `string` | Actual theme applied (`'light'` or `'dark'`) |

## Styling for Dark Mode

### Tailwind Dark Mode Classes

```tsx
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  Content adapts to dark mode
</div>
```

### Using CSS Variables (Recommended)

```tsx
<div className="bg-background text-foreground">
  Automatically adapts via CSS variables
</div>
```

**Why CSS variables are better:**
- Single source of truth
- Easier theme customization
- No class duplication
- Better maintainability

### Custom Dark Mode Styles

```css
/* Component-specific dark mode */
.my-component {
  background-color: hsl(var(--background));
}

.dark .my-component {
  border: 2px solid hsl(var(--primary));
}
```

## Testing Dark Mode

### Manual Testing

```tsx
// Add test buttons in development
'use client'

import { useTheme } from 'next-themes'

export function ThemeDebugger() {
  const { theme, systemTheme, resolvedTheme } = useTheme()
  
  return (
    <div className="fixed bottom-4 right-4 p-4 bg-card border rounded-lg">
      <p>Theme: {theme}</p>
      <p>System: {systemTheme}</p>
      <p>Resolved: {resolvedTheme}</p>
    </div>
  )
}
```

### Automated Testing

```typescript
// tests/dark-mode.test.tsx
import { render } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'

describe('Dark Mode', () => {
  it('applies dark class when theme is dark', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <div data-testid="content" className="bg-background">
          Content
        </div>
      </ThemeProvider>
    )
    
    expect(document.documentElement).toHaveClass('dark')
  })
})
```

## Common Patterns

### Conditional Rendering

```tsx
'use client'

import { useTheme } from 'next-themes'

export function ThemedImage() {
  const { theme } = useTheme()
  
  return (
    <img
      src={theme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'}
      alt="Logo"
    />
  )
}
```

### Dynamic Styles

```tsx
'use client'

import { useTheme } from 'next-themes'

export function ThemedComponent() {
  const { resolvedTheme } = useTheme()
  
  const backgroundColor = resolvedTheme === 'dark' 
    ? '#1a1a1a' 
    : '#ffffff'
  
  return (
    <div style={{ backgroundColor }}>
      Content
    </div>
  )
}
```

### Chart Color Adaptation

```tsx
'use client'

import { useTheme } from 'next-themes'

export function ThemedChart() {
  const { resolvedTheme } = useTheme()
  
  const colors = resolvedTheme === 'dark'
    ? ['#60a5fa', '#34d399', '#fbbf24']
    : ['#3b82f6', '#10b981', '#f59e0b']
  
  return <Chart colors={colors} />
}
```

## Accessibility

### Screen Reader Support

```tsx
<Button variant="ghost" size="icon">
  <Sun className="h-5 w-5" />
  <span className="sr-only">Toggle theme</span>
</Button>
```

### Keyboard Navigation

The ThemeToggle dropdown menu is fully keyboard accessible:
- **Tab** - Focus toggle button
- **Enter/Space** - Open menu
- **Arrow Keys** - Navigate options
- **Enter** - Select option
- **Esc** - Close menu

## Troubleshooting

### Flash of Unstyled Content

**Issue:** Brief flash of wrong theme on page load

**Solution:**

```tsx
// Add suppressHydrationWarning
<html suppressHydrationWarning>
  {children}
</html>
```

### Theme Not Persisting

**Issue:** Theme resets on page reload

**Solution:** Check localStorage:

```javascript
// In browser console
localStorage.getItem('theme')  // Should return 'light', 'dark', or 'system'
```

### Wrong Theme on First Load

**Issue:** Server and client theme mismatch

**Solution:** Ensure `mounted` check:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null
```

## Best Practices

### 1. Use CSS Variables

```tsx
// ✅ Good - Adapts automatically
<div className="bg-background text-foreground" />

// ❌ Bad - Requires dark: prefix everywhere
<div className="bg-white dark:bg-gray-900" />
```

### 2. Test Both Modes

Always test components in both light and dark mode during development.

### 3. Consider Contrast

Ensure sufficient contrast in both themes:
- Light mode: Dark text on light background
- Dark mode: Light text on dark background

### 4. Avoid Hardcoded Colors

```tsx
// ❌ Bad
<div style={{ backgroundColor: '#ffffff' }} />

// ✅ Good
<div className="bg-background" />
```

## Next Steps

1. **[Theme Registry](./08-theme-registry.md)** - Understanding the registry
2. **[Creating Custom Themes](./09-creating-custom-themes.md)** - Build your theme

---

> 💡 **Tip**: Dark mode is automatically handled by CSS variables. Focus on defining good color palettes in both `:root` and `.dark` selectors.
