# Custom Components

## Introduction

Custom components extend the functionality of shadcn/ui primitives to create specialized, domain-specific UI elements. While shadcn/ui provides excellent foundational components, custom components address specific business requirements, complex interactions, and unique user experiences that generic components cannot handle.

**Key Principles:**
- **Single Responsibility** - Each component has one clear purpose
- **Composition Over Complexity** - Build complex UIs by composing simple components
- **Type Safety** - Comprehensive TypeScript interfaces for all props
- **Controlled Components** - Prefer controlled components for predictable state
- **Accessibility First** - ARIA labels, keyboard navigation, screen reader support
- **Performance Aware** - Optimize rendering with React.memo, useCallback, useMemo

---

## 1. When to Create Custom Components

### Create Custom Components When:

✅ **Domain-Specific Logic**
- Business rules embedded in component
- Complex validation requirements
- Specialized data transformations

✅ **Unique User Interactions**
- Non-standard input patterns
- Multi-step workflows
- Custom gestures or animations

✅ **Third-Party Integrations**
- Map components (Google Maps, Mapbox)
- Rich text editors
- File upload with cloud storage

✅ **Performance Critical**
- Virtualized lists for large datasets
- Optimized image galleries
- Real-time data visualizations

### Examples from the Codebase:

**Address Input** (`core/components/ui/address-input.tsx`)
- Domain-specific: Address format validation
- Integration: Potential geocoding API
- Complex state: Multiple related fields

**Image Upload** (`core/components/ui/image-upload.tsx`)
- Third-party: Cloud storage integration
- Validation: File size, type, dimensions
- Preview: Image manipulation and display

**User Select** (`core/components/ui/user-select.tsx`)
- Domain-specific: User search and selection
- Integration: API integration for user search
- Performance: Debounced search, virtualization

---

## 2. Component Patterns

### 2.1 Presentational vs Container Components

**Presentational Components (Dumb/Stateless):**

```typescript
// ✅ CORRECT - Presentational component
interface UserCardProps {
  name: string
  email: string
  avatar?: string
  onEdit: () => void
}

export function UserCard({ name, email, avatar, onEdit }: UserCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4">
        <Avatar>
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback>{name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{name}</CardTitle>
          <CardDescription>{email}</CardDescription>
        </div>
      </CardHeader>
      <CardFooter>
        <Button onClick={onEdit} variant="outline">Edit Profile</Button>
      </CardFooter>
    </Card>
  )
}
```

**Container Components (Smart/Stateful):**

```typescript
// ✅ CORRECT - Container component
'use client'

import { useQuery } from '@tanstack/react-query'
import { UserCard } from './UserCard'
import { Skeleton } from '@/core/components/ui/skeleton'

interface UserProfileProps {
  userId: string
}

export function UserProfile({ userId }: UserProfileProps) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => fetch(`/api/v1/users/${userId}`).then(res => res.json())
  })

  const handleEdit = () => {
    router.push(`/users/${userId}/edit`)
  }

  if (isLoading) return <Skeleton className="h-48" />
  if (!user) return <div>User not found</div>

  return (
    <UserCard
      name={user.name}
      email={user.email}
      avatar={user.avatar}
      onEdit={handleEdit}
    />
  )
}
```

**Benefits:**
- Clear separation of concerns
- Easier testing (presentational components)
- Better reusability
- Simpler debugging

---

### 2.2 Controlled Components

**Controlled Component Pattern:**

```typescript
// ✅ CORRECT - Controlled component
interface AddressInputProps {
  value: Address
  onChange: (address: Address) => void
  disabled?: boolean
}

export function AddressInput({ value, onChange, disabled }: AddressInputProps) {
  const updateField = (field: keyof Address, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue })
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Street"
        value={value.street}
        onChange={(e) => updateField('street', e.target.value)}
        disabled={disabled}
      />
      <Input
        placeholder="City"
        value={value.city}
        onChange={(e) => updateField('city', e.target.value)}
        disabled={disabled}
      />
      {/* More fields... */}
    </div>
  )
}

// Usage
function ParentComponent() {
  const [address, setAddress] = useState<Address>({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  })

  return (
    <AddressInput
      value={address}
      onChange={setAddress}
    />
  )
}
```

**Benefits:**
- Single source of truth (parent controls state)
- Easier validation
- Predictable behavior
- Better debugging

---

### 2.3 Uncontrolled Components (Use Sparingly)

```typescript
// ❌ AVOID - Uncontrolled component (harder to validate and test)
export function UncontrolledInput() {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const value = inputRef.current?.value
    // Process value
  }

  return (
    <div>
      <input ref={inputRef} />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  )
}

// ✅ PREFER - Controlled component
export function ControlledInput() {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    // Value is always in sync
    processValue(value)
  }

  return (
    <div>
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  )
}
```

---

## 3. Props Design Best Practices

### 3.1 Clear Prop Interfaces

```typescript
// ✅ CORRECT - Well-defined props interface
export interface ImageUploadProps {
  // Required props
  value: UploadedImage[]
  onChange: (images: UploadedImage[]) => void

  // Optional configuration
  maxImages?: number
  maxSize?: number // in MB
  disabled?: boolean
  className?: string

  // Feature toggles
  multiple?: boolean
  showPreview?: boolean

  // Customization
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'free'

  // Callbacks
  onUploadStart?: () => void
  onUploadComplete?: (images: UploadedImage[]) => void
  onError?: (error: string) => void
}

// ❌ WRONG - Poorly defined props
export interface BadImageUploadProps {
  data: any  // Too vague
  callback: Function  // No type safety
  config: object  // Not specific
}
```

### 3.2 Default Values

```typescript
// ✅ CORRECT - Default values in destructuring
export function ImageUpload({
  value = [],
  onChange,
  maxImages = 5,
  maxSize = 5,
  disabled = false,
  multiple = true,
  showPreview = true,
  aspectRatio = 'free',
}: ImageUploadProps) {
  // Implementation
}

// ❌ WRONG - Handling defaults inside component
export function ImageUpload(props: ImageUploadProps) {
  const maxImages = props.maxImages || 5  // Repetitive
  const maxSize = props.maxSize || 5
  // ...
}
```

### 3.3 Callback Props Naming

```typescript
// ✅ CORRECT - Clear callback naming
interface SearchInputProps {
  value: string
  onChange: (value: string) => void  // Value changed
  onSearch: (query: string) => void  // Search triggered
  onClear: () => void                // Input cleared
  onFocus: () => void                // Input focused
  onBlur: () => void                 // Input blurred
}

// ❌ WRONG - Unclear callback names
interface BadSearchInputProps {
  value: string
  callback1: (value: string) => void
  callback2: (query: string) => void
  handler: () => void
}
```

---

## 4. TypeScript Typing

### 4.1 Component Props

```typescript
// ✅ CORRECT - Extending HTML attributes
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export function CustomButton({
  variant = 'default',
  size = 'md',
  isLoading,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}  // Spreads all remaining HTML button props
    >
      {isLoading ? <Spinner /> : children}
    </button>
  )
}
```

### 4.2 Generic Components

```typescript
// ✅ CORRECT - Generic type-safe component
interface SelectOption<T> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectProps<T> {
  options: SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  placeholder?: string
}

export function Select<T extends string | number>({
  options,
  value,
  onChange,
  placeholder
}: SelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const selectedOption = options.find(opt => String(opt.value) === e.target.value)
        if (selectedOption) onChange(selectedOption.value)
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

// Usage - fully type-safe
<Select<number>
  options={[
    { value: 1, label: 'Option 1' },
    { value: 2, label: 'Option 2' }
  ]}
  value={selectedNumber}
  onChange={(num) => setSelectedNumber(num)}  // num is typed as number
/>
```

### 4.3 Discriminated Unions

```typescript
// ✅ CORRECT - Discriminated union for variant props
type ButtonProps =
  | {
      variant: 'link'
      href: string
      onClick?: never
    }
  | {
      variant?: 'default' | 'outline' | 'ghost'
      onClick: () => void
      href?: never
    }

export function SmartButton(props: ButtonProps) {
  if (props.variant === 'link') {
    return <a href={props.href}>{props.children}</a>
  }

  return <button onClick={props.onClick}>{props.children}</button>
}

// TypeScript enforces:
<SmartButton variant="link" href="/home" />  // ✅ OK
<SmartButton variant="default" onClick={handleClick} />  // ✅ OK
<SmartButton variant="link" onClick={handleClick} />  // ❌ Error: href required
```

---

## 5. Real-World Examples

### 5.1 Address Input Component

```typescript
// core/components/ui/address-input.tsx
'use client'

import * as React from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/core/components/ui/input'
import { cn } from '@/core/lib/utils'

export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  fullAddress?: string
}

interface AddressInputProps {
  value: Address
  onChange: (address: Address) => void
  disabled?: boolean
  className?: string
  layout?: 'inline' | 'stacked'
  showFullAddress?: boolean
  onGeocodeRequest?: (fullAddress: string) => Promise<Address>
}

export function AddressInput({
  value = {
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  },
  onChange,
  disabled = false,
  className,
  layout = 'stacked',
  showFullAddress = true,
  onGeocodeRequest,
}: AddressInputProps) {
  const updateField = (field: keyof Address, fieldValue: string) => {
    const newAddress = { ...value, [field]: fieldValue }

    // Auto-update full address
    if (showFullAddress && field !== 'fullAddress') {
      newAddress.fullAddress = [
        newAddress.street,
        newAddress.city,
        newAddress.state,
        newAddress.zipCode,
        newAddress.country,
      ]
        .filter(Boolean)
        .join(', ')
    }

    onChange(newAddress)
  }

  const handleFullAddressChange = async (fullAddress: string) => {
    // If geocoding is available, use it
    if (onGeocodeRequest) {
      try {
        const geocodedAddress = await onGeocodeRequest(fullAddress)
        onChange({ ...geocodedAddress, fullAddress })
      } catch (error) {
        console.error('Geocoding failed:', error)
      }
      return
    }

    // Simple parsing fallback
    const parts = fullAddress.split(',').map((part) => part.trim())
    const newAddress: Address = { ...value, fullAddress }

    if (parts.length >= 1) newAddress.street = parts[0] || ''
    if (parts.length >= 2) newAddress.city = parts[1] || ''
    if (parts.length >= 3) newAddress.state = parts[2] || ''
    if (parts.length >= 4) newAddress.zipCode = parts[3] || ''
    if (parts.length >= 5) newAddress.country = parts[4] || ''

    onChange(newAddress)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showFullAddress && (
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Full address..."
            value={value.fullAddress || ''}
            onChange={(e) => handleFullAddressChange(e.target.value)}
            disabled={disabled}
            className="pl-9"
          />
        </div>
      )}

      <div
        className={cn(
          'grid gap-3',
          layout === 'inline' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'
        )}
      >
        <Input
          placeholder="Street"
          value={value.street}
          onChange={(e) => updateField('street', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="City"
          value={value.city}
          onChange={(e) => updateField('city', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="State"
          value={value.state}
          onChange={(e) => updateField('state', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="ZIP Code"
          value={value.zipCode}
          onChange={(e) => updateField('zipCode', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="Country"
          value={value.country}
          onChange={(e) => updateField('country', e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
```

**Usage:**

```typescript
function CheckoutForm() {
  const [shippingAddress, setShippingAddress] = useState<Address>({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  })

  const handleGeocode = async (fullAddress: string) => {
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(fullAddress)}`)
    return response.json()
  }

  return (
    <form>
      <h2>Shipping Address</h2>
      <AddressInput
        value={shippingAddress}
        onChange={setShippingAddress}
        layout="inline"
        showFullAddress={true}
        onGeocodeRequest={handleGeocode}
      />
    </form>
  )
}
```

---

### 5.2 Image Upload Component

```typescript
// core/components/ui/image-upload.tsx
'use client'

import * as React from 'react'
import NextImage from 'next/image'
import { X, Eye, Upload } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/core/components/ui/dialog'
import { cn } from '@/core/lib/utils'

export interface UploadedImage {
  id: string
  name: string
  size: number
  url: string
  alt?: string
  width?: number
  height?: number
}

interface ImageUploadProps {
  value: UploadedImage[]
  onChange: (images: UploadedImage[]) => void
  maxImages?: number
  maxSize?: number // in MB
  disabled?: boolean
  className?: string
  multiple?: boolean
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'free'
  showPreview?: boolean
  onUpload?: (file: File) => Promise<UploadedImage>
}

export function ImageUpload({
  value = [],
  onChange,
  maxImages = 5,
  maxSize = 5,
  disabled = false,
  className,
  multiple = true,
  aspectRatio = 'free',
  showPreview = true,
  onUpload,
}: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateImage = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        resolve(`Image is too large. Maximum ${maxSize}MB.`)
        return
      }

      if (!file.type.startsWith('image/')) {
        resolve('File must be an image.')
        return
      }

      resolve(null)
    })
  }

  const handleFiles = async (files: FileList) => {
    if (disabled || isUploading) return

    setIsUploading(true)
    const newImages: UploadedImage[] = []

    for (const file of Array.from(files)) {
      if (value.length + newImages.length >= maxImages) {
        break
      }

      const error = await validateImage(file)
      if (error) {
        console.error(error)
        continue
      }

      try {
        let uploadedImage: UploadedImage

        if (onUpload) {
          // Use custom upload handler
          uploadedImage = await onUpload(file)
        } else {
          // Default: Create object URL
          uploadedImage = {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            url: URL.createObjectURL(file),
          }
        }

        newImages.push(uploadedImage)
      } catch (error) {
        console.error('Upload failed:', error)
      }
    }

    onChange([...value, ...newImages])
    setIsUploading(false)
  }

  const handleRemove = (imageId: string) => {
    onChange(value.filter((img) => img.id !== imageId))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Area */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragOver && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop images here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Max {maxImages} images, {maxSize}MB each
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Image Preview Grid */}
      {showPreview && value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {value.map((image) => (
            <div key={image.id} className="relative group">
              <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                <NextImage
                  src={image.url}
                  alt={image.alt || image.name}
                  fill
                  className="object-cover"
                />

                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <div className="relative w-full h-[600px]">
                        <NextImage
                          src={image.url}
                          alt={image.alt || image.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(image.id)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-1 truncate">{image.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(image.size)}</p>
            </div>
          ))}
        </div>
      )}

      {isUploading && (
        <div className="text-center text-sm text-muted-foreground">Uploading...</div>
      )}
    </div>
  )
}
```

**Usage:**

```typescript
function ProductForm() {
  const [productImages, setProductImages] = useState<UploadedImage[]>([])

  const handleUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    return response.json()
  }

  return (
    <form>
      <ImageUpload
        value={productImages}
        onChange={setProductImages}
        maxImages={10}
        maxSize={10}
        multiple={true}
        onUpload={handleUpload}
      />
    </form>
  )
}
```

---

## 6. Performance Optimization

### 6.1 React.memo

```typescript
// ✅ CORRECT - Memoize expensive components
interface ProductCardProps {
  product: Product
  onAddToCart: (productId: string) => void
}

export const ProductCard = React.memo(({ product, onAddToCart }: ProductCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>${product.price}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={() => onAddToCart(product.id)}>
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if product or onAddToCart changes
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.onAddToCart === nextProps.onAddToCart
  )
})
```

### 6.2 useCallback for Stable Callbacks

```typescript
// ✅ CORRECT - Stable callback references
function ProductList({ products }: { products: Product[] }) {
  const handleAddToCart = useCallback((productId: string) => {
    addToCart(productId)
  }, [])  // No dependencies means callback never changes

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={handleAddToCart}  // Stable reference
        />
      ))}
    </div>
  )
}
```

### 6.3 useMemo for Expensive Calculations

```typescript
// ✅ CORRECT - Memoize expensive calculations
function ProductFilter({ products, filters }: Props) {
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (filters.category && product.category !== filters.category) return false
      if (filters.minPrice && product.price < filters.minPrice) return false
      if (filters.maxPrice && product.price > filters.maxPrice) return false
      if (filters.search && !product.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
      return true
    })
  }, [products, filters])  // Only recalculate when products or filters change

  return <ProductGrid products={filteredProducts} />
}
```

---

## 7. Testing Custom Components

### 7.1 Unit Tests

```typescript
// address-input.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AddressInput, type Address } from './address-input'

describe('AddressInput', () => {
  const mockAddress: Address = {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'USA',
  }

  test('renders all input fields', () => {
    const handleChange = jest.fn()

    render(<AddressInput value={mockAddress} onChange={handleChange} />)

    expect(screen.getByPlaceholderText('Street')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('City')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('State')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ZIP Code')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Country')).toBeInTheDocument()
  })

  test('updates street field', () => {
    const handleChange = jest.fn()

    render(<AddressInput value={mockAddress} onChange={handleChange} />)

    const streetInput = screen.getByPlaceholderText('Street')
    fireEvent.change(streetInput, { target: { value: '456 Oak Ave' } })

    expect(handleChange).toHaveBeenCalledWith({
      ...mockAddress,
      street: '456 Oak Ave',
    })
  })

  test('disables inputs when disabled prop is true', () => {
    const handleChange = jest.fn()

    render(<AddressInput value={mockAddress} onChange={handleChange} disabled={true} />)

    expect(screen.getByPlaceholderText('Street')).toBeDisabled()
    expect(screen.getByPlaceholderText('City')).toBeDisabled()
  })
})
```

### 7.2 E2E Tests

```typescript
// address-input.cy.ts
describe('AddressInput E2E', () => {
  beforeEach(() => {
    cy.visit('/checkout')
  })

  it('allows user to enter shipping address', () => {
    cy.get('[data-cy=address-street]').type('123 Main St')
    cy.get('[data-cy=address-city]').type('New York')
    cy.get('[data-cy=address-state]').type('NY')
    cy.get('[data-cy=address-zip]').type('10001')
    cy.get('[data-cy=address-country]').type('USA')

    cy.get('[data-cy=checkout-submit]').click()

    cy.url().should('include', '/confirmation')
  })

  it('validates required address fields', () => {
    cy.get('[data-cy=checkout-submit]').click()

    cy.contains('Street is required').should('be.visible')
    cy.contains('City is required').should('be.visible')
  })
})
```

---

## 8. Documentation Best Practices

### 8.1 JSDoc Comments

```typescript
/**
 * AddressInput component for collecting structured address data.
 *
 * @example
 * ```tsx
 * <AddressInput
 *   value={shippingAddress}
 *   onChange={setShippingAddress}
 *   layout="inline"
 *   showFullAddress={true}
 * />
 * ```text
 */
export function AddressInput(props: AddressInputProps) {
  // Implementation
}

/**
 * Upload and manage images with drag-and-drop support.
 *
 * Features:
 * - Drag and drop upload
 * - Image preview with lightbox
 * - File size and type validation
 * - Cloud storage integration
 *
 * @param {UploadedImage[]} value - Array of uploaded images
 * @param {function} onChange - Callback when images change
 * @param {number} maxImages - Maximum number of images (default: 5)
 * @param {number} maxSize - Maximum file size in MB (default: 5)
 *
 * @example
 * ```tsx
 * <ImageUpload
 *   value={productImages}
 *   onChange={setProductImages}
 *   maxImages={10}
 *   onUpload={uploadToS3}
 * />
 * ```text
 */
export function ImageUpload(props: ImageUploadProps) {
  // Implementation
}
```

### 8.2 README for Complex Components

```markdown
# AddressInput Component

## Overview

The AddressInput component provides a structured way to collect address information with support for geocoding and multiple layout options.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `Address` | - | Current address value (required) |
| `onChange` | `(address: Address) => void` | - | Callback when address changes (required) |
| `disabled` | `boolean` | `false` | Disable all inputs |
| `layout` | `'inline' \| 'stacked'` | `'stacked'` | Layout orientation |
| `showFullAddress` | `boolean` | `true` | Show full address input field |
| `onGeocodeRequest` | `(fullAddress: string) => Promise<Address>` | - | Optional geocoding handler |

## Usage

### Basic Usage

\`\`\`tsx
import { AddressInput } from '@/core/components/ui/address-input'

function CheckoutForm() {
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  })

  return (
    <AddressInput
      value={address}
      onChange={setAddress}
    />
  )
}
\`\`\`

### With Geocoding

\`\`\`tsx
const handleGeocode = async (fullAddress: string) => {
  const response = await fetch(\`/api/geocode?q=\${encodeURIComponent(fullAddress)}\`)
  return response.json()
}

<AddressInput
  value={address}
  onChange={setAddress}
  onGeocodeRequest={handleGeocode}
/>
\`\`\`

## Testing

Run tests with:
\`\`\`bash
npm test address-input
\`\`\`
```

---

## Resources

**Related Documentation:**
- [Component Architecture](./01-component-architecture.md)
- [shadcn/ui Integration](./02-shadcn-ui-integration.md)
- [Compound Components](./04-compound-components.md)
- [Forms & Validation](./06-forms-and-validation.md)

**Related Files:**
- `core/components/ui/` - Custom component implementations
- `.rules/components.md` - Component development rules
- `core/lib/utils.ts` - Component utilities

**External Resources:**
- [React Component Patterns](https://react.dev/learn/thinking-in-react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
