# Component Architecture

## Introduction

The component architecture follows a clear, scalable organization pattern that separates concerns while maximizing reusability. Components are organized by purpose and responsibility, with a strong emphasis on composition, type safety, and maintainability.

**Key Principles:**
- **Separation of Concerns** - Components organized by domain (ui/, entities/, auth/, dashboard/)
- **Composition Over Inheritance** - Build complex components by composing simpler ones
- **Type Safety First** - Full TypeScript coverage with strict prop types
- **Registry-Based Loading** - Entity components load from build-time registries
- **shadcn/ui Foundation** - All UI components built on shadcn/ui primitives
- **Theme Awareness** - Components use CSS variables for consistent theming

---

## 1. Component Organization

### Directory Structure

```text
core/components/
├── ui/                          # Base UI components (shadcn/ui + custom)
│   ├── button.tsx              # Primitive components
│   ├── form.tsx                # Compound form components
│   ├── input.tsx
│   ├── address-input.tsx       # Custom specialized inputs
│   ├── image-upload.tsx
│   └── ...                     # 60+ components total
│
├── entities/                   # Entity-specific components
│   ├── EntityList/             # Universal list component
│   ├── EntityForm/             # Universal form component
│   ├── EntityDetail/           # Universal detail view
│   ├── EntityNavigation/       # Dynamic navigation
│   └── wrappers/               # Entity wrapper components
│
├── auth/                       # Authentication components
│   ├── forms/                  # Login, signup, password reset
│   └── layouts/                # Auth page layouts
│
├── dashboard/                  # Dashboard-specific components
│   ├── navigation/             # Sidebar, topbar
│   ├── layouts/                # Dashboard layouts
│   ├── mobile/                 # Mobile-specific components
│   └── misc/                   # Utility components
│
├── docs/                       # Documentation components
│   ├── navigation/             # Docs sidebar, breadcrumbs
│   └── content/                # Content display components
│
├── app/                        # Application shell components
│   ├── layouts/                # App-level layouts
│   ├── guards/                 # Route guards
│   └── misc/                   # App utilities
│
├── settings/                   # Settings page components
│   └── layouts/                # Settings layouts
│
├── admin/                    # Admin area components
│   ├── layouts/                # Admin layouts
│   └── misc/                   # Admin utilities
│
└── public/                     # Public-facing components
    └── entities/               # Public entity displays
```

**Organization Principles:**

1. **Domain-Based Organization** - Components grouped by functional domain
2. **Flat When Possible** - Avoid deep nesting except for large component families
3. **Co-location** - Related files (tests, styles) near components
4. **Index Exports** - Use barrel exports for cleaner imports

---

## 2. Component Types

### 2.1 UI Components (Primitive)

**Purpose:** Reusable, atomic UI building blocks based on shadcn/ui

**Location:** `core/components/ui/`

**Characteristics:**
- Built on Radix UI primitives
- Fully accessible (ARIA support)
- Theme-aware via CSS variables
- Variant-based styling with CVA (class-variance-authority)
- Type-safe props with TypeScript

**Example: Button Component**

```typescript
// core/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/core/lib/utils"

const buttonVariants = cva(
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
Button.displayName = "Button"
```

**Usage:**

```typescript
// ✅ CORRECT - Variant-based styling
import { Button } from "@/core/components/ui/button"

<Button variant="default">Primary Action</Button>
<Button variant="outline" size="sm">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost" size="icon">
  <Trash className="h-4 w-4" />
</Button>

// ✅ CORRECT - Polymorphic with asChild
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>

// ❌ WRONG - Hardcoded colors (not theme-aware)
<button className="bg-blue-500 text-white">Not Themeable</button>
```

**Available UI Components:**

| Category | Components | Count |
|----------|-----------|-------|
| **Form Controls** | input, textarea, select, checkbox, radio-group, switch, slider | 7 |
| **Buttons & Actions** | button, button-group, toggle, dropdown-menu | 4 |
| **Layout** | card, separator, sheet, dialog, tabs, accordion, collapsible | 7 |
| **Data Display** | table, badge, avatar, skeleton, progress, rating | 6 |
| **Navigation** | breadcrumb, menubar, pagination, command | 4 |
| **Feedback** | alert, toast (sonner), tooltip, popover | 4 |
| **Specialized Inputs** | address-input, phone-input, file-upload, image-upload, audio-upload, video-upload, country-select, currency-select, timezone-select, user-select, tags-input, double-range, date-picker (calendar), color-picker, rich-text-editor | 15 |
| **Utilities** | scroll-area, context-menu, label, form, combobox, multi-select | 6 |

**Total: 60+ UI components**

---

### 2.2 Compound Components

**Purpose:** Complex components built from multiple primitive components

**Pattern:** Context API for internal state sharing

**Example: Form Component**

```typescript
// core/components/ui/form.tsx
import * as React from "react"
import { FormProvider, useFormContext } from "react-hook-form"

// ✅ CORRECT - Compound component pattern
const Form = FormProvider

const FormField = <TFieldValues extends FieldValues>({ ...props }) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const FormItem = React.forwardRef<HTMLDivElement>(({ className, ...props }, ref) => {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})

const FormLabel = React.forwardRef<HTMLLabelElement>((props, ref) => {
  const { formItemId } = useFormField()
  return <Label ref={ref} htmlFor={formItemId} {...props} />
})

const FormControl = React.forwardRef<HTMLDivElement>((props, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  )
})

const FormMessage = React.forwardRef<HTMLParagraphElement>((props, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message) : props.children
  if (!body) return null

  return (
    <p
      ref={ref}
      id={formMessageId}
      className="text-sm font-medium text-destructive"
      {...props}
    >
      {body}
    </p>
  )
})

export { Form, FormField, FormItem, FormLabel, FormControl, FormMessage }
```

**Usage:**

```typescript
// ✅ CORRECT - Compound component composition
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/core/components/ui/form"

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
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
  </form>
</Form>

// ❌ WRONG - Using form primitives without compound pattern
<div className="space-y-2">
  <label htmlFor="email">Email</label>
  <input type="email" id="email" />
  <p className="text-red-500">{error}</p>
</div>
```

**Benefits:**
- Clear component relationships
- Shared context eliminates prop drilling
- Flexible composition
- Type-safe internal communication

---

### 2.3 Entity Components

**Purpose:** Universal components that work with any entity from the registry

**Location:** `core/components/entities/`

**Characteristics:**
- Registry-based entity loading
- Fully dynamic based on entity config
- Permission-aware rendering
- Automatic CRUD operations
- TanStack Query integration

**Example: EntityList Component**

```typescript
// core/components/entities/EntityList/EntityList.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/components/ui/table'
import { Button } from '@/core/components/ui/button'

interface EntityListProps {
  entityType: string
  enableSearch?: boolean
  enableFilters?: boolean
  onRowClick?: (item: any) => void
}

export function EntityList({ entityType, enableSearch, enableFilters, onRowClick }: EntityListProps) {
  // ✅ CORRECT - Registry-based entity config access
  const entityConfig = ENTITY_REGISTRY[entityType]

  if (!entityConfig) {
    return <div>Entity "{entityType}" not found</div>
  }

  const { data: items, isLoading } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => fetch(`/api/v1/${entityType}`).then(res => res.json())
  })

  if (isLoading) return <SkeletonList />

  return (
    <div className="space-y-4">
      {enableSearch && <EntitySearch entityType={entityType} />}
      {enableFilters && <EntityFilters entityType={entityType} />}

      <Table>
        <TableHeader>
          <TableRow>
            {entityConfig.fields.map(field => (
              <TableHead key={field.name}>{field.label}</TableHead>
            ))}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items?.data?.map((item: any) => (
            <TableRow
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className="cursor-pointer hover:bg-muted/50"
            >
              {entityConfig.fields.map(field => (
                <TableCell key={field.name}>
                  {renderFieldValue(item[field.name], field)}
                </TableCell>
              ))}
              <TableCell>
                <Button variant="ghost" size="sm">Edit</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Usage:**

```typescript
// ✅ CORRECT - Works with any entity
<EntityList
  entityType="products"
  enableSearch={true}
  enableFilters={true}
  onRowClick={(product) => router.push(`/products/${product.id}`)}
/>

<EntityList
  entityType="customers"
  enableSearch={true}
/>

// ❌ WRONG - Hardcoded entity-specific list
function ProductList() {
  // This duplicates code that EntityList already provides
  return <Table>...</Table>
}
```

**Entity Component Family:**
- `EntityList` - Universal list with search, filters, sorting
- `EntityForm` - Universal create/edit form
- `EntityDetail` - Universal detail view
- `EntityNavigation` - Dynamic navigation menu
- `EntitySearch` - Universal search component
- `EntityFilters` - Dynamic filter UI

---

### 2.4 Layout Components

**Purpose:** Page structure and composition components

**Locations:**
- `core/components/app/layouts/` - Application-level layouts
- `core/components/dashboard/layouts/` - Dashboard layouts
- `core/components/auth/layouts/` - Authentication layouts
- `core/components/docs/` - Documentation layouts

**Example: Dashboard Layout**

```typescript
// core/components/dashboard/layouts/DashboardLayout.tsx
import { Sidebar } from '@/core/components/dashboard/navigation/Sidebar'
import { Header } from '@/core/components/dashboard/navigation/Header'
import { MobileNav } from '@/core/components/dashboard/mobile/MobileNav'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: SessionUser
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Navigation */}
      <MobileNav user={user} className="lg:hidden" />

      {/* Desktop Sidebar */}
      <Sidebar user={user} className="hidden lg:block" />

      {/* Main Content Area */}
      <div className="lg:pl-64">
        <Header user={user} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Usage:**

```typescript
// ✅ CORRECT - Layout composition
import { DashboardLayout } from '@/core/components/dashboard/layouts/DashboardLayout'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <DashboardLayout user={user}>
      <h1>Welcome to Dashboard</h1>
      {/* Page content */}
    </DashboardLayout>
  )
}

// ❌ WRONG - Duplicating layout structure
export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main>
        <h1>Welcome to Dashboard</h1>
      </main>
    </div>
  )
}
```

---

### 2.5 Domain-Specific Components

**Purpose:** Components specific to a functional area

**Examples:**

**Authentication Components** (`core/components/auth/`)

```typescript
// core/components/auth/forms/LoginForm.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@/core/lib/validation/auth'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/core/components/ui/form'
import { Input } from '@/core/components/ui/input'
import { Button } from '@/core/components/ui/button'
import { PasswordInput } from '@/core/components/ui/password-input'

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  async function onSubmit(data: LoginFormValues) {
    await signIn.email({
      email: data.email,
      password: data.password,
      callbackURL: '/dashboard'
    })
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
                <PasswordInput placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </Form>
  )
}
```

**Documentation Components** (`core/components/docs/`)

```typescript
// core/components/docs/navigation/DocsSidebar.tsx
import { DOCS_REGISTRY } from '@/core/lib/registries/docs-registry'
import { cn } from '@/core/lib/utils'

interface DocsSidebarProps {
  currentPath: string
}

export function DocsSidebar({ currentPath }: DocsSidebarProps) {
  const sections = DOCS_REGISTRY.sections

  return (
    <nav className="w-64 border-r p-4 space-y-6">
      {sections.map(section => (
        <div key={section.slug}>
          <h3 className="font-semibold mb-2">{section.title}</h3>
          <ul className="space-y-1">
            {section.pages.map(page => (
              <li key={page.slug}>
                <Link
                  href={`/docs/${section.slug}/${page.slug}`}
                  className={cn(
                    "block py-1 px-2 rounded text-sm hover:bg-muted",
                    currentPath === page.slug && "bg-muted font-medium"
                  )}
                >
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
```

---

## 3. File Naming Conventions

### 3.1 Component Files

**Pattern:** PascalCase for components, kebab-case for utilities

```text
✅ CORRECT
core/components/ui/button.tsx
core/components/ui/input.tsx
core/components/ui/address-input.tsx
core/components/entities/EntityList/EntityList.tsx
core/components/entities/EntityList/index.ts
core/components/entities/EntityList/EntityList.test.tsx

❌ WRONG
core/components/ui/Button.tsx          // Use lowercase
core/components/ui/Address_Input.tsx   // Use kebab-case
core/components/entities/entity-list.tsx  // No directory for complex components
```

### 3.2 Index Files

**Purpose:** Barrel exports for cleaner imports

```typescript
// ✅ CORRECT - Barrel export pattern
// core/components/entities/EntityList/index.ts
export { EntityList } from './EntityList'
export type { EntityListProps } from './EntityList'

// Enables clean imports
import { EntityList } from '@/core/components/entities/EntityList'

// ❌ WRONG - Direct file imports
import { EntityList } from '@/core/components/entities/EntityList/EntityList'
```

### 3.3 Test Files

**Pattern:** Co-located with component, `.test.tsx` suffix

```text
✅ CORRECT
core/components/ui/button.tsx
core/components/ui/button.test.tsx

core/components/entities/EntityList/EntityList.tsx
core/components/entities/EntityList/EntityList.test.tsx

❌ WRONG
test/components/ui/button.test.tsx     // Not co-located
core/components/ui/button.spec.tsx     // Use .test.tsx
```

---

## 4. Import/Export Patterns

### 4.1 Named Exports (Preferred)

```typescript
// ✅ CORRECT - Named exports for better tree-shaking
// core/components/ui/button.tsx
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...)
export type ButtonProps = { ... }

// Import
import { Button, type ButtonProps } from '@/core/components/ui/button'

// ❌ WRONG - Default exports
export default Button
import Button from '@/core/components/ui/button'
```

### 4.2 Path Aliases

**Configuration:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/core/*": ["./core/*"],
      "@/app/*": ["./app/*"],
      "@/contents/*": ["./contents/*"]
    }
  }
}
```

**Usage:**

```typescript
// ✅ CORRECT - Path aliases
import { Button } from '@/core/components/ui/button'
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { cn } from '@/core/lib/utils'

// ❌ WRONG - Relative paths
import { Button } from '../../../core/components/ui/button'
import { ENTITY_REGISTRY } from '../../lib/registries/entity-registry'
```

### 4.3 Barrel Exports

**Pattern:** Group related exports

```typescript
// ✅ CORRECT - Barrel export
// core/components/ui/index.ts
export { Button } from './button'
export { Input } from './input'
export { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from './form'
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'

// Clean import
import { Button, Input, Form, FormField, Card } from '@/core/components/ui'

// ❌ WRONG - Individual imports
import { Button } from '@/core/components/ui/button'
import { Input } from '@/core/components/ui/input'
import { Form } from '@/core/components/ui/form'
```

---

## 5. Component Composition Patterns

### 5.1 Composition vs Inheritance

**Principle:** Prefer composition over inheritance

```typescript
// ✅ CORRECT - Composition pattern
interface CardProps {
  children: React.ReactNode
  title?: string
  description?: string
  footer?: React.ReactNode
}

export function Card({ children, title, description, footer }: CardProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div>{children}</div>
      {footer && <div className="mt-4 pt-4 border-t">{footer}</div>}
    </div>
  )
}

// Usage: Flexible composition
<Card
  title="User Profile"
  description="Manage your profile settings"
  footer={<Button>Save Changes</Button>}
>
  <UserForm />
</Card>

// ❌ WRONG - Inheritance pattern
class UserProfileCard extends Card {
  constructor(props) {
    super(props)
    this.title = "User Profile"
  }

  render() {
    return (
      <div>
        {super.render()}
        <UserForm />
      </div>
    )
  }
}
```

### 5.2 Render Props Pattern

```typescript
// ✅ CORRECT - Render props for flexible rendering
interface DataTableProps<T> {
  data: T[]
  renderRow: (item: T) => React.ReactNode
  renderEmpty?: () => React.ReactNode
}

export function DataTable<T>({ data, renderRow, renderEmpty }: DataTableProps<T>) {
  if (data.length === 0) {
    return renderEmpty?.() ?? <div>No data available</div>
  }

  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index}>{renderRow(item)}</div>
      ))}
    </div>
  )
}

// Usage: Flexible row rendering
<DataTable
  data={products}
  renderRow={(product) => (
    <ProductCard product={product} />
  )}
  renderEmpty={() => (
    <EmptyState
      title="No products found"
      action={<Button>Add Product</Button>}
    />
  )}
/>
```

### 5.3 Slots Pattern

```typescript
// ✅ CORRECT - Slots for flexible content placement
interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: React.ReactNode
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="border-b bg-background p-6">
      {breadcrumbs && <div className="mb-4">{breadcrumbs}</div>}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        </div>

        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// Usage: Slot-based composition
<PageHeader
  title="Products"
  description="Manage your product inventory"
  breadcrumbs={
    <Breadcrumb>
      <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
      <BreadcrumbItem>Products</BreadcrumbItem>
    </Breadcrumb>
  }
  actions={
    <>
      <Button variant="outline">Import</Button>
      <Button>Add Product</Button>
    </>
  }
/>
```

---

## 6. Core vs Theme Components

### 6.1 Core Components

**Location:** `core/components/`

**Purpose:** Universal, reusable components that work across themes

**Rules:**
- ✅ **DO** use CSS variables for colors
- ✅ **DO** support theme customization via props
- ✅ **DO** provide sensible defaults
- ❌ **DON'T** hardcode theme-specific values
- ❌ **DON'T** import from `@/contents/themes/`

```typescript
// ✅ CORRECT - Core component (theme-agnostic)
export function Button({ variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "bg-primary text-primary-foreground hover:bg-primary/90",
        variantClasses[variant]
      )}
      {...props}
    />
  )
}

// ❌ WRONG - Theme-specific hardcoding
export function Button() {
  return (
    <button className="bg-blue-600 text-white">
      Click me
    </button>
  )
}
```

### 6.2 Theme Components

**Location:** `contents/themes/[theme]/components/`

**Purpose:** Theme-specific component overrides or extensions

**Example:**

```typescript
// contents/themes/default/components/Hero.tsx
'use client'

import { Button } from '@/core/components/ui/button'
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'

export function Hero() {
  const theme = THEME_REGISTRY.default

  return (
    <section
      className="relative h-screen flex items-center justify-center"
      style={{ backgroundImage: `url(${theme.brand.heroBg})` }}
    >
      <div className="text-center space-y-6">
        <img src={theme.brand.logo} alt={theme.name} className="h-16 mx-auto" />
        <h1 className="text-5xl font-bold">Welcome to {theme.name}</h1>
        <p className="text-xl text-muted-foreground">Build amazing SaaS products</p>
        <Button size="lg">Get Started</Button>
      </div>
    </section>
  )
}
```

---

## 7. Component Best Practices

### 7.1 Type Safety

```typescript
// ✅ CORRECT - Strict TypeScript typing
interface UserCardProps {
  user: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  onEdit: (userId: string) => void
  showEmail?: boolean
}

export function UserCard({ user, onEdit, showEmail = true }: UserCardProps) {
  // Implementation
}

// ❌ WRONG - Weak typing
export function UserCard({ user, onEdit, showEmail }: any) {
  // No type safety
}
```

### 7.2 Props Destructuring

```typescript
// ✅ CORRECT - Destructure props with defaults
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export function Button({
  variant = 'default',
  size = 'md',
  disabled = false,
  onClick,
  children
}: ButtonProps) {
  // Implementation
}

// ❌ WRONG - Props object access
export function Button(props: ButtonProps) {
  return (
    <button
      className={props.variant}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  )
}
```

### 7.3 Client vs Server Components

```typescript
// ✅ CORRECT - Server component (default)
// No 'use client' directive
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

export function EntityMetadata({ entityType }: { entityType: string }) {
  const config = ENTITY_REGISTRY[entityType]

  return (
    <div>
      <h2>{config.label}</h2>
      <p>{config.description}</p>
    </div>
  )
}

// ✅ CORRECT - Client component (interactive)
'use client'

import { useState } from 'react'
import { Button } from '@/core/components/ui/button'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <Button onClick={() => setCount(count + 1)}>Increment</Button>
    </div>
  )
}

// ❌ WRONG - Unnecessary 'use client' for static components
'use client'  // Not needed!

export function StaticCard({ title, description }: CardProps) {
  return (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
```

### 7.4 Error Boundaries

```typescript
// ✅ CORRECT - Error boundary for robust UIs
'use client'

import React from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/core/components/ui/alert'
import { Button } from '@/core/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Component error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            {this.state.error?.message}
          </AlertDescription>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </Button>
        </Alert>
      )
    }

    return this.props.children
  }
}

// Usage
<ErrorBoundary>
  <EntityList entityType="products" />
</ErrorBoundary>
```

---

## 8. Component Testing

### 8.1 Unit Tests

```typescript
// core/components/ui/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  test('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  test('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByText('Delete')

    expect(button).toHaveClass('bg-destructive')
  })

  test('disables correctly', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByText('Disabled')).toBeDisabled()
  })
})
```

### 8.2 E2E Tests

```typescript
// test/e2e/components/entity-list.cy.ts
describe('EntityList Component', () => {
  beforeEach(() => {
    cy.login()
    cy.visit('/dashboard/products')
  })

  it('displays product list', () => {
    cy.get('[data-cy=entity-list]').should('be.visible')
    cy.get('[data-cy=entity-list-row]').should('have.length.greaterThan', 0)
  })

  it('filters products by search', () => {
    cy.get('[data-cy=entity-search]').type('Laptop')
    cy.get('[data-cy=entity-list-row]').should('contain', 'Laptop')
  })

  it('navigates to product detail on row click', () => {
    cy.get('[data-cy=entity-list-row]').first().click()
    cy.url().should('include', '/products/')
  })
})
```

---

## Resources

**Related Documentation:**
- [shadcn/ui Integration](./02-shadcn-ui-integration.md)
- [Custom Components](./03-custom-components.md)
- [Compound Components](./04-compound-components.md)
- [State Management](./05-state-management.md)

**Related Files:**
- `core/components/ui/` - UI component library
- `core/components/entities/` - Entity components
- `core/lib/registries/entity-registry.ts` - Entity registry (auto-generated)
- `.rules/components.md` - Component development rules

**External Resources:**
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Documentation](https://www.radix-ui.com)
- [React Server Components](https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023#react-server-components)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
