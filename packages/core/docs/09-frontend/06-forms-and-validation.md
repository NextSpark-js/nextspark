# Forms and Validation

Forms are a critical part of any application, and proper form handling directly impacts user experience. This guide covers our complete form management strategy using React Hook Form and Zod validation, with real-world patterns from our codebase.

---

## 📋 Table of Contents

1. [Form Stack Overview](#form-stack-overview)
2. [Basic Form Setup](#basic-form-setup)
3. [Validation with Zod](#validation-with-zod)
4. [Form Submission](#form-submission)
5. [Error Handling](#error-handling)
6. [Integration with TanStack Query](#integration-with-tanstack-query)
7. [Complex Form Patterns](#complex-form-patterns)
8. [File Upload Forms](#file-upload-forms)
9. [Multi-Step Forms](#multi-step-forms)
10. [Form Accessibility](#form-accessibility)
11. [Best Practices](#best-practices)
12. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Form Stack Overview

Our form management uses a battle-tested stack:

| Technology | Purpose | Version |
|------------|---------|---------|
| **React Hook Form** | Form state management | v7.62.0 |
| **Zod** | Runtime type validation | v4.1.5 |
| **@hookform/resolvers** | Zod integration | v5.2.1 |
| **TanStack Query** | Server mutations | v5.85.0 |
| **shadcn/ui** | Form components | Latest |

### Why This Stack?

✅ **React Hook Form**:
- Minimal re-renders (uncontrolled inputs)
- Built-in validation
- Excellent TypeScript support
- Small bundle size (~9KB)

✅ **Zod**:
- TypeScript-first schema validation
- Runtime type safety
- Excellent error messages
- Composable schemas

✅ **TanStack Query**:
- Optimistic updates
- Automatic retry
- Cache invalidation
- Loading states

---

## Basic Form Setup

### Simple Login Form

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/core/components/ui/button'
import { Input } from '@/core/components/ui/input'
import { Label } from '@/core/components/ui/label'

// Define validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Infer TypeScript type from schema
type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      // Redirect or handle success
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          {...register('email')}
          id="email"
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          {...register('password')}
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
```

### Form Configuration Options

```typescript
useForm<FormData>({
  // Validation resolver
  resolver: zodResolver(schema),

  // When to trigger validation
  mode: 'onSubmit',      // Validate on submit (default)
  // mode: 'onChange',   // Validate on every change
  // mode: 'onBlur',     // Validate when field loses focus
  // mode: 'onTouched',  // Validate after first blur
  // mode: 'all',        // Validate on change and blur

  // When to re-validate after first error
  reValidateMode: 'onChange', // Re-validate on change (default)
  // reValidateMode: 'onBlur',  // Re-validate on blur
  // reValidateMode: 'onSubmit', // Re-validate only on submit

  // Default values
  defaultValues: {
    email: '',
    password: '',
  },

  // Focus first error on submit
  shouldFocusError: true,

  // Unregister fields on unmount
  shouldUnregister: false,
})
```

---

## Validation with Zod

### Basic Validation Schemas

```typescript
// core/lib/validation.ts
import { z } from 'zod'

// String validation
export const emailSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})

// Number validation
export const ageSchema = z.object({
  age: z.number()
    .int('Age must be an integer')
    .min(18, 'Must be at least 18 years old')
    .max(120, 'Must be less than 120 years old'),
})

// Enum validation
export const roleSchema = z.object({
  role: z.enum(['user', 'admin', 'moderator'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
})

// Boolean validation
export const termsSchema = z.object({
  acceptTerms: z.boolean()
    .refine(value => value === true, {
      message: 'You must accept the terms and conditions',
    }),
})

// Array validation
export const tagsSchema = z.object({
  tags: z.array(z.string())
    .min(1, 'At least one tag is required')
    .max(5, 'Maximum 5 tags allowed'),
})

// Date validation
export const birthdateSchema = z.object({
  birthdate: z.date({
    required_error: 'Birthdate is required',
    invalid_type_error: 'Invalid date format',
  })
    .min(new Date('1900-01-01'), 'Date too far in the past')
    .max(new Date(), 'Date cannot be in the future'),
})
```

### Advanced Validation Patterns

#### Password Validation with Requirements

```typescript
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'], // Attach error to confirmPassword field
})

export type SignupFormData = z.infer<typeof signupSchema>
```

#### Conditional Validation

```typescript
export const addressSchema = z.object({
  country: z.string().min(1, 'Please select a country'),
  state: z.string().optional(),
  zipCode: z.string().optional(),
}).superRefine((data, ctx) => {
  // US addresses require state and zip code
  if (data.country === 'US') {
    if (!data.state) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'State is required for US addresses',
        path: ['state'],
      })
    }
    if (!data.zipCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ZIP code is required for US addresses',
        path: ['zipCode'],
      })
    }
  }
})
```

#### Custom Validation Functions

```typescript
export const usernameSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .refine(
      async (username) => {
        // Check if username is available
        const response = await fetch(`/api/check-username?username=${username}`)
        const { available } = await response.json()
        return available
      },
      {
        message: 'Username is already taken',
      }
    ),
})
```

#### Nested Object Validation

```typescript
export const addressFormSchema = z.object({
  personalInfo: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  }),
  address: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
    country: z.string().min(1, 'Country is required'),
  }),
  contactInfo: z.object({
    email: z.string().email('Invalid email'),
    phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number'),
  }),
})

type AddressFormData = z.infer<typeof addressFormSchema>

// In component
function AddressForm() {
  const { register, formState: { errors } } = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
  })

  return (
    <form>
      <Input {...register('personalInfo.firstName')} />
      {errors.personalInfo?.firstName && (
        <p className="text-destructive">{errors.personalInfo.firstName.message}</p>
      )}

      <Input {...register('address.street')} />
      {errors.address?.street && (
        <p className="text-destructive">{errors.address.street.message}</p>
      )}
    </form>
  )
}
```

---

## Form Submission

### Basic Form Submission

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function ContactForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  })

  const onSubmit = async (data: ContactFormData) => {
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to submit form')
      }

      setSuccess(true)
      reset() // Clear form after successful submission
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>Message sent successfully!</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  )
}
```

### Form Submission with useCallback

```typescript
import { useCallback } from 'react'

export function ProfileForm() {
  const { register, handleSubmit } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  })

  // Memoize submission handler
  const onSubmit = useCallback(async (data: ProfileFormData) => {
    try {
      await updateProfile(data)
    } catch (error) {
      console.error(error)
    }
  }, [])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

---

## Error Handling

### Field-Level Errors

```typescript
function FormFieldWithError() {
  const { register, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  return (
    <div className="space-y-2">
      <Label htmlFor="email">
        Email
        {errors.email && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        {...register('email')}
        id="email"
        type="email"
        aria-invalid={errors.email ? 'true' : 'false'}
        aria-describedby={errors.email ? 'email-error' : undefined}
        className={errors.email ? 'border-destructive' : ''}
      />
      {errors.email && (
        <p
          id="email-error"
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive"
        >
          {errors.email.message}
        </p>
      )}
    </div>
  )
}
```

### Form-Level Errors

```typescript
function FormWithGlobalError() {
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    setFormError(null)

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message)
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Submission failed')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {formError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* Form fields */}
    </form>
  )
}
```

### Error Mapping

```typescript
// Map backend errors to form fields
function mapBackendErrorsToForm(
  backendErrors: Record<string, string>,
  setError: UseFormSetError<FormData>
) {
  Object.entries(backendErrors).forEach(([field, message]) => {
    setError(field as keyof FormData, {
      type: 'manual',
      message,
    })
  })
}

// Usage
const { setError } = useForm<FormData>()

const onSubmit = async (data: FormData) => {
  try {
    await submitForm(data)
  } catch (error) {
    if (error.response?.data?.errors) {
      mapBackendErrorsToForm(error.response.data.errors, setError)
    }
  }
}
```

---

## Integration with TanStack Query

### Form with TanStack Query Mutation

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      country: profile.country || '',
    },
  })

  // Update form when profile changes
  useEffect(() => {
    reset({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      country: profile.country || '',
    })
  }, [profile, reset])

  // Mutation for updating profile
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      return response.json()
    },
    onMutate: async (newProfile) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user-profile'] })

      // Snapshot previous value
      const previousProfile = queryClient.getQueryData(['user-profile'])

      // Optimistically update
      queryClient.setQueryData(['user-profile'], (old: any) => ({
        ...old,
        ...newProfile,
      }))

      return { previousProfile }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousProfile) {
        queryClient.setQueryData(['user-profile'], context.previousProfile)
      }
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 3000)
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    await updateProfileMutation.mutateAsync(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {updateSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>Profile updated successfully!</AlertDescription>
        </Alert>
      )}

      {updateProfileMutation.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {updateProfileMutation.error.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            {...register('firstName')}
            id="firstName"
            placeholder="John"
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            {...register('lastName')}
            id="lastName"
            placeholder="Doe"
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={updateProfileMutation.isPending}
        className="w-full"
      >
        {updateProfileMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          'Update Profile'
        )}
      </Button>
    </form>
  )
}
```

---

## Complex Form Patterns

### Dynamic Fields

```typescript
function DynamicFieldsForm() {
  const { register, control, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      items: [{ name: '', quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <Input
            {...register(`items.${index}.name`)}
            placeholder="Item name"
          />
          <Input
            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
            type="number"
            placeholder="Qty"
          />
          <Button
            type="button"
            variant="destructive"
            onClick={() => remove(index)}
          >
            Remove
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ name: '', quantity: 1 })}
      >
        Add Item
      </Button>

      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Dependent Fields

```typescript
function DependentFieldsForm() {
  const { register, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const shippingSameAsBilling = watch('shippingSameAsBilling')
  const country = watch('billingCountry')

  return (
    <form>
      {/* Billing Address */}
      <Input {...register('billingAddress')} placeholder="Billing Address" />

      <Select {...register('billingCountry')}>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
      </Select>

      {/* Show state field only for US */}
      {country === 'US' && (
        <Input {...register('billingState')} placeholder="State" />
      )}

      {/* Shipping Address - shown only if different from billing */}
      <Checkbox {...register('shippingSameAsBilling')} />
      <Label>Shipping address same as billing</Label>

      {!shippingSameAsBilling && (
        <>
          <Input {...register('shippingAddress')} placeholder="Shipping Address" />
          <Select {...register('shippingCountry')}>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </Select>
        </>
      )}
    </form>
  )
}
```

---

## File Upload Forms

### Single File Upload

```typescript
function FileUploadForm() {
  const [preview, setPreview] = useState<string | null>(null)
  const { register, handleSubmit, watch } = useForm<FileFormData>()

  const fileInput = watch('file')

  // Preview file
  useEffect(() => {
    if (fileInput && fileInput[0]) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(fileInput[0])
    }
  }, [fileInput])

  const onSubmit = async (data: FileFormData) => {
    const formData = new FormData()
    if (data.file[0]) {
      formData.append('file', data.file[0])
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="file">Upload Image</Label>
        <Input
          {...register('file')}
          id="file"
          type="file"
          accept="image/*"
        />
      </div>

      {preview && (
        <div className="mt-4">
          <img
            src={preview}
            alt="Preview"
            className="max-w-xs rounded-lg"
          />
        </div>
      )}

      <Button type="submit">Upload</Button>
    </form>
  )
}
```

### Multiple File Upload with Validation

```typescript
const fileUploadSchema = z.object({
  files: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, 'At least one file is required')
    .refine((files) => files.length <= 5, 'Maximum 5 files allowed')
    .refine(
      (files) => Array.from(files).every(file => file.size <= 5 * 1024 * 1024),
      'Each file must be less than 5MB'
    )
    .refine(
      (files) => Array.from(files).every(file =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      ),
      'Only JPEG, PNG, and WebP images are allowed'
    ),
})

type FileUploadFormData = z.infer<typeof fileUploadSchema>

function MultiFileUploadForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FileUploadFormData>({
    resolver: zodResolver(fileUploadSchema),
  })

  const onSubmit = async (data: FileUploadFormData) => {
    const formData = new FormData()
    Array.from(data.files).forEach((file) => {
      formData.append('files', file)
    })

    await fetch('/api/upload-multiple', {
      method: 'POST',
      body: formData,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="files">Upload Images</Label>
        <Input
          {...register('files')}
          id="files"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
        />
        <p className="text-xs text-muted-foreground">
          Upload up to 5 images (JPEG, PNG, WebP). Max 5MB each.
        </p>
      </div>

      {errors.files && (
        <p className="text-sm text-destructive">
          {errors.files.message}
        </p>
      )}

      <Button type="submit">Upload Files</Button>
    </form>
  )
}
```

---

## Multi-Step Forms

### State-Based Multi-Step Form

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// Define schemas for each step
const step1Schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
})

const step2Schema = z.object({
  address: z.string().min(5),
  city: z.string().min(2),
  zipCode: z.string().regex(/^\d{5}$/),
})

const step3Schema = z.object({
  cardNumber: z.string().regex(/^\d{16}$/),
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/),
  cvv: z.string().regex(/^\d{3}$/),
})

// Combined schema for final submission
const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema)

type FormData = z.infer<typeof fullSchema>

function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<FormData>>({})

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<FormData>({
    resolver: zodResolver(
      currentStep === 1 ? step1Schema :
      currentStep === 2 ? step2Schema :
      step3Schema
    ),
    defaultValues: formData,
  })

  const nextStep = async () => {
    const isValid = await trigger()
    if (isValid) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    setCurrentStep(currentStep - 1)
  }

  const onSubmit = async (data: FormData) => {
    const fullData = { ...formData, ...data }

    try {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullData),
      })
      // Handle success
    } catch (error) {
      console.error(error)
    }
  }

  const onStepSubmit = (data: Partial<FormData>) => {
    setFormData({ ...formData, ...data })
    if (currentStep < 3) {
      nextStep()
    }
  }

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`flex items-center ${
                step <= currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {step}
              </div>
              <span className="ml-2">
                {step === 1 ? 'Personal' : step === 2 ? 'Address' : 'Payment'}
              </span>
            </div>
          ))}
        </div>
        <div className="w-full bg-muted h-2 rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Form steps */}
      <form onSubmit={handleSubmit(currentStep === 3 ? onSubmit : onStepSubmit)}>
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Personal Information</h2>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input {...register('firstName')} id="firstName" />
              {errors.firstName && (
                <p className="text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input {...register('lastName')} id="lastName" />
              {errors.lastName && (
                <p className="text-destructive">{errors.lastName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input {...register('email')} id="email" type="email" />
              {errors.email && (
                <p className="text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Address</h2>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input {...register('address')} id="address" />
              {errors.address && (
                <p className="text-destructive">{errors.address.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input {...register('city')} id="city" />
                {errors.city && (
                  <p className="text-destructive">{errors.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input {...register('zipCode')} id="zipCode" />
                {errors.zipCode && (
                  <p className="text-destructive">{errors.zipCode.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Payment</h2>

            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                {...register('cardNumber')}
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
              />
              {errors.cardNumber && (
                <p className="text-destructive">{errors.cardNumber.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  {...register('expiryDate')}
                  id="expiryDate"
                  placeholder="MM/YY"
                />
                {errors.expiryDate && (
                  <p className="text-destructive">{errors.expiryDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  {...register('cvv')}
                  id="cvv"
                  placeholder="123"
                />
                {errors.cvv && (
                  <p className="text-destructive">{errors.cvv.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={prevStep}>
              Previous
            </Button>
          )}
          {currentStep < 3 ? (
            <Button type="submit" className="ml-auto">
              Next
            </Button>
          ) : (
            <Button type="submit" className="ml-auto">
              Submit
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
```

---

## Form Accessibility

### ARIA Attributes

```typescript
function AccessibleForm() {
  const { register, formState: { errors } } = useForm<FormData>()

  return (
    <form aria-labelledby="form-heading">
      <h2 id="form-heading">Contact Us</h2>

      <div className="space-y-2">
        <Label htmlFor="email">
          Email
          <span className="text-destructive" aria-label="required">*</span>
        </Label>
        <Input
          {...register('email')}
          id="email"
          type="email"
          aria-required="true"
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'email-error' : 'email-help'}
        />
        <p id="email-help" className="text-xs text-muted-foreground">
          We'll never share your email
        </p>
        {errors.email && (
          <p
            id="email-error"
            role="alert"
            aria-live="assertive"
            className="text-sm text-destructive"
          >
            {errors.email.message}
          </p>
        )}
      </div>
    </form>
  )
}
```

### Screen Reader Announcements

```typescript
function FormWithAnnouncements() {
  const [statusMessage, setStatusMessage] = useState('')

  const onSubmit = async (data: FormData) => {
    setStatusMessage('Submitting form...')

    try {
      await submitForm(data)
      setStatusMessage('Form submitted successfully')
    } catch (error) {
      setStatusMessage('Error submitting form. Please try again.')
    }
  }

  return (
    <>
      {/* Screen reader announcement region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </>
  )
}
```

---

## Best Practices

### 1. Use Proper Validation Modes

✅ **CORRECT**:
```typescript
// Validate on submit, re-validate on change
useForm({
  mode: 'onSubmit',
  reValidateMode: 'onChange',
})
```

❌ **WRONG**:
```typescript
// Validate on every keystroke (bad UX)
useForm({
  mode: 'onChange',
})
```

### 2. Provide Clear Error Messages

✅ **CORRECT**:
```typescript
z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
```

❌ **WRONG**:
```typescript
z.string()
  .min(8, 'Invalid')
  .regex(/[A-Z]/, 'Error')
```

### 3. Reset Form After Successful Submission

✅ **CORRECT**:
```typescript
const { reset } = useForm()

const onSubmit = async (data) => {
  await submitForm(data)
  reset() // Clear form
}
```

### 4. Use Optimistic Updates

✅ **CORRECT**:
```typescript
const mutation = useMutation({
  mutationFn: updateProfile,
  onMutate: async (newData) => {
    // Optimistically update UI
    queryClient.setQueryData(['profile'], newData)
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['profile'], context.previousData)
  },
})
```

### 5. Handle Loading States

✅ **CORRECT**:
```typescript
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Saving...
    </>
  ) : (
    'Save Changes'
  )}
</Button>
```

---

## Anti-Patterns to Avoid

### ❌ Don't Use Controlled Inputs Unnecessarily

```typescript
// ❌ WRONG - Causes re-renders on every keystroke
const [email, setEmail] = useState('')
<Input value={email} onChange={(e) => setEmail(e.target.value)} />

// ✅ CORRECT - Let React Hook Form handle it
<Input {...register('email')} />
```

### ❌ Don't Validate on Mount

```typescript
// ❌ WRONG - Shows errors before user interaction
useForm({
  mode: 'all',
  shouldUnregister: true,
})

// ✅ CORRECT - Validate after submission
useForm({
  mode: 'onSubmit',
  reValidateMode: 'onChange',
})
```

### ❌ Don't Forget to Handle Errors

```typescript
// ❌ WRONG - Silent failures
const onSubmit = async (data) => {
  await fetch('/api/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ✅ CORRECT - Handle errors properly
const onSubmit = async (data) => {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Submission failed')
    }
  } catch (error) {
    setError(error.message)
  }
}
```

---

## Related Documentation

- **[State Management](./05-state-management.md)** - TanStack Query integration patterns
- **[Accessibility](./07-accessibility.md)** - Complete accessibility guide
- **[Component Architecture](./01-component-architecture.md)** - Component organization

---

## Resources

- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [TanStack Query - Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [shadcn/ui Form Components](https://ui.shadcn.com/docs/components/form)
- [Web Forms Accessibility](https://www.w3.org/WAI/tutorials/forms/)
