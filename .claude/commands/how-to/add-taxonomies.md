# /how-to:add-taxonomies

Interactive guide to implementing taxonomies (tags and categories) in NextSpark.

**Aliases:** `/how-to:tags`, `/how-to:categories`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/database-migrations/SKILL.md` - Creating taxonomy tables
- `.claude/skills/entity-system/SKILL.md` - Entity field definitions

---

## Syntax

```
/how-to:add-taxonomies
/how-to:add-taxonomies --type tags
/how-to:add-taxonomies --entity posts
```

---

## Behavior

Guides the user through implementing a taxonomy system with tags, categories, and hierarchical classifications.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding Taxonomies
        └── Tags, categories, hierarchy

Step 2: Taxonomy Table Structure
        └── Fields, constraints, indexes

Step 3: Creating Taxonomy Types
        └── post_category, product_tag, etc.

Step 4: Linking Entities to Taxonomies
        └── Join tables, many-to-many

Step 5: UI Components
        └── Tag selectors, category dropdowns
```

---

## Step 1: Understanding Taxonomies

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: ADD TAXONOMIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding Taxonomies

Taxonomies provide a flexible classification
system for organizing content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 What are Taxonomies?**

```
┌─────────────────────────────────────────────┐
│  TAXONOMY = Classification System           │
│  ─────────────────────────────────────────  │
│                                             │
│  TAGS (flat):                               │
│  [javascript] [react] [nextjs] [tutorial]   │
│                                             │
│  CATEGORIES (hierarchical):                 │
│  Technology                                 │
│  ├── Frontend                               │
│  │   ├── React                              │
│  │   └── Vue                                │
│  └── Backend                                │
│      ├── Node.js                            │
│      └── Python                             │
└─────────────────────────────────────────────┘
```

**📋 Tags vs Categories:**

| Feature | Tags | Categories |
|---------|------|------------|
| Structure | Flat | Hierarchical |
| Multiple per item | Yes (many) | Usually 1-2 |
| User created | Often | Usually admin |
| Purpose | Discovery | Organization |
| Example | #react, #tutorial | Technology > Frontend |

**📋 Common Taxonomy Types:**

| Type | Used For | Example |
|------|----------|---------|
| `post_category` | Blog posts | Technology, Lifestyle |
| `post_tag` | Blog tags | #react, #nextjs |
| `product_category` | E-commerce | Electronics, Clothing |
| `product_tag` | Product tags | #sale, #new |
| `portfolio_type` | Portfolio items | Web, Mobile, Design |
| `skill` | User skills | JavaScript, Design |

**📋 Features:**

```
✓ Hierarchical support (parent-child)
✓ Visual customization (icon, color)
✓ Slug-based URLs (/blog/category/technology)
✓ Ordering support
✓ Soft delete
✓ Metadata storage (JSONB)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Table Structure)
[2] What's the difference from enum fields?
[3] Can users create their own tags?
```

---

## Step 2: Taxonomy Table Structure

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Taxonomy Table Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The taxonomies table provides a flexible
structure for all classification types.
```

**📋 Taxonomies Table Schema:**

```sql
-- migrations/006_taxonomies_table.sql

CREATE TABLE taxonomies (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  userId      TEXT REFERENCES users(id),
  teamId      TEXT REFERENCES teams(id),

  -- Classification
  type        TEXT NOT NULL,          -- 'post_category', 'tag', etc.
  slug        TEXT NOT NULL,          -- URL-friendly: 'my-category'
  name        TEXT NOT NULL,          -- Display name: 'My Category'
  description TEXT,                   -- Optional description

  -- Visual customization
  icon        TEXT,                   -- Lucide icon name
  color       TEXT,                   -- Hex color or name

  -- Hierarchy support
  parentId    TEXT REFERENCES taxonomies(id),

  -- Metadata & ordering
  metadata    JSONB DEFAULT '{}',     -- Flexible extra data
  "order"     INTEGER DEFAULT 0,      -- Manual ordering

  -- Status
  isDefault   BOOLEAN DEFAULT FALSE,  -- Default selection
  isActive    BOOLEAN DEFAULT TRUE,   -- Enable/disable

  -- Timestamps
  createdAt   TIMESTAMPTZ DEFAULT now(),
  updatedAt   TIMESTAMPTZ DEFAULT now(),
  deletedAt   TIMESTAMPTZ,            -- Soft delete

  -- Constraints
  UNIQUE(type, slug, teamId),
  CHECK(slug ~ '^[a-z0-9\-]+$'),
  CHECK(LENGTH(slug) >= 2 AND LENGTH(slug) <= 100),
  CHECK(LENGTH(TRIM(name)) > 0)
);

-- Enable RLS
ALTER TABLE taxonomies ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_taxonomies_type ON taxonomies(type);
CREATE INDEX idx_taxonomies_slug ON taxonomies(slug);
CREATE INDEX idx_taxonomies_team_id ON taxonomies(teamId);
CREATE INDEX idx_taxonomies_parent_id ON taxonomies(parentId);
CREATE INDEX idx_taxonomies_active ON taxonomies(isActive)
  WHERE isActive = TRUE;
```

**📋 Key Fields Explained:**

| Field | Purpose | Example |
|-------|---------|---------|
| `type` | Taxonomy classification | `'post_category'` |
| `slug` | URL-safe identifier | `'web-development'` |
| `name` | Display name | `'Web Development'` |
| `parentId` | Hierarchy support | Links to parent taxonomy |
| `icon` | Visual icon | `'Code'` (Lucide) |
| `color` | Visual color | `'#3B82F6'` |
| `metadata` | Flexible storage | `{ "featured": true }` |
| `order` | Manual sorting | `1, 2, 3...` |

**📋 Slug Validation:**

```sql
-- Only lowercase letters, numbers, and hyphens
CHECK(slug ~ '^[a-z0-9\-]+$')

-- Minimum 2, maximum 100 characters
CHECK(LENGTH(slug) >= 2 AND LENGTH(slug) <= 100)

-- Examples:
-- ✓ 'web-development'
-- ✓ 'react-18'
-- ✗ 'Web Development' (uppercase)
-- ✗ 'web_development' (underscore)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Creating Taxonomy Types)
[2] How do I add RLS policies?
[3] Can taxonomies be global (no team)?
```

---

## Step 3: Creating Taxonomy Types

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Creating Taxonomy Types
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define taxonomy types for different content
classifications in your app.
```

**📋 Sample Data Migration:**

```sql
-- migrations/007_taxonomies_sample_data.sql

-- Post categories (hierarchical)
INSERT INTO taxonomies (type, slug, name, icon, color, "order", teamId)
SELECT
  'post_category',
  slug,
  name,
  icon,
  color,
  row_number() OVER (),
  (SELECT id FROM teams LIMIT 1)
FROM (VALUES
  ('technology', 'Technology', 'Cpu', '#3B82F6'),
  ('lifestyle', 'Lifestyle', 'Heart', '#EC4899'),
  ('business', 'Business', 'Briefcase', '#10B981'),
  ('tutorials', 'Tutorials', 'GraduationCap', '#F59E0B')
) AS t(slug, name, icon, color);

-- Sub-categories (with parent)
INSERT INTO taxonomies (type, slug, name, parentId, teamId)
SELECT
  'post_category',
  slug,
  name,
  (SELECT id FROM taxonomies WHERE slug = parent_slug AND type = 'post_category'),
  (SELECT id FROM teams LIMIT 1)
FROM (VALUES
  ('frontend', 'Frontend', 'technology'),
  ('backend', 'Backend', 'technology'),
  ('devops', 'DevOps', 'technology'),
  ('health', 'Health', 'lifestyle'),
  ('travel', 'Travel', 'lifestyle')
) AS t(slug, name, parent_slug);

-- Post tags (flat)
INSERT INTO taxonomies (type, slug, name, color, teamId)
SELECT
  'post_tag',
  slug,
  name,
  color,
  (SELECT id FROM teams LIMIT 1)
FROM (VALUES
  ('javascript', 'JavaScript', '#F7DF1E'),
  ('react', 'React', '#61DAFB'),
  ('nextjs', 'Next.js', '#000000'),
  ('typescript', 'TypeScript', '#3178C6'),
  ('tutorial', 'Tutorial', '#10B981'),
  ('beginner', 'Beginner', '#8B5CF6')
) AS t(slug, name, color);
```

**📋 Querying Taxonomies:**

```typescript
// Get all categories with children
const categories = await db.query(`
  SELECT
    t.*,
    (
      SELECT json_agg(c.*)
      FROM taxonomies c
      WHERE c.parentId = t.id
      ORDER BY c."order"
    ) as children
  FROM taxonomies t
  WHERE t.type = 'post_category'
    AND t.parentId IS NULL
    AND t.isActive = true
    AND t.teamId = $1
  ORDER BY t."order"
`, [teamId])

// Result:
// [
//   {
//     id: '...',
//     name: 'Technology',
//     slug: 'technology',
//     children: [
//       { name: 'Frontend', slug: 'frontend' },
//       { name: 'Backend', slug: 'backend' }
//     ]
//   },
//   ...
// ]
```

**📋 Taxonomy Service:**

```typescript
// lib/services/taxonomy.service.ts
export class TaxonomyService {
  static async getByType(type: string, teamId: string) {
    return db.query(
      'SELECT * FROM taxonomies WHERE type = $1 AND teamId = $2 AND isActive = true ORDER BY "order"',
      [type, teamId]
    )
  }

  static async getHierarchy(type: string, teamId: string) {
    const all = await this.getByType(type, teamId)
    return buildTree(all) // Helper to build nested structure
  }

  static async create(data: CreateTaxonomyInput) {
    const slug = slugify(data.name)
    return db.query(
      'INSERT INTO taxonomies (type, slug, name, teamId, ...) VALUES ($1, $2, $3, $4, ...) RETURNING *',
      [data.type, slug, data.name, data.teamId, ...]
    )
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Linking Entities)
[2] How do I auto-generate slugs?
[3] Can I import taxonomies from a file?
```

---

## Step 4: Linking Entities to Taxonomies

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Linking Entities to Taxonomies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Connect entities to taxonomies using
join tables for many-to-many relationships.
```

**📋 Entity-Taxonomy Relations Table:**

```sql
-- migrations/008_entity_taxonomy_relations.sql

CREATE TABLE entity_taxonomy_relations (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Entity reference (polymorphic)
  entityType  TEXT NOT NULL,          -- 'posts', 'products', etc.
  entityId    TEXT NOT NULL,          -- ID of the entity

  -- Taxonomy reference
  taxonomyId  TEXT NOT NULL REFERENCES taxonomies(id) ON DELETE CASCADE,

  -- Ordering within entity
  "order"     INTEGER DEFAULT 0,

  -- Timestamps
  createdAt   TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(entityType, entityId, taxonomyId)
);

-- Indexes
CREATE INDEX idx_etr_entity ON entity_taxonomy_relations(entityType, entityId);
CREATE INDEX idx_etr_taxonomy ON entity_taxonomy_relations(taxonomyId);
```

**📋 Alternative: Direct Foreign Key:**

```sql
-- For single category per entity
ALTER TABLE posts ADD COLUMN categoryId TEXT REFERENCES taxonomies(id);

-- For multiple tags (JSONB array)
ALTER TABLE posts ADD COLUMN tagIds TEXT[] DEFAULT '{}';
```

**📋 Linking Examples:**

```typescript
// Add category to post
await db.query(`
  INSERT INTO entity_taxonomy_relations (entityType, entityId, taxonomyId)
  VALUES ('posts', $1, $2)
`, [postId, categoryId])

// Add multiple tags
const tagIds = ['tag-1', 'tag-2', 'tag-3']
for (const tagId of tagIds) {
  await db.query(`
    INSERT INTO entity_taxonomy_relations (entityType, entityId, taxonomyId)
    VALUES ('posts', $1, $2)
    ON CONFLICT (entityType, entityId, taxonomyId) DO NOTHING
  `, [postId, tagId])
}

// Remove tag from post
await db.query(`
  DELETE FROM entity_taxonomy_relations
  WHERE entityType = 'posts' AND entityId = $1 AND taxonomyId = $2
`, [postId, tagId])
```

**📋 Query with Taxonomies:**

```typescript
// Get posts with their categories and tags
const posts = await db.query(`
  SELECT
    p.*,
    (
      SELECT json_agg(t.*)
      FROM entity_taxonomy_relations etr
      JOIN taxonomies t ON t.id = etr.taxonomyId
      WHERE etr.entityType = 'posts'
        AND etr.entityId = p.id
        AND t.type = 'post_category'
    ) as categories,
    (
      SELECT json_agg(t.*)
      FROM entity_taxonomy_relations etr
      JOIN taxonomies t ON t.id = etr.taxonomyId
      WHERE etr.entityType = 'posts'
        AND etr.entityId = p.id
        AND t.type = 'post_tag'
    ) as tags
  FROM posts p
  WHERE p.teamId = $1
`, [teamId])
```

**📋 Filter by Taxonomy:**

```typescript
// Get posts in a specific category
const posts = await db.query(`
  SELECT p.*
  FROM posts p
  WHERE p.id IN (
    SELECT etr.entityId
    FROM entity_taxonomy_relations etr
    JOIN taxonomies t ON t.id = etr.taxonomyId
    WHERE etr.entityType = 'posts'
      AND t.slug = $1
      AND t.type = 'post_category'
  )
`, [categorySlug])

// Get posts with specific tag
// GET /api/v1/posts?tag=react
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (UI Components)
[2] How do I handle taxonomy counts?
[3] Can I have required taxonomies?
```

---

## Step 5: UI Components

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: UI Components
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create UI components for selecting and
displaying taxonomies.
```

**📋 Category Select Component:**

```typescript
// components/CategorySelect.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select'

interface Props {
  value: string
  onChange: (value: string) => void
  type: string
  teamId: string
}

export function CategorySelect({ value, onChange, type, teamId }: Props) {
  const { data: categories } = useQuery({
    queryKey: ['taxonomies', type, teamId],
    queryFn: () => fetch(`/api/v1/taxonomies?type=${type}`).then(r => r.json())
  })

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        {categories?.data?.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.icon && <span className="mr-2">{cat.icon}</span>}
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

**📋 Tag Multi-Select Component:**

```typescript
// components/TagSelect.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/core/components/ui/badge'
import { X } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
  type: string
}

export function TagSelect({ value, onChange, type }: Props) {
  const [search, setSearch] = useState('')

  const { data: tags } = useQuery({
    queryKey: ['taxonomies', type],
    queryFn: () => fetch(`/api/v1/taxonomies?type=${type}`).then(r => r.json())
  })

  const selectedTags = tags?.data?.filter(t => value.includes(t.id)) || []
  const availableTags = tags?.data?.filter(t =>
    !value.includes(t.id) &&
    t.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const addTag = (tagId: string) => {
    onChange([...value, tagId])
  }

  const removeTag = (tagId: string) => {
    onChange(value.filter(id => id !== tagId))
  }

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <X
              className="ml-1 h-3 w-3 cursor-pointer"
              onClick={() => removeTag(tag.id)}
            />
          </Badge>
        ))}
      </div>

      {/* Search and select */}
      <input
        type="text"
        placeholder="Search tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />

      {/* Available tags */}
      {search && (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="cursor-pointer"
              onClick={() => addTag(tag.id)}
            >
              + {tag.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
```

**📋 Entity Field Type:**

```typescript
// In entity fields definition
{
  name: 'categoryId',
  type: 'taxonomy',
  taxonomyType: 'post_category',
  required: true,
  display: {
    label: 'Category',
    showInList: true,
    showInForm: true,
  }
},
{
  name: 'tagIds',
  type: 'taxonomy-multi',
  taxonomyType: 'post_tag',
  required: false,
  display: {
    label: 'Tags',
    showInList: true,
    showInForm: true,
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Taxonomy system concepts
• Table structure with hierarchy
• Creating taxonomy types
• Entity-taxonomy relationships
• UI components for selection

📚 Related tutorials:
   • /how-to:create-entity - Create entities with taxonomies
   • /how-to:create-migrations - Database setup
   • /how-to:implement-search - Filter by taxonomy

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "What's the difference from enum fields?"

```
📋 Taxonomies vs Enum Fields:

ENUM FIELDS:
• Hardcoded in schema
• Requires code change to modify
• Type-safe at compile time
• Limited options (5-10 typically)
• Example: status: 'draft' | 'published' | 'archived'

TAXONOMIES:
• Stored in database
• Modified at runtime (admin UI)
• Unlimited options
• Can be user-created
• Support hierarchy
• Have metadata (icon, color, description)
• Example: categories, tags, skills

USE ENUM FOR:
✓ Fixed, known options
✓ Business logic (status, priority)
✓ Type safety needed

USE TAXONOMY FOR:
✓ User-defined classifications
✓ Content organization
✓ Variable number of options
✓ Need hierarchy
✓ Visual customization
```

### "How do I handle taxonomy counts?"

```
📋 Taxonomy Counts:

Add a count column or compute dynamically:

OPTION 1: Computed (always accurate)

SELECT
  t.*,
  (
    SELECT COUNT(*)
    FROM entity_taxonomy_relations etr
    WHERE etr.taxonomyId = t.id
  ) as postCount
FROM taxonomies t
WHERE t.type = 'post_category';

OPTION 2: Cached (faster, needs updates)

ALTER TABLE taxonomies ADD COLUMN entityCount INTEGER DEFAULT 0;

-- Update on insert
CREATE OR REPLACE FUNCTION update_taxonomy_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE taxonomies
    SET entityCount = entityCount + 1
    WHERE id = NEW.taxonomyId;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE taxonomies
    SET entityCount = entityCount - 1
    WHERE id = OLD.taxonomyId;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER taxonomy_count_trigger
AFTER INSERT OR DELETE ON entity_taxonomy_relations
FOR EACH ROW EXECUTE FUNCTION update_taxonomy_count();
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:create-entity` | Create entities with taxonomy fields |
| `/how-to:create-migrations` | Database setup |
| `/how-to:implement-search` | Filter by taxonomy |
| `/how-to:create-child-entities` | Taxonomies for child entities |
