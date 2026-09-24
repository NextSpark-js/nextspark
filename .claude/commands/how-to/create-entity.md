# /how-to:create-entity

Interactive guide to create entities with full CRUD in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/entity-system/SKILL.md` - Entity configuration and registry
- `.claude/skills/database-migrations/SKILL.md` - PostgreSQL migrations with RLS
- `.claude/skills/entity-api/SKILL.md` - Dynamic API patterns

---

## Syntax

```
/how-to:create-entity
/how-to:create-entity [entity-name]
```

---

## Behavior

Guides the user through creating a complete entity with database migration, automatic CRUD API, and dashboard integration.

---

## Tutorial Structure

```
STEPS OVERVIEW (6 steps)

Step 1: Understanding the Entity System
        └── How entities work in NextSpark

Step 2: Create Entity Configuration
        └── Define entity config with fields

Step 3: Create Database Migration
        └── SQL with RLS policies

Step 4: Generate Sample Data
        └── Create realistic test data

Step 5: Add Translations
        └── i18n for labels and messages

Step 6: Test Your Entity
        └── Verify CRUD operations

Bonus: Customize the Dashboard UI
```

---

## Step 1: Understanding Entities

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE AN ENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 6: Understanding the Entity System

In NextSpark, an **entity** is a data type that automatically gets:

✅ Database table with RLS policies
✅ Full CRUD API endpoints
✅ Dashboard UI (list, create, edit, delete)
✅ Form validation with Zod
✅ i18n support
✅ Permissions integration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Entity Files Structure:

entities/{entity}/
├── config.ts           # Entity configuration (REQUIRED)
├── messages/
│   ├── en.json         # English translations
│   └── es.json         # Spanish translations
└── migrations/
    └── 001_{entity}.sql  # Database migration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 What you get automatically:

• GET    /api/v1/entities/{entity}         → List all
• GET    /api/v1/entities/{entity}/{id}    → Get one
• POST   /api/v1/entities/{entity}         → Create
• PATCH  /api/v1/entities/{entity}/{id}    → Update
• DELETE /api/v1/entities/{entity}/{id}    → Delete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What entity would you like to create?

Example: "products", "tasks", "invoices"
```

---

## Step 2: Create Entity Configuration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 6: Create Entity Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The config.ts file defines your entity's structure:
```

**📋 Entity Config Example:**

```typescript
// entities/products/config.ts
import type { EntityConfig } from '@/core/types/entity'
import * as z from 'zod'
import { Package } from 'lucide-react'

export const productsEntity: EntityConfig = {
  // Identity
  name: 'products',
  slug: 'products',
  table: 'products',

  // Display
  displayName: 'entities.products.name',
  displayNamePlural: 'entities.products.namePlural',
  icon: Package,

  // Schema (Zod validation)
  schema: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    price: z.number().min(0),
    sku: z.string().min(1).max(50),
    categoryId: z.string().uuid().optional(),
    isActive: z.boolean().default(true),
  }),

  // Field definitions for UI
  fields: {
    name: {
      type: 'text',
      label: 'entities.products.fields.name',
      required: true,
      searchable: true,
      sortable: true,
    },
    description: {
      type: 'textarea',
      label: 'entities.products.fields.description',
    },
    price: {
      type: 'number',
      label: 'entities.products.fields.price',
      format: 'currency',
      sortable: true,
    },
    sku: {
      type: 'text',
      label: 'entities.products.fields.sku',
      searchable: true,
    },
    categoryId: {
      type: 'relation',
      label: 'entities.products.fields.category',
      relation: {
        entity: 'categories',
        displayField: 'name',
      },
    },
    isActive: {
      type: 'boolean',
      label: 'entities.products.fields.isActive',
      default: true,
    },
  },

  // List view configuration
  listView: {
    columns: ['name', 'sku', 'price', 'isActive'],
    defaultSort: { field: 'name', direction: 'asc' },
    searchableFields: ['name', 'sku'],
  },

  // Dashboard settings
  dashboard: {
    enabled: true,
    showInMenu: true,
    menuOrder: 10,
  },

  // Permissions (uses entity name)
  // Automatically creates: products.read, products.create, etc.
}

export default productsEntity
```

**📋 Field Types Available:**

- `text` - Single line text
- `textarea` - Multi-line text
- `number` - Numeric with optional format
- `boolean` - True/false toggle
- `select` - Dropdown with options
- `date` - Date picker
- `datetime` - Date and time
- `email` - Email with validation
- `url` - URL with validation
- `relation` - Reference to another entity
- `json` - JSON editor

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Migration)
[2] I have a question about config
[3] What field options are available?
[4] Let me create my entity config now
```

---

## Step 3: Create Database Migration

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 6: Create Database Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The migration creates your database table with RLS:
```

**📋 Migration Example:**

```sql
-- entities/products/migrations/001_products.sql
-- ============================================================================
-- Entity: products
-- Description: Products catalog for the store
-- ============================================================================

-- Main Table
CREATE TABLE IF NOT EXISTS "products" (
  -- Primary key (UUID)
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Team ownership (REQUIRED for multi-tenant)
  "teamId" UUID NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,

  -- Entity fields (camelCase!)
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "sku" VARCHAR(50) NOT NULL,
  "categoryId" UUID REFERENCES "categories"("id") ON DELETE SET NULL,
  "isActive" BOOLEAN DEFAULT true,

  -- Audit fields
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" UUID REFERENCES "user"("id") ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES "user"("id") ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_products_teamId" ON "products"("teamId");
CREATE INDEX IF NOT EXISTS "idx_products_categoryId" ON "products"("categoryId");
CREATE INDEX IF NOT EXISTS "idx_products_sku" ON "products"("sku");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_team_sku"
  ON "products"("teamId", "sku");

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

-- Team members can view their team's products
CREATE POLICY "products_select_policy" ON "products"
  FOR SELECT
  USING (
    "teamId" IN (
      SELECT "teamId" FROM "teamMembers"
      WHERE "userId" = current_setting('app.user_id', true)::UUID
    )
  );

-- Team members can insert products for their team
CREATE POLICY "products_insert_policy" ON "products"
  FOR INSERT
  WITH CHECK (
    "teamId" IN (
      SELECT "teamId" FROM "teamMembers"
      WHERE "userId" = current_setting('app.user_id', true)::UUID
    )
  );

-- Team members can update their team's products
CREATE POLICY "products_update_policy" ON "products"
  FOR UPDATE
  USING (
    "teamId" IN (
      SELECT "teamId" FROM "teamMembers"
      WHERE "userId" = current_setting('app.user_id', true)::UUID
    )
  );

-- Team members can delete their team's products
CREATE POLICY "products_delete_policy" ON "products"
  FOR DELETE
  USING (
    "teamId" IN (
      SELECT "teamId" FROM "teamMembers"
      WHERE "userId" = current_setting('app.user_id', true)::UUID
    )
  );
```

**⚠️ CRITICAL Rules:**

- ALL column names use camelCase (not snake_case)
- TIMESTAMPTZ for dates (not TIMESTAMP)
- Always include teamId for multi-tenant
- Always add RLS policies

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Sample Data)
[2] I have a question about migrations
[3] How do I add a metadata table?
[4] Let me create my migration now
```

---

## Step 4: Generate Sample Data

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 6: Generate Sample Data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add sample data for development and testing:
```

**📋 Sample Data Migration:**

```sql
-- entities/products/migrations/002_products_sample.sql
-- ============================================================================
-- Sample Data: products
-- ============================================================================

-- Get reference IDs (assuming default team and user exist)
DO $$
DECLARE
  v_team_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_team_id FROM "team" LIMIT 1;
  SELECT id INTO v_user_id FROM "user" LIMIT 1;

  -- Insert sample products
  INSERT INTO "products" (
    "teamId", "name", "description", "price", "sku", "isActive",
    "createdBy", "updatedBy"
  ) VALUES
    (v_team_id, 'Wireless Headphones', 'Premium noise-canceling headphones', 299.99, 'WH-001', true, v_user_id, v_user_id),
    (v_team_id, 'Mechanical Keyboard', 'RGB mechanical gaming keyboard', 149.99, 'KB-001', true, v_user_id, v_user_id),
    (v_team_id, 'USB-C Hub', '7-in-1 USB-C dock for laptops', 79.99, 'HUB-001', true, v_user_id, v_user_id),
    (v_team_id, 'Webcam HD', '1080p HD webcam with microphone', 89.99, 'WC-001', true, v_user_id, v_user_id),
    (v_team_id, 'Monitor Stand', 'Adjustable monitor stand with USB', 59.99, 'MS-001', true, v_user_id, v_user_id),
    (v_team_id, 'Laptop Sleeve', 'Protective sleeve for 15" laptops', 29.99, 'LS-001', true, v_user_id, v_user_id),
    (v_team_id, 'Wireless Mouse', 'Ergonomic wireless mouse', 49.99, 'WM-001', true, v_user_id, v_user_id),
    (v_team_id, 'Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 'DL-001', false, v_user_id, v_user_id),
    (v_team_id, 'Cable Organizer', 'Desktop cable management system', 19.99, 'CO-001', true, v_user_id, v_user_id),
    (v_team_id, 'Screen Cleaner Kit', 'Microfiber cloth and cleaning solution', 14.99, 'SC-001', true, v_user_id, v_user_id)
  ON CONFLICT DO NOTHING;
END $$;
```

**📋 Sample Data Guidelines:**

- Use 8-12 varied records
- Include edge cases (inactive items)
- Use realistic values
- Reference existing users/teams
- Make data coherent (related items)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Translations)
[2] I have a question about sample data
[3] Let me create my sample data now
```

---

## Step 5: Add Translations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 6: Add Translations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add i18n translations for your entity:
```

**📋 English Translations (en.json):**

```json
// entities/products/messages/en.json
{
  "entities": {
    "products": {
      "name": "Product",
      "namePlural": "Products",
      "description": "Manage your product catalog",

      "fields": {
        "name": "Name",
        "description": "Description",
        "price": "Price",
        "sku": "SKU",
        "category": "Category",
        "isActive": "Active"
      },

      "placeholders": {
        "name": "Enter product name...",
        "description": "Enter product description...",
        "sku": "Enter SKU code..."
      },

      "actions": {
        "create": "Create Product",
        "edit": "Edit Product",
        "delete": "Delete Product"
      },

      "messages": {
        "created": "Product created successfully",
        "updated": "Product updated successfully",
        "deleted": "Product deleted successfully",
        "confirmDelete": "Are you sure you want to delete this product?"
      }
    }
  }
}
```

**📋 Spanish Translations (es.json):**

```json
// entities/products/messages/es.json
{
  "entities": {
    "products": {
      "name": "Producto",
      "namePlural": "Productos",
      "description": "Administra tu catálogo de productos",

      "fields": {
        "name": "Nombre",
        "description": "Descripción",
        "price": "Precio",
        "sku": "SKU",
        "category": "Categoría",
        "isActive": "Activo"
      },

      "placeholders": {
        "name": "Ingresa el nombre del producto...",
        "description": "Ingresa la descripción...",
        "sku": "Ingresa el código SKU..."
      },

      "actions": {
        "create": "Crear Producto",
        "edit": "Editar Producto",
        "delete": "Eliminar Producto"
      },

      "messages": {
        "created": "Producto creado exitosamente",
        "updated": "Producto actualizado exitosamente",
        "deleted": "Producto eliminado exitosamente",
        "confirmDelete": "¿Estás seguro de que deseas eliminar este producto?"
      }
    }
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 6 (Testing)
[2] What translations are required?
[3] Let me create my translations now
```

---

## Step 6: Test Your Entity

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 OF 6: Test Your Entity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**1️⃣ Run the migration:**

```bash
pnpm db:migrate
```

**2️⃣ Rebuild the entity registry:**

```bash
node core/scripts/build/registry.mjs
```

**3️⃣ Start the dev server:**

```bash
pnpm dev
```

**4️⃣ Test the API endpoints:**

```bash
# List all products
curl http://localhost:3000/api/v1/entities/products \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create a product
curl -X POST http://localhost:3000/api/v1/entities/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":99.99,"sku":"TEST-001"}'
```

**5️⃣ Test in the Dashboard:**

- Go to /dashboard/products
- Verify list view shows your sample data
- Test create, edit, and delete operations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've created a complete entity with:
• Database table with RLS
• Automatic CRUD API
• Dashboard integration
• Full i18n support

📚 Related tutorials:
   • /how-to:create-migrations - Advanced migrations
   • /how-to:create-api - Custom API endpoints
   • /how-to:set-user-roles-and-permissions - Entity permissions

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/session:db:entity` | Create entity via session workflow |
| `/session:db:sample` | Generate sample data |
| `/how-to:create-migrations` | Advanced migration patterns |
