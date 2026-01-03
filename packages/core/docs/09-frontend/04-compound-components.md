# Compound Components

## Introduction

Compound components are a React pattern where multiple components work together to create a cohesive UI element. Instead of passing many props to a single component, compound components distribute responsibilities across multiple sub-components that share implicit state through Context API.

**Key Principles:**
- **Implicit State Sharing** - Sub-components access parent state via Context
- **Flexible Composition** - Users compose components in any order
- **Clear Relationships** - Component naming shows parent-child relationships
- **Encapsulated Logic** - Complex state management hidden from consumers
- **Type Safety** - Full TypeScript support across component tree
- **Inversion of Control** - Users control layout and structure

---

## 1. The Compound Component Pattern

### Traditional Approach (Props Drilling)

```typescript
// ❌ NOT RECOMMENDED - Too many props
<Accordion
  items={[
    {
      title: 'Section 1',
      content: 'Content 1',
      icon: <ChevronDown />,
      defaultOpen: true
    },
    {
      title: 'Section 2',
      content: 'Content 2'
    }
  ]}
  allowMultiple={false}
  className="my-accordion"
/>
```

**Problems:**
- Inflexible - hard to customize individual items
- Limited composition - can't nest complex content easily
- Props explosion - too many configuration options
- Hard to extend - adding features requires API changes

### Compound Component Approach

```typescript
// ✅ RECOMMENDED - Flexible composition
<Accordion type="single" defaultValue="item-1">
  <AccordionItem value="item-1">
    <AccordionTrigger>
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4" />
        <span>Section 1</span>
      </div>
    </AccordionTrigger>
    <AccordionContent>
      <p>Any complex content here</p>
      <Button>Action</Button>
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-2">
    <AccordionTrigger>Section 2</AccordionTrigger>
    <AccordionContent>
      <CustomComponent />
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Benefits:**
- Flexible - full control over structure and content
- Composable - nest any components inside
- Clean API - minimal props, clear intent
- Extensible - add features without breaking changes

---

## 2. Implementation Pattern

### Basic Structure

```typescript
// 1. Create Context for shared state
const AccordionContext = createContext<AccordionContextValue | null>(null)

// 2. Parent component provides context
export function Accordion({ children, ...props }: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>([])

  const contextValue = {
    openItems,
    toggleItem: (value: string) => {
      // State management logic
    }
  }

  return (
    <AccordionContext.Provider value={contextValue}>
      <div {...props}>{children}</div>
    </AccordionContext.Provider>
  )
}

// 3. Child components consume context
export function AccordionItem({ value, children }: AccordionItemProps) {
  const context = useContext(AccordionContext)

  if (!context) {
    throw new Error('AccordionItem must be used within Accordion')
  }

  const isOpen = context.openItems.includes(value)

  return (
    <div data-state={isOpen ? 'open' : 'closed'}>
      {children}
    </div>
  )
}

// 4. Create custom hook for type safety
function useAccordion() {
  const context = useContext(AccordionContext)

  if (!context) {
    throw new Error('useAccordion must be used within Accordion')
  }

  return context
}
```

---

## 3. Real-World Examples

### 3.1 Form Compound Component

```typescript
// core/components/ui/form.tsx
'use client'

import * as React from 'react'
import { useFormContext, Controller, FormProvider } from 'react-hook-form'
import { Label } from '@/core/components/ui/label'
import { cn } from '@/core/lib/utils'

// 1. Context for form field state
type FormFieldContextValue = {
  name: string
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

// 2. Root component (wraps React Hook Form)
const Form = FormProvider

// 3. Field-level component
const FormField = <TFieldValues extends FieldValues = FieldValues>({
  ...props
}: ControllerProps<TFieldValues>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

// 4. Item wrapper component
const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId()

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('space-y-2', className)} {...props} />
      </FormItemContext.Provider>
    )
  }
)
FormItem.displayName = 'FormItem'

// 5. Custom hook for accessing context
const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

// 6. Label component
const FormLabel = React.forwardRef<HTMLLabelElement, React.ComponentProps<typeof Label>>(
  ({ className, ...props }, ref) => {
    const { error, formItemId } = useFormField()

    return (
      <Label
        ref={ref}
        className={cn(error && 'text-destructive', className)}
        htmlFor={formItemId}
        {...props}
      />
    )
  }
)
FormLabel.displayName = 'FormLabel'

// 7. Control component (wraps input)
const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={
          !error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`
        }
        aria-invalid={!!error}
        {...props}
      />
    )
  }
)
FormControl.displayName = 'FormControl'

// 8. Description component
const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField()

    return (
      <p
        ref={ref}
        id={formDescriptionId}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    )
  }
)
FormDescription.displayName = 'FormDescription'

// 9. Error message component
const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField()
    const body = error ? String(error?.message) : children

    if (!body) {
      return null
    }

    return (
      <p
        ref={ref}
        id={formMessageId}
        className={cn('text-sm font-medium text-destructive', className)}
        {...props}
      >
        {body}
      </p>
    )
  }
)
FormMessage.displayName = 'FormMessage'

export {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  useFormField,
}
```

**Usage:**

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/core/components/ui/form'
import { Input } from '@/core/components/ui/input'
import { Button } from '@/core/components/ui/button'

const formSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
})

export function ProfileForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Save Profile</Button>
      </form>
    </Form>
  )
}
```

---

### 3.2 Card Compound Component

```typescript
// core/components/ui/card.tsx
import * as React from 'react'
import { cn } from '@/core/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border bg-card text-card-foreground shadow', className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

**Usage:**

```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card'
import { Button } from '@/core/components/ui/button'

export function ProductCard({ product }: { product: Product }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.category}</CardDescription>
      </CardHeader>
      <CardContent>
        <img src={product.image} alt={product.name} className="w-full h-48 object-cover rounded-md" />
        <p className="mt-4">{product.description}</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <span className="text-2xl font-bold">${product.price}</span>
        <Button>Add to Cart</Button>
      </CardFooter>
    </Card>
  )
}
```

---

### 3.3 Tabs Compound Component

```typescript
// core/components/ui/tabs.tsx (simplified)
'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/core/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

**Usage:**

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card'

export function SettingsTabs() {
  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>

      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Make changes to your account here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="Pedro Duarte" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input id="username" defaultValue="@peduarte" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="password">
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Change your password here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Password fields */}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notifications">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Manage your notification preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Notification settings */}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
```

---

## 4. When to Use Compound Components

### ✅ Use Compound Components When:

**Complex State Management**
- Multiple sub-components need to share state
- State transitions affect multiple children
- User interactions cascade through component tree

**Flexible Composition**
- Users need control over layout
- Content varies significantly between uses
- Custom styling per sub-component required

**Clear Hierarchies**
- Parent-child relationships are intuitive
- Component names clearly show relationships
- Nesting makes semantic sense

**Examples:**
- Forms (Form, FormField, FormLabel, FormControl, FormMessage)
- Cards (Card, CardHeader, CardTitle, CardContent, CardFooter)
- Modals (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter)
- Tabs (Tabs, TabsList, TabsTrigger, TabsContent)
- Accordions (Accordion, AccordionItem, AccordionTrigger, AccordionContent)

### ❌ Don't Use Compound Components When:

**Simple Components**
- Single responsibility
- No shared state needed
- Few configuration options

**Fixed Structure**
- Layout never changes
- Content is always the same structure
- No customization needed

**Performance Critical**
- Context updates cause unnecessary re-renders
- Simple props would be more efficient
- Minimal state sharing

**Examples:**
- Button (simple component, no children state)
- Badge (display only, no interaction)
- Avatar (fixed structure)
- Separator (no state)

---

## 5. Advanced Patterns

### 5.1 Compound Components with TypeScript Generics

```typescript
interface SelectContextValue<T> {
  value: T
  onChange: (value: T) => void
}

const SelectContext = createContext<SelectContextValue<any> | null>(null)

function Select<T>({ value, onChange, children }: SelectProps<T>) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      {children}
    </SelectContext.Provider>
  )
}

function SelectOption<T>({ value, children }: SelectOptionProps<T>) {
  const context = useContext(SelectContext) as SelectContextValue<T>

  return (
    <button
      onClick={() => context.onChange(value)}
      className={context.value === value ? 'selected' : ''}
    >
      {children}
    </button>
  )
}

// Usage - fully type-safe
<Select<number> value={selectedId} onChange={setSelectedId}>
  <SelectOption value={1}>Option 1</SelectOption>
  <SelectOption value={2}>Option 2</SelectOption>
</Select>
```

### 5.2 Compound Components with Render Props

```typescript
<Form>
  {({ values, errors, isSubmitting }) => (
    <form>
      <FormField name="email">
        {({ field, meta }) => (
          <div>
            <input {...field} />
            {meta.touched && meta.error && <span>{meta.error}</span>}
          </div>
        )}
      </FormField>
    </form>
  )}
</Form>
```

### 5.3 Compound Components with Slots

```typescript
interface DialogProps {
  children: React.ReactNode
  trigger?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
}

export function Dialog({ children, trigger, title, description, footer }: DialogProps) {
  return (
    <DialogPrimitive.Root>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Content>
        {title && <DialogPrimitive.Title>{title}</DialogPrimitive.Title>}
        {description && <DialogPrimitive.Description>{description}</DialogPrimitive.Description>}
        {children}
        {footer && <div className="dialog-footer">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  )
}

// Usage: Flexible composition
<Dialog
  trigger={<Button>Open</Button>}
  title="Confirm Action"
  description="Are you sure?"
  footer={
    <>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </>
  }
>
  <p>This action cannot be undone.</p>
</Dialog>
```

---

## 6. Best Practices

### 6.1 Always Validate Context

```typescript
// ✅ CORRECT - Throw error if used outside provider
function useFormField() {
  const context = useContext(FormFieldContext)

  if (!context) {
    throw new Error('useFormField must be used within <FormField>')
  }

  return context
}

// ❌ WRONG - No validation
function useFormField() {
  return useContext(FormFieldContext)  // Could be null
}
```

### 6.2 Use displayName for Debugging

```typescript
// ✅ CORRECT - Set displayName
const FormItem = React.forwardRef<HTMLDivElement>(({ ...props }, ref) => (
  <div ref={ref} {...props} />
))
FormItem.displayName = 'FormItem'

// ❌ WRONG - No displayName
const FormItem = React.forwardRef<HTMLDivElement>(({ ...props }, ref) => (
  <div ref={ref} {...props} />
))
```

### 6.3 Provide Sensible Defaults

```typescript
// ✅ CORRECT - Default values in context
const AccordionContext = createContext<AccordionContextValue>({
  type: 'single',
  value: '',
  onValueChange: () => {},
})

// ❌ WRONG - Nullable context
const AccordionContext = createContext<AccordionContextValue | null>(null)
```

### 6.4 Export Custom Hooks

```typescript
// ✅ CORRECT - Export hook for consumers
export function useFormField() {
  const context = useContext(FormFieldContext)
  if (!context) throw new Error('...')
  return context
}

// Allow advanced users to access context directly
export { FormFieldContext }
```

---

## Resources

**Related Documentation:**
- [Component Architecture](./01-component-architecture.md)
- [shadcn/ui Integration](./02-shadcn-ui-integration.md)
- [Custom Components](./03-custom-components.md)
- [State Management](./05-state-management.md)

**Related Files:**
- `core/components/ui/form.tsx` - Form compound component
- `core/components/ui/card.tsx` - Card compound component
- `core/components/ui/tabs.tsx` - Tabs compound component

**External Resources:**
- [Compound Components Pattern](https://kentcdodds.com/blog/compound-components-with-react-hooks)
- [React Context API](https://react.dev/reference/react/useContext)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
