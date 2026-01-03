# Entity Relationships

The entity system supports four types of relationships that allow connecting entities in a flexible and type-safe way.

## Relationship Types

| Type | Description | Returns | Use Case |
|------|-------------|---------|----------|
| `relation` | Simple 1:N relationship | ID (string) | Classic foreign keys |
| `relation-multi` | Multiple N:N relationship | Array of IDs | Tags, multiple categories |
| `relation-prop` | Related entity property | Property value | Dynamic properties |
| `relation-prop-multi` | Multiple properties | Array of values | Multiple prop selection |

---

## 1. relation: Simple Relationship

Classic one-to-many (1:N) relationship. Returns the related entity's ID.

### Configuration

```typescript
{
  name: 'clientId',
  type: 'relation',
  required: true,
  relation: {
    entity: 'clients',           // Related entity
    titleField: 'name',          // Field to display
    userFiltered: true,          // Filter by current user
    parentId?: string            // Optional hierarchical filter
  },
  display: {
    label: 'Client',
    placeholder: 'Select client...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 1,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: true,
    readOnly: false
  }
}
```

### Example: Tasks → Clients

```typescript
// In tasks.fields.ts
{
  name: 'clientId',
  type: 'relation',
  required: true,
  relation: {
    entity: 'clients',
    titleField: 'name',
    userFiltered: true
  },
  // ...
}
```

**Behavior:**
- The form displays a dropdown with all the user's clients
- The list shows the client's name
- The API returns the client's ID
- RLS automatically filters by `userId`

### With Hierarchical Filter

```typescript
// First select client, then project from that client
{
  name: 'projectId',
  type: 'relation',
  required: false,
  relation: {
    entity: 'projects',
    titleField: 'name',
    parentId: 'clientId',      // Filter by selected client
    userFiltered: true
  },
  // ...
}
```

---

## 2. relation-multi: Multiple Relationship

Many-to-many (N:N) relationship. Returns an array of IDs.

### Configuration

```typescript
{
  name: 'categoryIds',
  type: 'relation-multi',
  required: false,
  relation: {
    entity: 'categories',
    titleField: 'name',
    userFiltered: true,
    parentId?: string
  },
  display: {
    label: 'Categories',
    placeholder: 'Select categories...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 2,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

### Example: Tasks → Categories

```typescript
{
  name: 'categoryIds',
  type: 'relation-multi',
  required: false,
  relation: {
    entity: 'categories',
    titleField: 'name',
    userFiltered: false        // Global categories
  },
  display: {
    label: 'Categories',
    placeholder: 'Select multiple...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 3,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Behavior:**
- Multiselect in forms
- Shows badges in lists
- Saves array of IDs: `["id1", "id2", "id3"]`

---

## 3. relation-prop: Relationship Property

Selects a value from a JSONB property of a related entity.

### When to use?

When the related entity has a dynamic field (JSONB array) from which you want to select a value.

### Configuration

```typescript
{
  name: 'language',
  type: 'relation-prop',
  required: true,
  relation: {
    entity: 'clients',              // Entity that has the prop
    prop: 'contentLanguages',       // JSONB array field
    parentId: 'clientId',           // FK to the entity
    userFiltered: true,
    options: [                      // Fallback options
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' },
      { value: 'pt', label: 'Português' }
    ]
  },
  display: {
    label: 'Content Language',
    placeholder: 'Select language...',
    showInList: true,
    showInDetail: true,
    showInForm: true,
    order: 4,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

### Real Example: Tasks → Client Languages

```typescript
// The 'clients' entity has:
// contentLanguages: ['es', 'en', 'pt']  (JSONB field)

// In tasks.fields.ts:
{
  name: 'language',
  type: 'relation-prop',
  required: true,
  relation: {
    entity: 'clients',
    prop: 'contentLanguages',       // Reads this array
    parentId: 'clientId',           // From selected client
    userFiltered: true,
    options: [                      // Used if client has no languages
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' }
    ]
  },
  // ...
}
```

**Behavior:**
1. User selects a client in `clientId`
2. System loads `client.contentLanguages` → `['es', 'en']`
3. Dropdown shows only those options
4. User selects `'es'`
5. Saves `language: 'es'` in the task

**Fallback Options:**
If the client doesn't have `contentLanguages`, uses `relation.options`.

---

## 4. relation-prop-multi: Multiple Properties

Same as `relation-prop` but allows selecting multiple values.

### Configuration

```typescript
{
  name: 'selectedLanguages',
  type: 'relation-prop-multi',
  required: false,
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
    label: 'Content Languages',
    placeholder: 'Select multiple languages...',
    showInList: false,
    showInDetail: true,
    showInForm: true,
    order: 5,
    columnWidth: 6
  },
  api: {
    searchable: false,
    sortable: false,
    readOnly: false
  }
}
```

**Behavior:**
- Multiselect with dynamic options
- Saves array: `['es', 'en', 'pt']`

---

## RelationConfig Configuration

### Complete Properties

```typescript
interface RelationConfig {
  entity: string              // Related entity
  titleField?: string         // Field to display (required for relation/relation-multi)
  parentId?: string          // FK for hierarchical filter
  prop?: string              // JSONB property (required for relation-prop)
  options?: FieldOption[]    // Fallback options
  userFiltered?: boolean     // Filter by user (default: true)
}
```

### `entity` (required)

Slug of the related entity.

```typescript
{
  entity: 'clients'  // Must exist in the registry
}
```

### `titleField` (required for relation/relation-multi)

Field from the related entity to display in the UI.

```typescript
{
  entity: 'clients',
  titleField: 'name'  // Shows client.name in the dropdown
}
```

### `parentId` (optional)

Hierarchical filter. Filters options based on another relationship.

```typescript
// First select client, then projects from that client
{
  name: 'projectId',
  type: 'relation',
  relation: {
    entity: 'projects',
    titleField: 'name',
    parentId: 'clientId'  // Only projects where project.clientId === task.clientId
  }
}
```

### `prop` (required for relation-prop)

JSONB array field from the related entity.

```typescript
{
  entity: 'clients',
  prop: 'contentLanguages'  // Reads client.contentLanguages[]
}
```

### `options` (optional)

Static fallback options.

```typescript
{
  relation: {
    entity: 'clients',
    prop: 'contentLanguages',
    options: [  // Used if client.contentLanguages is null/empty
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' }
    ]
  }
}
```

### `userFiltered` (optional, default: true)

Filters results by the current user.

```typescript
{
  userFiltered: true   // Only my clients
}

{
  userFiltered: false  // All clients (e.g., global categories)
}
```

---

## Use Case Examples

### Case 1: Simple E-commerce

```typescript
// Product → Category (simple)
{
  name: 'categoryId',
  type: 'relation',
  relation: {
    entity: 'categories',
    titleField: 'name',
    userFiltered: false  // Global categories
  }
}

// Product → Tags (multiple)
{
  name: 'tagIds',
  type: 'relation-multi',
  relation: {
    entity: 'tags',
    titleField: 'name',
    userFiltered: false
  }
}
```

### Case 2: CRM with Hierarchy

```typescript
// Task → Client (level 1)
{
  name: 'clientId',
  type: 'relation',
  relation: {
    entity: 'clients',
    titleField: 'name',
    userFiltered: true
  }
}

// Task → Project (level 2, filtered by client)
{
  name: 'projectId',
  type: 'relation',
  relation: {
    entity: 'projects',
    titleField: 'name',
    parentId: 'clientId',  // Hierarchical filter
    userFiltered: true
  }
}
```

### Case 3: Content Management with Dynamic Props

```typescript
// Post → Client
{
  name: 'clientId',
  type: 'relation',
  relation: {
    entity: 'clients',
    titleField: 'name',
    userFiltered: true
  }
}

// Post → Language (from client.contentLanguages)
{
  name: 'language',
  type: 'relation-prop',
  relation: {
    entity: 'clients',
    prop: 'contentLanguages',
    parentId: 'clientId',
    userFiltered: true,
    options: [
      { value: 'es', label: 'Español' },
      { value: 'en', label: 'English' }
    ]
  }
}

// Post → Hashtags (from client.hashtags array)
{
  name: 'hashtags',
  type: 'relation-prop-multi',
  relation: {
    entity: 'clients',
    prop: 'hashtags',
    parentId: 'clientId',
    userFiltered: true
  }
}
```

---

## UI Behavior

### In Forms

- **relation**: Dropdown/Select
- **relation-multi**: Multiselect
- **relation-prop**: Dynamic dropdown
- **relation-prop-multi**: Dynamic multiselect

### In Lists

- **relation**: Shows `titleField` from the related entity
- **relation-multi**: Shows badges for each item
- **relation-prop**: Shows the selected value
- **relation-prop-multi**: Shows badges for each value

### In APIs

```typescript
// GET /api/v1/tasks/123

{
  "id": "123",
  "title": "My Task",
  "clientId": "client-456",              // relation
  "categoryIds": ["cat-1", "cat-2"],     // relation-multi
  "language": "es",                       // relation-prop
  "hashtags": ["#marketing", "#social"]  // relation-prop-multi
}
```

---

## Validation

### In Database

```sql
-- For relation: Foreign Key
ALTER TABLE tasks 
  ADD CONSTRAINT fk_client 
  FOREIGN KEY (clientId) 
  REFERENCES clients(id);

-- For relation-multi: Array of UUIDs
ALTER TABLE tasks 
  ADD COLUMN categoryIds UUID[];

-- For relation-prop: Simple value
ALTER TABLE tasks 
  ADD COLUMN language VARCHAR(10);

-- For relation-prop-multi: Array of values
ALTER TABLE tasks 
  ADD COLUMN hashtags TEXT[];
```

### In Code (Zod)

```typescript
// Auto-generated validation
const taskSchema = z.object({
  clientId: z.string().uuid(),          // relation
  categoryIds: z.array(z.string().uuid()), // relation-multi
  language: z.string(),                 // relation-prop
  hashtags: z.array(z.string())        // relation-prop-multi
})
```

---

## Performance and Optimization

### Eager Loading

The system automatically does eager loading of relationships in lists:

```sql
-- Automatic optimized query
SELECT 
  t.*,
  c.name as client_name
FROM tasks t
LEFT JOIN clients c ON t.clientId = c.id
WHERE t.userId = $1
```

### Caching

Relationship options are cached per user:

```typescript
// Cached
const clientOptions = useRelationOptions('clients', user.id)
```

---

## Next Steps

1. **[Child Entities](./06-child-entities.md)** - Parent-child relationships
2. **[Field Types](./04-field-types.md)** - All field types
3. **[Examples](./12-examples.md)** - Complete examples with relationships

---

> 💡 **Tip**: Check `contents/themes/default/entities/tasks/tasks.fields.ts` to see real examples of all relationship types in use.
