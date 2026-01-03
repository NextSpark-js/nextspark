# Field Types

This guide documents all available field types in the entity system. Each type automatically generates the appropriate UI component, validation, and API behavior.

## EntityField Structure

Each field is defined with this structure:

```typescript
interface EntityField {
  name: string                // Field name (DB column)
  type: EntityFieldType       // Data type
  required: boolean           // Required field
  defaultValue?: any          // Default value
  validation?: ZodSchema      // Custom Zod validation
  display: FieldDisplay       // UI configuration
  api: FieldAPI              // API configuration
  options?: FieldOption[]     // For select/multiselect
  relation?: RelationConfig   // For relation types
}
```

### FieldDisplay

```typescript
interface FieldDisplay {
  label: string               // Field label
  description?: string        // Help text
  placeholder?: string        // Placeholder
  showInList: boolean        // Show in tables
  showInDetail: boolean      // Show in detail view
  showInForm: boolean        // Show in forms
  order: number              // Order in forms
  columnWidth?: number       // Column width (1-12)
  className?: string         // Custom CSS classes
}
```

### FieldAPI

```typescript
interface FieldAPI {
  searchable: boolean        // Include in searches
  sortable: boolean          // Allow sorting
  readOnly: boolean          // Read-only in API
}
```

---

## System Fields (Implicit)

The following fields are **implicit system fields** that should **NOT** be declared in the `fields` array:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier (auto-generated) |
| `createdAt` | TIMESTAMPTZ | Record creation timestamp |
| `updatedAt` | TIMESTAMPTZ | Last modification timestamp |
| `userId` | UUID | Owner user ID |
| `teamId` | UUID | Team ID for isolation |

These fields are:
- **Always present** in database tables (defined in migrations)
- **Always returned** in API responses (handled by `generic-handler.ts`)
- **Always available** for sorting in frontend components
- **Automatically shown** in detail view metadata sections
- **Never shown** in forms (managed by database triggers/defaults)

> **Important:** Do NOT declare `createdAt` or `updatedAt` in your entity's `fields` array. They are handled automatically by the system. See `core/lib/entities/system-fields.ts` for the implementation.

---

## Basic Types

### 1. text

Single-line text input.

```typescript
{
  name: 'title',
  type: 'text',
  required: true,
  display: {
    label: 'Title',
    description: 'Enter a title',
    placeholder: 'Type here...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 1,
    columnWidth: 12
  },
  api: {
    searchable: true,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Names, titles, short labels

### 2. textarea

Multi-line text area.

```typescript
{
  name: 'description',
  type: 'textarea',
  required: false,
  display: {
    label: 'Description',
    placeholder: 'Enter description...',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 2,
    columnWidth: 12
  },
  api: {
    searchable: true,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Descriptions, notes, comments

### 3. number

Numeric input.

```typescript
{
  name: 'price',
  type: 'number',
  required: true,
  defaultValue: 0,
  display: {
    label: 'Price',
    placeholder: '0.00',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 3,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Prices, quantities, counters

### 4. boolean

Checkbox for true/false values.

```typescript
{
  name: 'isActive',
  type: 'boolean',
  required: false,
  defaultValue: true,
  display: {
    label: 'Active',
    description: 'Is this record active?',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 4,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Flags, on/off states, activation

### 5. date

Date picker.

```typescript
{
  name: 'dueDate',
  type: 'date',
  required: false,
  display: {
    label: 'Due Date',
    placeholder: 'Select date...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 5,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Due dates, start/end dates

### 6. datetime

Date and time picker.

```typescript
{
  name: 'scheduledAt',
  type: 'datetime',
  required: false,
  display: {
    label: 'Scheduled At',
    placeholder: 'Select date and time...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 6,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Timestamps, event scheduling

### 7. email

Email input with validation.

```typescript
{
  name: 'email',
  type: 'email',
  required: true,
  display: {
    label: 'Email Address',
    placeholder: 'user@example.com',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 7,
    columnWidth: 6
  },
  api: {
    searchable: true,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Contact emails, email addresses

### 8. url

URL input with validation.

```typescript
{
  name: 'website',
  type: 'url',
  required: false,
  display: {
    label: 'Website',
    placeholder: 'https://example.com',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 8,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** URLs, external links

### 9. json

Structured JSON editor.

```typescript
{
  name: 'metadata',
  type: 'json',
  required: false,
  display: {
    label: 'Metadata',
    description: 'Additional structured data',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 9,
    columnWidth: 12
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Configurations, structured data

---

## Selection Types

### 10. select

Single selection dropdown.

```typescript
{
  name: 'status',
  type: 'select',
  required: false,
  defaultValue: 'draft',
  options: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' }
  ],
  display: {
    label: 'Status',
    placeholder: 'Select status...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 10,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Status, categories, fixed options

### 11. multiselect

Multiple option selector.

```typescript
{
  name: 'tags',
  type: 'multiselect',
  required: false,
  options: [
    { value: 'urgent', label: 'Urgent' },
    { value: 'important', label: 'Important' },
    { value: 'optional', label: 'Optional' }
  ],
  display: {
    label: 'Tags',
    placeholder: 'Select tags...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 11,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Multiple tags, multiple categories

### 12. radio

Radio buttons (RadioGroup).

```typescript
{
  name: 'type',
  type: 'radio',
  required: true,
  defaultValue: 'personal',
  options: [
    { value: 'personal', label: 'Personal' },
    { value: 'work', label: 'Work' },
    { value: 'other', label: 'Other' }
  ],
  display: {
    label: 'Type',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 12,
    columnWidth: 12
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Mutually exclusive visible options

### 13. buttongroup

Button group (radio with better styling).

```typescript
{
  name: 'priority',
  type: 'buttongroup',
  required: false,
  defaultValue: 'medium',
  options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ],
  display: {
    label: 'Priority',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 13,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Levels, priorities, visual options

### 14. tags

Input with dynamic chips/tags.

```typescript
{
  name: 'keywords',
  type: 'tags',
  required: false,
  display: {
    label: 'Keywords',
    placeholder: 'Add keywords...',
    description: 'Press Enter to add',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 14,
    columnWidth: 12
  },
  api: {
    searchable: true,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Free tags, keywords, labels

### 15. combobox

Select with integrated search.

```typescript
{
  name: 'category',
  type: 'combobox',
  required: false,
  options: [
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'food', label: 'Food' }
  ],
  display: {
    label: 'Category',
    placeholder: 'Search category...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 15,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Long lists with search

---

## Media Types

### 16. file

Generic file upload.

```typescript
{
  name: 'attachment',
  type: 'file',
  required: false,
  display: {
    label: 'Attachment',
    description: 'Upload a file',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 16,
    columnWidth: 12
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Documents, PDFs, general files

### 17. image

Image upload with preview.

```typescript
{
  name: 'thumbnail',
  type: 'image',
  required: false,
  display: {
    label: 'Thumbnail',
    description: 'Product image',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 17,
    columnWidth: 12
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Photos, thumbnails, product images

### 18. video

Video upload.

```typescript
{
  name: 'videoUrl',
  type: 'video',
  required: false,
  display: {
    label: 'Video',
    description: 'Upload video file',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 18,
    columnWidth: 12
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Product videos, tutorials

### 19. audio

Audio upload.

```typescript
{
  name: 'audioUrl',
  type: 'audio',
  required: false,
  display: {
    label: 'Audio',
    description: 'Upload audio file',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 19,
    columnWidth: 12
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Podcasts, recordings, audio clips

---

## Specialized Types

### 20. phone

Phone input with validation.

```typescript
{
  name: 'phone',
  type: 'phone',
  required: false,
  display: {
    label: 'Phone Number',
    placeholder: '+1 (555) 123-4567',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 20,
    columnWidth: 6
  },
  api: {
    searchable: true,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Contact phones

### 21. rating

Star/rating system.

```typescript
{
  name: 'rating',
  type: 'rating',
  required: false,
  defaultValue: 0,
  display: {
    label: 'Rating',
    description: 'Rate from 1 to 5',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 21,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Ratings, reviews, ratings

### 22. range

Slider for numeric ranges.

```typescript
{
  name: 'progress',
  type: 'range',
  required: false,
  defaultValue: 0,
  display: {
    label: 'Progress',
    description: 'Completion percentage',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 22,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Percentages, levels, progress

### 23. doublerange

Double slider for ranges.

```typescript
{
  name: 'priceRange',
  type: 'doublerange',
  required: false,
  display: {
    label: 'Price Range',
    description: 'Min and max price',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 23,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Range filters, intervals

---

## Text Editors

### 24. markdown

Markdown editor.

```typescript
{
  name: 'content',
  type: 'markdown',
  required: false,
  display: {
    label: 'Content',
    description: 'Markdown content',
    placeholder: 'Write markdown...',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 24,
    columnWidth: 12
  },
  api: {
    searchable: true,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Documentation, technical articles

### 25. richtext

WYSIWYG editor.

```typescript
{
  name: 'body',
  type: 'richtext',
  required: false,
  display: {
    label: 'Body',
    description: 'Rich text content',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 25,
    columnWidth: 12
  },
  api: {
    searchable: true,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Blog posts, pages, formatted content

### 26. code

Code editor with syntax highlighting.

```typescript
{
  name: 'snippet',
  type: 'code',
  required: false,
  display: {
    label: 'Code Snippet',
    description: 'Code with syntax highlighting',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 26,
    columnWidth: 12
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Code snippets, examples

---

## Data Selectors

### 27. timezone

Timezone selector.

```typescript
{
  name: 'timezone',
  type: 'timezone',
  required: false,
  defaultValue: 'UTC',
  display: {
    label: 'Timezone',
    placeholder: 'Select timezone...',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 27,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** User configuration, events

### 28. currency

Currency selector.

```typescript
{
  name: 'currency',
  type: 'currency',
  required: false,
  defaultValue: 'USD',
  display: {
    label: 'Currency',
    placeholder: 'Select currency...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 28,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** International pricing, billing

### 29. country

Country selector.

```typescript
{
  name: 'country',
  type: 'country',
  required: false,
  display: {
    label: 'Country',
    placeholder: 'Select country...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 29,
    columnWidth: 6
  },
  api: {
    searchable: true,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Addresses, location

### 30. address

Full address input.

```typescript
{
  name: 'address',
  type: 'address',
  required: false,
  display: {
    label: 'Address',
    description: 'Full address',
    placeholder: 'Enter address...',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 30,
    columnWidth: 12
  },
  api: {
    searchable: true,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Shipping addresses, locations

---

## Relation Types

### 31. relation

Simple relation with another entity (returns ID).

```typescript
{
  name: 'clientId',
  type: 'relation',
  required: true,
  relation: {
    entity: 'clients',
    titleField: 'name',
    userFiltered: true
  },
  display: {
    label: 'Client',
    placeholder: 'Select client...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 31,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Foreign keys, 1:N relationships

### 32. relation-multi

Multiple relation with another entity (returns array of IDs).

```typescript
{
  name: 'categoryIds',
  type: 'relation-multi',
  required: false,
  relation: {
    entity: 'categories',
    titleField: 'name',
    userFiltered: true
  },
  display: {
    label: 'Categories',
    placeholder: 'Select categories...',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 32,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Entity tags, multiple categories

### 33. relation-prop

Property-based entity relation.

```typescript
{
  name: 'language',
  type: 'relation-prop',
  required: true,
  relation: {
    entity: 'clients',
    prop: 'contentLanguages',
    parentId: 'clientId',
    userFiltered: true,
    options: [
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' }
    ]
  },
  display: {
    label: 'Language',
    placeholder: 'Select language...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 33,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Dynamic properties of related entities

### 34. relation-prop-multi

Multiple property-based relation.

```typescript
{
  name: 'selectedLanguages',
  type: 'relation-prop-multi',
  required: false,
  relation: {
    entity: 'clients',
    prop: 'contentLanguages',
    parentId: 'clientId',
    userFiltered: true
  },
  display: {
    label: 'Languages',
    placeholder: 'Select languages...',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 34,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Use cases:** Multiple properties of related entities

### 35. user

Specific user selector.

```typescript
{
  name: 'assignedTo',
  type: 'user',
  required: false,
  display: {
    label: 'Assigned To',
    placeholder: 'Select user...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 35,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

**Use cases:** Task assignment, ownership

---

## Custom Validation with Zod

You can add additional validation using Zod:

```typescript
import { z } from 'zod'

{
  name: 'email',
  type: 'email',
  required: true,
  validation: z.string().email().endsWith('@company.com'),
  display: { ... },
  api: { ... }
}
```

---

## Next Steps

1. **[Relationships](./05-relationships.md)** - Relation types in detail
2. **[Validation](./10-validation.md)** - Complete validation system
3. **[Examples](./12-examples.md)** - Real field examples

---

> 💡 **Tip**: Review `contents/themes/default/entities/tasks/tasks.fields.ts` to see real examples of multiple field types in action.
