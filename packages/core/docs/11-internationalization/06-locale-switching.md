# Locale Switching

## Introduction

Locale switching allows users to dynamically change the application language, with preferences persisted across sessions. NextSpark implements a comprehensive locale switching system that works seamlessly for both authenticated and anonymous users, with multiple persistence strategies and automatic UI updates.

The locale switching system integrates with the authentication system, database storage, cookie-based persistence, and next-intl's locale detection to provide a smooth user experience.

---

## Locale Detection Priority

The application determines the active locale using a **cascading detection strategy** with the following priority order:

```text
1. Database User Preference (authenticated users)
   ↓
2. Cookie (NEXT_LOCALE)
   ↓
3. Accept-Language Header (browser preference)
   ↓
4. Default Locale (fallback: 'en')
```

### Detection Implementation

Located in `core/lib/locale.ts`:

```typescript
import { cookies, headers } from 'next/headers'
import { I18N_CONFIG, type SupportedLocale } from '@/core/lib/config'
import { auth } from '@/core/lib/auth'
import { queryOne } from '@/core/lib/db'

export async function getUserLocale(): Promise<SupportedLocale> {
  // 1. Check user profile from database (highest priority)
  try {
    const sessionHeaders = await headers()
    const session = await auth.api.getSession({ headers: sessionHeaders })

    if (session?.user?.id) {
      const user = await queryOne<{ language: string }>(
        'SELECT language FROM "users" WHERE id = $1',
        [session.user.id]
      )

      if (user?.language && I18N_CONFIG.supportedLocales.includes(user.language as SupportedLocale)) {
        return user.language as SupportedLocale
      }
    }
  } catch (error) {
    // Silently fail and continue to next detection method
  }

  // 2. Check cookie
  try {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get(I18N_CONFIG.cookie.name)?.value

    if (cookieLocale && I18N_CONFIG.supportedLocales.includes(cookieLocale as SupportedLocale)) {
      return cookieLocale as SupportedLocale
    }
  } catch (error) {
    // Silently fail during static generation
  }

  // 3. Check Accept-Language header
  try {
    const headersList = await headers()
    const acceptLanguage = headersList.get('accept-language')
    if (acceptLanguage) {
      const preferredLocale = acceptLanguage.split(',')[0].split('-')[0] as SupportedLocale
      if (I18N_CONFIG.supportedLocales.includes(preferredLocale)) {
        return preferredLocale
      }
    }
  } catch (error) {
    // Silently fail during static generation
  }

  // 4. Default to configured default locale
  return I18N_CONFIG.defaultLocale
}
```

---

## Server-Side Locale Switching

### Setting Locale (Server)

Located in `core/lib/locale.ts`:

```typescript
export async function setUserLocale(locale: string) {
  // Validate input locale
  if (!I18N_CONFIG.supportedLocales.includes(locale as SupportedLocale)) {
    throw new Error(
      `Unsupported locale: ${locale}. Supported locales: ${I18N_CONFIG.supportedLocales.join(', ')}`
    )
  }

  const cookieStore = await cookies()
  const cookieConfig = I18N_CONFIG.cookie
  
  cookieStore.set(cookieConfig.name, locale, {
    expires: new Date(Date.now() + cookieConfig.maxAge),
    httpOnly: cookieConfig.httpOnly,
    secure: cookieConfig.secure === 'auto' 
      ? process.env.NODE_ENV === 'production' 
      : cookieConfig.secure,
    sameSite: cookieConfig.sameSite,
    path: cookieConfig.path
  })
}
```

**Use Case**: Setting locale from Server Actions or API routes.

```typescript
// In a Server Action
'use server'

import { setUserLocale } from '@/core/lib/locale'

export async function changeUserLocale(locale: string) {
  await setUserLocale(locale)
  revalidatePath('/')
}
```

---

## Client-Side Locale Switching

### Setting Locale (Client)

Located in `core/lib/locale-client.ts`:

```typescript
'use client'

import { I18N_CONFIG, type SupportedLocale } from '@/core/lib/config'

export function setUserLocaleClient(locale: string) {
  // Validate input locale
  if (!I18N_CONFIG.supportedLocales.includes(locale as SupportedLocale)) {
    throw new Error(
      `Unsupported locale: ${locale}. Supported locales: ${I18N_CONFIG.supportedLocales.join(', ')}`
    )
  }

  const cookieConfig = I18N_CONFIG.cookie
  const expires = new Date(Date.now() + cookieConfig.maxAge)
  
  // Set cookie using document.cookie for client-side
  document.cookie = `${cookieConfig.name}=${locale}; expires=${expires.toUTCString()}; path=${cookieConfig.path}; SameSite=${cookieConfig.sameSite}`
}
```

**Use Case**: Immediate locale changes from client components.

---

## useLocale Hook

The `useLocale` hook provides a complete locale switching interface for Client Components.

Located in `core/hooks/useLocale.ts`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useUserProfile } from './useUserProfile'
import { setUserLocaleClient } from '@/core/lib/locale-client'
import { I18N_CONFIG, type SupportedLocale } from '@/core/lib/config'

export function useLocale() {
  const { profile, updateProfile } = useUserProfile()
  const [isChanging, setIsChanging] = useState(false)

  const currentLocale = (profile?.language as SupportedLocale) || I18N_CONFIG.defaultLocale

  const changeLanguage = useCallback(async (newLocale: SupportedLocale) => {
    if (newLocale === currentLocale) return

    setIsChanging(true)
    try {
      // 1. Update in database (authenticated users)
      await updateProfile({ language: newLocale })
      
      // 2. Update cookie for next-intl
      setUserLocaleClient(newLocale)
      
      // 3. Force full page reload to apply language change
      window.location.reload()
    } catch (error) {
      console.error('Error changing language:', error)
      
      // Toast notification for user feedback
      if (typeof window !== 'undefined') {
        const { toast } = await import('sonner')
        toast.error('Failed to change language. Please try again.')
      }
      
      throw error
    } finally {
      setIsChanging(false)
    }
  }, [currentLocale, updateProfile])

  return {
    locale: currentLocale,
    changeLanguage,
    isChanging,
    supportedLocales: I18N_CONFIG.supportedLocales
  }
}
```

### Hook Return Values

| Property | Type | Description |
|----------|------|-------------|
| `locale` | `SupportedLocale` | Current active locale |
| `changeLanguage` | `(locale: SupportedLocale) => Promise<void>` | Function to change locale |
| `isChanging` | `boolean` | Loading state during locale change |
| `supportedLocales` | `readonly SupportedLocale[]` | Array of supported locales |

---

## Implementing Locale Selection UI

### Example: Language Selector Dropdown

```typescript
'use client'

import { useLocale } from '@/core/hooks/useLocale'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select'
import { Globe } from 'lucide-react'

const LOCALE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
} as const

export function LanguageSwitcher() {
  const { locale, changeLanguage, isChanging, supportedLocales } = useLocale()
  const t = useTranslations('common.language')

  return (
    <Select
      value={locale}
      onValueChange={changeLanguage}
      disabled={isChanging}
    >
      <SelectTrigger className="w-[180px]">
        <Globe className="mr-2 h-4 w-4" />
        <SelectValue placeholder={t('select')} />
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {LOCALE_NAMES[loc] || loc.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### Example: Compact Language Toggle

```typescript
'use client'

import { useLocale } from '@/core/hooks/useLocale'
import { Button } from '@/core/components/ui/button'
import { Languages } from 'lucide-react'

export function LanguageToggle() {
  const { locale, changeLanguage, isChanging } = useLocale()

  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'es' : 'en'
    changeLanguage(newLocale)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLocale}
      disabled={isChanging}
      aria-label="Toggle language"
    >
      <Languages className="h-5 w-5" />
      <span className="ml-2 text-xs">{locale.toUpperCase()}</span>
    </Button>
  )
}
```

### Example: Settings Page Integration

```typescript
'use client'

import { useLocale } from '@/core/hooks/useLocale'
import { useTranslations } from 'next-intl'
import { Label } from '@/core/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/core/components/ui/radio-group'

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
]

export function LanguageSettings() {
  const { locale, changeLanguage, isChanging } = useLocale()
  const t = useTranslations('settings.language')

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      
      <RadioGroup
        value={locale}
        onValueChange={changeLanguage}
        disabled={isChanging}
        className="gap-4"
      >
        {LOCALE_OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center space-x-3">
            <RadioGroupItem value={option.value} id={option.value} />
            <Label
              htmlFor={option.value}
              className="flex items-center cursor-pointer"
            >
              <span className="mr-2 text-2xl">{option.flag}</span>
              <span>{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      
      {isChanging && (
        <p className="text-sm text-muted-foreground">{t('updating')}</p>
      )}
    </div>
  )
}
```

---

## Locale Persistence

### Authenticated Users

For authenticated users, locale preference is stored in the database:

**Database Schema**:

```sql
CREATE TABLE "users" (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  language TEXT DEFAULT 'en', -- User's preferred locale
  -- ... other fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_language ON "users"("language");
```

**Update Locale in Database**:

```typescript
// Via useUserProfile hook
const { updateProfile } = useUserProfile()

await updateProfile({
  language: 'es'
})
```

**Automatic Loading**:

The locale detection system automatically loads the user's saved preference from the database when they sign in.

### Anonymous Users

For anonymous users, locale is stored in cookies:

**Cookie Configuration** (from `core/lib/config/app.config.ts`):

```typescript
cookie: {
  name: 'locale',
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  httpOnly: false,
  secure: 'auto',
  sameSite: 'lax',
  path: '/',
}
```

**Cookie Behavior**:

- **Expires**: 1 year from last update
- **HttpOnly**: `false` (allows client-side access)
- **Secure**: Auto (HTTPS in production)
- **SameSite**: `lax` (CSRF protection)
- **Path**: `/` (available site-wide)

---

## Handling Locale Changes

### Full Page Reload Strategy

The current implementation uses a **full page reload** after locale changes:

```typescript
// In useLocale hook
await updateProfile({ language: newLocale })
setUserLocaleClient(newLocale)
window.location.reload() // Force reload
```

**Why Full Reload?**

- ✅ Ensures all translations are updated
- ✅ Resets all component state
- ✅ Simplifies implementation
- ✅ Works with Server Components
- ❌ Momentary loading experience

### Without Page Reload (Alternative)

For a smoother experience, you can implement locale switching without full reload:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from '@/core/hooks/useLocale'

export function SmoothLanguageSwitcher() {
  const router = useRouter()
  const { changeLanguage } = useLocale()

  const handleChange = async (newLocale: string) => {
    await changeLanguage(newLocale)
    
    // Refresh current route without full reload
    router.refresh()
  }

  // ... rest of component
}
```

**Considerations**:

- May require additional state management
- Client-side translations need manual refresh
- Server Components will update on navigation

---

## Locale Switching in Different Contexts

### During Authentication

Set default locale during user signup:

```typescript
// In signup flow
import { I18N_CONFIG } from '@/core/lib/config'

const newUser = await auth.api.signUp({
  email: data.email,
  password: data.password,
  name: data.name,
  language: I18N_CONFIG.defaultLocale, // Set default locale
})
```

### Social Authentication

Map user locale from OAuth provider:

```typescript
// core/lib/auth.ts
export const auth = betterAuth({
  socialProviders: {
    google: {
      mapProfileToUser: (profile: GoogleProfile) => {
        // Detect locale from Google profile
        const locale = profile.locale?.startsWith('es') ? 'es' : 'en'
        
        return {
          email: profile.email,
          name: profile.name,
          language: locale, // Auto-detect from provider
          // ... other fields
        }
      },
    },
  },
})
```

### API Routes

Return localized API responses:

```typescript
// app/api/data/route.ts
import { getUserLocale } from '@/core/lib/locale'
import { getTranslations } from 'next-intl/server'

export async function GET(request: Request) {
  const locale = await getUserLocale()
  const t = await getTranslations({ locale, namespace: 'api' })
  
  return Response.json({
    message: t('success'),
    locale: locale
  })
}
```

---

## Locale-Aware Routing

### URL Locale Prefix (Optional)

You can implement URL-based locale routing:

```text
/en/dashboard  → English dashboard
/es/dashboard  → Spanish dashboard
```

**Middleware Implementation**:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserLocale } from '@/core/lib/locale'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if locale is in URL
  const pathnameHasLocale = I18N_CONFIG.supportedLocales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
  
  if (!pathnameHasLocale) {
    // Get user's preferred locale
    const locale = await getUserLocale()
    
    // Redirect to locale-prefixed URL
    request.nextUrl.pathname = `/${locale}${pathname}`
    return NextResponse.redirect(request.nextUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
```

**Note**: The current implementation does NOT use URL locale prefixes by default.

---

## Testing Locale Switching

### Manual Testing

1. **As Anonymous User:**
   - Select locale from language switcher
   - Verify cookie is set
   - Refresh page to confirm persistence
   - Clear cookies and verify fallback to browser locale

2. **As Authenticated User:**
   - Change locale in settings
   - Sign out and sign back in
   - Verify saved preference is loaded
   - Change locale on different device
   - Verify change syncs via database

3. **Browser Locale Detection:**
   - Clear cookies and database
   - Set browser to Spanish (`es`)
   - Visit app and verify Spanish is loaded
   - Repeat with other supported locales

### Automated Testing

```typescript
// test/locale-switching.test.ts
import { describe, it, expect } from '@jest/globals'
import { setUserLocaleClient } from '@/core/lib/locale-client'

describe('Locale Switching', () => {
  it('should set locale cookie', () => {
    setUserLocaleClient('es')
    
    const cookies = document.cookie.split(';')
    const localeCookie = cookies.find(c => c.trim().startsWith('locale='))
    
    expect(localeCookie).toContain('locale=es')
  })
  
  it('should reject invalid locale', () => {
    expect(() => setUserLocaleClient('invalid')).toThrow()
  })
})
```

---

## Best Practices

### ✅ DO: Validate Locales

```typescript
// Always validate before setting
if (I18N_CONFIG.supportedLocales.includes(locale)) {
  await changeLanguage(locale)
}
```

### ✅ DO: Provide Visual Feedback

```typescript
// Show loading state during locale change
{isChanging && (
  <Spinner className="ml-2" />
)}
```

### ✅ DO: Handle Errors Gracefully

```typescript
try {
  await changeLanguage(newLocale)
} catch (error) {
  toast.error('Failed to change language')
  // Keep current locale
}
```

### ✅ DO: Persist Across Sessions

```typescript
// Database for authenticated users
// Cookies for anonymous users
// Both strategies implemented
```

### ❌ DON'T: Force Locales

```typescript
// ❌ BAD: Don't override user preference
const locale = 'en' // Always English

// ✅ GOOD: Respect user choice
const locale = await getUserLocale()
```

### ❌ DON'T: Forget Browser Detection

```typescript
// ✅ GOOD: Fallback to browser locale
const acceptLanguage = headers.get('accept-language')
```

---

## Troubleshooting

### Locale Not Persisting

**Problem**: Locale reverts to default after reload

**Solutions**:
1. Check cookie is being set correctly
2. Verify cookie expiration is in the future
3. Check for cookie blocking in browser
4. Verify database update for authenticated users
5. Check middleware isn't clearing cookies

### Translations Not Updating

**Problem**: UI doesn't reflect new locale

**Solutions**:
1. Ensure `window.location.reload()` is called
2. Check `router.refresh()` if avoiding reload
3. Verify translations exist for new locale
4. Clear Next.js cache: `rm -rf .next`
5. Check browser console for loading errors

### Database Locale Not Loading

**Problem**: User's saved locale not being used

**Solutions**:
1. Verify user is authenticated
2. Check `language` column exists in database
3. Verify `getUserLocale()` is called correctly
4. Check database query returns language field
5. Ensure locale value is in `supportedLocales`

---

## Next Steps

1. **[Advanced i18n Patterns](./07-advanced-patterns.md)** - Pluralization, formatting, RTL
2. **[Testing Translations](./08-testing-translations.md)** - Testing locale switching
3. **[Translation Keys](./03-translation-keys.md)** - Managing translation keys

---

> 💡 **Pro Tip**: For the best user experience, combine database persistence (authenticated users) with cookie fallback (anonymous users) and browser locale detection as the final fallback.
