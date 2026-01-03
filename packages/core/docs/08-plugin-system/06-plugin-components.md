# Plugin Components

## Introduction

Plugins can export React components that integrate seamlessly with the application's UI. This document covers component development, theming, accessibility, and best practices for creating plugin components.

**Key Principles:**
- **Client Components** - Use `'use client'` directive
- **shadcn/ui Integration** - Use core UI components
- **Theme Awareness** - CSS variables for styling
- **Accessibility** - ARIA attributes and keyboard navigation
- **Type Safety** - TypeScript props and interfaces

---

## Component Structure

### Basic Plugin Component

**Location**: `contents/plugins/[plugin]/components/MyComponent.tsx`

**Example**:
```typescript
// contents/plugins/my-plugin/components/MyWidget.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/core/components/ui/button'
import { Input } from '@/core/components/ui/input'

interface MyWidgetProps {
  initialValue?: string
  onSubmit?: (value: string) => void
}

export function MyWidget({ initialValue = '', onSubmit }: MyWidgetProps) {
  const [value, setValue] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onSubmit?.(value)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4" data-cy="my-widget">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter text..."
        data-cy="my-widget-input"
      />
      <Button
        onClick={handleSubmit}
        disabled={loading || !value}
        data-cy="my-widget-submit"
      >
        {loading ? 'Processing...' : 'Submit'}
      </Button>
    </div>
  )
}
```

---

## Using Core Components

### shadcn/ui Components

**Available Core Components**:
- `Button` - Buttons with variants
- `Input` - Text inputs
- `Card` - Content containers
- `Dialog` - Modals and dialogs
- `Select` - Dropdowns
- `Toast` - Notifications

**Example**:
```typescript
'use client'

import { Button } from '@/core/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/core/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/core/components/ui/select'

export function PluginDashboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plugin Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>

        <Button>Process</Button>
      </CardContent>
    </Card>
  )
}
```

---

## Theming Components

### Using CSS Variables

**Theme Variables** (defined in theme CSS):
```css
/* Available CSS variables */
--background
--foreground
--primary
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--destructive
--destructive-foreground
--border
--input
--ring
--radius
```

**Component with Theme Variables**:
```typescript
'use client'

export function ThemedCard() {
  return (
    <div
      className="rounded-lg border p-6"
      style={{
        backgroundColor: 'hsl(var(--card))',
        color: 'hsl(var(--card-foreground))',
        borderColor: 'hsl(var(--border))'
      }}
    >
      <h3 className="text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
        Themed Component
      </h3>
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        This component adapts to the active theme
      </p>
    </div>
  )
}
```

**Prefer Tailwind Classes**:
```typescript
'use client'

export function ThemedCard() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground p-6">
      <h3 className="text-lg font-semibold text-foreground">
        Themed Component
      </h3>
      <p className="text-sm text-muted-foreground">
        This component adapts to the active theme
      </p>
    </div>
  )
}
```

---

## Accessibility

### ARIA Attributes

**Accessible Components**:
```typescript
'use client'

export function AccessibleButton({ onClick, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-disabled={disabled}
      className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
    >
      {label}
    </button>
  )
}

export function AccessibleForm() {
  return (
    <form role="form" aria-labelledby="form-title">
      <h2 id="form-title">Contact Form</h2>

      <label htmlFor="name">Name</label>
      <input
        id="name"
        type="text"
        aria-required="true"
        aria-describedby="name-help"
      />
      <span id="name-help" className="text-sm text-muted-foreground">
        Enter your full name
      </span>

      <button type="submit" aria-label="Submit form">
        Submit
      </button>
    </form>
  )
}
```

---

### Keyboard Navigation

```typescript
'use client'

import { useEffect, useRef } from 'react'

export function KeyboardNavigableList({ items }) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        // Navigate to next item
        event.preventDefault()
      } else if (event.key === 'ArrowUp') {
        // Navigate to previous item
        event.preventDefault()
      } else if (event.key === 'Enter') {
        // Activate current item
        event.preventDefault()
      }
    }

    const list = listRef.current
    list?.addEventListener('keydown', handleKeyDown)

    return () => {
      list?.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <ul ref={listRef} role="menu" tabIndex={0}>
      {items.map((item, index) => (
        <li key={index} role="menuitem" tabIndex={-1}>
          {item}
        </li>
      ))}
    </ul>
  )
}
```

---

## Testing Attributes

### data-cy Attributes for E2E Testing

**Component with Test Selectors**:
```typescript
'use client'

export function TestableForm() {
  return (
    <form data-cy="plugin-form">
      <input
        type="text"
        placeholder="Name"
        data-cy="plugin-form-name"
      />
      <input
        type="email"
        placeholder="Email"
        data-cy="plugin-form-email"
      />
      <button type="submit" data-cy="plugin-form-submit">
        Submit
      </button>
    </form>
  )
}
```

**Cypress Test**:
```typescript
describe('Plugin Form', () => {
  it('submits form successfully', () => {
    cy.visit('/plugin-page')

    cy.get('[data-cy="plugin-form-name"]').type('John Doe')
    cy.get('[data-cy="plugin-form-email"]').type('john@example.com')
    cy.get('[data-cy="plugin-form-submit"]').click()

    cy.contains('Form submitted successfully').should('be.visible')
  })
})
```

---

## Component Export

### Exporting from Plugin Config

```typescript
// contents/plugins/my-plugin/plugin.config.ts
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  version: '1.0.0',
  enabled: true,

  components: {
    MyWidget: () => import('./components/MyWidget').then(m => m.MyWidget),
    MyDashboard: () => import('./components/MyDashboard').then(m => m.MyDashboard)
  }
}
```

---

## Real-World Example: AI Plugin Component

```typescript
// contents/plugins/ai/components/AIChat.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/core/components/ui/button'
import { Textarea } from '@/core/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '@/core/components/ui/card'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/v1/plugin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: input })
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.text
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto" data-cy="ai-chat">
      <CardHeader>
        <CardTitle>AI Chat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-96 overflow-y-auto space-y-2" data-cy="ai-chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]'
                  : 'bg-muted text-foreground mr-auto max-w-[80%]'
              }`}
              data-cy={`ai-chat-message-${message.role}`}
            >
              {message.content}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            data-cy="ai-chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            data-cy="ai-chat-send"
          >
            {loading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Summary

**Component Best Practices:**
- ✅ Use `'use client'` directive
- ✅ Import core UI components (shadcn/ui)
- ✅ Use CSS variables for theming
- ✅ Add ARIA attributes for accessibility
- ✅ Include `data-cy` for E2E testing
- ✅ Implement keyboard navigation
- ✅ Handle loading and error states
- ✅ Use TypeScript for props

**Core Components Available:**
- Button, Input, Textarea
- Card, Dialog, Select
- Toast, Badge, Alert

**Theming:**
- Use Tailwind classes with theme variables
- Avoid hardcoded colors
- Components adapt to active theme

**Accessibility:**
- ARIA attributes for screen readers
- Keyboard navigation support
- Semantic HTML structure

**Next:** [Testing Plugins](./08-testing-plugins.md) - Comprehensive plugin testing

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
