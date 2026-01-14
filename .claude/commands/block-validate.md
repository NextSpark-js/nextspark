---
description: "[Block] Validate block structure and consistency"
---

# Validate Block

You are validating page builder block(s) for structure and consistency.

**Validation Request:**
{{{ input }}}

---

## Protocol

### Step 1: Determine Theme

Check if `--theme=X` was specified in the input above.

- **If specified:** Use that theme
- **If not specified:** Read `NEXT_PUBLIC_ACTIVE_THEME` from `.env` or `.env.local`
- **If no variable:** Use `"default"`

```bash
grep "NEXT_PUBLIC_ACTIVE_THEME" .env .env.local 2>/dev/null
```

**ALWAYS confirm:** "Validating blocks in theme: {THEME}"

### Step 2: Determine Scope

From the input:
- **If "all"** → Validate ALL blocks in the theme
- **If slug specified** → Validate only that block

```bash
# List all blocks to validate (or just the specified one)
ls contents/themes/{THEME}/blocks/
```

### Step 3: Run Validation

For EACH block, check the following:

---

## Validation Checklist

### 1. File Structure (5 files required)

```bash
# Check files exist
ls contents/themes/{THEME}/blocks/{slug}/
```

- [ ] `config.ts` exists
- [ ] `schema.ts` exists
- [ ] `fields.ts` exists
- [ ] `component.tsx` exists
- [ ] `index.ts` exists

### 2. config.ts Validation

```typescript
// Required fields
{
  slug: string     // Must match directory name
  name: string     // Display name
  category: BlockCategory  // Valid category
  icon: string     // Lucide icon name
  description?: string
  thumbnail?: string
}
```

- [ ] `slug` matches directory name
- [ ] `name` is non-empty
- [ ] `category` is valid (one of 15 categories)
- [ ] `icon` is specified

### 3. schema.ts Validation

```typescript
// Must extend baseBlockSchema
import { baseBlockSchema } from '@/core/types/blocks'

export const schema = baseBlockSchema.merge(z.object({
  // Block-specific fields only
}))

export type {Name}Props = z.infer<typeof schema>
```

- [ ] Imports `baseBlockSchema` from `@/core/types/blocks`
- [ ] Uses `.merge()` to extend (not recreate)
- [ ] Does NOT recreate: title, content, cta, backgroundColor, className, id
- [ ] Exports `schema`
- [ ] Exports Props type

### 4. fields.ts Validation

```typescript
import { baseContentFields, baseDesignFields, baseAdvancedFields } from '@/core/types/blocks'

export const fieldDefinitions: FieldDefinition[] = [
  ...baseContentFields,
  // content fields
  ...baseDesignFields,
  // design fields
  ...baseAdvancedFields,  // MUST be last
]
```

- [ ] Imports base field definitions
- [ ] Uses spread operators for base fields
- [ ] Field order is: Content → Design → Advanced
- [ ] `baseAdvancedFields` is LAST
- [ ] Every schema field has a corresponding field definition
- [ ] Field types match schema types

### 5. component.tsx Validation

```typescript
import { buildSectionClasses } from '@/core/types/blocks'

export function {Name}Block(props: {Name}Props) {
  const sectionClasses = buildSectionClasses('...', {
    backgroundColor: props.backgroundColor,
    className: props.className,
  })

  return (
    <section
      id={props.id}
      className={sectionClasses}
      data-cy="block-{slug}"
    >
```

- [ ] Imports `buildSectionClasses` helper
- [ ] Props type matches schema type name
- [ ] Uses `buildSectionClasses` for section classes
- [ ] Has `data-cy="block-{slug}"` attribute
- [ ] Uses `props.id` for section id
- [ ] Handles optional props safely (with && or ?.)

### 6. index.ts Validation

```typescript
export { config } from './config'
export { fieldDefinitions } from './fields'
export { schema, type {Name}Props } from './schema'
export { {Name}Block } from './component'
```

- [ ] Re-exports `config`
- [ ] Re-exports `fieldDefinitions`
- [ ] Re-exports `schema` and Props type
- [ ] Re-exports component

### 7. Registry Integration

```bash
# Verify block is in registry
node -e "const r = require('./core/lib/registries/block-registry'); console.log(Object.keys(r.BLOCK_REGISTRY))"
```

- [ ] Block slug appears in BLOCK_REGISTRY
- [ ] Category matches config

---

## Output Format

```markdown
## Validation Results: {theme}

### Summary
- **Blocks Validated:** {count}
- **Passed:** {count}
- **Failed:** {count}

---

### {block-slug} - {PASSED/FAILED}

**File Structure:** {5/5 files}
- [x] config.ts
- [x] schema.ts
- [x] fields.ts
- [x] component.tsx
- [x] index.ts

**config.ts:** {PASSED/FAILED}
- [x] slug matches directory
- [x] category is valid
- [x] icon specified

**schema.ts:** {PASSED/FAILED}
- [x] Extends baseBlockSchema
- [x] No recreated base fields
- [ ] Missing field definition for: {field}

**fields.ts:** {PASSED/FAILED}
- [x] Uses base field spreads
- [x] Correct tab order
- [ ] Field "{name}" missing from schema

**component.tsx:** {PASSED/FAILED}
- [x] Uses buildSectionClasses
- [ ] Missing data-cy attribute
- [x] Props type correct

**index.ts:** {PASSED/FAILED}
- [x] All exports present

**Registry:** {PASSED/FAILED}
- [x] Block in BLOCK_REGISTRY

---

### Issues Found

1. **{block-slug}**: {issue description}
   - **Fix:** {how to fix}

2. **{block-slug}**: {issue description}
   - **Fix:** {how to fix}

---

### Recommendations

- {Any general recommendations for improvement}
```

---

**Now validate the block(s) as specified above.**
