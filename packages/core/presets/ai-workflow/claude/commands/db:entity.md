---
description: "[DB Step 1] Generate migration for entity with relations and metadata support"
---

# Database Entity - Generate Migration

You are creating a database migration for a new entity.

**Entity Description:**
{{{ input }}}

---

## CRITICAL: Use Migration Presets

**ALWAYS reference templates from `core/presets/migrations/`**

Read the README first:
```typescript
await Read('core/presets/migrations/README.md')
```

Then read the appropriate template based on RLS mode selected.

---

## Migration Standards (from `.rules/migrations.md`)

**MANDATORY conventions - NO EXCEPTIONS:**

| Standard | Correct | Incorrect |
|----------|---------|-----------|
| ID Type | `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text` | `UUID PRIMARY KEY DEFAULT uuid_generate_v4()` |
| Column Naming | `"userId"`, `"teamId"`, `"createdAt"` | `user_id`, `team_id`, `created_at` |
| Timestamps | `TIMESTAMPTZ NOT NULL DEFAULT now()` | `TIMESTAMP WITH TIME ZONE DEFAULT NOW()` |
| Trigger Function | `public.set_updated_at()` | Custom `update_entity_updated_at()` |
| Meta FK | `"entityId"` | `"productId"`, `"customerId"` |
| Child FK | `"parentId"` | `"postId"`, `"invoiceId"` |
| Table Quoting | `public."entityName"` | `entityName` |

---

## Entity Planning

### Step 1: Select RLS Mode (REQUIRED FIRST)

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "RLS Mode",
      question: "What security model should this entity use?",
      options: [
        {
          label: "Team Mode (Recommended)",
          description: "Team-based isolation - users see only their team's data"
        },
        {
          label: "Private Mode",
          description: "Owner-only access - users see only their own data"
        },
        {
          label: "Shared Mode",
          description: "Any authenticated user can access all records"
        },
        {
          label: "Public Mode",
          description: "Public read (published), authenticated write"
        }
      ],
      multiSelect: false
    }
  ]
})

// Read the selected template
const templateFolder = {
  'Team Mode': 'team-mode',
  'Private Mode': 'private-mode',
  'Shared Mode': 'shared-mode',
  'Public Mode': 'public-mode'
}[selectedMode]

await Read(`core/presets/migrations/${templateFolder}/001_entity_table.sql.template`)
```

### Step 2: Gather Entity Requirements

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "Entity Type",
      question: "What type of entity is this?",
      options: [
        { label: "Main Entity", description: "Primary entity with userId/teamId ownership" },
        { label: "Child Entity", description: "Belongs to another entity via parentId" },
        { label: "Junction Table", description: "Many-to-many relationship table" }
      ],
      multiSelect: false
    },
    {
      header: "Metadata",
      question: "Does this entity need metadata support?",
      options: [
        { label: "Yes - metas table", description: "Extensible key-value attributes (SEO, settings)" },
        { label: "No - fixed schema", description: "All fields defined in main table only" }
      ],
      multiSelect: false
    },
    {
      header: "Soft Delete",
      question: "Should deletions be soft (recoverable)?",
      options: [
        { label: "No - hard delete (Recommended)", description: "Actually remove records" },
        { label: "Yes - soft delete", description: "Add deletedAt column, don't actually delete" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 3: Define Schema Fields

```typescript
await AskUserQuestion({
  questions: [
    {
      header: "Fields",
      question: "What fields should this entity have? (Select all that apply)",
      options: [
        { label: "title (TEXT)", description: "Display title/name" },
        { label: "slug (TEXT UNIQUE)", description: "URL-friendly identifier" },
        { label: "description (TEXT)", description: "Long description/content" },
        { label: "status (TEXT)", description: "Status field (active, inactive, etc.)" },
        { label: "amount (NUMERIC)", description: "Monetary/decimal value" },
        { label: "sortOrder (INTEGER)", description: "Ordering/position field" }
      ],
      multiSelect: true
    }
  ]
})
```

---

## Migration Generation

### Step 4: Determine Migration Numbers

```typescript
// Check existing migrations in both locations
await Bash({ command: 'ls -la migrations/*.sql | tail -5' })
await Bash({ command: `ls -la contents/themes/${themeName}/entities/${entityName}/migrations/*.sql 2>/dev/null || echo "No existing migrations"` })

// Determine next migration number
// Schema migrations: 001, 002, 003...
// Sample data: 100, 101, 102...
```

### Step 5: Generate Migration Files

Based on selected RLS mode, generate migrations from templates:

**For Team Mode:**
```typescript
await Read('core/presets/migrations/team-mode/001_entity_table.sql.template')
await Read('core/presets/migrations/team-mode/002_entity_metas.sql.template')      // If metas selected
await Read('core/presets/migrations/team-mode/003_entity_child.sql.template')      // If has children
await Read('core/presets/migrations/team-mode/100_entity_sample_data.sql.template')
```

**For Private Mode:**
```typescript
await Read('core/presets/migrations/private-mode/001_entity_table.sql.template')
// ... same pattern
```

**For Shared Mode:**
```typescript
await Read('core/presets/migrations/shared-mode/001_entity_table.sql.template')
// ... same pattern
```

**For Public Mode:**
```typescript
await Read('core/presets/migrations/public-mode/001_entity_table.sql.template')
// ... same pattern
```

### Step 6: Create Migration File

**Main Entity Table Template (Team Mode Example):**

```sql
-- Migration: 001_{{ENTITY_NAME}}_table.sql
-- Description: {{ENTITY_NAME_PASCAL}} entity (table, indexes, RLS) - Team Mode
-- Date: {{DATE}}
-- Mode: Team-based isolation

-- ============================================
-- TABLE
-- ============================================
DROP TABLE IF EXISTS public."{{ENTITY_NAME}}" CASCADE;
CREATE TABLE public."{{ENTITY_NAME}}" (
  -- Primary Key
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Relational Fields (ALWAYS these two for team mode)
  "userId"        TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  "teamId"        TEXT NOT NULL REFERENCES public."team"(id) ON DELETE CASCADE,

  -- Entity-specific fields (ADD YOUR FIELDS HERE)
  -- title         TEXT NOT NULL,
  -- slug          TEXT NOT NULL UNIQUE,
  -- description   TEXT,
  -- status        TEXT NOT NULL DEFAULT 'active',

  -- System fields (always last)
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE  public."{{ENTITY_NAME}}"              IS '{{DESCRIPTION}}';
COMMENT ON COLUMN public."{{ENTITY_NAME}}"."userId"     IS 'Creator of this {{ENTITY_NAME_SINGULAR}}';
COMMENT ON COLUMN public."{{ENTITY_NAME}}"."teamId"     IS 'Team that owns this {{ENTITY_NAME_SINGULAR}}';

-- ============================================
-- TRIGGER updatedAt (uses Better Auth function)
-- ============================================
DROP TRIGGER IF EXISTS {{ENTITY_NAME}}_set_updated_at ON public."{{ENTITY_NAME}}";
CREATE TRIGGER {{ENTITY_NAME}}_set_updated_at
BEFORE UPDATE ON public."{{ENTITY_NAME}}"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_{{ENTITY_NAME}}_user_id    ON public."{{ENTITY_NAME}}"("userId");
CREATE INDEX IF NOT EXISTS idx_{{ENTITY_NAME}}_team_id    ON public."{{ENTITY_NAME}}"("teamId");
CREATE INDEX IF NOT EXISTS idx_{{ENTITY_NAME}}_created_at ON public."{{ENTITY_NAME}}"("createdAt" DESC);

-- ============================================
-- RLS (Team Mode)
-- ============================================
ALTER TABLE public."{{ENTITY_NAME}}" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "{{ENTITY_NAME_PASCAL}} team can do all" ON public."{{ENTITY_NAME}}";

CREATE POLICY "{{ENTITY_NAME_PASCAL}} team can do all"
ON public."{{ENTITY_NAME}}"
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
)
WITH CHECK (
  public.is_superadmin()
  OR
  "teamId" = ANY(public.get_user_team_ids())
);
```

### Variable Substitution Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ENTITY_NAME}}` | Plural lowercase | `products` |
| `{{ENTITY_NAME_SINGULAR}}` | Singular lowercase | `product` |
| `{{ENTITY_NAME_PASCAL}}` | PascalCase | `Products` |
| `{{PARENT_ENTITY}}` | Parent entity name | `orders` |
| `{{DATE}}` | Migration date | `2024-01-15` |
| `{{DESCRIPTION}}` | Entity description | `Customer products catalog` |

---

## Step 7: Run Migration

```typescript
// Run the migration
await Bash({
  command: 'pnpm db:migrate',
  description: 'Run database migration'
})

// Verify the tables were created
await Bash({
  command: 'pnpm db:verify',
  description: 'Verify database tables'
})
```

---

## Step 8: Generate TypeScript Types

```typescript
// Types should use camelCase matching database columns
const typePath = `contents/themes/${themeName}/entities/${entityName}/${entityName}.types.ts`

await Write({
  file_path: typePath,
  content: `// Generated types for ${entityName}

export interface ${EntityNamePascal} {
  id: string
  userId: string
  teamId: string
  // Add entity-specific fields
  createdAt: Date
  updatedAt: Date
}

export interface Create${EntityNamePascal}Input {
  // Required fields for creation
}

export interface Update${EntityNamePascal}Input {
  // Optional fields for updates
}
`
})
```

---

## Output Format

```markdown
## Entity Created: {{ENTITY_NAME}}

### RLS Mode
- **Selected:** [Team Mode / Private Mode / Shared Mode / Public Mode]
- **Template:** `core/presets/migrations/{{mode}}/`

### Entity Files Created (4-File Structure)
All entity files in `contents/themes/${themeName}/entities/${entityName}/`:
- `${entityName}.config.ts` - Entity configuration (5 sections)
- `${entityName}.fields.ts` - Field definitions
- `${entityName}.types.ts` - TypeScript interfaces
- `${entityName}.service.ts` - Data access service (static class)
- `messages/en.json` - English translations
- `messages/es.json` - Spanish translations

### Migrations Generated
- `migrations/001_{{ENTITY_NAME}}_table.sql` - Main entity table
- `migrations/002_{{ENTITY_NAME}}_metas.sql` - Metadata table (if selected)
- `migrations/100_{{ENTITY_NAME}}_sample_data.sql` - Sample data

### Tables Created
- `public."{{ENTITY_NAME}}"` - Main entity table
- `public."{{ENTITY_NAME}}_metas"` - Key-value metadata (if selected)

### RLS Policies
- `{{ENTITY_NAME_PASCAL}} team can do all` - Team-based access control

### Indexes
- `idx_{{ENTITY_NAME}}_user_id` - User lookup
- `idx_{{ENTITY_NAME}}_team_id` - Team filtering
- `idx_{{ENTITY_NAME}}_created_at` - Sorting by date

### Next Steps
1. Run `/db:sample` to generate sample data
2. Run `/db:fix` if any migration errors occur
3. Launch `db-validator` to verify migrations
4. Use entity service in API routes: `import { ${EntityName}Service } from '...'`
```

---

## Entity Service Generation

**After creating the entity structure, generate the service file:**

```typescript
// ${entityName}.service.ts template
import { queryOneWithRLS, queryWithRLS } from '@/core/lib/db'
import type { ${EntityName}, ${EntityName}ListOptions, ${EntityName}ListResult } from './${entityName}.types'

export class ${EntityName}Service {
  /**
   * Get a ${entityName} by ID
   */
  static async getById(id: string, userId: string): Promise<${EntityName} | null> {
    // Use queryOneWithRLS for authenticated access
  }

  /**
   * List ${entityName}s with pagination
   */
  static async list(userId: string, options?: ${EntityName}ListOptions): Promise<${EntityName}ListResult> {
    // Use queryWithRLS for authenticated access
  }
}
```

**Reference:** `core/presets/theme/entities/tasks/tasks.service.ts`
**Documentation:** `core/docs/10-backend/05-service-layer.md`

---

## RLS Mode Quick Reference

### Team Mode (Multi-tenant SaaS)
- Users see only their team's data
- `"teamId"` column required
- Uses `public.get_user_team_ids()` function

### Private Mode (Personal Data)
- Users see only their own data
- `"userId"` column required
- No team isolation

### Shared Mode (Collaborative)
- Any authenticated user can access all records
- Good for shared resources, settings
- Still requires authentication

### Public Mode (Blog, CMS)
- Anonymous can read published content
- Authenticated can manage all content
- `published` + `"publishedAt"` columns required

---

## Self-Validation Checklist

Before completing, verify:

### Entity File Structure (4 Required Files)
- [ ] Created `[entity].config.ts` with 5 sections
- [ ] Created `[entity].fields.ts` with business fields only (NO system fields)
- [ ] Created `[entity].types.ts` with TypeScript interfaces
- [ ] Created `[entity].service.ts` with static class pattern
- [ ] Created `messages/en.json` and `messages/es.json`

### Naming Conventions
- [ ] All columns use camelCase: `"userId"`, `"createdAt"`, `"teamId"`
- [ ] Table names are quoted: `public."entityName"`
- [ ] No snake_case anywhere

### Types & Defaults
- [ ] ID is `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`
- [ ] Timestamps are `TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] Foreign keys use `TEXT` (not UUID)

### Structure
- [ ] Field order: id → relational → entity → system
- [ ] Trigger uses `public.set_updated_at()` (Better Auth)
- [ ] Meta tables use `"entityId"` foreign key
- [ ] Child tables use `"parentId"` foreign key

### RLS
- [ ] RLS enabled: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Policy matches selected mode
- [ ] Policy names use PascalCase entity name

### Templates
- [ ] Read template from `core/presets/migrations/{{mode}}/`
- [ ] Substituted all `{{VARIABLE}}` placeholders
- [ ] Section separators: `-- ============================================`

---

**Now generate the entity migration for the entity described above, following ALL conventions above.**
