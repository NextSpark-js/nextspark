---
description: "[Block] Modify an existing page builder block"
---

# Update Existing Block

You are modifying an existing block in the Page Builder.

**Update Request:**
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

**ALWAYS confirm:** "Updating block in theme: {THEME}"

### Step 2: Identify Block

Extract the block slug from the input.

```bash
# Verify block exists
ls contents/themes/{THEME}/blocks/{slug}/
```

**If block not found:**
```markdown
Block "{slug}" not found in theme "{THEME}".

**Available blocks:**
{list blocks from ls contents/themes/{THEME}/blocks/}

Please specify which block to update.
```

### Step 3: Launch block-developer Agent

Launch the `block-developer` agent with context:

```
Update an existing block:

**Theme:** {determined theme}
**Block Slug:** {extracted slug}
**Location:** contents/themes/{THEME}/blocks/{slug}/

**Requested Changes:**
{from input}

**IMPORTANT:**
1. Read ALL 5 current files to understand existing structure
2. Plan changes to maintain backward compatibility
3. If adding new fields:
   - Add to schema.ts (extend existing schema)
   - Add to fields.ts (in correct tab order)
   - Update component.tsx to use new props
4. If modifying existing fields:
   - Ensure existing data remains valid
   - Consider migration path for existing content
5. Run build-registry after modifications
6. Verify schema ↔ fields ↔ component consistency
```

### Step 4: Verify Update

After agent completes:
- Confirm changes maintain backward compatibility
- Verify build-registry was executed
- Check schema/fields/component are consistent

---

## Output Format

```markdown
## Block Updated: {block-name}

**Theme:** {theme}
**Location:** `contents/themes/{theme}/blocks/{slug}/`

### Changes Made

**schema.ts:**
- {list of schema changes}

**fields.ts:**
- {list of field definition changes}

**component.tsx:**
- {list of component changes}

### Backward Compatibility
- [x] Existing props still work
- [x] Default values provided for new optional fields
- [x] No breaking changes to existing content

### Registry
- [x] `node core/scripts/build/registry.mjs` executed
- [x] Block still appears in BLOCK_REGISTRY

### Testing Recommendations
1. Test existing pages using this block still render
2. Test new functionality works in page editor
3. Verify no TypeScript errors
```

---

## Common Update Patterns

### Adding a New Field

1. **schema.ts**: Add field with `.optional()` and `.default()`
2. **fields.ts**: Add FieldDefinition in correct tab
3. **component.tsx**: Use field with safe fallback

```typescript
// schema.ts - Safe addition
subtitle: z.string().optional().default('')

// fields.ts - In content tab
{ name: 'subtitle', label: 'Subtitle', type: 'text', tab: 'content' }

// component.tsx - Safe usage
{props.subtitle && <p>{props.subtitle}</p>}
```

### Modifying Field Type

**CAUTION:** May break existing content!

1. Consider if change is additive (safe) or breaking
2. If breaking, discuss with user about migration

### Adding Array Field

1. **schema.ts**: Define item schema, then array
2. **fields.ts**: Use `type: 'array'` with `itemFields`
3. **component.tsx**: Map over array with safe defaults

---

**Now update the block as specified above.**
