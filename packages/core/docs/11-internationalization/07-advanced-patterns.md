# Advanced i18n Patterns

## Introduction

Beyond basic translation key lookups, modern internationalization requires sophisticated handling of pluralization rules, date and time formatting, number formatting, rich text interpolation, and support for diverse writing systems. This document covers advanced patterns and techniques for handling complex internationalization scenarios in NextSpark.

The application uses **next-intl** which is built on **ICU MessageFormat**, providing powerful formatting capabilities while maintaining type safety and performance.

---

## Pluralization

### ICU MessageFormat Pluralization

The application uses ICU MessageFormat for pluralization, which supports complex plural rules for different languages.

**Basic Pluralization**:

```json
{
  "items": {
    "count": "{count, plural, =0 {No items} =1 {One item} other {# items}}"
  }
}
```

**Usage**:

```typescript
import { useTranslations } from 'next-intl'

export function ItemCount({ count }: { count: number }) {
  const t = useTranslations('items')
  
  return <p>{t('count', { count })}</p>
}

// Output:
// count=0  → "No items"
// count=1  → "One item"
// count=5  → "5 items"
```

### Complex Plural Rules

Different languages have different plural rules. ICU MessageFormat supports:

- `zero` - Exactly zero (not all languages)
- `one` - Singular form
- `two` - Dual form (Arabic, Hebrew)
- `few` - Few form (Slavic languages)
- `many` - Many form (Slavic, Arabic)
- `other` - Default/plural form

**English Example**:

```json
{
  "tasks": {
    "remaining": "{count, plural, =0 {No tasks remaining} =1 {1 task remaining} other {# tasks remaining}}"
  }
}
```

**Spanish Example** (similar to English):

```json
{
  "tasks": {
    "remaining": "{count, plural, =0 {No quedan tareas} =1 {Queda 1 tarea} other {Quedan # tareas}}"
  }
}
```

**Russian Example** (has more complex rules):

```json
{
  "tasks": {
    "remaining": "{count, plural, =0 {Нет задач} one {# задача} few {# задачи} many {# задач} other {# задач}}"
  }
}
```

### Pluralization with Ordinals

For ordinal numbers (1st, 2nd, 3rd):

```json
{
  "position": {
    "rank": "{rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
  }
}
```

**Usage**:

```typescript
const t = useTranslations('position')

t('rank', { rank: 1 })  // "1st"
t('rank', { rank: 2 })  // "2nd"
t('rank', { rank: 3 })  // "3rd"
t('rank', { rank: 4 })  // "4th"
```

### Pluralization with Gender

Some languages require gender-specific plural forms:

```json
{
  "users": {
    "count": "{count, plural, =0 {No users} =1 {One user} other {# users}}",
    "countFemale": "{count, plural, =0 {No female users} =1 {One female user} other {# female users}}",
    "countMale": "{count, plural, =0 {No male users} =1 {One male user} other {# male users}}"
  }
}
```

---

## Date and Time Formatting

### Using next-intl Formatters

The application provides built-in date/time formatting via next-intl's `format` utilities.

**Basic Date Formatting**:

```typescript
'use client'

import { useFormatter } from 'next-intl'

export function DateDisplay({ date }: { date: Date }) {
  const format = useFormatter()
  
  return (
    <div>
      <p>{format.dateTime(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>
    </div>
  )
}

// Output:
// en: "November 19, 2025"
// es: "19 de noviembre de 2025"
```

### Date Format Options

**Available Options**:

```typescript
interface DateTimeFormatOptions {
  year?: 'numeric' | '2-digit'
  month?: 'numeric' | '2-digit' | 'narrow' | 'short' | 'long'
  day?: 'numeric' | '2-digit'
  weekday?: 'narrow' | 'short' | 'long'
  hour?: 'numeric' | '2-digit'
  minute?: 'numeric' | '2-digit'
  second?: 'numeric' | '2-digit'
  timeZoneName?: 'short' | 'long'
  hour12?: boolean
}
```

**Common Patterns**:

```typescript
const format = useFormatter()

// Full date
format.dateTime(date, {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})
// en: "November 19, 2025"
// es: "19 de noviembre de 2025"

// Short date
format.dateTime(date, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})
// en: "11/19/2025"
// es: "19/11/2025"

// Date with weekday
format.dateTime(date, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})
// en: "Wednesday, November 19, 2025"
// es: "miércoles, 19 de noviembre de 2025"

// Time only
format.dateTime(date, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
})
// en: "2:30 PM"
// es: "14:30"

// Date and time
format.dateTime(date, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})
// en: "Nov 19, 2025, 2:30 PM"
// es: "19 nov 2025, 14:30"
```

### Relative Time Formatting

Format dates relative to now:

```typescript
const format = useFormatter()

// Relative time
format.relativeTime(date, {
  style: 'long'
})
// en: "3 hours ago"
// es: "hace 3 horas"

// Short format
format.relativeTime(date, {
  style: 'short'
})
// en: "3h ago"
// es: "hace 3h"

// Narrow format
format.relativeTime(date, {
  style: 'narrow'
})
// en: "3h"
// es: "3h"
```

### Custom Date Formatters

Located in `core/lib/formatters.ts`:

```typescript
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

const locales = {
  es,
  en: enUS
}

export function formatDate(
  date: Date | string, 
  locale: 'en' | 'es' = 'es', 
  formatStr: string = 'PPP'
) {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatStr, { locale: locales[locale] })
}

export function formatDateTime(date: Date | string, locale: 'en' | 'es' = 'es') {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'PPP p', { locale: locales[locale] })
}

export function formatRelativeTime(date: Date | string, locale: 'en' | 'es' = 'es') {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'PPp', { locale: locales[locale] })
}
```

**Usage**:

```typescript
import { formatDate, formatDateTime } from '@/core/lib/formatters'

// Format date
const formatted = formatDate(new Date(), 'en', 'PPP')
// "November 19, 2025"

// Format date and time
const formattedDT = formatDateTime(new Date(), 'es')
// "19 de noviembre de 2025 14:30"
```

---

## Number Formatting

### Using next-intl Number Formatter

```typescript
'use client'

import { useFormatter } from 'next-intl'

export function NumberDisplay({ value }: { value: number }) {
  const format = useFormatter()
  
  return (
    <div>
      <p>{format.number(value)}</p>
    </div>
  )
}

// Output:
// en: value=1234567.89 → "1,234,567.89"
// es: value=1234567.89 → "1.234.567,89"
```

### Number Format Options

```typescript
const format = useFormatter()

// Default number
format.number(1234.56)
// en: "1,234.56"
// es: "1.234,56"

// Percentage
format.number(0.75, {
  style: 'percent'
})
// en: "75%"
// es: "75 %"

// Currency
format.number(1234.56, {
  style: 'currency',
  currency: 'USD'
})
// en: "$1,234.56"
// es: "1.234,56 US$"

// Compact notation
format.number(1234567, {
  notation: 'compact'
})
// en: "1.2M"
// es: "1,2 M"

// Scientific notation
format.number(1234567, {
  notation: 'scientific'
})
// en: "1.235E6"
// es: "1,235E6"

// Custom decimal places
format.number(1234.5678, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
// en: "1,234.57"
// es: "1.234,57"

// Unit formatting
format.number(123, {
  style: 'unit',
  unit: 'kilometer'
})
// en: "123 km"
// es: "123 km"
```

### Currency Formatting

```typescript
const format = useFormatter()

// USD
format.number(1234.56, {
  style: 'currency',
  currency: 'USD'
})
// en: "$1,234.56"
// es: "1.234,56 US$"

// EUR
format.number(1234.56, {
  style: 'currency',
  currency: 'EUR'
})
// en: "€1,234.56"
// es: "1.234,56 €"

// Custom currency display
format.number(1234.56, {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'name'
})
// en: "1,234.56 US dollars"
// es: "1.234,56 dólares estadounidenses"
```

### Custom Number Formatters

Located in `core/lib/formatters.ts`:

```typescript
export function formatNumber(
  number: number, 
  locale: 'en' | 'es' = 'es', 
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(
    locale === 'es' ? 'es-ES' : 'en-US', 
    options
  ).format(number)
}

export function formatCurrency(
  amount: number, 
  locale: 'en' | 'es' = 'es', 
  currency: string = 'USD'
) {
  return new Intl.NumberFormat(
    locale === 'es' ? 'es-ES' : 'en-US', 
    {
      style: 'currency',
      currency
    }
  ).format(amount)
}

export function formatPercentage(value: number, locale: 'en' | 'es' = 'es') {
  return new Intl.NumberFormat(
    locale === 'es' ? 'es-ES' : 'en-US', 
    {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }
  ).format(value / 100)
}
```

---

## Rich Text and Interpolation

### Variable Interpolation

**Simple Variables**:

```json
{
  "welcome": {
    "greeting": "Hello, {name}!"
  }
}
```

```typescript
const t = useTranslations('welcome')

t('greeting', { name: 'John' })
// "Hello, John!"
```

**Multiple Variables**:

```json
{
  "task": {
    "assigned": "{task} has been assigned to {user} by {assigner}"
  }
}
```

```typescript
t('task.assigned', {
  task: 'Review PR #123',
  user: 'Jane',
  assigner: 'Admin'
})
// "Review PR #123 has been assigned to Jane by Admin"
```

### HTML and Rich Text

**Using `rich` parameter for HTML**:

```json
{
  "welcome": {
    "message": "Welcome to <strong>{appName}</strong>! Click <link>here</link> to get started."
  }
}
```

```typescript
const t = useTranslations('welcome')

t.rich('message', {
  appName: 'My App',
  strong: (chunks) => <strong>{chunks}</strong>,
  link: (chunks) => <a href="/getting-started" className="underline">{chunks}</a>
})
```

**Output**:

```html
Welcome to <strong>My App</strong>! Click <a href="/getting-started" class="underline">here</a> to get started.
```

### Markdown in Translations

```json
{
  "terms": {
    "content": "By using our service, you agree to our **Terms of Service** and *Privacy Policy*."
  }
}
```

```typescript
import ReactMarkdown from 'react-markdown'
import { useTranslations } from 'next-intl'

export function TermsNotice() {
  const t = useTranslations('terms')
  
  return (
    <ReactMarkdown>
      {t('content')}
    </ReactMarkdown>
  )
}
```

### Component Interpolation

Pass React components as translation values:

```typescript
const t = useTranslations('notifications')

t.rich('newMessage', {
  avatar: () => <Avatar src="/user.jpg" />,
  badge: (chunks) => <Badge>{chunks}</Badge>
})
```

---

## Select (Conditional) Formatting

### Basic Select

Choose different strings based on a value:

```json
{
  "status": {
    "message": "{status, select, pending {Waiting for approval} approved {Approved!} rejected {Rejected} other {Unknown status}}"
  }
}
```

```typescript
const t = useTranslations('status')

t('message', { status: 'pending' })   // "Waiting for approval"
t('message', { status: 'approved' })  // "Approved!"
t('message', { status: 'rejected' })  // "Rejected"
t('message', { status: 'unknown' })   // "Unknown status"
```

### Gender-Based Selection

```json
{
  "user": {
    "greeting": "{gender, select, male {Hello Mr. {name}} female {Hello Ms. {name}} other {Hello {name}}}"
  }
}
```

```typescript
t('user.greeting', { gender: 'female', name: 'Smith' })
// "Hello Ms. Smith"
```

### Combined Select and Plural

```json
{
  "notifications": {
    "message": "{gender, select, male {He has} female {She has} other {They have}} {count, plural, =0 {no messages} =1 {one message} other {# messages}}"
  }
}
```

```typescript
t('notifications.message', { gender: 'female', count: 5 })
// "She has 5 messages"
```

---

## RTL (Right-to-Left) Language Support

### Detecting RTL Languages

```typescript
// core/lib/locale.ts
const RTL_LOCALES = ['ar', 'he', 'fa', 'ur']

export function isRTL(locale: string): boolean {
  return RTL_LOCALES.includes(locale)
}
```

### Applying RTL to Layout

```typescript
// app/layout.tsx
import { getUserLocale } from '@/core/lib/locale'
import { isRTL } from '@/core/lib/locale'

export default async function RootLayout({ children }: Props) {
  const locale = await getUserLocale()
  const dir = isRTL(locale) ? 'rtl' : 'ltr'
  
  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  )
}
```

### RTL-Aware CSS

```css
/* Use logical properties for automatic RTL support */

/* ❌ BAD: Fixed directions */
.element {
  margin-left: 16px;
  padding-right: 8px;
  text-align: left;
}

/* ✅ GOOD: Logical properties */
.element {
  margin-inline-start: 16px;
  padding-inline-end: 8px;
  text-align: start;
}

/* RTL-specific overrides */
[dir="rtl"] .icon {
  transform: scaleX(-1); /* Flip icons */
}
```

### Tailwind RTL Support

```typescript
// Use Tailwind's RTL utilities
<div className="ml-4 rtl:mr-4 rtl:ml-0">
  Content
</div>

// Or use logical properties plugin
<div className="ms-4 pe-2">
  Content
</div>
```

---

## Dynamic Translation Loading

### Context-Aware Namespace Loading

The application automatically loads namespaces based on the current route:

```typescript
// core/lib/translations/i18n-integration.ts
export function getOptimizedNamespaces(pathname: string): {
  core: string[]
  entities: string[]
  strategy: string
} {
  // Dashboard context
  if (pathname.startsWith('/dashboard')) {
    return {
      core: ['common', 'dashboard'],
      entities: [],
      strategy: 'dashboard'
    }
  }
  
  // Auth context
  if (pathname.startsWith('/auth') || pathname.startsWith('/signin')) {
    return {
      core: ['common', 'auth'],
      entities: [],
      strategy: 'auth'
    }
  }
  
  // Public context (default)
  return {
    core: ['common', 'public'],
    entities: [],
    strategy: 'public'
  }
}
```

### Manual Namespace Loading

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

export function DynamicComponent({ namespace }: { namespace: string }) {
  const [translations, setTranslations] = useState<Record<string, string>>({})
  
  useEffect(() => {
    // Load namespace dynamically
    import(`@/core/messages/en/${namespace}.json`)
      .then(module => setTranslations(module.default))
      .catch(err => console.error('Failed to load translations:', err))
  }, [namespace])
  
  return (
    <div>
      {translations.title || 'Loading...'}
    </div>
  )
}
```

---

## Advanced Formatting Patterns

### List Formatting

Format arrays as localized lists:

```typescript
const format = useFormatter()

const items = ['Apple', 'Banana', 'Cherry']

// Conjunction (and)
format.list(items, { type: 'conjunction' })
// en: "Apple, Banana, and Cherry"
// es: "Apple, Banana y Cherry"

// Disjunction (or)
format.list(items, { type: 'disjunction' })
// en: "Apple, Banana, or Cherry"
// es: "Apple, Banana o Cherry"

// Unit
format.list(items, { type: 'unit' })
// en: "Apple, Banana, Cherry"
// es: "Apple, Banana, Cherry"
```

### Date Range Formatting

```typescript
const format = useFormatter()

const startDate = new Date('2025-11-01')
const endDate = new Date('2025-11-19')

format.dateTimeRange(startDate, endDate, {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})
// en: "Nov 1 – 19, 2025"
// es: "1–19 nov 2025"
```

### Number Range Formatting

```typescript
const format = useFormatter()

format.numberRange(10, 20)
// en: "10–20"
// es: "10-20"

format.numberRange(10, 20, {
  style: 'currency',
  currency: 'USD'
})
// en: "$10.00 – $20.00"
// es: "10,00 US$-20,00 US$"
```

---

## Best Practices

### ✅ DO: Use ICU MessageFormat

```json
{
  "items": "{count, plural, =0 {No items} =1 {One item} other {# items}}"
}
```

### ✅ DO: Provide Context in Keys

```json
{
  "buttons": {
    "save": "Save",
    "saveAndContinue": "Save and Continue"
  }
}
```

### ✅ DO: Use Logical CSS Properties

```css
.element {
  margin-inline-start: 16px;  /* Auto RTL */
  padding-block-end: 8px;
}
```

### ✅ DO: Format Dates and Numbers

```typescript
// ✅ GOOD
format.dateTime(date, { year: 'numeric', month: 'long', day: 'numeric' })
format.number(price, { style: 'currency', currency: 'USD' })
```

### ❌ DON'T: Concatenate Translations

```typescript
// ❌ BAD
const message = t('hello') + ' ' + userName + '!'

// ✅ GOOD
const message = t('greeting', { name: userName })
```

### ❌ DON'T: Hardcode Formats

```typescript
// ❌ BAD
const formatted = `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}`

// ✅ GOOD
const formatted = format.dateTime(date, { /* options */ })
```

---

## Next Steps

1. **[Testing Translations](./08-testing-translations.md)** - Test advanced patterns
2. **[Translation Keys](./03-translation-keys.md)** - Organize complex keys
3. **[Translation Sources](./04-translation-sources.md)** - Manage translations

---

> 💡 **Pro Tip**: Use ICU MessageFormat for all dynamic content. It handles pluralization, gender, and complex rules automatically across all languages.
