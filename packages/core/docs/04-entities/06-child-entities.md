# Child Entities

Child Entities allow creating parent-child relationships where the child entity exists only in the context of its parent. They're useful for nested data like comments, order lines, or project tasks.

## Concept

A child entity is an entity that:
- Has a required reference to its parent entity (`parentId`)
- Only exists while its parent exists (CASCADE DELETE)
- Is managed primarily from the parent's view
- Can have its own field configuration and permissions

## Configuration

### In EntityConfig

```typescript
export const projectEntityConfig: EntityConfig = {
  slug: 'projects',
  // ... other configurations
  
  childEntities: {
    'comments': {
      table: 'project_comments',
      showInParentView: true,
      hasOwnRoutes: false,
      fields: [
        {
          name: 'content',
          type: 'textarea',
          required: true,
          display: {
            label: 'Comment',
            placeholder: 'Write a comment...',
          }
        },
        {
          name: 'author',
          type: 'text',
          required: true,
          display: {
            label: 'Author'
          }
        }
      ],
      display: {
        title: 'Comments',
        description: 'Project comments and notes',
        mode: 'list'
      }
    }
  }
}
```

### ChildEntityConfig Structure

```typescript
interface ChildEntityConfig {
  [childName: string]: ChildEntityDefinition
}

interface ChildEntityDefinition {
  table: string                    // Database table name
  fields: ChildEntityField[]       // Child entity fields
  showInParentView: boolean        // Show in parent view
  hasOwnRoutes: boolean           // Has independent routes?
  permissions?: EntityPermissions  // Specific permissions
  hooks?: ChildEntityHooks        // Specific hooks
  display: ChildEntityDisplay     // Display configuration
  idStrategy?: {                  // ID strategy
    type: 'uuid' | 'serial'
    autoGenerate?: boolean
  }
}
```

## Properties

### `table` (required)

Database table name.

```typescript
{
  table: 'project_comments'  // Table where comments are stored
}
```

**Convention:** `{parent}_{child}` (e.g., `project_comments`, `order_items`)

### `fields` (required)

Array of child entity fields.

```typescript
{
  fields: [
    {
      name: 'content',
      type: 'textarea',
      required: true,
      display: {
        label: 'Comment Content'
      }
    },
    {
      name: 'rating',
      type: 'rating',
      required: false,
      display: {
        label: 'Rating'
      }
    }
  ]
}
```

### `showInParentView` (required)

Whether it should be shown in the parent view.

```typescript
{
  showInParentView: true  // Yes, show in the project view
}
```

### `hasOwnRoutes` (required)

Whether it has independent routes (`/api/v1/comments`).

```typescript
{
  hasOwnRoutes: false  // Only accessible from the parent
}
```

**Behavior:**
- `false`: Only `/api/v1/projects/{id}/child/comments`
- `true`: Also `/api/v1/comments` (as an independent entity)

### `permissions` (optional)

Specific permissions for the child entity.

```typescript
{
  permissions: {
    read: ['admin', 'colaborator', 'member'],
    create: ['admin', 'colaborator'],
    update: ['admin'],
    delete: ['admin']
  }
}
```

If not specified, inherits permissions from the parent.

### `display` (required)

Display configuration.

```typescript
{
  display: {
    title: 'Comments',                    // Section title
    description: 'User comments',         // Description
    mode: 'list'                          // 'table' | 'cards' | 'list'
  }
}
```

## Complete Example: Order with Items

```typescript
// orders.config.ts
export const orderEntityConfig: EntityConfig = {
  slug: 'orders',
  enabled: true,
  names: {
    singular: 'order',
    plural: 'Orders'
  },
  icon: ShoppingCart,
  
  access: {
    public: false,
    api: true,
    metadata: true,
    shared: false
  },
  
  // ... other configurations
  
  childEntities: {
    'items': {
      table: 'order_items',
      showInParentView: true,
      hasOwnRoutes: false,
      
      fields: [
        {
          name: 'productName',
          type: 'text',
          required: true,
          display: {
            label: 'Product'
          }
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          defaultValue: 1,
          display: {
            label: 'Quantity'
          }
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          display: {
            label: 'Unit Price'
          }
        },
        {
          name: 'subtotal',
          type: 'number',
          required: true,
          display: {
            label: 'Subtotal'
          }
        }
      ],
      
      display: {
        title: 'Order Items',
        description: 'Products in this order',
        mode: 'table'
      },
      
      permissions: {
        read: ['admin', 'colaborator', 'member'],
        create: ['admin', 'colaborator'],
        update: ['admin', 'colaborator'],
        delete: ['admin', 'colaborator']
      }
    }
  }
}
```

## Database

### SQL Migration

```sql
-- Parent table
CREATE TABLE "orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderNumber" VARCHAR(50) NOT NULL,
  "total" DECIMAL(10, 2),
  "userId" UUID NOT NULL REFERENCES "user"("id"),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Child table
CREATE TABLE "order_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "parentId" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "productName" VARCHAR(255) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "price" DECIMAL(10, 2) NOT NULL,
  "subtotal" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX "idx_order_items_parentId" ON "order_items"("parentId");

-- RLS for child entity
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" ON "order_items"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "orders"
      WHERE "orders"."id" = "order_items"."parentId"
      AND "orders"."userId" = auth.uid()
    )
  );
```

**Important:** The `parentId` column is required and must be a foreign key with `ON DELETE CASCADE`.

## Automatic APIs

### Generated Endpoints

```bash
# List items from an order
GET /api/v1/orders/{orderId}/child/items

# Create item in an order
POST /api/v1/orders/{orderId}/child/items

# Get specific item
GET /api/v1/orders/{orderId}/child/items/{itemId}

# Update item
PATCH /api/v1/orders/{orderId}/child/items/{itemId}

# Delete item
DELETE /api/v1/orders/{orderId}/child/items/{itemId}
```

### Request Example

```typescript
// GET /api/v1/orders/123/child/items
{
  "success": true,
  "data": [
    {
      "id": "item-1",
      "parentId": "123",
      "productName": "Laptop",
      "quantity": 2,
      "price": 999.99,
      "subtotal": 1999.98,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}

// POST /api/v1/orders/123/child/items
{
  "productName": "Mouse",
  "quantity": 1,
  "price": 29.99,
  "subtotal": 29.99
}
```

## UI Components

### EntityDetailWrapper with Child Entities

```typescript
'use client'

import { EntityDetailWrapper } from '@/core/components/entities/wrappers'

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <EntityDetailWrapper
      entityType="orders"
      id={params.id}
      childEntityNames={['items']}  // Loads items automatically
    />
  )
}
```

### Manual EntityChildManager

If you need more control:

```typescript
import { EntityChildManager } from '@/core/components/entities/EntityChildManager'

<EntityChildManager
  parentEntityConfig={orderConfig}
  childEntityName="items"
  childEntityConfig={itemsConfig}
  childData={items}
  onChildAdd={handleAddItem}
  onChildUpdate={handleUpdateItem}
  onChildDelete={handleDeleteItem}
  onRefresh={handleRefresh}
/>
```

## Display Modes

### `table`

Table with columns for each field.

```typescript
{
  display: {
    mode: 'table'
  }
}
```

**Best for:** Order items, invoice lines, tabular records

### `cards`

Individual cards for each item.

```typescript
{
  display: {
    mode: 'cards'
  }
}
```

**Best for:** Comments, reviews, attachments

### `list`

Simple list without much formatting.

```typescript
{
  display: {
    mode: 'list'
  }
}
```

**Best for:** Simple lists, logs, history

## Use Cases

### E-commerce

```typescript
// Order → Items
childEntities: {
  'items': { ... }         // Order products
  'shipments': { ... }     // Order shipments
  'payments': { ... }      // Order payments
}
```

### Project Management

```typescript
// Project → Tasks, Milestones
childEntities: {
  'tasks': { ... }         // Project tasks
  'milestones': { ... }    // Project milestones
  'documents': { ... }     // Project documents
}
```

### Blog/CMS

```typescript
// Post → Comments, Revisions
childEntities: {
  'comments': { ... }      // Post comments
  'revisions': { ... }     // Revision history
  'attachments': { ... }   // Attached files
}
```

## Limitations

1. **One level deep**: Child entities cannot have their own child entities
2. **No public routes**: Child entities don't have their own public pages
3. **Cascade deletion**: Deleting the parent deletes all child entities

## Next Steps

1. **[Metadata System](./07-metadata-system.md)** - Dynamic fields system
2. **[Permissions](./09-permissions.md)** - Permissions in child entities
3. **[Examples](./12-examples.md)** - Complete examples with child entities

---

> 💡 **Tip**: Child entities are ideal for 1:N relationships where the child doesn't make sense outside the parent's context (e.g., order items, post comments).
