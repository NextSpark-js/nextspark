# shadcn/ui Integration

## Introduction

The application uses **shadcn/ui** as its foundational UI component library. shadcn/ui is not a traditional component library but rather a collection of re-usable components that you can copy and paste into your apps. Built on Radix UI primitives and styled with Tailwind CSS, it provides accessible, customizable, and theme-aware components out of the box.

**Key Principles:**
- **Copy, Don't Install** - Components are copied into your codebase, not installed as dependencies
- **Radix UI Foundation** - All components built on accessible Radix UI primitives
- **Tailwind-First** - Styled entirely with Tailwind CSS utilities
- **Theme-Aware** - Uses CSS variables for complete theme customization
- **Fully Customizable** - Components live in your codebase, modify as needed
- **TypeScript Native** - Full type safety with TypeScript

---

## 1. What is shadcn/ui?

### Overview

shadcn/ui is a component collection that differs from traditional UI libraries:

**Traditional Library:**
```bash
npm install ui-library      # Install as dependency
import { Button } from 'ui-library'  # Import from node_modules
```

**shadcn/ui Approach:**
```bash
npx shadcn@latest add button  # Copies component to your project
import { Button } from '@/core/components/ui/button'  # Import from your code
```

### Architecture

```text
shadcn/ui Component Stack:
┌─────────────────────────────┐
│   shadcn/ui Component       │ ← Your customizable code
├─────────────────────────────┤
│   Tailwind CSS Classes      │ ← Styling layer
├─────────────────────────────┤
│   Radix UI Primitives       │ ← Accessibility & behavior
├─────────────────────────────┤
│   React Components          │ ← Base layer
└─────────────────────────────┘
```

### Benefits

1. **Full Control** - Components live in your codebase, no version lock-in
2. **No Bundle Bloat** - Only include components you actually use
3. **Easy Customization** - Modify components directly, no wrapper components needed
4. **Type Safety** - Full TypeScript support with proper types
5. **Accessibility** - Built on Radix UI's accessible primitives
6. **Theme System** - CSS variable-based theming works automatically

---

## 2. Installation & Setup

### Initial Setup

The project is already configured with shadcn/ui. Here's how it was set up:

**1. Initialize shadcn/ui:**

```bash
npx shadcn@latest init
```

**2. Configuration File (`components.json`):**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "core/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/core/components",
    "utils": "@/core/lib/utils",
    "ui": "@/core/components/ui",
    "lib": "@/core/lib",
    "hooks": "@/core/hooks"
  }
}
```

**3. Tailwind Configuration:**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './core/**/*.{js,ts,jsx,tsx,mdx}',
    './contents/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}

export default config
```

**4. Global CSS Variables:**

```css
/* core/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

### Dependencies

**Core Dependencies:**

```json
{
  "dependencies": {
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-context-menu": "^2.2.16",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-menubar": "^1.1.16",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-tooltip": "^1.2.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "shadcn": "^3.5.0"
  }
}
```

### Utility Functions

**The `cn` Utility (`core/lib/utils.ts`):**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Purpose:**
- Merges Tailwind classes intelligently
- Handles conditional classes
- Prevents style conflicts

**Usage:**

```typescript
// ✅ CORRECT - Conditional classes with cn
<div className={cn(
  "bg-primary text-white p-4",
  isActive && "bg-secondary",
  className  // Allow external className override
)} />

// ❌ WRONG - Manual string concatenation
<div className={`bg-primary text-white p-4 ${isActive ? 'bg-secondary' : ''} ${className}`} />
```

---

## 3. Adding Components

### Adding New Components

**Command:**

```bash
npx shadcn@latest add [component-name]
```

**Examples:**

```bash
# Add single component
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add dialog

# Add multiple components
npx shadcn@latest add button input form

# Add all components (not recommended)
npx shadcn@latest add --all
```

**What Happens:**

1. Component file created in `core/components/ui/[component].tsx`
2. Dependencies automatically added to `package.json`
3. Component ready to use immediately

### Example: Adding a New Component

```bash
npx shadcn@latest add badge
```

**Result:**

```typescript
// core/components/ui/badge.tsx (created)
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/core/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
```

---

## 4. Component Inventory

### Currently Installed Components

The project includes **60+ shadcn/ui components**:

#### Form Controls
- **button** - Button component with variants
- **input** - Text input field
- **textarea** - Multiline text input
- **select** - Dropdown select
- **checkbox** - Checkbox input
- **radio-group** - Radio button group
- **switch** - Toggle switch
- **slider** - Range slider
- **label** - Form label
- **form** - Form wrapper with validation

#### Layout
- **card** - Card container with header, content, footer
- **separator** - Horizontal/vertical divider
- **tabs** - Tabbed interface
- **accordion** - Collapsible sections
- **collapsible** - Single collapsible section
- **sheet** - Side panel/drawer
- **dialog** - Modal dialog
- **scroll-area** - Custom scrollbar container

#### Data Display
- **table** - Data table
- **badge** - Status badge
- **avatar** - User avatar with fallback
- **skeleton** - Loading skeleton
- **progress** - Progress bar
- **rating** - Star rating (custom)

#### Navigation
- **breadcrumb** - Breadcrumb navigation
- **menubar** - Menubar with dropdowns
- **pagination** - Page navigation
- **command** - Command palette (⌘K)
- **dropdown-menu** - Dropdown menu
- **context-menu** - Right-click menu

#### Feedback
- **alert** - Alert message
- **toast** - Toast notification (Sonner)
- **tooltip** - Hover tooltip
- **popover** - Popover container

#### Specialized (Custom Extensions)
- **address-input** - Address autocomplete
- **phone-input** - Phone number input with country code
- **file-upload** - File uploader
- **image-upload** - Image uploader with preview
- **audio-upload** - Audio file uploader
- **video-upload** - Video file uploader
- **country-select** - Country dropdown
- **currency-select** - Currency dropdown
- **timezone-select** - Timezone picker
- **user-select** - User autocomplete
- **tags-input** - Tag input field
- **double-range** - Dual handle range slider
- **password-input** - Password field with show/hide
- **combobox** - Searchable select
- **multi-select** - Multiple selection dropdown
- **relation-display** - Entity relation display
- **simple-relation-select** - Simple relation picker

---

## 5. Component Anatomy

### Basic Component Structure

**Example: Card Component**

```typescript
// core/components/ui/card.tsx
import * as React from "react"
import { cn } from "@/core/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

**Key Patterns:**

1. **React.forwardRef** - Proper ref forwarding
2. **displayName** - Better debugging experience
3. **cn utility** - Class merging with overrides
4. **Spread props** - Forward all HTML attributes
5. **TypeScript** - Full type safety

### Variant-Based Components

**Example: Button Component with CVA**

```typescript
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
```

**Benefits:**
- Type-safe variants
- Easy to extend
- Autocomplete support
- Compile-time safety

---

## 6. Customizing Components

### Styling Customization

**Method 1: className Override**

```typescript
// ✅ CORRECT - Override with className
<Button className="rounded-full">
  Rounded Button
</Button>

<Card className="border-2 border-primary">
  Custom Border
</Card>
```

**Method 2: Modify Component File**

```typescript
// core/components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center...",
  {
    variants: {
      variant: {
        // Add custom variant
        gradient: "bg-gradient-to-r from-primary to-secondary text-white",
        // ... existing variants
      },
    },
  }
)

// Usage
<Button variant="gradient">Gradient Button</Button>
```

**Method 3: Extend with New Variants**

```typescript
// core/components/ui/button.tsx
const buttonVariants = cva(
  // ... base styles
  {
    variants: {
      variant: {
        // ... existing variants
      },
      size: {
        // ... existing sizes
      },
      // ✅ Add new variant dimension
      rounded: {
        none: "rounded-none",
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "md",
    },
  }
)

// Usage
<Button variant="primary" size="lg" rounded="full">
  Fully Rounded
</Button>
```

### Theme Customization

**Global Theme Variables:**

```css
/* core/globals.css */
:root {
  /* ✅ Customize primary color */
  --primary: 221.2 83.2% 53.3%;  /* Blue */
  --primary-foreground: 210 40% 98%;

  /* ✅ Customize radius */
  --radius: 0.5rem;  /* Change to 0.75rem for more rounded */
}

/* Custom theme for a specific section */
.theme-premium {
  --primary: 280 70% 55%;  /* Purple */
  --secondary: 340 75% 50%;  /* Pink */
}
```

**Usage:**

```typescript
// Apply custom theme to a section
<div className="theme-premium">
  <Button>Premium Button</Button>
  {/* All components in this section use premium colors */}
</div>
```

---

## 7. When to Use shadcn vs Custom

### Use shadcn/ui Components When:

✅ **Standard UI patterns**
- Buttons, inputs, forms
- Cards, dialogs, dropdowns
- Tables, tabs, accordions

✅ **Accessibility is critical**
- All shadcn components have ARIA support
- Keyboard navigation built-in
- Screen reader friendly

✅ **Rapid development**
- Need components quickly
- Standard behavior is sufficient
- Theming via CSS variables works

✅ **Examples:**

```typescript
// ✅ Use shadcn Button
<Button variant="outline" size="lg">
  Sign Up
</Button>

// ✅ Use shadcn Dialog
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Modal</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Create Custom Components When:

❌ **Complex domain logic**
- Entity-specific components (EntityList, EntityForm)
- Business logic embedded in component
- Complex state management

❌ **Unique UX requirements**
- Non-standard interaction patterns
- Custom animations
- Specialized layouts

❌ **Heavy integration**
- TanStack Query integration
- Registry-based loading
- Permission-aware rendering

❌ **Examples:**

```typescript
// ❌ Don't use shadcn - Create custom
<EntityList
  entityType="products"
  enableSearch={true}
  permissions={userPermissions}
  onRowClick={handleRowClick}
/>

// ❌ Don't use shadcn - Create custom
<AddressInput
  value={address}
  onChange={setAddress}
  enableGeocoding={true}
  restrictToCountries={['US', 'CA']}
/>
```

### Hybrid Approach (Recommended)

```typescript
// ✅ CORRECT - Combine shadcn with custom logic
import { Card, CardHeader, CardTitle, CardContent } from '@/core/components/ui/card'
import { Button } from '@/core/components/ui/button'
import { useEntityQuery } from '@/core/hooks/useEntityQuery'

export function ProductCard({ productId }: { productId: string }) {
  const { data: product, isLoading } = useEntityQuery('products', productId)

  if (isLoading) return <Skeleton />

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{product.description}</p>
        <div className="flex justify-between mt-4">
          <span className="text-2xl font-bold">${product.price}</span>
          <Button onClick={() => addToCart(product)}>
            Add to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 8. Maintaining Components

### Updating Components

**Update Single Component:**

```bash
npx shadcn@latest add button --overwrite
```

**Update All Components (Careful!):**

```bash
npx shadcn@latest diff
```

### Version Control

**Track Changes:**

```bash
# Before updating
git diff core/components/ui/button.tsx

# After reviewing changes
git add core/components/ui/button.tsx
git commit -m "Update button component from shadcn"
```

### Migration Strategy

When shadcn/ui releases updates:

1. **Check changelog** for breaking changes
2. **Test in isolation** before updating all components
3. **Review diffs** carefully
4. **Update incrementally** component by component
5. **Run tests** after each update

---

## 9. Advanced Patterns

### Polymorphic Components with asChild

```typescript
import { Slot } from "@radix-ui/react-slot"

export interface ButtonProps {
  asChild?: boolean
  // ... other props
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp ref={ref} {...props} />
  }
)

// Usage: Render as different elements
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>

<Button asChild>
  <Link to="/settings">Settings</Link>
</Button>
```

### Compound Components

```typescript
// ✅ CORRECT - Compose Card with subcomponents
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/core/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>User Profile</CardTitle>
    <CardDescription>Manage your account settings</CardDescription>
  </CardHeader>
  <CardContent>
    <UserForm />
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="outline">Cancel</Button>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>

// ❌ WRONG - Using Card alone without composition
<Card>
  <h3>User Profile</h3>
  <p>Manage your account settings</p>
  <UserForm />
  <div>
    <button>Cancel</button>
    <button>Save</button>
  </div>
</Card>
```

### Context-Based Components

```typescript
// Form component with context
import { FormProvider, useFormContext } from 'react-hook-form'

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

---

## 10. Common Patterns

### Form with Validation

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/core/components/ui/form'
import { Input } from '@/core/components/ui/input'
import { Button } from '@/core/components/ui/button'

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Handle form submission
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
    </Form>
  )
}
```

### Modal Dialog

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/core/components/ui/dialog'
import { Button } from '@/core/components/ui/button'
import { Input } from '@/core/components/ui/input'

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input placeholder="Full Name" />
          <Input type="email" placeholder="Email" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Data Table

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table'
import { Badge } from '@/core/components/ui/badge'
import { Button } from '@/core/components/ui/button'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

export function UsersTable({ users }: { users: User[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role}
              </Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="sm">Edit</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

## Resources

**Related Documentation:**
- [Component Architecture](./01-component-architecture.md)
- [Custom Components](./03-custom-components.md)
- [Compound Components](./04-compound-components.md)
- [Accessibility](./07-accessibility.md)

**Related Files:**
- `core/components/ui/` - shadcn/ui components
- `core/lib/utils.ts` - cn utility function
- `core/globals.css` - Global CSS variables
- `components.json` - shadcn/ui configuration

**External Resources:**
- [shadcn/ui Official Documentation](https://ui.shadcn.com)
- [Radix UI Documentation](https://www.radix-ui.com)
- [class-variance-authority](https://cva.style/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
