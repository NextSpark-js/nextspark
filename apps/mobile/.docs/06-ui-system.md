# UI System: NativeWind + shadcn-style Primitives

This document explains how the mobile app achieves **near-identical DX** to NextSpark Web while using React Native instead of the web stack.

## The Problem: Web vs Mobile Incompatibility

### NextSpark Web Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      NextSpark Web UI                            │
├─────────────────────────────────────────────────────────────────┤
│  Tailwind CSS v4      CSS-based utility classes                  │
│  shadcn/ui            Component library                          │
│  Radix UI             Headless primitives (Dialog, Select, etc.) │
│  CVA                  Class variance authority for variants      │
│  cn()                 clsx + tailwind-merge utility              │
└─────────────────────────────────────────────────────────────────┘
```

**The incompatibility issue:**

| Technology | Web | React Native | Why? |
|------------|-----|--------------|------|
| Tailwind CSS | `className="..."` | **Incompatible** | RN uses StyleSheet, not CSS |
| Radix UI | Works | **Incompatible** | Radix depends on DOM APIs |
| CSS Variables | Works | **Incompatible** | RN doesn't support `:root` |
| OKLCH Colors | Works | **Incompatible** | RN doesn't support OKLCH |

### The Solution: NativeWind + Custom Primitives

```
┌─────────────────────────────────────────────────────────────────┐
│                   NextSpark Mobile UI                            │
├─────────────────────────────────────────────────────────────────┤
│  NativeWind v4        Tailwind-to-RN compiler (className works!) │
│  Custom UI primitives Same API as shadcn/ui                      │
│  Native components    View, Pressable, Modal (replaces Radix)    │
│  CVA                  Same as web (JS-only, no DOM dependency)   │
│  cn()                 Same as web (clsx + tailwind-merge)        │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture Comparison

### Web Component (shadcn/ui)

```tsx
// repo/packages/core/src/components/ui/button.tsx
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground...",
        outline: "border border-input bg-background...",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
}
```

### Mobile Component (NativeWind)

```tsx
// apps/mobile-dev/src/components/ui/button.tsx
import { Pressable, ActivityIndicator } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/src/lib/utils"
import { Text } from "./text"

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-lg active:opacity-80",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
        outline: "border border-input bg-background",
        ghost: "",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({ className, variant, size, children, isLoading, ...props }) {
  return (
    <Pressable className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {isLoading ? (
        <ActivityIndicator />
      ) : typeof children === "string" ? (
        <Text className="text-primary-foreground font-semibold">{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}
```

### Key Differences

| Aspect | Web | Mobile |
|--------|-----|--------|
| Base element | `<button>` / `Slot` | `Pressable` |
| Hover states | `hover:bg-primary/90` | `active:opacity-80` |
| Layout | `inline-flex` | `flex-row` |
| Text | Inherited | Explicit `<Text>` component |
| Loading | Custom spinner | `ActivityIndicator` |

## The cn() Utility

Both platforms use **identical** `cn()` function:

```tsx
// src/lib/utils.ts (same on both platforms)
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

This allows conditional and merged classes:

```tsx
<Button className={cn(
  "w-full",
  isActive && "bg-primary",
  disabled && "opacity-50"
)}>
  Submit
</Button>
```

## Theming System

### Web (OKLCH in globals.css)

```css
/* NextSpark Web uses OKLCH for precise color control */
:root {
  --primary: oklch(0% 0 0);      /* Pure black */
  --background: oklch(100% 0 0); /* Pure white */
}
```

### Mobile (Hex in globals.css)

```css
/* React Native doesn't support OKLCH, so we convert to hex */
:root {
  --background: #FFFFFF;
  --foreground: #1a1a1a;
  --primary: #171717;
  --primary-foreground: #fafafa;
  --secondary: #f5f5f5;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --destructive: #ef4444;
  --border: #e5e5e5;
  --ring: #a3a3a3;
  --radius: 10px;
}

.dark {
  --background: #0a0a0a;
  --foreground: #fafafa;
  --primary: #fafafa;
  --primary-foreground: #171717;
  /* ... */
}
```

### Tailwind Config (Mobile)

```js
// tailwind.config.js
module.exports = {
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        // ... same semantic tokens as web
      },
    },
  },
}
```

## Available UI Primitives

| Component | Web (shadcn/ui) | Mobile (custom) | Notes |
|-----------|-----------------|-----------------|-------|
| `Button` | Radix Slot | Pressable | Same variants API |
| `Input` | HTML input | TextInput | Same styling |
| `Textarea` | HTML textarea | TextInput multiline | Same styling |
| `Card` | div | View | Same compound pattern |
| `Badge` | div | View + Pressable | Same variants |
| `Avatar` | Radix Avatar | Image + View | Same compound pattern |
| `Dialog` | Radix Dialog | Modal | Same compound pattern |
| `Select` | Radix Select | Modal + FlatList | Custom implementation |
| `Switch` | Radix Switch | RN Switch | Styled wrapper |
| `Checkbox` | Radix Checkbox | Pressable | Custom implementation |
| `Separator` | Radix Separator | View | Same styling |
| `Skeleton` | div + animation | View + Animated | Same variants |
| `Text` | N/A (native) | RN Text | Custom (RN requires explicit Text) |

### Import Pattern

```tsx
// Same barrel export pattern
import { Button, Card, CardContent, Badge, Input } from "@/src/components/ui"
```

## Usage Examples

### Creating a Form (Nearly Identical DX)

**Web:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Create Task</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <Input placeholder="Task title" value={title} onChange={...} />
    <Button onClick={handleSubmit}>Save</Button>
  </CardContent>
</Card>
```

**Mobile:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Create Task</CardTitle>
  </CardHeader>
  <CardContent className="gap-4">
    <Input placeholder="Task title" value={title} onChangeText={...} />
    <Button onPress={handleSubmit}>Save</Button>
  </CardContent>
</Card>
```

**Differences:**
- `space-y-4` → `gap-4` (RN uses gap, not margin hack)
- `onChange` → `onChangeText` (RN TextInput API)
- `onClick` → `onPress` (RN Pressable API)

### Status Badges

```tsx
// Works identically on both platforms
<Badge variant="success">Active</Badge>
<Badge variant="destructive">Blocked</Badge>
<Badge variant="outline">Pending</Badge>
```

## Cross-Platform Utilities

### Alert Polyfill

React Native's `Alert.alert` doesn't work on web. We created a cross-platform utility:

```tsx
// src/lib/alert.ts
import { Alert as RNAlert, Platform } from "react-native"

export function confirmDestructive(
  title: string,
  message?: string,
  destructiveButtonText = "Eliminar"
): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(`${title}\n\n${message || ""}`)
      resolve(confirmed)
    } else {
      RNAlert.alert(title, message, [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        { text: destructiveButtonText, style: "destructive", onPress: () => resolve(true) },
      ])
    }
  })
}

// Usage
const confirmed = await Alert.confirmDestructive(
  "Delete Task",
  "Are you sure you want to delete this task?"
)
if (confirmed) {
  await deleteTask(id)
}
```

### Storage Abstraction

```tsx
// src/lib/storage.ts
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

export const storage = {
  async getItem(key: string) {
    if (Platform.OS === "web") {
      return localStorage.getItem(key)
    }
    return SecureStore.getItemAsync(key)
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value)
    } else {
      await SecureStore.setItemAsync(key, value)
    }
  },
  // ...
}
```

## NativeWind Setup

### Dependencies

```bash
pnpm add nativewind tailwindcss
pnpm add clsx tailwind-merge class-variance-authority
pnpm add react-native-reanimated
```

### Configuration Files

**babel.config.js:**
```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  }
}
```

**metro.config.js:**
```js
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)
module.exports = withNativeWind(config, { input: "./src/styles/globals.css" })
```

**nativewind-env.d.ts:**
```ts
/// <reference types="nativewind/types" />
```

**app/_layout.tsx:**
```tsx
import "../src/styles/globals.css"
// ... rest of layout
```

## Summary: DX Comparison

| Aspect | Web | Mobile | Difference |
|--------|-----|--------|------------|
| Styling | `className="..."` | `className="..."` | **Same** (NativeWind) |
| Variants | CVA | CVA | **Same** |
| Merging | cn() | cn() | **Same** |
| Theming | CSS variables | CSS variables | **Same** |
| Components | shadcn/ui | Custom primitives | **Same API** |
| Events | onClick | onPress | Minor rename |
| Text | Implicit | Explicit `<Text>` | React Native requirement |

**Result:** Developers familiar with shadcn/ui on web can immediately build mobile UIs with the same patterns, same class names, and same component APIs.

---

## Practical Examples: DX Side-by-Side

The following examples demonstrate the **developer experience** when building the same UI on both platforms.

### Example 1: Accordion Component

The Accordion is a compound component that shows/hides content. On web, it uses **Radix UI primitives**. On mobile, we replicate the same API using **Pressable + Animated**.

#### Web Implementation (shadcn/ui + Radix)

```tsx
// repo/packages/core/src/components/ui/accordion.tsx
"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon } from "@radix-ui/react-icons"
import { cn } from "../../lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
))

const AccordionTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-sm font-medium",
        "[&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))

const AccordionContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```

#### Mobile Implementation (NativeWind + Animated)

```tsx
// apps/mobile-dev/src/components/ui/accordion.tsx
import { useState } from "react"
import { View, Pressable, LayoutAnimation } from "react-native"
import { ChevronDown } from "lucide-react-native"
import { cn } from "@/src/lib/utils"
import { Text } from "./text"

interface AccordionItemData {
  value: string
  trigger: string
  content: React.ReactNode
}

interface AccordionProps {
  items: AccordionItemData[]
  type?: "single" | "multiple"
  className?: string
}

export function Accordion({ items, type = "single", className }: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggle = (value: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    if (type === "single") {
      setOpenItems(openItems.includes(value) ? [] : [value])
    } else {
      setOpenItems(
        openItems.includes(value)
          ? openItems.filter((v) => v !== value)
          : [...openItems, value]
      )
    }
  }

  return (
    <View className={cn("w-full", className)}>
      {items.map((item) => (
        <AccordionItem
          key={item.value}
          isOpen={openItems.includes(item.value)}
          onToggle={() => toggle(item.value)}
          trigger={item.trigger}
          content={item.content}
        />
      ))}
    </View>
  )
}

function AccordionItem({ isOpen, onToggle, trigger, content }) {
  return (
    <View className="border-b border-border">
      <AccordionTrigger onPress={onToggle} isOpen={isOpen}>
        {trigger}
      </AccordionTrigger>
      {isOpen && <AccordionContent>{content}</AccordionContent>}
    </View>
  )
}

function AccordionTrigger({ children, onPress, isOpen, className }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center justify-between py-4",
        className
      )}
    >
      <Text className="text-sm font-medium">{children}</Text>
      <ChevronDown
        size={16}
        color="#737373"
        style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
      />
    </Pressable>
  )
}

function AccordionContent({ children, className }) {
  return (
    <View className={cn("pb-4", className)}>
      {typeof children === "string" ? (
        <Text className="text-sm text-muted-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  )
}

export { AccordionItem, AccordionTrigger, AccordionContent }
```

#### Usage Comparison

| Platform | Code |
|----------|------|
| **Web** | `<Accordion type="single"><AccordionItem value="item-1"><AccordionTrigger>FAQ 1</AccordionTrigger><AccordionContent>Answer...</AccordionContent></AccordionItem></Accordion>` |
| **Mobile** | `<Accordion type="single" items={[{ value: "item-1", trigger: "FAQ 1", content: "Answer..." }]} />` |

**DX Verdict:**
- Web uses **compound components** pattern (more flexible but verbose)
- Mobile uses **data-driven** pattern (simpler API for common cases)
- Both achieve the same visual result with **identical Tailwind classes**

---

### Example 2: Button Component with Loading State

Let's build a "Submit" button with loading state on both platforms.

#### Web Usage

```tsx
// NextSpark Web - Using shadcn/ui Button
import { Button } from "@nextsparkjs/core/components/ui/button"
import { Loader2 } from "lucide-react"

function SubmitButton({ isLoading, onSubmit }) {
  return (
    <Button
      onClick={onSubmit}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Guardando...
        </>
      ) : (
        "Guardar Cambios"
      )}
    </Button>
  )
}
```

#### Mobile Usage

```tsx
// NextSpark Mobile - Using custom Button
import { Button } from "@/src/components/ui"

function SubmitButton({ isLoading, onSubmit }) {
  return (
    <Button
      onPress={onSubmit}
      disabled={isLoading}
      isLoading={isLoading}
      className="w-full"
    >
      {isLoading ? "Guardando..." : "Guardar Cambios"}
    </Button>
  )
}
```

#### Side-by-Side Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                         WEB                                      │
├─────────────────────────────────────────────────────────────────┤
│  <Button                                                         │
│    onClick={onSubmit}           ← Event handler                  │
│    disabled={isLoading}         ← Disabled state                 │
│    className="w-full"           ← Tailwind classes               │
│  >                                                               │
│    {isLoading ? (                                                │
│      <>                                                          │
│        <Loader2 className="animate-spin" />  ← Manual spinner    │
│        Guardando...                                              │
│      </>                                                         │
│    ) : "Guardar Cambios"}                                        │
│  </Button>                                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE                                    │
├─────────────────────────────────────────────────────────────────┤
│  <Button                                                         │
│    onPress={onSubmit}           ← Event handler (renamed)        │
│    disabled={isLoading}         ← Disabled state                 │
│    isLoading={isLoading}        ← Built-in loading (optional)    │
│    className="w-full"           ← Tailwind classes               │
│  >                                                               │
│    {isLoading ? "Guardando..." : "Guardar Cambios"}              │
│  </Button>                      ← Spinner handled internally     │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Differences

| Aspect | Web | Mobile | Notes |
|--------|-----|--------|-------|
| Event | `onClick` | `onPress` | React Native convention |
| Loading | Manual `<Loader2>` | Built-in `isLoading` prop | Mobile simplifies common pattern |
| Spinner | `animate-spin` CSS | `ActivityIndicator` | Native component |
| Classes | Identical | Identical | `w-full`, `bg-primary`, etc. |

**DX Verdict:** The mobile Button has a **slightly better DX** for loading states (built-in prop), while keeping the same Tailwind class API. A developer can switch between platforms with minimal mental overhead.

---

## Final Developer Experience Summary

### What Stays Identical

```tsx
// These patterns work exactly the same on both platforms:

// 1. Tailwind classes
className="flex-row items-center justify-between p-4 bg-card rounded-lg border"

// 2. cn() utility for conditional classes
className={cn(
  "p-4 rounded-lg",
  isActive && "bg-primary",
  disabled && "opacity-50"
)}

// 3. CVA variants
<Button variant="destructive" size="lg">Delete</Button>
<Badge variant="success">Active</Badge>

// 4. Compound components
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>

// 5. Semantic color tokens
bg-background, text-foreground, border-border, bg-primary, text-muted-foreground
```

### What Changes (Minor)

| Web | Mobile | Why |
|-----|--------|-----|
| `onClick` | `onPress` | React Native event naming |
| `onChange` | `onChangeText` | TextInput API difference |
| `<span>text</span>` | `<Text>text</Text>` | RN requires explicit Text |
| `hover:bg-accent` | `active:opacity-80` | No hover on touch devices |
| `space-y-4` | `gap-4` | RN uses flex gap natively |

### Learning Curve for shadcn/ui Developers

```
Day 1: "Wait, I can use Tailwind classes in React Native?"
       → Yes, NativeWind compiles them to StyleSheet

Day 2: "The Button component looks almost identical..."
       → That's the point. Same API, same variants.

Day 3: "I need an Accordion. There's no Radix on mobile."
       → We built one with the same API using Pressable + Animated.

Day 4: "I'm just writing the same code I would on web."
       → Mission accomplished. ✅
```

### Conclusion

The combination of **NativeWind + shadcn-style primitives** achieves:

1. **~95% identical class names** between web and mobile
2. **Same component APIs** (Button, Card, Badge, Input, etc.)
3. **Same utility patterns** (cn(), CVA variants)
4. **Same theming system** (CSS variables mapped to Tailwind)
5. **Minimal context switching** for developers

A frontend developer experienced with NextSpark Web can productively build mobile UIs **within hours**, not days.
