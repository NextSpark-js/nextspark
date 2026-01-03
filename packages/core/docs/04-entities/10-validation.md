# Validation System

The validation system ensures data integrity using Zod for type-safe schemas, automatic validation on client and server, and informative error messages.

## Validation Levels

1. **Client-side**: In forms (immediate UX)
2. **Server-side**: In APIs (security)
3. **Database**: Constraints (last defense)

## Automatic Validation

### By Field Type

Each field type has automatic validation:

```typescript
// text
{
  type: 'text',
  required: true  // → z.string().min(1)
}

// number
{
  type: 'number',
  required: true  // → z.number()
}

// email
{
  type: 'email',
  required: true  // → z.string().email()
}

// url
{
  type: 'url',
  required: false  // → z.string().url().optional()
}

// date
{
  type: 'date',
  required: true  // → z.string().datetime()
}

// select
{
  type: 'select',
  options: [...]  // → z.enum(['option1', 'option2'])
}
```

## Custom Validation with Zod

### In EntityField

```typescript
import { z } from 'zod'

{
  name: 'email',
  type: 'email',
  required: true,
  validation: z.string()
    .email('Invalid email format')
    .endsWith('@company.com', 'Must be company email'),
  // ...
}
```

### Common Examples

#### String Length

```typescript
{
  name: 'username',
  type: 'text',
  required: true,
  validation: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric and underscore allowed')
}
```

#### Number Ranges

```typescript
{
  name: 'age',
  type: 'number',
  required: true,
  validation: z.number()
    .min(18, 'Must be at least 18')
    .max(120, 'Invalid age')
    .int('Must be a whole number')
}

{
  name: 'price',
  type: 'number',
  required: true,
  validation: z.number()
    .positive('Price must be positive')
    .multipleOf(0.01, 'Max 2 decimal places')
}
```

#### Dates

```typescript
{
  name: 'birthdate',
  type: 'date',
  required: true,
  validation: z.string()
    .datetime()
    .refine(
      (date) => new Date(date) < new Date(),
      'Birthdate must be in the past'
    )
}

{
  name: 'dueDate',
  type: 'date',
  required: false,
  validation: z.string()
    .datetime()
    .optional()
    .refine(
      (date) => !date || new Date(date) > new Date(),
      'Due date must be in the future'
    )
}
```

#### Arrays

```typescript
{
  name: 'tags',
  type: 'multiselect',
  required: false,
  validation: z.array(z.string())
    .min(1, 'Select at least one tag')
    .max(5, 'Maximum 5 tags allowed')
}
```

#### JSON Objects

```typescript
{
  name: 'metadata',
  type: 'json',
  required: false,
  validation: z.object({
    version: z.string(),
    author: z.string(),
    tags: z.array(z.string()).optional()
  }).optional()
}
```

#### Conditional Validation

```typescript
{
  name: 'assignedTo',
  type: 'user',
  required: false,
  validation: z.string().uuid().refine(
    async (userId) => {
      // Validate that user exists and is active
      const user = await getUser(userId)
      return user && user.isActive
    },
    'Assigned user must be active'
  )
}
```

#### Dependent Validation

```typescript
// In the complete entity schema
const taskSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional()
}).refine(
  (data) => {
    // If urgent, must have assignee
    if (data.priority === 'urgent' && !data.assignedTo) {
      return false
    }
    return true
  },
  {
    message: 'Urgent tasks must have an assignee',
    path: ['assignedTo']
  }
).refine(
  (data) => {
    // If has assignee, must have due date
    if (data.assignedTo && !data.dueDate) {
      return false
    }
    return true
  },
  {
    message: 'Assigned tasks must have a due date',
    path: ['dueDate']
  }
)
```

## Form Validation (Client-side)

### React Hook Form + Zod

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const taskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().datetime().optional()
})

type TaskFormData = z.infer<typeof taskSchema>

export function TaskForm() {
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      priority: 'medium'
    }
  })
  
  const onSubmit = async (data: TaskFormData) => {
    try {
      await createTask(data)
      toast.success('Task created')
    } catch (error) {
      toast.error('Failed to create task')
    }
  }
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input
        {...form.register('title')}
        error={form.formState.errors.title?.message}
      />
      {/* ... more fields */}
    </form>
  )
}
```

### Automatic EntityForm

`EntityForm` generates validation automatically:

```typescript
<EntityForm
  entityType="tasks"
  mode="create"
  // Automatic validation based on EntityConfig
/>
```

## API Validation (Server-side)

### In Route Handlers

```typescript
// app/api/v1/tasks/route.ts
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional()
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate with Zod
    const validatedData = createTaskSchema.parse(body)
    
    // Continue with creation...
    const task = await createEntity('tasks', validatedData, user.id)
    
    return NextResponse.json({ success: true, data: task })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Error Messages

```typescript
// Zod error format
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "path": ["title"],
      "message": "Title must be at least 3 characters",
      "code": "too_small"
    },
    {
      "path": ["priority"],
      "message": "Invalid enum value",
      "code": "invalid_enum_value"
    }
  ]
}
```

## Database Validation

### Constraints

```sql
-- NOT NULL
CREATE TABLE "tasks" (
  "title" VARCHAR(255) NOT NULL,
  -- ...
);

-- CHECK constraints
ALTER TABLE "tasks" 
  ADD CONSTRAINT "check_priority" 
  CHECK ("priority" IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE "tasks"
  ADD CONSTRAINT "check_due_date_future"
  CHECK ("dueDate" IS NULL OR "dueDate" > NOW());

-- UNIQUE
ALTER TABLE "tasks"
  ADD CONSTRAINT "unique_task_number"
  UNIQUE ("taskNumber");

-- Foreign keys
ALTER TABLE "tasks"
  ADD CONSTRAINT "fk_assigned_to"
  FOREIGN KEY ("assignedTo")
  REFERENCES "user"("id");
```

## Custom Error Messages

### By Language

```typescript
// messages/es.json
{
  "validation": {
    "required": "Este campo es obligatorio",
    "email": "Ingresa un email válido",
    "minLength": "Mínimo {{min}} caracteres",
    "maxLength": "Máximo {{max}} caracteres",
    "min": "Valor mínimo: {{min}}",
    "max": "Valor máximo: {{max}}"
  }
}

// Use in validation
import { useTranslations } from 'next-intl'

const t = useTranslations('validation')

const schema = z.object({
  email: z.string().email(t('email')),
  password: z.string().min(8, t('minLength', { min: 8 }))
})
```

## Async Validation

### In Zod

```typescript
const usernameSchema = z.string()
  .min(3)
  .refine(
    async (username) => {
      // Check if username already exists
      const exists = await checkUsernameExists(username)
      return !exists
    },
    'Username already taken'
  )

// Use
await usernameSchema.parseAsync(formData.username)
```

### Debouncing

```typescript
'use client'

import { useDebouncedCallback } from 'use-debounce'

export function UsernameInput() {
  const [error, setError] = useState<string | null>(null)
  
  const validateUsername = useDebouncedCallback(
    async (username: string) => {
      try {
        await usernameSchema.parseAsync(username)
        setError(null)
      } catch (err) {
        if (err instanceof z.ZodError) {
          setError(err.errors[0].message)
        }
      }
    },
    500  // Wait 500ms after typing stops
  )
  
  return (
    <div>
      <Input
        onChange={(e) => validateUsername(e.target.value)}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  )
}
```

## Testing Validation

```typescript
// test/validation/taskSchema.test.ts
import { taskSchema } from '@/schemas/task'

describe('Task Schema Validation', () => {
  test('accepts valid task data', () => {
    const validTask = {
      title: 'Valid Task',
      priority: 'medium',
      status: 'todo'
    }
    
    expect(() => taskSchema.parse(validTask)).not.toThrow()
  })
  
  test('rejects task without title', () => {
    const invalidTask = {
      priority: 'medium',
      status: 'todo'
    }
    
    expect(() => taskSchema.parse(invalidTask)).toThrow()
  })
  
  test('rejects invalid priority', () => {
    const invalidTask = {
      title: 'Task',
      priority: 'invalid',  // Not a valid priority
      status: 'todo'
    }
    
    expect(() => taskSchema.parse(invalidTask)).toThrow()
  })
  
  test('requires assignee for urgent tasks', () => {
    const urgentWithoutAssignee = {
      title: 'Urgent Task',
      priority: 'urgent',
      status: 'todo'
      // Without assignedTo
    }
    
    expect(() => taskSchema.parse(urgentWithoutAssignee)).toThrow(
      'Urgent tasks must have an assignee'
    )
  })
})
```

## Best Practices

1. **Always validate on server**: Client-side is UX, server-side is security
2. **Clear messages**: Indicate what's wrong and how to fix it
3. **Incremental validation**: Feedback while user types
4. **Type-safe**: Use `z.infer<typeof schema>` for automatic types
5. **Reuse schemas**: DRY - Define once, use everywhere
6. **Test exhaustively**: Valid and invalid cases

## Next Steps

1. **[Hooks](./08-hooks-and-lifecycle.md)** - Validation in hooks
2. **[Advanced Patterns](./11-advanced-patterns.md)** - Advanced patterns
3. **[Examples](./12-examples.md)** - Complete examples

---

> 💡 **Tip**: Zod allows sharing the same schema between client and server, ensuring consistency and being type-safe on both sides.
